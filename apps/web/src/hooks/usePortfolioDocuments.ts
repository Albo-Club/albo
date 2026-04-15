import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import {
  downloadFromPortfolioStorage,
  removeFromPortfolioStorage,
} from '@/lib/portfolioStorage';

export interface PortfolioDocument {
  id: string;
  company_id: string;
  type: 'folder' | 'file';
  name: string;
  parent_id: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  original_file_name: string | null;
  report_file_id: string | null;
  text_content: string | null;
  source_report_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  source_bucket?: string; // Optional: indicates the source storage bucket
  is_archived?: boolean;
}


export interface DocumentTreeNode extends PortfolioDocument {
  children: DocumentTreeNode[];
}

function buildDocumentTree(documents: PortfolioDocument[]): DocumentTreeNode[] {
  const nodeMap = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  // Create nodes with empty children arrays
  documents.forEach(doc => {
    nodeMap.set(doc.id, { ...doc, children: [] });
  });

  // Build tree structure
  documents.forEach(doc => {
    const node = nodeMap.get(doc.id)!;
    if (doc.parent_id && nodeMap.has(doc.parent_id)) {
      nodeMap.get(doc.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children: folders first, then files alphabetically
  const sortNodes = (nodes: DocumentTreeNode[]) => {
    nodes.sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
    .replace(/_+/g, '_') // Collapse multiple underscores
    .toLowerCase();
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

export function usePortfolioDocuments(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['portfolio-documents', companyId];

  // Fetch documents and inject report_files into the Reporting folder
  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Fetch existing portfolio_documents (including archived)
      const { data: docs, error: docsError } = await supabase
        .from('portfolio_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (docsError) throw docsError;

      // Get IDs of report_files linked in ALL docs (including archived)
      // so archived docs don't reappear as virtual report_file entries
      const linkedReportFileIds = ((docs || []) as PortfolioDocument[])
        .filter(d => d.report_file_id !== null)
        .map(d => d.report_file_id!);

      // Hide archived/orphaned documents + filter out image files
      const allDocs = ((docs || []) as PortfolioDocument[]).filter(
        doc => doc.is_archived !== true && (doc.type === 'folder' || !doc.mime_type?.startsWith('image/'))
      );

      // 2. Find the "Reporting" folder for this company
      const reportingFolder = allDocs.find(
        d => d.type === 'folder' && d.name === 'Reporting' && d.parent_id === null
      );

      // If no Reporting folder exists, return docs as-is
      if (!reportingFolder) return allDocs;

      // 4. Fetch report_files for this company that are NOT already linked
      const { data: reportFiles, error: rfError } = await supabase
        .from('report_files')
        .select(`
          id,
          file_name,
          original_file_name,
          storage_path,
          mime_type,
          file_size_bytes,
          file_type,
          created_at,
          report_id,
          company_reports!inner (
            company_id,
            is_duplicate,
            report_period,
            report_date
          )
        `)
        .eq('company_reports.company_id', companyId)
        .eq('company_reports.is_duplicate', false)
        .eq('company_reports.is_archived', false); // Hide archived/orphaned reports

      if (rfError) {
        console.error('Error fetching report_files:', rfError);
        return allDocs; // Fallback: return docs without report files
      }

      // 5. Filter out already-linked files and transform into PortfolioDocument shape
      const unlinkedReportFiles = (reportFiles || [])
        .filter(rf => !linkedReportFileIds.includes(rf.id))
        .map(rf => {
          const displayName = rf.original_file_name || rf.file_name || 'Report';

          return {
            id: `rf-${rf.id}`, // Prefix to distinguish from real portfolio_documents
            company_id: companyId,
            type: 'file' as const,
            name: displayName,
            parent_id: reportingFolder.id, // Place inside Reporting folder
            storage_path: rf.storage_path,
            mime_type: rf.mime_type || 'application/pdf',
            file_size_bytes: rf.file_size_bytes,
            original_file_name: rf.original_file_name || rf.file_name,
            report_file_id: rf.id,
            text_content: null,
            source_report_id: rf.report_id,
            source_bucket: 'report-files', // IMPORTANT: tells download/preview to use this bucket
            created_by: null,
            created_at: rf.created_at,
            updated_at: rf.created_at,
          } as PortfolioDocument;
        });

      // 6. Merge and return
      return [...allDocs, ...unlinkedReportFiles];
    },
    enabled: !!companyId,
  });

  // Build tree from flat list
  const documentTree = buildDocumentTree(documents);

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId?: string | null }) => {
      if (!companyId) throw new Error('Company ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('portfolio_documents')
        .insert({
          company_id: companyId,
          type: 'folder',
          name,
          parent_id: parentId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PortfolioDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Dossier créé avec succès');
    },
    onError: (error) => {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      file,
      parentId,
      reportFileId,
    }: {
      file: File;
      parentId?: string | null;
      reportFileId?: string | null;
    }) => {
      if (!companyId) throw new Error('Company ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build storage path
      const timestamp = Date.now();
      const ext = getFileExtension(file.name);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const sanitizedName = sanitizeFileName(baseName);
      const storagePath = `${companyId}/${timestamp}_${sanitizedName}${ext ? `.${ext}` : ''}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('portfolio-documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      // Deck embedding is handled automatically by a DB trigger + Trigger.dev task
      const { data, error } = await supabase
        .from('portfolio_documents')
        .insert({
          company_id: companyId,
          type: 'file',
          name: file.name,
          parent_id: parentId || null,
          storage_path: storagePath,
          mime_type: file.type || null,
          file_size_bytes: file.size,
          original_file_name: file.name,
          report_file_id: reportFileId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return data as PortfolioDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Fichier uploadé avec succès');
    },
    onError: (error) => {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors de l\'upload du fichier');
    },
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ documentId, newName }: { documentId: string; newName: string }) => {
      const { data, error } = await supabase
        .from('portfolio_documents')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return data as PortfolioDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Renommé avec succès');
    },
    onError: (error) => {
      console.error('Error renaming:', error);
      toast.error('Erreur lors du renommage');
    },
  });

  // Move mutation
  const moveMutation = useMutation({
    mutationFn: async ({
      documentId,
      newParentId,
      newParentName,
    }: {
      documentId: string;
      newParentId: string | null;
      newParentName?: string | null;
    }) => {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');
      if (doc.type !== 'file' || documentId.startsWith('rf-')) {
        throw new Error('Only real files can be moved');
      }

      const { data, error } = await supabase
        .from('portfolio_documents')
        .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return { document: data as PortfolioDocument, newParentName };
    },
    onSuccess: ({ newParentName }) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(
        newParentName
          ? i18n.t('companyDetail.documents.moveSuccessFolder', { folder: newParentName })
          : i18n.t('companyDetail.documents.moveSuccessRoot')
      );
    },
    onError: (error) => {
      console.error('Error moving:', error);
      toast.error(i18n.t('companyDetail.documents.moveError'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      const isVirtual = documentId.startsWith('rf-');
      if (isVirtual) {
        throw new Error(i18n.t('companyDetail.documents.virtualFileDeleteForbidden'));
      }

      if (doc.type === 'folder') {
        const hasChildren = documents.some(d => d.parent_id === documentId);
        if (hasChildren) {
          throw new Error(i18n.t('companyDetail.documents.folderNotEmpty'));
        }

        const { error } = await supabase
          .from('portfolio_documents')
          .delete()
          .eq('id', documentId);

        if (error) throw error;
        return doc;
      }

      if (doc.storage_path) {
        await removeFromPortfolioStorage(doc.storage_path, doc.source_bucket ?? 'portfolio-documents');
      }

      const { error } = await supabase
        .from('portfolio_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(i18n.t('companyDetail.documents.deleteSuccess'));
    },
    onError: (error) => {
      console.error('Error deleting:', error);
      toast.error(error instanceof Error ? error.message : i18n.t('companyDetail.documents.deleteError'));
    },
  });

  // Download file helper
  const downloadFile = async (doc: PortfolioDocument) => {
    try {
      let blob: Blob;
      const fileName = doc.original_file_name || doc.name;

      if (doc.storage_path) {
        const result = await downloadFromPortfolioStorage(
          doc.storage_path,
          doc.source_bucket ?? 'portfolio-documents'
        );
        blob = result.data;
      } else if (doc.text_content) {
        blob = new Blob([doc.text_content], { type: 'text/plain;charset=utf-8' });
      } else {
        toast.error(i18n.t('companyDetail.documents.noFileAttached'));
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(i18n.t('companyDetail.documents.downloadError'));
    }
  };

  // Update document content mutation (syncs to company_reports if linked)
  const updateContentMutation = useMutation({
    mutationFn: async ({ documentId, content }: { documentId: string; content: string }) => {
      // Update portfolio_documents.text_content
      const { data: doc, error: docError } = await supabase
        .from('portfolio_documents')
        .update({ 
          text_content: content,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select('source_report_id')
        .single();

      if (docError) throw docError;

      // If linked to a report, also update company_reports.cleaned_content
      if (doc?.source_report_id) {
        const { error: reportError } = await supabase
          .from('company_reports')
          .update({ 
            cleaned_content: content,
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.source_report_id);

        if (reportError) throw reportError;
      }

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Contenu mis à jour');
    },
    onError: (error) => {
      console.error('Error updating content:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  return {
    // Data
    documents,
    documentTree,
    isLoading,
    error,

    // Mutations
    createFolder: createFolderMutation.mutateAsync,
    uploadFile: uploadFileMutation.mutateAsync,
    rename: renameMutation.mutateAsync,
    move: moveMutation.mutateAsync,
    deleteDocument: deleteMutation.mutateAsync,

    // Loading states
    isCreatingFolder: createFolderMutation.isPending,
    isUploadingFile: uploadFileMutation.isPending,
    isRenaming: renameMutation.isPending,
    isMoving: moveMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Content update
    updateContent: updateContentMutation.mutateAsync,
    isUpdatingContent: updateContentMutation.isPending,

    // Helpers
    downloadFile,
  };
}

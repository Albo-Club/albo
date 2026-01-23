import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PortfolioDocument {
  id: string;
  company_id: string;
  type: 'folder' | 'file' | 'synthesis';
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
  // Virtual synthesis fields
  is_virtual?: boolean;
  report_period?: string;
  cleaned_content?: string;
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

  // Sort children: folders first, then synthesis, then alphabetically
  const sortNodes = (nodes: DocumentTreeNode[]) => {
    nodes.sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      // Then synthesis files
      if (a.type === 'synthesis' && b.type !== 'synthesis') return 1;
      if (a.type !== 'synthesis' && b.type === 'synthesis') return -1;
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

  // Fetch documents AND reports with syntheses
  const {
    data: documentsData = { documents: [], syntheses: [] },
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!companyId) return { documents: [], syntheses: [] };

      // Fetch documents
      const { data: docs, error: docsError } = await supabase
        .from('portfolio_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (docsError) throw docsError;

      // Fetch reports with cleaned_content for virtual synthesis files
      const { data: reports, error: reportsError } = await supabase
        .from('company_reports')
        .select('id, report_period, cleaned_content, processing_status, created_at')
        .eq('company_id', companyId)
        .eq('processing_status', 'completed')
        .not('cleaned_content', 'is', null);

      if (reportsError) throw reportsError;

      return { 
        documents: docs as PortfolioDocument[], 
        syntheses: reports || [] 
      };
    },
    enabled: !!companyId,
  });

  // Merge real documents with virtual synthesis files
  const documents = (() => {
    const realDocs = documentsData.documents;
    const syntheses = documentsData.syntheses;

    // Find or create Reporting folder structure
    const reportingFolder = realDocs.find(d => d.type === 'folder' && d.name === 'Reporting' && !d.parent_id);
    
    // Create virtual synthesis files for each report
    const virtualSyntheses: PortfolioDocument[] = syntheses.map(report => {
      // Find the folder for this report period
      const periodFolder = realDocs.find(d => 
        d.type === 'folder' && 
        d.name === report.report_period &&
        d.parent_id === reportingFolder?.id
      );

      return {
        id: `synthesis-${report.id}`,
        company_id: companyId!,
        type: 'synthesis' as const,
        name: 'Synthèse.md',
        parent_id: periodFolder?.id || reportingFolder?.id || null,
        storage_path: null,
        mime_type: 'text/markdown',
        file_size_bytes: report.cleaned_content?.length || 0,
        original_file_name: 'Synthèse.md',
        report_file_id: null,
        text_content: null,
        source_report_id: report.id,
        created_by: null,
        created_at: report.created_at,
        updated_at: report.created_at,
        is_virtual: true,
        report_period: report.report_period,
        cleaned_content: report.cleaned_content,
      };
    });

    return [...realDocs, ...virtualSyntheses];
  })();

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
    mutationFn: async ({ documentId, newParentId }: { documentId: string; newParentId: string | null }) => {
      const { data, error } = await supabase
        .from('portfolio_documents')
        .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return data as PortfolioDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Déplacé avec succès');
    },
    onError: (error) => {
      console.error('Error moving:', error);
      toast.error('Erreur lors du déplacement');
    },
  });

  // Delete mutation (recursive for folders)
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      // Get the document to check if it's a folder
      const doc = documents.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      // Collect all IDs to delete (recursive for folders)
      const idsToDelete: string[] = [];
      const pathsToDelete: string[] = [];

      const collectChildren = (id: string) => {
        idsToDelete.push(id);
        const item = documents.find(d => d.id === id);
        if (item?.storage_path) {
          pathsToDelete.push(item.storage_path);
        }
        // Find children
        documents
          .filter(d => d.parent_id === id)
          .forEach(child => collectChildren(child.id));
      };

      collectChildren(documentId);

      // Delete files from storage
      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('portfolio-documents')
          .remove(pathsToDelete);
        
        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Continue with DB deletion even if storage fails
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('portfolio_documents')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;
      return idsToDelete;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Supprimé avec succès');
    },
    onError: (error) => {
      console.error('Error deleting:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  // Download file helper
  const downloadFile = async (doc: PortfolioDocument) => {
    try {
      let blob: Blob;
      let fileName = doc.original_file_name || doc.name;

      // Case 1: File has text_content (like Synthèse.txt)
      if (doc.text_content) {
        blob = new Blob([doc.text_content], { type: 'text/plain;charset=utf-8' });
      }
      // Case 2: File has storage_path
      else if (doc.storage_path) {
        // Try portfolio-documents bucket first
        let { data, error } = await supabase.storage
          .from('portfolio-documents')
          .download(doc.storage_path);

        // If error, try report-files bucket
        if (error) {
          console.log('Trying report-files bucket...');
          const result = await supabase.storage
            .from('report-files')
            .download(doc.storage_path);
          
          if (result.error) throw result.error;
          data = result.data;
        }

        if (!data) throw new Error('No data received');
        blob = data;
      } else {
        toast.error('Aucun fichier associé');
        return;
      }

      // Create download link
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
      toast.error('Erreur lors du téléchargement');
    }
  };

  // Get synthesis content by document id
  const getSynthesisContent = (docId: string): { reportPeriod: string; content: string } | null => {
    const doc = documents.find(d => d.id === docId);
    if (!doc || doc.type !== 'synthesis') return null;
    return {
      reportPeriod: doc.report_period || 'Report',
      content: doc.cleaned_content || '',
    };
  };

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

    // Helpers
    downloadFile,
    getSynthesisContent,
  };
}

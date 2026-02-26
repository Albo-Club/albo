import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

      // 1. Fetch existing portfolio_documents
      const { data: docs, error: docsError } = await supabase
        .from('portfolio_documents')
        .select('*')
        .eq('company_id', companyId)
        .neq('is_archived', true)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (docsError) throw docsError;
      const allDocs = (docs || []) as PortfolioDocument[];

      // 2. Find the "Reporting" folder for this company
      const reportingFolder = allDocs.find(
        d => d.type === 'folder' && d.name === 'Reporting' && d.parent_id === null
      );

      // If no Reporting folder exists, return docs as-is
      if (!reportingFolder) return allDocs;

      // 3. Get IDs of report_files already linked in portfolio_documents
      const linkedReportFileIds = allDocs
        .filter(d => d.report_file_id !== null)
        .map(d => d.report_file_id!);

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
            report_period,
            report_date
          )
        `)
        .eq('company_reports.company_id', companyId);

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

  // Webhook URL for deck embedding
  const N8N_DECK_EMBEDDING_WEBHOOK = 'https://n8n.alboteam.com/webhook/deck-embedding';

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
      
      // ============================================
      // DECK EMBEDDING: Détecter si c'est un upload dans le dossier "Deck"
      // ============================================
      if (parentId && file.type === 'application/pdf') {
        // Vérifier si le parent est le dossier "Deck"
        const { data: parentFolder } = await supabase
          .from('portfolio_documents')
          .select('name')
          .eq('id', parentId)
          .single();
        
        if (parentFolder?.name === 'Deck') {
          console.log('📂 PDF uploaded to Deck folder. Initiating embedding process...');
          
          // Afficher le toast de chargement persistant
          const toastId = toast.loading("Deck en cours d'ajout...", {
            description: file.name,
          });
          
          // Récupérer l'entrée deck_embeddings créée par le trigger
          // On attend un peu pour laisser le trigger s'exécuter
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: deckEmbedding } = await supabase
            .from('deck_embeddings')
            .select('id')
            .eq('document_id', data.id)
            .single();
          
          if (deckEmbedding) {
            // Récupérer le nom de la company
            const { data: company } = await supabase
              .from('portfolio_companies')
              .select('company_name')
              .eq('id', companyId)
              .single();
            
            // Appeler le webhook N8N avec FormData (comme SubmitDeal.tsx)
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('deck_embedding_id', deckEmbedding.id);
              formData.append('company_id', companyId);
              formData.append('company_name', company?.company_name || 'Unknown');
              formData.append('document_id', data.id);
              formData.append('file_name', file.name);
              formData.append('storage_path', storagePath);
              formData.append('event', 'deck_uploaded');
              
              console.log('📤 Calling N8N webhook for deck embedding with FormData:', {
                deck_embedding_id: deckEmbedding.id,
                company_id: companyId,
                company_name: company?.company_name || 'Unknown',
                document_id: data.id,
                file_name: file.name,
                storage_path: storagePath,
                event: 'deck_uploaded'
              });
              
              const response = await fetch(N8N_DECK_EMBEDDING_WEBHOOK, {
                method: 'POST',
                body: formData,
                // Ne pas mettre Content-Type, le browser le gère automatiquement pour FormData
              });
              
              if (!response.ok) {
                console.error('❌ N8N webhook failed:', response.status, await response.text());
                toast.error("Erreur lors de l'ajout du deck", {
                  id: toastId,
                  description: "Le traitement a échoué. Veuillez réessayer.",
                  duration: 8000,
                });
              } else {
                console.log('✅ N8N webhook called successfully');
                toast.success("Ajout réussi !", {
                  id: toastId,
                  description: "Vous pouvez dès à présent discuter avec ce document.",
                  duration: 5000,
                });
              }
            } catch (webhookError) {
              console.error('❌ Error calling N8N webhook:', webhookError);
              toast.error("Erreur lors de l'ajout du deck", {
                id: toastId,
                description: "Veuillez vérifier votre connexion et réessayer.",
                duration: 8000,
              });
            }
          } else {
            console.warn('⚠️ No deck_embedding entry found for document:', data.id);
            toast.error("Erreur lors de l'ajout du deck", {
              id: toastId,
              description: "L'enregistrement n'a pas pu être créé.",
              duration: 8000,
            });
          }
        }
      }
      // ============================================
      
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

  // Delete mutation (soft-delete via is_archived for portfolio_documents, or mark report_files)
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      // For virtual report files (rf- prefix), we archive them differently
      const isVirtual = documentId.startsWith('rf-');

      if (isVirtual) {
        // Extract real report_file id
        const realId = documentId.replace('rf-', '');
        // Soft-delete via is_archived on report_files
        const { error } = await supabase
          .from('report_files')
          .update({ is_archived: true })
          .eq('id', realId);
        if (error) throw error;
        return [documentId];
      }

      // Collect all IDs to archive (recursive for folders)
      const idsToArchive: string[] = [];

      const collectChildren = (id: string) => {
        idsToArchive.push(id);
        documents
          .filter(d => d.parent_id === id)
          .forEach(child => collectChildren(child.id));
      };

      collectChildren(documentId);

      // Soft-delete: set is_archived = true
      const { error } = await supabase
        .from('portfolio_documents')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .in('id', idsToArchive);

      if (error) throw error;
      return idsToArchive;
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

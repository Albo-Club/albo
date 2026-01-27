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

  // Fetch documents only (no virtual synthesis files)
  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!companyId) return [];

      // Fetch documents only
      const { data: docs, error: docsError } = await supabase
        .from('portfolio_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (docsError) throw docsError;
      return docs as PortfolioDocument[];
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
            
            // Récupérer l'URL signée du fichier (valide 1h)
            const { data: signedUrlData } = await supabase.storage
              .from('portfolio-documents')
              .createSignedUrl(storagePath, 3600); // 1 heure
            
            // Appeler le webhook N8N
            try {
              const webhookPayload = {
                deck_embedding_id: deckEmbedding.id,
                company_id: companyId,
                company_name: company?.company_name || 'Unknown',
                document_id: data.id,
                file_name: file.name,
                storage_path: storagePath,
                signed_url: signedUrlData?.signedUrl || null,
                event: 'deck_uploaded'
              };
              
              console.log('📤 Calling N8N webhook for deck embedding:', webhookPayload);
              
              const response = await fetch(N8N_DECK_EMBEDDING_WEBHOOK, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload),
              });
              
              if (!response.ok) {
                console.error('N8N webhook failed:', response.status);
                // On ne throw pas l'erreur pour ne pas bloquer l'upload
                // L'embedding pourra être relancé manuellement si nécessaire
              } else {
                console.log('✅ N8N webhook called successfully');
              }
            } catch (webhookError) {
              console.error('Error calling N8N webhook:', webhookError);
              // Idem, on ne bloque pas l'upload
            }
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

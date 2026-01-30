import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DealDocument {
  id: string;
  deal_id: string;
  file_name: string;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  base64_content: string | null;
  sender_email: string | null;
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

export function useDealDocuments(dealId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['deal-documents', dealId];

  // Fetch documents for this deal
  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!dealId) return [];

      const { data, error } = await supabase
        .from('deck_files')
        .select('*')
        .eq('deal_id', dealId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as DealDocument[];
    },
    enabled: !!dealId,
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!dealId) throw new Error('Deal ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build storage path: {user.email}/{dealId}/{filename}
      const timestamp = Date.now();
      const ext = getFileExtension(file.name);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const sanitizedName = sanitizeFileName(baseName);
      const storagePath = `${user.email}/${dealId}/${timestamp}_${sanitizedName}${ext ? `.${ext}` : ''}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('deck-files')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error } = await supabase
        .from('deck_files')
        .insert({
          deal_id: dealId,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          file_size_bytes: file.size,
          sender_email: user.email,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DealDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Fichier uploadé avec succès');
    },
    onError: (error) => {
      console.error('Error uploading file:', error);
      toast.error("Erreur lors de l'upload du fichier");
    },
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ documentId, newName }: { documentId: string; newName: string }) => {
      const { data, error } = await supabase
        .from('deck_files')
        .update({ file_name: newName })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return data as DealDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Fichier renommé avec succès');
    },
    onError: (error) => {
      console.error('Error renaming:', error);
      toast.error('Erreur lors du renommage');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      // Get the document to find storage path
      const doc = documents.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      // Delete from storage if path exists
      if (doc.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('deck-files')
          .remove([doc.storage_path]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Continue with DB deletion even if storage fails
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('deck_files')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return documentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Fichier supprimé avec succès');
    },
    onError: (error) => {
      console.error('Error deleting:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  // Download file helper
  const downloadFile = async (doc: DealDocument) => {
    try {
      let blob: Blob;
      const fileName = doc.file_name;

      if (doc.storage_path) {
        const { data, error } = await supabase.storage
          .from('deck-files')
          .download(doc.storage_path);

        if (error) throw error;
        if (!data) throw new Error('No data received');
        blob = data;
      } else if (doc.base64_content) {
        // Legacy fallback for base64 content
        const binaryString = atob(doc.base64_content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: doc.mime_type || 'application/pdf' });
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

  // Open in new tab helper
  const openInNewTab = async (doc: DealDocument) => {
    try {
      if (doc.storage_path) {
        const { data, error } = await supabase.storage
          .from('deck-files')
          .createSignedUrl(doc.storage_path, 300); // 5 minutes

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('Failed to create signed URL');

        window.open(data.signedUrl, '_blank');
      } else if (doc.base64_content) {
        const binaryString = atob(doc.base64_content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: doc.mime_type || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        toast.error('Aucun fichier associé');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast.error("Erreur lors de l'ouverture");
    }
  };

  return {
    documents,
    isLoading,
    error,
    uploadFile: uploadFileMutation.mutate,
    isUploading: uploadFileMutation.isPending,
    renameFile: renameMutation.mutate,
    isRenaming: renameMutation.isPending,
    deleteFile: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    downloadFile,
    openInNewTab,
  };
}

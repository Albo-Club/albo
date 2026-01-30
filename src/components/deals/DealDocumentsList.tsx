import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Upload,
  MoreHorizontal,
  Download,
  Pencil,
  Trash2,
  File,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  Eye,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useDealDocuments, DealDocument } from '@/hooks/useDealDocuments';
import { DealDocumentPreviewModal } from './DealDocumentPreviewModal';

interface DealDocumentsListProps {
  dealId: string;
}

// Helper: get file icon and badge info based on mime type and name
function getFileIconInfo(mimeType: string | null, fileName: string): {
  icon: typeof File;
  badge?: { text: string; color: string };
} {
  const name = fileName.toLowerCase();
  const mime = mimeType?.toLowerCase() || '';

  // PDF
  if (name.endsWith('.pdf') || mime.includes('pdf')) {
    return { icon: FileText, badge: { text: 'PDF', color: 'bg-red-500' } };
  }
  // Word
  if (name.endsWith('.doc') || name.endsWith('.docx') ||
    mime.includes('word') || mime.includes('officedocument.wordprocessing')) {
    return { icon: FileText, badge: { text: 'DOC', color: 'bg-blue-500' } };
  }
  // Excel/CSV
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv') ||
    mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
    return { icon: FileSpreadsheet, badge: { text: 'XLS', color: 'bg-green-500' } };
  }
  // PowerPoint
  if (name.endsWith('.ppt') || name.endsWith('.pptx') ||
    mime.includes('presentation') || mime.includes('powerpoint')) {
    return { icon: FileText, badge: { text: 'PPT', color: 'bg-orange-500' } };
  }
  // Images
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/) || mime.startsWith('image/')) {
    return { icon: ImageIcon, badge: { text: 'IMG', color: 'bg-violet-500' } };
  }
  // Default
  return { icon: File };
}

// Helper: format file size
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper: check if file is previewable
function isPreviewable(doc: DealDocument): boolean {
  const name = doc.file_name.toLowerCase();
  const mime = doc.mime_type?.toLowerCase() || '';

  return (
    mime.includes('pdf') ||
    mime.startsWith('image/') ||
    name.endsWith('.pdf') ||
    name.match(/\.(jpg|jpeg|png|gif|webp)$/) !== null
  );
}

export function DealDocumentsList({ dealId }: DealDocumentsListProps) {
  const {
    documents,
    isLoading,
    uploadFile,
    isUploading,
    renameFile,
    deleteFile,
    downloadFile,
    openInNewTab,
  } = useDealDocuments(dealId);

  const [isDragging, setIsDragging] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DealDocument | null>(null);
  const [newName, setNewName] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DealDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      uploadFile({ file });
    });
  }, [uploadFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      uploadFile({ file });
    });
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRename = (doc: DealDocument) => {
    setSelectedDoc(doc);
    setNewName(doc.file_name);
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    if (selectedDoc && newName.trim()) {
      renameFile({ documentId: selectedDoc.id, newName: newName.trim() });
      setRenameDialogOpen(false);
      setSelectedDoc(null);
      setNewName('');
    }
  };

  const handleDelete = (doc: DealDocument) => {
    setSelectedDoc(doc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedDoc) {
      deleteFile(selectedDoc.id);
      setDeleteDialogOpen(false);
      setSelectedDoc(null);
    }
  };

  const handlePreview = (doc: DealDocument) => {
    if (isPreviewable(doc)) {
      setPreviewDoc(doc);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-medium">Documents</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {documents.length} fichier{documents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Ajouter un fichier
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Drop zone / File list */}
          <div
            className={cn(
              'min-h-[200px] rounded-lg border-2 border-dashed transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-muted',
              documents.length === 0 && 'flex items-center justify-center'
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Aucun document
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Glissez-déposez des fichiers ici ou cliquez sur "Ajouter un fichier"
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {documents.map((doc) => {
                  const { icon: FileIcon, badge: fileBadge } = getFileIconInfo(doc.mime_type, doc.file_name);
                  const canPreview = isPreviewable(doc);

                  return (
                    <div
                      key={doc.id}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => canPreview && handlePreview(doc)}
                    >
                      {/* Icon with badge */}
                      <div className="relative flex-shrink-0">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        {fileBadge && (
                          <Badge
                            className={cn(
                              'absolute -top-1 -right-2 h-3 px-1 text-[8px] text-white border-0',
                              fileBadge.color
                            )}
                          >
                            {fileBadge.text}
                          </Badge>
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size_bytes)}
                          {doc.uploaded_at && (
                            <> · {format(new Date(doc.uploaded_at), 'd MMM yyyy', { locale: fr })}</>
                          )}
                        </p>
                      </div>

                      {/* Quick actions (hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canPreview && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(doc);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInNewTab(doc);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(doc);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRename(doc);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Renommer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(doc);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le fichier</DialogTitle>
            <DialogDescription>
              Entrez le nouveau nom pour ce fichier.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRenameSubmit} disabled={!newName.trim()}>
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le fichier "{selectedDoc?.file_name}" sera
              définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Modal */}
      <DealDocumentPreviewModal
        document={previewDoc}
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        onDownload={downloadFile}
        onOpenInNewTab={openInNewTab}
      />
    </>
  );
}

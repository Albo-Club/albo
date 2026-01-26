import { useState, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Upload,
  Home,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Download,
  Pencil,
  Trash2,
  File,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  LayoutList,
  LayoutGrid,
  Eye,
  Edit3,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePortfolioDocuments, PortfolioDocument, DocumentTreeNode } from "@/hooks/usePortfolioDocuments";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { MarkdownEditorModal } from "./MarkdownEditorModal";

interface PortfolioDocumentsBrowserProps {
  companyId: string;
}

// Helper: get file icon and badge info based on mime type and name
function getFileIconInfo(mimeType: string | null, fileName: string): { 
  icon: typeof File; 
  badge?: { text: string; color: string };
} {
  const name = fileName.toLowerCase();
  const mime = mimeType?.toLowerCase() || '';

  // Markdown synthesis files (real files with AI-generated content)
  if (name.startsWith('synthèse') && name.endsWith('.md')) {
    return { icon: FileText, badge: { text: 'MD', color: 'bg-purple-500' } };
  }
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
  // Images
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/) || mime.startsWith('image/')) {
    return { icon: ImageIcon };
  }
  // Text
  if (name.endsWith('.txt') || mime.startsWith('text/')) {
    return { icon: FileText };
  }
  // Default
  return { icon: File };
}

// Helper: check if file is an image
function isImageFile(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
}


// Helper: format file size
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper: get thumbnail URL for images
function getThumbnailUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  const { data } = supabase.storage
    .from('portfolio-documents')
    .getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

// Helper: check if file is previewable
function isPreviewable(item: PortfolioDocument): boolean {
  if (item.type === 'folder') return false;
  if (item.text_content) return true;
  
  const name = item.name.toLowerCase();
  const mime = item.mime_type?.toLowerCase() || '';

  return (
    mime.includes('pdf') ||
    mime.startsWith('image/') ||
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessing') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    name.endsWith('.pdf') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    name.match(/\.(jpg|jpeg|png|gif|webp)$/) !== null
  );
}

// Sidebar folder item component
function FolderTreeItem({
  node,
  depth,
  selectedFolderId,
  expandedFolders,
  onSelect,
  onToggleExpand,
}: {
  node: DocumentTreeNode;
  depth: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const isSelected = selectedFolderId === node.id;
  const isExpanded = expandedFolders.has(node.id);
  const hasChildren = node.children.some(c => c.type === 'folder');
  const folderChildren = node.children.filter(c => c.type === 'folder');

  return (
    <div>
      <button
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-accent rounded-md transition-colors",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {isSelected ? (
          <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isExpanded && folderChildren.length > 0 && (
        <div>
          {folderChildren.map(child => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// File/Folder item for list view
function ListViewItem({
  item,
  onNavigate,
  onDownload,
  onRename,
  onDelete,
  onPreview,
  onEdit,
  countItems,
}: {
  item: PortfolioDocument;
  onNavigate: (id: string) => void;
  onDownload: (doc: PortfolioDocument) => void;
  onRename: (doc: PortfolioDocument) => void;
  onDelete: (doc: PortfolioDocument) => void;
  onPreview: (doc: PortfolioDocument) => void;
  onEdit: (doc: PortfolioDocument) => void;
  countItems: (folderId: string) => number;
}) {
  const isFolder = item.type === 'folder';
  const { icon: FileIcon, badge: fileBadge } = getFileIconInfo(item.mime_type, item.name);
  const isImage = isImageFile(item.mime_type);
  const thumbnailUrl = isImage ? getThumbnailUrl(item.storage_path) : null;
  const canPreview = isPreviewable(item);

  const handleDoubleClick = () => {
    if (isFolder) return;
    if (canPreview) {
      onPreview(item);
    } else {
      onDownload(item);
    }
  };

  const handleClick = () => {
    if (isFolder) {
      onNavigate(item.id);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md cursor-pointer transition-all duration-200 hover:scale-[1.01] animate-fade-in"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Icon or Thumbnail */}
      {isFolder ? (
        <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      ) : isImage && thumbnailUrl ? (
        <div className="h-10 w-10 rounded overflow-hidden bg-muted flex-shrink-0">
          <img 
            src={thumbnailUrl} 
            alt={item.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : fileBadge ? (
        <div className="relative flex-shrink-0">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
          <Badge className={cn("absolute -top-1 -right-2 h-3 px-1 text-[8px] text-white border-0", fileBadge.color)}>
            {fileBadge.text}
          </Badge>
        </div>
      ) : (
        <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{item.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {isFolder ? (
            <>{countItems(item.id)} éléments</>
          ) : (
            <>
              {formatFileSize(item.file_size_bytes)}
              {item.created_at && (
                <> · {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}</>
              )}
            </>
          )}
        </p>
      </div>

      {/* Preview icon on hover */}
      {canPreview && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(item);
          }}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canPreview && (
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}>
              <Eye className="h-3.5 w-3.5 mr-2" />
              Prévisualiser
            </DropdownMenuItem>
          )}
          {/* Edit option for markdown files */}
          {!isFolder && item.name.toLowerCase().endsWith('.md') && (
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}>
              <Edit3 className="h-3.5 w-3.5 mr-2" />
              Éditer
            </DropdownMenuItem>
          )}
          {!isFolder && (
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onDownload(item);
            }}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Télécharger
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            onRename(item);
          }}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// File/Folder item for grid view
function GridViewItem({
  item,
  onNavigate,
  onDownload,
  onRename,
  onDelete,
  onPreview,
  onEdit,
}: {
  item: PortfolioDocument;
  onNavigate: (id: string) => void;
  onDownload: (doc: PortfolioDocument) => void;
  onRename: (doc: PortfolioDocument) => void;
  onDelete: (doc: PortfolioDocument) => void;
  onPreview: (doc: PortfolioDocument) => void;
  onEdit: (doc: PortfolioDocument) => void;
}) {
  const isFolder = item.type === 'folder';
  const { icon: FileIcon, badge: fileBadge } = getFileIconInfo(item.mime_type, item.name);
  const isImage = isImageFile(item.mime_type);
  const thumbnailUrl = isImage ? getThumbnailUrl(item.storage_path) : null;
  const canPreview = isPreviewable(item);

  const handleDoubleClick = () => {
    if (isFolder) return;
    if (canPreview) {
      onPreview(item);
    } else {
      onDownload(item);
    }
  };

  const handleClick = () => {
    if (isFolder) {
      onNavigate(item.id);
    }
  };

  return (
    <Card
      className={cn(
        "group relative p-3 hover:bg-accent/50 cursor-pointer transition-all duration-200 hover:scale-[1.02] animate-fade-in"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canPreview && (
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}>
              <Eye className="h-3.5 w-3.5 mr-2" />
              Prévisualiser
            </DropdownMenuItem>
          )}
          {/* Edit option for markdown files */}
          {!isFolder && item.name.toLowerCase().endsWith('.md') && (
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}>
              <Edit3 className="h-3.5 w-3.5 mr-2" />
              Éditer
            </DropdownMenuItem>
          )}
          {!isFolder && (
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onDownload(item);
            }}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Télécharger
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            onRename(item);
          }}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Content */}
      <div className="flex flex-col items-center text-center">
        {/* Icon or Thumbnail */}
        <div className="h-16 w-16 flex items-center justify-center mb-2 relative">
          {isFolder ? (
            <Folder className="h-12 w-12 text-muted-foreground" />
          ) : isImage && thumbnailUrl ? (
            <div className="h-16 w-16 rounded overflow-hidden bg-muted">
              <img 
                src={thumbnailUrl} 
                alt={item.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : fileBadge ? (
            <div className="relative">
              <FileIcon className="h-12 w-12 text-muted-foreground" />
              <Badge className={cn("absolute -top-1 -right-2 h-4 px-1.5 text-[9px] text-white border-0", fileBadge.color)}>
                {fileBadge.text}
              </Badge>
            </div>
          ) : (
            <FileIcon className="h-12 w-12 text-muted-foreground" />
          )}
          {/* Preview overlay */}
          {canPreview && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(item);
              }}
            >
              <Eye className="h-5 w-5 text-white" />
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-xs font-medium truncate w-full">{item.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {!isFolder && formatFileSize(item.file_size_bytes)}
        </p>
      </div>
    </Card>
  );
}

export function PortfolioDocumentsBrowser({ companyId }: PortfolioDocumentsBrowserProps) {
  const queryClient = useQueryClient();
  const {
    documents,
    documentTree,
    isLoading,
    createFolder,
    uploadFile,
    rename,
    deleteDocument,
    downloadFile,
    isCreatingFolder,
    isUploadingFile,
    isRenaming,
    isDeleting,
  } = usePortfolioDocuments(companyId);

  // State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<PortfolioDocument | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PortfolioDocument | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newName, setNewName] = useState("");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDragging, setIsDragging] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<PortfolioDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editDocument, setEditDocument] = useState<PortfolioDocument | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Get current folder contents
  const currentContents = useMemo(() => {
    return documents.filter(d => d.parent_id === currentFolderId);
  }, [documents, currentFolderId]);

  const folders = currentContents.filter(d => d.type === 'folder');
  const files = currentContents.filter(d => d.type === 'file');

  // Get folder tree for sidebar (only root-level folders)
  const rootFolders = documentTree.filter(d => d.type === 'folder');

  // Build breadcrumb path
  const breadcrumbPath = useMemo(() => {
    const path: { id: string | null; name: string }[] = [{ id: null, name: "Fichiers" }];
    if (!currentFolderId) return path;

    let current = documents.find(d => d.id === currentFolderId);
    const segments: { id: string; name: string }[] = [];
    
    while (current) {
      segments.unshift({ id: current.id, name: current.name });
      current = current.parent_id ? documents.find(d => d.id === current!.parent_id) : undefined;
    }
    
    return [...path, ...segments];
  }, [documents, currentFolderId]);

  // Count items in a folder
  const countFolderItems = useCallback((folderId: string): number => {
    return documents.filter(d => d.parent_id === folderId).length;
  }, [documents]);

  // Toggle folder expansion
  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder({ name: newFolderName.trim(), parentId: currentFolderId });
    setNewFolderName("");
    setNewFolderDialogOpen(false);
  };

  // Handle rename
  const handleRename = async () => {
    if (!itemToRename || !newName.trim()) return;
    await rename({ documentId: itemToRename.id, newName: newName.trim() });
    setItemToRename(null);
    setNewName("");
    setRenameDialogOpen(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!itemToDelete) return;
    await deleteDocument(itemToDelete.id);
    setItemToDelete(null);
    setDeleteDialogOpen(false);
  };

  // Handle file upload
  const handleFileUpload = async (fileToUpload: File) => {
    await uploadFile({ file: fileToUpload, parentId: currentFolderId });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file input change
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      await handleFileUpload(file);
    }
  }, [currentFolderId]);

  // Open rename dialog
  const openRenameDialog = (item: PortfolioDocument) => {
    setItemToRename(item);
    setNewName(item.name);
    setRenameDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (item: PortfolioDocument) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  // Open preview modal
  const openPreview = (item: PortfolioDocument) => {
    setPreviewDocument(item);
    setPreviewOpen(true);
  };

  // Open edit modal for markdown files
  const handleEditMarkdown = (doc: PortfolioDocument) => {
    setEditDocument(doc);
    setEditModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <>
      <Card className="h-[500px] flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Dossiers
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {/* Root button */}
              <button
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded-md transition-colors",
                  currentFolderId === null && "bg-accent"
                )}
                onClick={() => setCurrentFolderId(null)}
              >
                <Home className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Tous les fichiers</span>
              </button>
              
              {/* Folder tree */}
              {rootFolders.map(folder => (
                <FolderTreeItem
                  key={folder.id}
                  node={folder}
                  depth={0}
                  selectedFolderId={currentFolderId}
                  expandedFolders={expandedFolders}
                  onSelect={setCurrentFolderId}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div 
          className="flex-1 flex flex-col min-w-0 relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center animate-fade-in">
              <div className="text-center">
                <Upload className="h-12 w-12 text-primary/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Déposer le fichier ici</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-xs min-w-0 overflow-hidden">
              {breadcrumbPath.map((segment, index) => (
                <div key={segment.id ?? 'root'} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                  <button
                    className={cn(
                      "hover:text-primary truncate transition-colors",
                      index === breadcrumbPath.length - 1 
                        ? "font-medium text-foreground" 
                        : "text-muted-foreground"
                    )}
                    onClick={() => setCurrentFolderId(segment.id)}
                  >
                    {segment.name}
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              >
                {viewMode === 'list' ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <LayoutList className="h-4 w-4" />
                )}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs gap-1.5"
                onClick={() => setNewFolderDialogOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Dossier
              </Button>
              <Button 
                size="sm" 
                className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
              >
                {isUploadingFile ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Nouveau
              </Button>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {folders.length === 0 && files.length === 0 ? (
                /* Empty state */
                <div className="h-[380px] flex flex-col items-center justify-center text-center">
                  <Folder className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Ce dossier est vide
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Créez un dossier ou glissez-déposez un fichier
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                /* List view */
                <div className="space-y-4">
                  {/* Folders section */}
                  {folders.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                        Dossiers
                      </p>
                      <div className="space-y-0.5">
                        {folders.map(folder => (
                          <ListViewItem
                            key={folder.id}
                            item={folder}
                            onNavigate={setCurrentFolderId}
                            onDownload={downloadFile}
                            onRename={openRenameDialog}
                            onDelete={openDeleteDialog}
                            onPreview={openPreview}
                            onEdit={handleEditMarkdown}
                            countItems={countFolderItems}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files section */}
                  {files.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                        Fichiers
                      </p>
                      <div className="space-y-0.5">
                        {files.map(file => (
                          <ListViewItem
                            key={file.id}
                            item={file}
                            onNavigate={setCurrentFolderId}
                            onDownload={downloadFile}
                            onRename={openRenameDialog}
                            onDelete={openDeleteDialog}
                            onPreview={openPreview}
                            onEdit={handleEditMarkdown}
                            countItems={countFolderItems}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Grid view */
                <div className="grid grid-cols-4 gap-3">
                  {folders.map(folder => (
                    <GridViewItem
                      key={folder.id}
                      item={folder}
                      onNavigate={setCurrentFolderId}
                      onDownload={downloadFile}
                      onRename={openRenameDialog}
                      onDelete={openDeleteDialog}
                      onPreview={openPreview}
                      onEdit={handleEditMarkdown}
                    />
                  ))}
                  {files.map(file => (
                    <GridViewItem
                      key={file.id}
                      item={file}
                      onNavigate={setCurrentFolderId}
                      onDownload={downloadFile}
                      onRename={openRenameDialog}
                      onDelete={openDeleteDialog}
                      onPreview={openPreview}
                      onEdit={handleEditMarkdown}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.md"
        onChange={handleFileInputChange}
      />

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
            <DialogDescription>
              Créer un nouveau dossier dans le répertoire courant
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nom du dossier"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder || !newFolderName.trim()}>
              {isCreatingFolder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>
              Entrez le nouveau nom pour "{itemToRename?.name}"
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nouveau nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()}>
              {isRenaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer "{itemToDelete?.name}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'folder'
                ? "Ce dossier et tout son contenu seront définitivement supprimés. Cette action est irréversible."
                : "Ce fichier sera définitivement supprimé. Cette action est irréversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDocument}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={downloadFile}
      />

      {/* Markdown Editor Modal */}
      <MarkdownEditorModal
        document={editDocument}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['portfolio-documents', companyId] });
        }}
      />
    </>
  );
}

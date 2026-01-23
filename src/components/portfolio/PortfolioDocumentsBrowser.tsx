import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePortfolioDocuments, PortfolioDocument, DocumentTreeNode } from "@/hooks/usePortfolioDocuments";

interface PortfolioDocumentsBrowserProps {
  companyId: string;
}

// Helper: get file icon based on mime type
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('image')) return ImageIcon;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('xls')) {
    return FileSpreadsheet;
  }
  return File;
}

// Helper: format file size
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export function PortfolioDocumentsBrowser({ companyId }: PortfolioDocumentsBrowserProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const countFolderItems = (folderId: string): number => {
    return documents.filter(d => d.parent_id === folderId).length;
  };

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
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile({ file, parentId: currentFolderId });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-xs min-w-0 overflow-hidden">
              {breadcrumbPath.map((segment, index) => (
                <div key={segment.id ?? 'root'} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                  <button
                    className={cn(
                      "hover:text-primary truncate",
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
                    Créez un dossier ou uploadez un fichier
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Folders section */}
                  {folders.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                        Dossiers
                      </p>
                      <div className="space-y-0.5">
                        {folders.map(folder => (
                          <div
                            key={folder.id}
                            className="group flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                            onClick={() => setCurrentFolderId(folder.id)}
                          >
                            <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{folder.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {countFolderItems(folder.id)} éléments
                              </p>
                            </div>
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
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  openRenameDialog(folder);
                                }}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Renommer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteDialog(folder);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
                        {files.map(file => {
                          const FileIcon = getFileIcon(file.mime_type);
                          return (
                            <div
                              key={file.id}
                              className="group flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                              onDoubleClick={() => downloadFile(file)}
                            >
                              <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{file.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatFileSize(file.file_size_bytes)}
                                  {file.created_at && (
                                    <> · {format(new Date(file.created_at), "d MMM yyyy", { locale: fr })}</>
                                  )}
                                </p>
                              </div>
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
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(file);
                                  }}>
                                    <Download className="h-3.5 w-3.5 mr-2" />
                                    Télécharger
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    openRenameDialog(file);
                                  }}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                    Renommer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog(file);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
        onChange={handleFileUpload}
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
    </>
  );
}

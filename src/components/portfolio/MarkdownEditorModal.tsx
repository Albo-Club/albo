import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Eye, Edit3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PortfolioDocument } from "@/hooks/usePortfolioDocuments";

interface MarkdownEditorModalProps {
  document: PortfolioDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function MarkdownEditorModal({
  document,
  open,
  onOpenChange,
  onSave,
}: MarkdownEditorModalProps) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Load content when document changes
  useEffect(() => {
    if (document && open) {
      const initialContent = document.text_content || "";
      setContent(initialContent);
      setOriginalContent(initialContent);
      setActiveTab("edit");
    }
  }, [document?.id, open]);

  const hasChanges = content !== originalContent;

  const handleSave = async () => {
    if (!document || !hasChanges) return;

    setIsSaving(true);
    try {
      // Update portfolio_documents.text_content
      const { error: docError } = await supabase
        .from("portfolio_documents")
        .update({
          text_content: content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", document.id);

      if (docError) throw docError;

      // If linked to a report, also update company_reports.cleaned_content
      if (document.source_report_id) {
        const { error: reportError } = await supabase
          .from("company_reports")
          .update({
            cleaned_content: content,
          })
          .eq("id", document.source_report_id);

        if (reportError) {
          console.error("Error updating report:", reportError);
          // Don't throw - document was saved successfully
        }
      }

      setOriginalContent(content);
      toast.success("Modifications enregistrées");
      onSave();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open && hasChanges) {
      if (confirm("Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?")) {
        onOpenChange(false);
      }
    } else {
      onOpenChange(open);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              {document.name}
            </DialogTitle>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")}>
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs px-3 gap-1">
                  <Edit3 className="h-3 w-3" />
                  Éditer
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-3 gap-1">
                  <Eye className="h-3 w-3" />
                  Aperçu
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "edit" ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-full w-full resize-none border-0 rounded-none focus-visible:ring-0 font-mono text-sm p-4"
              placeholder="Contenu markdown..."
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content || "*Aucun contenu*"}
                  </ReactMarkdown>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {hasChanges ? "Modifications non enregistrées" : "Aucune modification"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

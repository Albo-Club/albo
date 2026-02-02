import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MemoHtmlFrame } from "@/components/MemoHtmlFrame";

interface ReportContentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  content: string | null;
  title?: string | null;
  period?: string | null;
}

export function ReportContentViewer({
  isOpen,
  onClose,
  content,
  title,
  period,
}: ReportContentViewerProps) {
  const isHtml = useMemo(() => {
    if (!content) return false;
    const trimmed = content.trim().toLowerCase();
    return (
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<style") ||
      trimmed.startsWith("<div") ||
      trimmed.startsWith("<article") ||
      trimmed.startsWith("<section") ||
      trimmed.startsWith("<table")
    );
  }, [content]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {title || "Report"}
                </DialogTitle>
                {period && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {period}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Report mail
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {content ? (
            isHtml ? (
              <MemoHtmlFrame
                html={content}
                title={title || "Report Content"}
                className="h-full w-full"
              />
            ) : (
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <div className="report-content prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>
                </div>
              </ScrollArea>
            )
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Aucun contenu disponible
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
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
  // Detect if content is HTML (starts with <style>, <div>, <article>, <!doctype>, or <html)
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">
                  {title || "Report"}
                </SheetTitle>
                {period && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {period}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
            >
              Synthèse IA
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {content ? (
            isHtml ? (
              // Render HTML content in an iframe for proper style isolation
              <MemoHtmlFrame
                html={content}
                title={title || "Report Content"}
                className="h-full w-full"
              />
            ) : (
              // Render Markdown content
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
      </SheetContent>
    </Sheet>
  );
}

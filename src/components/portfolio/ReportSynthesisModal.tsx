import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReportSynthesisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportPeriod: string | null;
  content: string | null;
}

export function ReportSynthesisModal({
  open,
  onOpenChange,
  reportPeriod,
  content,
}: ReportSynthesisModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Synthèse - {reportPeriod || "Report"}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          {content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Aucune synthèse disponible pour ce report.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

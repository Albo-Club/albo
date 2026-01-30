import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MemoHtmlFrame } from "@/components/MemoHtmlFrame";

interface ReportSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportPeriod: string | null;
  summary: string | null;
  companyName?: string;
}

export function ReportSummaryModal({
  open,
  onOpenChange,
  reportPeriod,
  summary,
  companyName,
}: ReportSummaryModalProps) {
  const [copied, setCopied] = useState(false);

  // Detect if content is HTML
  const isHtml = useMemo(() => {
    if (!summary) return false;
    const trimmed = summary.trim().toLowerCase();
    return (
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<style") ||
      trimmed.startsWith("<div") ||
      trimmed.startsWith("<article") ||
      trimmed.startsWith("<section") ||
      trimmed.startsWith("<table")
    );
  }, [summary]);

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success("Synthèse copiée !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!summary) return;
    const ext = isHtml ? ".html" : ".md";
    const mimeType = isHtml ? "text/html" : "text/markdown";
    const blob = new Blob([summary], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Synthese_${companyName || "Report"}_${reportPeriod || ""}`.replace(/\s+/g, "_") + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Synthèse {reportPeriod ? `- ${reportPeriod}` : ""}
                </DialogTitle>
                {companyName && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {companyName}
                  </p>
                )}
              </div>
            </div>
            
            {/* AI Badge + Actions */}
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 gap-1">
                <Sparkles className="h-3 w-3" />
                Généré par AI
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} title="Copier">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Télécharger">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {summary ? (
            isHtml ? (
              <MemoHtmlFrame
                html={summary}
                title={`Synthèse - ${reportPeriod || "Report"}`}
                className="h-full w-full"
              />
            ) : (
              <ScrollArea className="h-full">
                <div className="p-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {summary}
                    </ReactMarkdown>
                  </div>
                </div>
              </ScrollArea>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground italic">
                Aucune synthèse disponible pour ce rapport.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

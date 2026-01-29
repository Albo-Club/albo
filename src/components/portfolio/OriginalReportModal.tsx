import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface OriginalReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportPeriod: string | null;
  content: string | null;
  companyName?: string;
  originalFileName?: string | null;
}

export function OriginalReportModal({
  open,
  onOpenChange,
  reportPeriod,
  content,
  companyName,
  originalFileName,
}: OriginalReportModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Rapport copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erreur lors de la copie");
    }
  };

  const handleDownload = () => {
    if (!content) return;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    // Utiliser original_file_name si disponible, sinon générer un nom
    const downloadName = originalFileName 
      ? `${originalFileName.replace(/[^a-zA-Z0-9\s\-_]/g, '')}.txt`
      : `${(companyName || "Report").replace(/[^a-zA-Z0-9]/g, "_")}_${(reportPeriod || "").replace(/[^a-zA-Z0-9]/g, "_")}_original.txt`;
    
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Téléchargement démarré");
  };

  // Titre à afficher : original_file_name ou fallback
  const displayTitle = originalFileName || `Rapport Original ${reportPeriod ? `- ${reportPeriod}` : ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {displayTitle}
                </DialogTitle>
                {companyName && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {companyName}
                  </p>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Texte brut
              </Badge>
              <Button variant="ghost" size="icon" onClick={handleCopy} title="Copier">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload} title="Télécharger">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Contenu */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {content ? (
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg">
                  {content}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground font-medium">
                    Aucun rapport original disponible.
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Ce rapport provient probablement d'un PDF attaché.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

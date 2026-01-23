import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface ReportSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportPeriod: string | null;
  summary: string | null;
}

export function ReportSummaryModal({
  open,
  onOpenChange,
  reportPeriod,
  summary,
}: ReportSummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {reportPeriod ? `Rapport - ${reportPeriod}` : "Rapport"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 mt-4">
          <div className="pr-4">
            {summary ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {summary}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Aucune synthèse disponible pour ce rapport.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

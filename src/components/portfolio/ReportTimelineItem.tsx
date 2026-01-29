import { FileText, Eye, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ReportTimelineItemProps {
  report: CompanyReport;
  onClickHeadline: (report: CompanyReport) => void;
  onPreviewPdf: (report: CompanyReport) => void;
  isLast?: boolean;
}

export function ReportTimelineItem({ 
  report, 
  onClickHeadline, 
  onPreviewPdf,
  isLast = false 
}: ReportTimelineItemProps) {
  // Déterminer le type de fichier principal
  const mainFile = report.files[0];
  const isTextReport = mainFile?.file_type === 'text';
  const isPdfReport = mainFile?.file_type === 'report' || mainFile?.mime_type === 'application/pdf';
  
  // Calculer le temps relatif
  const timeAgo = report.created_at 
    ? formatDistanceToNow(new Date(report.created_at), { addSuffix: false, locale: fr })
    : null;

  return (
    <div className="flex gap-4 relative group">
      {/* Colonne gauche : Date et ligne verticale */}
      <div className="flex flex-col items-center w-24 shrink-0">
        {/* Date/Période */}
        <span className="text-xs font-medium text-muted-foreground text-center leading-tight mb-2">
          {report.report_period || "—"}
        </span>
        
        {/* Point sur la timeline */}
        <div 
          className={cn(
            "w-3 h-3 rounded-full border-2 z-10 shrink-0",
            isTextReport 
              ? "bg-blue-500 border-blue-300" 
              : "bg-primary border-primary/50"
          )}
        />
        
        {/* Ligne verticale (sauf pour le dernier) */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border mt-2" />
        )}
        
        {/* Temps relatif */}
        {timeAgo && (
          <span className="text-[10px] text-muted-foreground/60 mt-1 whitespace-nowrap">
            il y a {timeAgo}
          </span>
        )}
      </div>
      
      {/* Colonne droite : Contenu du report */}
      <div className="flex-1 pb-6 min-w-0">
        {/* Bandeau cliquable avec le headline */}
        <div 
          className={cn(
            "rounded-lg border p-3 cursor-pointer transition-all duration-200",
            "hover:shadow-md hover:border-primary/30",
            isTextReport 
              ? "border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20" 
              : "border-l-4 border-l-primary bg-card"
          )}
          onClick={() => onClickHeadline(report)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Icône de type */}
              <div 
                className={cn(
                  "p-1.5 rounded-md shrink-0 mt-0.5",
                  isTextReport 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" 
                    : "bg-primary/10 text-primary"
                )}
              >
                {isTextReport ? (
                  <Mail className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                {/* Headline */}
                {report.headline && (
                  <p className="text-sm font-medium text-foreground leading-relaxed line-clamp-2">
                    {report.headline}
                  </p>
                )}
                
                {/* Pas de headline */}
                {!report.headline && (
                  <p className="text-sm text-muted-foreground italic">
                    Aucun résumé disponible
                  </p>
                )}
              </div>
            </div>
            
            {/* Actions pour les PDF : Preview */}
            {isPdfReport && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewPdf(report);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

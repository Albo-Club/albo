import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CompanyReportsListProps {
  reports: CompanyReport[];
  isLoading: boolean;
}

export function CompanyReportsList({ reports, isLoading }: CompanyReportsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <FileText className="h-8 w-8" />
        <p className="text-sm">Aucun rapport disponible.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <Card key={report.id} className="hover:bg-muted/30 transition-colors">
          <CardContent className="flex items-center gap-4 py-3 px-4">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {report.headline || report.report_period || "Rapport"}
              </p>
              {report.report_period && (
                <p className="text-xs text-muted-foreground">{report.report_period}</p>
              )}
            </div>
            {report.report_type && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {report.report_type}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {report.report_date
                ? format(new Date(report.report_date), "dd MMM yyyy", { locale: fr })
                : format(new Date(report.created_at), "dd MMM yyyy", { locale: fr })}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

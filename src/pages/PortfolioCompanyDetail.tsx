import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { useCompanyReports } from "@/hooks/useCompanyReports";
import { useCompanyAIAnalysis } from "@/hooks/useCompanyAIAnalysis";
import { parseReportPeriodToSortDate, isPeriodRange } from "@/lib/reportPeriodParser";
import { PortfolioCompanyHeader } from "@/components/portfolio/PortfolioCompanyHeader";
import { ReportsTimeline } from "@/components/portfolio/ReportsTimeline";
import { PortfolioCompanyOverview } from "@/components/portfolio/PortfolioCompanyOverview";
import { PortfolioDocumentsBrowser } from "@/components/portfolio/PortfolioDocumentsBrowser";
import { CompanyAIBanner } from "@/components/portfolio/CompanyAIBanner";
import { CompanyEmailsTab } from "@/components/portfolio/CompanyEmailsTab";
import { CompanyMetricsTab } from "@/components/portfolio/CompanyMetricsTab";
import { DealTabs } from "@/components/deals/DealTabs";

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePortfolioCompanyWithReport(id);
  const { data: allReports = [], isLoading: reportsLoading } = useCompanyReports(id);
  const { analysis } = useCompanyAIAnalysis(id || "");
  
  const sortedReports = useMemo(() => {
    const completed = allReports.filter(r => r.processing_status === 'completed');
    return [...completed].sort((a, b) => {
      const periodDateA = parseReportPeriodToSortDate(a.report_period);
      const periodDateB = parseReportPeriodToSortDate(b.report_period);
      if (periodDateA.getTime() !== periodDateB.getTime()) {
        return periodDateB.getTime() - periodDateA.getTime();
      }
      const isRangeA = isPeriodRange(a.report_period);
      const isRangeB = isPeriodRange(b.report_period);
      if (isRangeA !== isRangeB) return isRangeA ? 1 : -1;
      const dateA = a.report_date || '';
      const dateB = b.report_date || '';
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
      return 0;
    });
  }, [allReports]);
  
  const latestReport = sortedReports[0] || null;

  // Extract alerts by severity
  const criticalAlerts = useMemo(() => {
    return (analysis?.alerts || []).filter((a: any) => a.severity === "critical");
  }, [analysis]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Entreprise non trouvée</p>
        <Button onClick={() => navigate("/portfolio")} className="mt-4">
          Retour au Portfolio
        </Button>
      </div>
    );
  }

  const overviewContent = (
    <div>
      {/* Critical alerts — full width */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {criticalAlerts.map((alert: any, i: number) => (
            <Alert key={i} variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">{alert.title}</span> — {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Grid 70/30 */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <CompanyAIBanner companyId={company.id} />
          <ReportsTimeline reports={sortedReports} companyId={company.id} companyName={company.company_name} />
        </div>
        <div className="lg:col-span-3">
          <div className="sticky top-4">
            <PortfolioCompanyOverview 
              company={company}
              latestReport={latestReport}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const documentsContent = <PortfolioDocumentsBrowser companyId={company.id} />;

  const emailsContent = (
    <CompanyEmailsTab 
      companyId={company.id} 
      companyName={company.company_name}
      domain={company.domain}
    />
  );

  const metricsContent = <CompanyMetricsTab companyId={company.id} />;

  return (
    <div className="space-y-6">
      <PortfolioCompanyHeader
        companyName={company.company_name}
        domain={company.domain}
        preview={company.preview}
        sectors={company.sectors}
        investmentDate={company.investment_date}
      />

      <DealTabs 
        overviewContent={overviewContent} 
        emailsContent={emailsContent}
        foldersContent={documentsContent}
        metricsContent={metricsContent}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, TriangleAlert, AlertTriangle, Info, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { usePortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { useCompanyReports } from "@/hooks/useCompanyReports";
import { useCompanyAIAnalysis } from "@/hooks/useCompanyAIAnalysis";
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
  const [opSummaryExpanded, setOpSummaryExpanded] = useState(false);
  
  const sortedReports = useMemo(() => {
    const completed = allReports.filter(r => r.processing_status === 'completed');
    return [...completed].sort((a, b) => {
      const dateA = a.report_date || '';
      const dateB = b.report_date || '';
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
      const createdA = a.created_at || '';
      const createdB = b.created_at || '';
      if (createdA > createdB) return -1;
      if (createdA < createdB) return 1;
      return 0;
    });
  }, [allReports]);
  
  const latestReport = sortedReports[0] || null;

  // Extract alerts by severity
  const criticalAlerts = useMemo(() => {
    return (analysis?.alerts || []).filter((a: any) => a.severity === "critical");
  }, [analysis]);

  const secondaryAlerts = useMemo(() => {
    return (analysis?.alerts || []).filter((a: any) => a.severity === "warning" || a.severity === "info");
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

  // Executive summary for operational synthesis
  const opSummary = analysis?.executive_summary || "";
  const opTruncated = opSummary.length > 300;
  const displayOpSummary = opSummaryExpanded || !opTruncated ? opSummary : opSummary.slice(0, 300) + "…";

  const overviewContent = (
    <div>
      {/* A. Critical Alerts — full width */}
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

      {/* Main 70/30 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* B. Main column (70%) */}
        <div className="lg:col-span-7 space-y-4">
          {/* B1-B3. AI Banner (Score + KPIs + Points) */}
          <CompanyAIBanner companyId={company.id} />

          {/* B4. Synthèse Opérationnelle IA */}
          {opSummary && (
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-base font-semibold">Synthèse Opérationnelle IA</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed">
                  {displayOpSummary}
                  {opTruncated && (
                    <button
                      type="button"
                      onClick={() => setOpSummaryExpanded(v => !v)}
                      className="ml-1 text-primary text-xs font-medium hover:underline"
                    >
                      {opSummaryExpanded ? "Moins" : "Voir plus"}
                    </button>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* B5. Secondary Alerts */}
          {secondaryAlerts.length > 0 && (
            <div className="space-y-2">
              {secondaryAlerts.map((alert: any, i: number) => (
                <Alert
                  key={i}
                  className={
                    alert.severity === "warning"
                      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                      : "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800"
                  }
                >
                  {alert.severity === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Info className="h-4 w-4 text-blue-600" />
                  )}
                  <AlertDescription>
                    <span className="font-semibold">{alert.title}</span>{" "}
                    <span className="text-sm">{alert.message}</span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* B6. Reports Timeline */}
          <ReportsTimeline reports={sortedReports} companyId={company.id} companyName={company.company_name} />
        </div>

        {/* C. Sidebar (30%) */}
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

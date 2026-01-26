import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { useCompanyReports, CompanyReport } from "@/hooks/useCompanyReports";
import { PortfolioCompanyHeader } from "@/components/portfolio/PortfolioCompanyHeader";
import { PortfolioCompanyLastNews } from "@/components/portfolio/PortfolioCompanyLastNews";
import { PortfolioCompanyOverview } from "@/components/portfolio/PortfolioCompanyOverview";
import { PortfolioDocumentsBrowser } from "@/components/portfolio/PortfolioDocumentsBrowser";
import { DealTabs } from "@/components/deals/DealTabs";

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePortfolioCompanyWithReport(id);
  const { data: allReports = [], isLoading: reportsLoading } = useCompanyReports(id);
  
  // Filter only completed reports
  const completedReports = useMemo(() => 
    allReports.filter(r => r.processing_status === 'completed'),
    [allReports]
  );
  
  // State for selected report - initialize with latest_report.id when available
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  // Initialize selectedReportId when company loads
  useEffect(() => {
    if (company?.latest_report?.id && !selectedReportId) {
      setSelectedReportId(company.latest_report.id);
    }
  }, [company?.latest_report?.id, selectedReportId]);
  
  // Derive selected report from completedReports
  const selectedReport = useMemo(() => {
    if (!selectedReportId) return completedReports[0] || null;
    return completedReports.find(r => r.id === selectedReportId) || completedReports[0] || null;
  }, [selectedReportId, completedReports]);

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

  // Use selected report data instead of latest_report
  const keyHighlights = selectedReport?.key_highlights || null;
  const reportPeriod = selectedReport?.report_period || null;

  const overviewContent = (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Key Highlights - 3 columns */}
      <div className="lg:col-span-3">
        <PortfolioCompanyLastNews
          keyHighlights={keyHighlights}
          reportPeriod={reportPeriod}
          lastNewsUpdatedAt={selectedReport?.created_at || company.last_news_updated_at}
        />
      </div>

      {/* Sidebar - 2 columns */}
      <div className="lg:col-span-2">
        <PortfolioCompanyOverview 
          company={company}
          reports={completedReports}
          selectedReportId={selectedReportId}
          onReportChange={setSelectedReportId}
        />
      </div>
    </div>
  );

  const documentsContent = <PortfolioDocumentsBrowser companyId={company.id} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PortfolioCompanyHeader
        companyName={company.company_name}
        domain={company.domain}
        preview={company.preview}
        sectors={company.sectors}
        investmentDate={company.investment_date}
      />

      {/* Tabs */}
      <DealTabs 
        overviewContent={overviewContent} 
        foldersContent={documentsContent}
      />
    </div>
  );
}

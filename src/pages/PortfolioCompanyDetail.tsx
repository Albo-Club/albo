import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { PortfolioCompanyHeader } from "@/components/portfolio/PortfolioCompanyHeader";
import { PortfolioCompanyLastNews } from "@/components/portfolio/PortfolioCompanyLastNews";
import { PortfolioCompanyOverview } from "@/components/portfolio/PortfolioCompanyOverview";
import { PortfolioDocumentsBrowser } from "@/components/portfolio/PortfolioDocumentsBrowser";
import { DealTabs } from "@/components/deals/DealTabs";

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePortfolioCompanyWithReport(id);

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

  // Extraire les données du dernier report
  const latestReport = company.latest_report;
  const headline = latestReport?.headline || company.last_news;
  const keyHighlights = latestReport?.key_highlights || null;
  const reportPeriod = latestReport?.report_period || latestReport?.report_title || null;

  const overviewContent = (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Key Highlights avec Headline en bulle - 3 columns */}
      <div className="lg:col-span-3">
        <PortfolioCompanyLastNews
          headline={headline}
          keyHighlights={keyHighlights}
          reportPeriod={reportPeriod}
          lastNewsUpdatedAt={company.last_news_updated_at}
        />
      </div>

      {/* Sidebar - 2 columns */}
      <div className="lg:col-span-2">
        <PortfolioCompanyOverview company={company} />
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

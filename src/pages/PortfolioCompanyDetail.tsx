import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioCompany } from "@/hooks/usePortfolioCompany";
import { PortfolioCompanyHeader } from "@/components/portfolio/PortfolioCompanyHeader";
import { PortfolioCompanyLastNews } from "@/components/portfolio/PortfolioCompanyLastNews";
import { PortfolioCompanyInfoCard } from "@/components/portfolio/PortfolioCompanyInfoCard";
import { DealTabs } from "@/components/deals/DealTabs";

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePortfolioCompany(id);

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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Last News - 3 columns */}
      <div className="lg:col-span-3">
        <PortfolioCompanyLastNews
          lastNews={company.last_news}
          lastNewsUpdatedAt={company.last_news_updated_at}
        />
      </div>

      {/* Info Card - 2 columns */}
      <div className="lg:col-span-2">
        <PortfolioCompanyInfoCard company={company} />
      </div>
    </div>
  );

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
      <DealTabs overviewContent={overviewContent} />
    </div>
  );
}

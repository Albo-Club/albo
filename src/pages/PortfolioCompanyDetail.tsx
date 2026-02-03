import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { useCompanyReports } from "@/hooks/useCompanyReports";
import { PortfolioCompanyHeader } from "@/components/portfolio/PortfolioCompanyHeader";
import { ReportsTimeline } from "@/components/portfolio/ReportsTimeline";
import { PortfolioCompanyOverview } from "@/components/portfolio/PortfolioCompanyOverview";
import { PortfolioDocumentsBrowser } from "@/components/portfolio/PortfolioDocumentsBrowser";
import { CompanyEmailsTab } from "@/components/portfolio/CompanyEmailsTab";
import { DealTabs } from "@/components/deals/DealTabs";

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePortfolioCompanyWithReport(id);
  const { data: allReports = [], isLoading: reportsLoading } = useCompanyReports(id);
  
  // Filter completed reports and sort by report_date DESC, then created_at DESC (matches Supabase trigger logic)
  const sortedReports = useMemo(() => {
    const completed = allReports.filter(r => r.processing_status === 'completed');
    return [...completed].sort((a, b) => {
      // Primary sort: report_date descending
      const dateA = a.report_date || '';
      const dateB = b.report_date || '';
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
      // Secondary sort: created_at descending
      const createdA = a.created_at || '';
      const createdB = b.created_at || '';
      if (createdA > createdB) return -1;
      if (createdA < createdB) return 1;
      return 0;
    });
  }, [allReports]);
  
  // Latest report for the sidebar metrics
  const latestReport = sortedReports[0] || null;

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
      {/* Colonne gauche - Scrollable */}
      <div className="lg:col-span-3 min-h-0">
        <ReportsTimeline reports={sortedReports} companyId={company.id} companyName={company.company_name} />
      </div>
      
      {/* Colonne droite - Sticky */}
      <div className="lg:col-span-2">
        <div className="sticky top-4">
          <PortfolioCompanyOverview 
            company={company}
            latestReport={latestReport}
          />
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
        emailsContent={emailsContent}
        foldersContent={documentsContent}
      />
    </div>
  );
}

import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { useCompanyReports } from "@/hooks/useCompanyReports";
import { parseReportPeriodToSortDate, isPeriodRange } from "@/lib/reportPeriodParser";
import { PortfolioCompanyHeader } from "@/components/portfolio/PortfolioCompanyHeader";
import { CompanyMetricsModule } from "@/components/company/CompanyMetricsModule";
import { CompanyReportsList } from "@/components/company/CompanyReportsList";
import { CompanyNewsCarousel } from "@/components/company/CompanyNewsCarousel";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePortfolioCompanyWithReport(id);
  const { data: allReports = [], isLoading: reportsLoading } = useCompanyReports(id);

  const sortedReports = useMemo(() => {
    const completed = allReports.filter((r) => r.processing_status === "completed");
    return [...completed].sort((a, b) => {
      const periodDateA = parseReportPeriodToSortDate(a.report_period);
      const periodDateB = parseReportPeriodToSortDate(b.report_period);
      if (periodDateA.getTime() !== periodDateB.getTime()) {
        return periodDateB.getTime() - periodDateA.getTime();
      }
      const isRangeA = isPeriodRange(a.report_period);
      const isRangeB = isPeriodRange(b.report_period);
      if (isRangeA !== isRangeB) return isRangeA ? 1 : -1;
      return (b.report_date || "").localeCompare(a.report_date || "");
    });
  }, [allReports]);

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
        <p className="text-muted-foreground">Entreprise introuvable.</p>
        <Button onClick={() => navigate("/portfolio")} className="mt-4">
          Retour au portfolio
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PortfolioCompanyHeader
        companyName={company.company_name}
        domain={company.domain}
        preview={company.preview}
        sectors={company.sectors}
        investmentDate={company.investment_date}
      />

      {/* Metrics Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Métriques</h2>
        <CompanyMetricsModule
          companyId={company.id}
          displayedMetrics={(company as any).displayed_metrics || []}
        />
      </section>

      {/* Reports Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Rapports</h2>
        <CompanyReportsList reports={sortedReports} isLoading={reportsLoading} />
      </section>

      {/* News Section — hidden for now
      <section>
        <h2 className="text-lg font-semibold mb-4">Actualités</h2>
        <CompanyNewsCarousel companyId={company.id} />
      </section>
      */}
    </div>
  );
}

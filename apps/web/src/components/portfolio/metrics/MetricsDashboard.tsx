import { Loader2, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyDashboardMetrics } from "@/hooks/useCompanyDashboardMetrics";
import { MetricsKpiCards } from "./MetricsKpiCards";
import { MetricsCharts } from "./MetricsCharts";
import { MetricsTable } from "./MetricsTable";

interface Props {
  companyId: string;
}

export function MetricsDashboard({ companyId }: Props) {
  const { data, isLoading, error, refetch } = useCompanyDashboardMetrics(companyId);

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">Erreur lors du chargement des métriques</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      </div>
    );
  }

  const kpis = data?.kpi_cards ?? [];
  const series = data?.time_series ?? [];
  const available = data?.available_metrics ?? [];

  if (!kpis.length && !series.length && !available.length) {
    return (
      <div className="text-center py-16 space-y-3">
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Aucune métrique disponible. Les métriques seront automatiquement extraites des reports importés.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MetricsKpiCards cards={kpis} companyId={companyId} />
      <MetricsCharts series={series} companyId={companyId} />
      <MetricsTable metrics={available} timeSeries={series} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* KPI skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[110px] rounded-lg" />
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-[280px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

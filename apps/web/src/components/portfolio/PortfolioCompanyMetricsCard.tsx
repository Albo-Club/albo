import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Wallet,
  BarChart3,
  Users,
  Banknote,
  Clock,
  PiggyBank,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioCompanyMetrics } from "@/hooks/usePortfolioCompany";

interface MetricItem {
  label: string;
  value: number | null | undefined;
  growth?: number | null;
  icon: React.ElementType;
  format: 'currency' | 'number' | 'months';
}

function formatCurrencyCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1_000_000_000) {
    return `${sign}€${(absValue / 1_000_000_000).toFixed(1)}Md`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}€${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}€${(absValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}€${absValue.toFixed(0)}`;
}

function formatGrowth(growth: number | null | undefined): string | null {
  if (growth === null || growth === undefined) return null;
  if (growth >= 1) {
    return `x${growth.toFixed(1)}`;
  }
  return `${((growth - 1) * 100).toFixed(0)}%`;
}

function GrowthIndicator({ growth }: { growth: number | null | undefined }) {
  if (growth === null || growth === undefined) return null;
  
  const isPositive = growth >= 1;
  const isNeutral = growth === 1;
  
  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1",
        isPositive && !isNeutral && "text-green-600",
        !isPositive && "text-destructive",
        isNeutral && "text-muted-foreground"
      )}
    >
      {isPositive && !isNeutral && <TrendingUp className="h-3 w-3" />}
      {!isPositive && <TrendingDown className="h-3 w-3" />}
      {isNeutral && <Minus className="h-3 w-3" />}
      {formatGrowth(growth)} vs N-1
    </span>
  );
}

interface PortfolioCompanyMetricsCardProps {
  metrics: PortfolioCompanyMetrics | null;
}

export function PortfolioCompanyMetricsCard({ metrics }: PortfolioCompanyMetricsCardProps) {
  if (!metrics) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Métriques clés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aucune métrique disponible. Les données seront extraites du prochain report.
          </p>
        </CardContent>
      </Card>
    );
  }

  const allMetrics: MetricItem[] = [
    {
      label: "AUM",
      value: metrics.aum ?? null,
      growth: metrics.aum_growth_yoy,
      icon: Wallet,
      format: 'currency' as const,
    },
    {
      label: "MRR",
      value: metrics.mrr ?? null,
      growth: metrics.mrr_growth_yoy,
      icon: BarChart3,
      format: 'currency' as const,
    },
    {
      label: "EBITDA",
      value: metrics.ebitda ?? null,
      icon: PiggyBank,
      format: 'currency' as const,
    },
    {
      label: "Employés",
      value: metrics.employees ?? null,
      growth: metrics.employees_growth_yoy,
      icon: Users,
      format: 'number' as const,
    },
    {
      label: "Cash Position",
      value: metrics.cash_position ?? null,
      icon: Banknote,
      format: 'currency' as const,
    },
    {
      label: "Runway",
      value: metrics.runway_months ?? null,
      icon: Clock,
      format: 'months' as const,
    },
  ];
  
  const metricItems = allMetrics.filter(item => item.value !== null);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Métriques clés
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metricItems.map((item, index) => {
            const Icon = item.icon;
            let displayValue = '-';
            
            if (item.value !== null && item.value !== undefined) {
              if (item.format === 'currency') {
                displayValue = formatCurrencyCompact(item.value);
              } else if (item.format === 'months') {
                displayValue = `${item.value} mois`;
              } else {
                displayValue = String(item.value);
              }
            }

            const isNegative = typeof item.value === 'number' && item.value < 0;

            return (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      "font-semibold",
                      isNegative && "text-destructive"
                    )}
                  >
                    {displayValue}
                  </span>
                  {item.growth && <GrowthIndicator growth={item.growth} />}
                </div>
              </div>
            );
          })}

          {metricItems.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Aucune métrique extraite du dernier report.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

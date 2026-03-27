import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard as KpiCardType } from "@/hooks/useCompanyDashboardMetrics";
import { getMetricLabel, formatMetricValue, shortPeriod } from "./metricLabels";

interface Props {
  cards: KpiCardType[];
  companyId: string;
}

export function MetricsKpiCards({ cards, companyId }: Props) {
  const navigate = useNavigate();

  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const clickable = !!card.source_report_id;
        return (
          <Card
            key={card.key}
            className={`p-5 relative ${clickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            onClick={
              clickable
                ? () => navigate(`/portfolio/${companyId}/reports/${card.source_report_id}`)
                : undefined
            }
          >
            {clickable && (
              <ExternalLink className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground" />
            )}

            <p className="text-xs font-medium text-muted-foreground mb-1">
              {getMetricLabel(card.key)}
            </p>

            <p className="text-2xl font-bold tracking-tight">
              {formatMetricValue(card.latest_value, card.metric_type)}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">{shortPeriod(card.latest_period)}</span>

              {card.change_pct != null && (
                <TrendBadge pct={card.change_pct} />
              )}
            </div>

            {card.previous_period && (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                vs {shortPeriod(card.previous_period)}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function TrendBadge({ pct }: { pct: number }) {
  const formatted = `${pct > 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;

  if (pct > 0)
    return (
      <Badge variant="outline" className="text-[11px] py-0 px-1.5 border-green-200 bg-green-50 text-green-700 gap-0.5">
        <TrendingUp className="h-3 w-3" />
        {formatted}
      </Badge>
    );

  if (pct < 0)
    return (
      <Badge variant="outline" className="text-[11px] py-0 px-1.5 border-red-200 bg-red-50 text-red-700 gap-0.5">
        <TrendingDown className="h-3 w-3" />
        {formatted}
      </Badge>
    );

  return (
    <Badge variant="outline" className="text-[11px] py-0 px-1.5 text-muted-foreground">
      0%
    </Badge>
  );
}

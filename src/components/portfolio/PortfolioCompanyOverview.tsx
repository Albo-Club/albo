import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  Wallet, 
  PieChart, 
  Briefcase, 
  Globe, 
  Building2, 
  Calendar,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Banknote,
  Clock,
  BarChart3,
  PiggyBank,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { differenceInDays, differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { usePortfolioCompanyMetrics, PortfolioCompanyMetric } from "@/hooks/usePortfolioCompanyMetrics";
import { SectorBadges } from "./SectorBadges";
import { formatNumberCompact, formatShortDate, formatOwnership, formatMetricLabel, formatMetricValue, formatMetricDate } from "@/lib/portfolioFormatters";
import { ReportSummaryModal } from "./ReportSummaryModal";

// Investment type color mapping
const INVESTMENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Share': { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/20' },
  'SPV Share': { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20' },
  'BSA Air': { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20' },
  'Royalties': { bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/20' },
  'Obligation': { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-500/20' },
  'OCA': { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-500/20' },
  'SPV SAFE': { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-500/20' },
};

// Icon mapping for metric keys
const METRIC_ICONS: Record<string, React.ElementType> = {
  mrr: BarChart3,
  arr: BarChart3,
  revenue: TrendingUp,
  customers: Users,
  aum: Wallet,
  ebitda: PiggyBank,
  cash_position: Banknote,
  runway_months: Clock,
  employees: Users,
};

function formatCurrency(cents: number | null): string {
  if (cents === null) return '-';
  const euros = cents / 100;
  if (euros >= 1_000_000) {
    return `${(euros / 1_000_000).toFixed(1).replace('.', ',')}M€`;
  }
  if (euros >= 1_000) {
    return `${(euros / 1_000).toFixed(0)}k€`;
  }
  return `${euros.toFixed(0)}€`;
}

function TrendIcon({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  
  if (value === 0) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  
  if (value > 0) {
    return <TrendingUp className="h-3 w-3 text-green-500" />;
  }
  
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

function MetricDateBadge({ date }: { date: string }) {
  const daysDiff = differenceInDays(new Date(), new Date(date));
  
  // > 90 days = destructive with alert icon
  if (daysDiff > 90) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-destructive italic">
        <AlertCircle className="h-2.5 w-2.5" />
        {formatMetricDate(date)}
      </span>
    );
  }
  
  // > 30 days = amber warning
  if (daysDiff > 30) {
    return (
      <span className="text-[10px] text-amber-500 italic">
        {formatMetricDate(date)}
      </span>
    );
  }
  
  // Recent = normal muted
  return (
    <span className="text-[10px] text-muted-foreground italic">
      {formatMetricDate(date)}
    </span>
  );
}

interface PortfolioCompanyOverviewProps {
  company: PortfolioCompanyWithReport;
}

export function PortfolioCompanyOverview({ company }: PortfolioCompanyOverviewProps) {
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  
  // Fetch individual metrics from the new table
  const { metrics, isLoading: metricsLoading } = usePortfolioCompanyMetrics(company.id);
  
  const latestReport = company.latest_report;
  const reportPeriod = latestReport?.report_period;
  const reportDate = reportPeriod || latestReport?.report_date;
  const isReportOld = reportDate 
    ? differenceInMonths(new Date(), new Date(reportDate)) >= 1 
    : true;
  
  const formattedReportDate = reportDate 
    ? format(new Date(reportDate), "d MMM yyyy", { locale: fr })
    : null;

  const investmentTypeColors = company.investment_type 
    ? INVESTMENT_TYPE_COLORS[company.investment_type] || INVESTMENT_TYPE_COLORS['Share']
    : null;

  // Limit metrics display
  const MAX_VISIBLE_METRICS = 9;
  const visibleMetrics = showAllMetrics ? metrics : metrics.slice(0, MAX_VISIBLE_METRICS);
  const hasMoreMetrics = metrics.length > MAX_VISIBLE_METRICS;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Informations</h3>
          {formattedReportDate ? (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] gap-1 cursor-pointer hover:bg-muted transition-colors",
                isReportOld && "border-amber-500/50 text-amber-600 dark:text-amber-400"
              )}
              onClick={() => setShowSummaryModal(true)}
            >
              <FileText className="h-2.5 w-2.5" />
              {formattedReportDate}
              {isReportOld && <AlertTriangle className="h-2.5 w-2.5" />}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Aucun report
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Investment Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Entry Valuation */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Valorisation d'entrée</p>
              <p className="text-xs font-medium truncate">
                {formatCurrency(company.entry_valuation_cents)}
              </p>
            </div>
          </div>
          
          {/* Amount Invested */}
          <div className="flex items-center gap-2">
            <Wallet className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Montant investi</p>
              <p className="text-xs font-medium truncate">
                {formatCurrency(company.amount_invested_cents)}
              </p>
            </div>
          </div>
          
          {/* Ownership */}
          <div className="flex items-center gap-2">
            <PieChart className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Participation</p>
              <p className="text-xs font-medium truncate">
                {formatOwnership(company.ownership_percentage)}
              </p>
            </div>
          </div>
          
          {/* Investment Type */}
          <div className="flex items-center gap-2">
            <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Type</p>
              {company.investment_type && investmentTypeColors ? (
                <Badge 
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    investmentTypeColors.bg,
                    investmentTypeColors.text,
                    investmentTypeColors.border
                  )}
                >
                  {company.investment_type}
                </Badge>
              ) : (
                <p className="text-xs font-medium">-</p>
              )}
            </div>
          </div>
        </div>

        {/* Domain */}
        {company.domain && (
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground">Domaine</p>
              <a 
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline truncate block"
              >
                {company.domain}
              </a>
            </div>
          </div>
        )}

        {/* Sectors */}
        {company.sectors && company.sectors.length > 0 && (
          <div className="flex items-start gap-2">
            <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">Secteurs</p>
              <SectorBadges sectors={company.sectors} maxDisplay={3} />
            </div>
          </div>
        )}

        {/* Metrics Section - Using new individual metrics */}
        {metrics.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Métriques
                </p>
              </div>
              
              {/* Grid layout for metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleMetrics.map((metric) => {
                  const Icon = METRIC_ICONS[metric.metric_key] || Activity;
                  const numValue = parseFloat(metric.metric_value);
                  const isNegative = !isNaN(numValue) && numValue < 0;
                  
                  return (
                    <div 
                      key={metric.id} 
                      className="flex flex-col p-2 rounded-md bg-muted/30"
                    >
                      {/* Line 1: Icon + Label */}
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {formatMetricLabel(metric.metric_key)}
                        </span>
                      </div>
                      
                      {/* Line 2: Value */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isNegative && "text-destructive"
                          )}
                        >
                          {formatMetricValue(metric.metric_value, metric.metric_type, metric.metric_key)}
                        </span>
                        <TrendIcon value={isNaN(numValue) ? null : numValue} />
                      </div>
                      
                      {/* Line 3: Date */}
                      <MetricDateBadge date={metric.updated_at} />
                    </div>
                  );
                })}
              </div>
              
              {/* Show more/less button */}
              {hasMoreMetrics && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground"
                  onClick={() => setShowAllMetrics(!showAllMetrics)}
                >
                  {showAllMetrics ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Voir moins
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Voir plus ({metrics.length - MAX_VISIBLE_METRICS} autres)
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Metrics loading state */}
        {metricsLoading && (
          <>
            <Separator />
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-muted-foreground">Chargement des métriques...</span>
            </div>
          </>
        )}

        {/* Last News Section */}
        {company.last_news && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Dernières nouvelles
                </p>
                {company.last_news_updated_at && (
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(company.last_news_updated_at), "d MMM yyyy", { locale: fr })}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-4">
                {company.last_news}
              </p>
            </div>
          </>
        )}

        {/* Investment Date */}
        {company.investment_date && (
          <>
            <Separator />
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Date d'investissement</p>
                <p className="text-xs font-medium">
                  {format(new Date(company.investment_date), "d MMMM yyyy", { locale: fr })}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
      
      {/* Report Summary Modal */}
      <ReportSummaryModal
        open={showSummaryModal}
        onOpenChange={setShowSummaryModal}
        reportPeriod={reportPeriod ? format(new Date(reportPeriod), "MMMM yyyy", { locale: fr }) : null}
        summary={latestReport?.summary || null}
      />
    </Card>
  );
}

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Activity
} from "lucide-react";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { SectorBadges } from "./SectorBadges";
import { formatNumberCompact, formatShortDate } from "@/lib/portfolioFormatters";

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

interface MetricConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  format: 'currency' | 'number' | 'months';
  growthKey?: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'aum', label: 'AuM', icon: Wallet, format: 'currency', growthKey: 'aum_growth_yoy' },
  { key: 'mrr', label: 'MRR', icon: BarChart3, format: 'currency', growthKey: 'mrr_growth_yoy' },
  { key: 'revenue', label: 'Revenue', icon: TrendingUp, format: 'currency' },
  { key: 'ebitda', label: 'EBITDA', icon: PiggyBank, format: 'currency' },
  { key: 'employees', label: 'Employés', icon: Users, format: 'number', growthKey: 'employees_growth_yoy' },
  { key: 'cash_position', label: 'Cash', icon: Banknote, format: 'currency' },
  { key: 'runway_months', label: 'Runway', icon: Clock, format: 'months' },
];

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

function formatPercentage(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
}

function TrendIcon({ value, growth }: { value: number | null | undefined; growth?: number | null }) {
  // Determine trend based on growth or value sign
  let isPositive = true;
  let isNeutral = false;
  
  if (growth !== null && growth !== undefined) {
    isPositive = growth >= 1;
    isNeutral = growth === 1;
  } else if (value !== null && value !== undefined) {
    isPositive = value >= 0;
    isNeutral = value === 0;
  } else {
    return null;
  }
  
  if (isNeutral) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  
  if (isPositive) {
    return <TrendingUp className="h-3 w-3 text-green-500" />;
  }
  
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

interface PortfolioCompanyOverviewProps {
  company: PortfolioCompanyWithReport;
}

export function PortfolioCompanyOverview({ company }: PortfolioCompanyOverviewProps) {
  const latestReport = company.latest_report;
  const reportDate = latestReport?.processed_at || latestReport?.report_date;
  const isReportOld = reportDate 
    ? differenceInMonths(new Date(), new Date(reportDate)) >= 1 
    : true;
  
  const formattedReportDate = reportDate 
    ? format(new Date(reportDate), "d MMM yyyy", { locale: fr })
    : null;

  const shortReportDate = reportDate ? formatShortDate(reportDate) : null;

  const investmentTypeColors = company.investment_type 
    ? INVESTMENT_TYPE_COLORS[company.investment_type] || INVESTMENT_TYPE_COLORS['Share']
    : null;

  // Get metrics from latest_metrics or report
  const metrics = company.latest_metrics || latestReport?.metrics || {};

  // Build metric items with proper formatting
  const metricItems = METRIC_CONFIGS
    .map(config => {
      const value = metrics[config.key as keyof typeof metrics] as number | null | undefined;
      const growth = config.growthKey 
        ? (metrics[config.growthKey as keyof typeof metrics] as number | null | undefined)
        : null;
      
      if (value === null || value === undefined) return null;
      
      let displayValue = '-';
      if (config.format === 'currency') {
        displayValue = formatNumberCompact(value, '€');
      } else if (config.format === 'months') {
        displayValue = `${value} mois`;
      } else {
        displayValue = value.toLocaleString('fr-FR');
      }
      
      return {
        ...config,
        value,
        growth,
        displayValue,
        reportDate: shortReportDate,
      };
    })
    .filter(Boolean);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Informations</h3>
          {formattedReportDate ? (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] gap-1",
                isReportOld && "border-amber-500/50 text-amber-600 dark:text-amber-400"
              )}
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
                {formatPercentage(company.ownership_percentage)}
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

        {/* Metrics Section */}
        {metricItems.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Métriques
                </p>
              </div>
              <div className="space-y-2">
                {metricItems.map((item) => {
                  if (!item) return null;
                  const Icon = item.icon;
                  const isNegative = typeof item.value === 'number' && item.value < 0;

                  return (
                    <div key={item.key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-muted">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          {item.reportDate && (
                            <span className="text-[10px] text-muted-foreground/60">{item.reportDate}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isNegative && "text-red-500"
                          )}
                        >
                          {item.displayValue}
                        </span>
                        <TrendIcon value={item.value} growth={item.growth} />
                      </div>
                    </div>
                  );
                })}
              </div>
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
    </Card>
  );
}

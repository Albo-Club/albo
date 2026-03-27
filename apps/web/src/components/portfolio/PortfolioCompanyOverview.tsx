import { useMemo, useState } from "react";
import { useCompanyDomains } from "@/hooks/useCompanyDomains";
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
  TrendingUp,
  Users,
  Banknote,
  Clock,
  BarChart3,
  PiggyBank,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { SectorBadges } from "./SectorBadges";
import { formatOwnership, formatMetricLabel } from "@/lib/portfolioFormatters";
import type { CompanyReport } from "@/hooks/useCompanyReports";
import { EditPortfolioCompanyModal } from "./EditPortfolioCompanyModal";
import { DeletePortfolioCompanyDialog } from "./DeletePortfolioCompanyDialog";
import { useTranslation } from "react-i18next";
import { usePortfolioCompanyMetrics, PortfolioCompanyMetric } from "@/hooks/usePortfolioCompanyMetrics";

const METRIC_PRIORITY_LIST = ["aum", "mrr", "arr", "revenue", "ebitda", "cash_position", "runway_months", "employees", "customers"];

const METRIC_PRIORITY: Record<string, number> = {};
METRIC_PRIORITY_LIST.forEach((k, i) => { METRIC_PRIORITY[k] = i + 1; });

function formatMetricDisplayValue(value: string, metricType: string, metricKey: string, lang = 'fr', monthsLabel = 'mois'): string {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  const lowerKey = metricKey.toLowerCase();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  
  const isCurrencyMetric = metricType === 'currency' || 
    ['aum', 'mrr', 'arr', 'cash', 'cash_position', 'ebitda', 'revenue', 'debt', 'burn', 'inflow', 'outflow', 'cash_flow', 'gross_margin'].some(k => lowerKey.includes(k));
  
  if (isCurrencyMetric) {
    const absValue = Math.abs(numValue);
    const sign = numValue < 0 ? '-' : '';
    if (absValue >= 1_000_000_000) return `${sign}${(absValue / 1_000_000_000).toFixed(1).replace('.', ',')}Md€`;
    if (absValue >= 1_000_000) return `${sign}${(absValue / 1_000_000).toFixed(1).replace('.', ',')}M€`;
    if (absValue >= 1_000) return `${sign}${Math.round(absValue / 1_000)}k€`;
    return `${sign}${Math.round(absValue)}€`;
  }
  
  const isPercentageMetric = metricType === 'percentage' || 
    lowerKey.includes('rate') || lowerKey.includes('growth') || lowerKey.includes('margin');
  
  if (isPercentageMetric) {
    if (lowerKey.includes('growth') && lowerKey.includes('yoy')) {
      return `x${numValue.toFixed(1).replace('.', ',')}`;
    }
    if (Math.abs(numValue) <= 1) return `${(numValue * 100).toFixed(1).replace('.', ',')}%`;
    return `${numValue.toFixed(1).replace('.', ',')}%`;
  }
  
  if (lowerKey.includes('months') || lowerKey.includes('runway')) {
    return `${Math.round(numValue)} ${monthsLabel}`;
  }
  
  if (lowerKey.includes('employees') || lowerKey.includes('customers') || lowerKey.includes('count') || lowerKey.includes('contracts')) {
    if (numValue >= 1_000_000) return `${(numValue / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (numValue >= 10_000) return `${Math.round(numValue / 1_000)}k`;
    return numValue.toLocaleString(locale);
  }
  
  return numValue.toLocaleString(locale);
}

const INVESTMENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Share': { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/20' },
  'SPV Share': { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20' },
  'BSA Air': { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20' },
  'Royalties': { bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/20' },
  'Obligation': { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-500/20' },
  'OCA': { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-500/20' },
  'SPV SAFE': { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-500/20' },
};

const METRIC_ICONS: Record<string, React.ElementType> = {
  mrr: BarChart3, arr: BarChart3, revenue: TrendingUp, customers: Users,
  aum: Wallet, ebitda: PiggyBank, cash_position: Banknote, runway_months: Clock, employees: Users,
};

function formatCurrency(euros: number | null): string {
  if (euros === null) return '-';
  if (euros >= 1_000_000) return `${(euros / 1_000_000).toFixed(1).replace('.', ',')}M€`;
  if (euros >= 1_000) return `${(euros / 1_000).toFixed(0)}k€`;
  return `${euros.toFixed(0)}€`;
}

interface OverviewMetricItem {
  canonicalKey: string;
  metricValue: string;
  metricType: string;
  reportPeriod: string | null;
}

/** Pick the latest value per canonical_key from portfolio_company_metrics */
function pickLatestMetrics(
  metrics: PortfolioCompanyMetric[],
  displayedFavorites: string[],
): OverviewMetricItem[] {
  // Group by canonical_key, pick the one with the latest period_sort_date
  const latestMap = new Map<string, PortfolioCompanyMetric>();
  for (const m of metrics) {
    const ck = m.canonical_key || m.metric_key;
    const existing = latestMap.get(ck);
    if (!existing || (m.period_sort_date || "") > (existing.period_sort_date || "")) {
      latestMap.set(ck, m);
    }
  }

  let keysToShow: string[];
  if (displayedFavorites.length > 0) {
    keysToShow = displayedFavorites.filter((ck) => latestMap.has(ck));
  } else {
    // Fallback: top 6 by priority
    keysToShow = [...latestMap.keys()]
      .sort((a, b) => (METRIC_PRIORITY[a] || 100) - (METRIC_PRIORITY[b] || 100))
      .slice(0, 6);
  }

  return keysToShow.map((ck) => {
    const m = latestMap.get(ck)!;
    return {
      canonicalKey: ck,
      metricValue: m.metric_value,
      metricType: m.metric_type,
      reportPeriod: m.report_period,
    };
  });
}

interface PortfolioCompanyOverviewProps {
  company: PortfolioCompanyWithReport;
  latestReport: CompanyReport | null;
}

export function PortfolioCompanyOverview({ 
  company, 
  latestReport,
}: PortfolioCompanyOverviewProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { domains: companyDomains } = useCompanyDomains(company.id);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? frLocale : enUS;
  const lang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const primaryDomain = companyDomains.find(d => d.is_primary)?.domain || company.domain;
  const extraDomainsCount = Math.max(0, companyDomains.length - 1);

  const { metrics: allMetrics } = usePortfolioCompanyMetrics(company.id);

  const displayedFavorites: string[] = (company as any).displayed_metrics || [];

  const displayedMetrics = useMemo(
    () => pickLatestMetrics(allMetrics, displayedFavorites),
    [allMetrics, displayedFavorites],
  );

  const investmentTypeColors = company.investment_type 
    ? INVESTMENT_TYPE_COLORS[company.investment_type] || INVESTMENT_TYPE_COLORS['Share']
    : null;

  return (
  <>
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('companyDetail.info.title')}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditModalOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t('companyDetail.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={t('companyDetail.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.entryValuation')}</p>
              <p className="text-xs font-medium truncate">{formatCurrency(company.entry_valuation_euros)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Wallet className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.amountInvested')}</p>
              <p className="text-xs font-medium truncate">{formatCurrency(company.amount_invested_euros)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <PieChart className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.ownership')}</p>
              <p className="text-xs font-medium truncate">{formatOwnership(company.ownership_percentage)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.investmentType')}</p>
              {company.investment_type && investmentTypeColors ? (
                <Badge 
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", investmentTypeColors.bg, investmentTypeColors.text, investmentTypeColors.border)}
                >
                  {company.investment_type}
                </Badge>
              ) : (
                <p className="text-xs font-medium">-</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.domain')}</p>
              {primaryDomain ? (
                <div className="flex items-center gap-1">
                  <a href={`https://${primaryDomain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
                    {primaryDomain}
                  </a>
                  {extraDomainsCount > 0 && (
                    <button onClick={() => setEditModalOpen(true)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      +{extraDomainsCount}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs font-medium">-</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.investmentDate')}</p>
              <p className="text-xs font-medium">
                {company.investment_date 
                  ? format(new Date(company.investment_date), "d MMMM yyyy", { locale: dateLocale })
                  : "-" }
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.sectors')}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {company.sectors && company.sectors.length > 0 ? (
                  <SectorBadges sectors={company.sectors} maxDisplay={2} />
                ) : (
                  <p className="text-xs font-medium">-</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Users className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{t('companyDetail.info.relatedPeople')}</p>
              {company.related_people ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs font-medium truncate">{company.related_people}</p>
                  {company.related_people_linkedin && (
                    <a 
                      href={company.related_people_linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#0A66C2] hover:opacity-80 transition-opacity"
                      title={t('companyDetail.info.viewLinkedIn') || 'LinkedIn'}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs font-medium">-</p>
              )}
            </div>
          </div>
        </div>

        {displayedMetrics.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('companyDetail.metrics.title')}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                {displayedMetrics.map((metric) => {
                  const Icon = METRIC_ICONS[metric.canonicalKey] || Activity;
                  const numValue = parseFloat(metric.metricValue);
                  const isNegative = !isNaN(numValue) && numValue < 0;
                  const isPositiveVal = !isNaN(numValue) && numValue > 0;
                  
                  return (
                    <div key={metric.canonicalKey} className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {formatMetricLabel(metric.canonicalKey)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={cn("text-sm font-medium", isNegative && "text-destructive")}>
                          {formatMetricDisplayValue(metric.metricValue, metric.metricType, metric.canonicalKey, lang, t('companyDetail.metrics.months') || 'months')}
                        </span>
                        {isPositiveVal && !metric.canonicalKey.includes('growth') && (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                      {metric.reportPeriod && (
                        <span className="text-[9px] text-muted-foreground mt-0.5">{metric.reportPeriod}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>

    <EditPortfolioCompanyModal
      open={editModalOpen}
      onOpenChange={setEditModalOpen}
      company={company}
    />

    <DeletePortfolioCompanyDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      company={company}
    />
  </>
  );
}

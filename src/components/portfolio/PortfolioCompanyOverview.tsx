import { useMemo, useState } from "react";
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
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { SectorBadges } from "./SectorBadges";
import { formatOwnership, formatMetricLabel } from "@/lib/portfolioFormatters";
import type { CompanyReport } from "@/hooks/useCompanyReports";
import { PortfolioChatPanel } from "./PortfolioChatPanel";
import { EditPortfolioCompanyModal } from "./EditPortfolioCompanyModal";
import { DeletePortfolioCompanyDialog } from "./DeletePortfolioCompanyDialog";

// Metric priority for sorting
const METRIC_PRIORITY: Record<string, number> = {
  aum: 1,
  mrr: 2,
  arr: 3,
  revenue: 4,
  ebitda: 5,
  cash_position: 6,
  runway_months: 7,
  employees: 8,
  customers: 9,
  contracts_count: 10,
};

// Infer metric type from key
function inferMetricType(key: string): string {
  const k = key.toLowerCase();
  
  // Currency metrics
  if (k.includes('revenue') || k.includes('mrr') || k.includes('arr') || 
      k.includes('aum') || k.includes('cash') || k.includes('ebitda') ||
      k.includes('burn') || k.includes('debt') || k.includes('inflow') ||
      k.includes('outflow') || (k.includes('margin') && !k.includes('rate'))) {
    return 'currency';
  }
  
  // Percentage/rate metrics
  if (k.includes('rate') || k.includes('growth') || k.includes('churn')) {
    return 'percentage';
  }
  
  // Duration metrics
  if (k.includes('months') || k.includes('runway')) {
    return 'months';
  }
  
  // Count metrics
  if (k.includes('employees') || k.includes('customers') || k.includes('count') || k.includes('contracts')) {
    return 'count';
  }
  
  return 'number';
}

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

function formatCurrency(euros: number | null): string {
  if (euros === null) return '-';
  if (euros >= 1_000_000) {
    return `${(euros / 1_000_000).toFixed(1).replace('.', ',')}M€`;
  }
  if (euros >= 1_000) {
    return `${(euros / 1_000).toFixed(0)}k€`;
  }
  return `${euros.toFixed(0)}€`;
}

// Format metric value based on type and key - values are stored in EUROS (not cents)
function formatMetricDisplayValue(value: string, metricType: string, metricKey: string): string {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  const lowerKey = metricKey.toLowerCase();
  
  // Currency-like metrics - values are stored in EUROS (not cents)
  const isCurrencyMetric = metricType === 'currency' || 
    ['aum', 'mrr', 'arr', 'cash', 'cash_position', 'ebitda', 'revenue', 'debt', 'burn', 'inflow', 'outflow', 'cash_flow', 'gross_margin'].some(k => lowerKey.includes(k));
  
  if (isCurrencyMetric) {
    const absValue = Math.abs(numValue);
    const sign = numValue < 0 ? '-' : '';
    
    if (absValue >= 1_000_000_000) {
      return `${sign}${(absValue / 1_000_000_000).toFixed(1).replace('.', ',')}Md€`;
    }
    if (absValue >= 1_000_000) {
      return `${sign}${(absValue / 1_000_000).toFixed(1).replace('.', ',')}M€`;
    }
    if (absValue >= 1_000) {
      return `${sign}${Math.round(absValue / 1_000)}k€`;
    }
    return `${sign}${Math.round(absValue)}€`;
  }
  
  // Percentage-like metrics (growth rates, ratios)
  const isPercentageMetric = metricType === 'percentage' || 
    lowerKey.includes('rate') || lowerKey.includes('growth') || lowerKey.includes('margin');
  
  if (isPercentageMetric) {
    // YoY growth multipliers (2.3 = x2.3)
    if (lowerKey.includes('growth') && lowerKey.includes('yoy')) {
      return `x${numValue.toFixed(1).replace('.', ',')}`;
    }
    
    // Regular percentages - if value is <= 1, it's likely a decimal
    if (Math.abs(numValue) <= 1) {
      return `${(numValue * 100).toFixed(1).replace('.', ',')}%`;
    }
    // Already in percentage form
    return `${numValue.toFixed(1).replace('.', ',')}%`;
  }
  
  // Months (runway)
  if (lowerKey.includes('months') || lowerKey.includes('runway')) {
    return `${Math.round(numValue)} mois`;
  }
  
  // Count metrics (employees, customers, contracts)
  if (lowerKey.includes('employees') || lowerKey.includes('customers') || lowerKey.includes('count') || lowerKey.includes('contracts')) {
    if (numValue >= 1_000_000) {
      return `${(numValue / 1_000_000).toFixed(1).replace('.', ',')}M`;
    }
    if (numValue >= 10_000) {
      return `${Math.round(numValue / 1_000)}k`;
    }
    return numValue.toLocaleString('fr-FR');
  }
  
  // Default number formatting
  return numValue.toLocaleString('fr-FR');
}

interface ReportMetricItem {
  id: string;
  metric_key: string;
  metric_value: string;
  metric_type: string;
  report_period: string | null;
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
  
  // Metrics from the latest report
  const reportMetrics = useMemo<ReportMetricItem[]>(() => {
    if (!latestReport?.metrics) return [];
    
    return Object.entries(latestReport.metrics)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value], index) => ({
        id: `${latestReport.id}-${key}-${index}`,
        metric_key: key,
        metric_value: String(value),
        metric_type: inferMetricType(key),
        report_period: latestReport.report_period,
      }))
      .sort((a, b) => {
        const priorityA = METRIC_PRIORITY[a.metric_key] || 100;
        const priorityB = METRIC_PRIORITY[b.metric_key] || 100;
        return priorityA - priorityB;
      })
      .slice(0, 6);
  }, [latestReport]);

  const investmentTypeColors = company.investment_type 
    ? INVESTMENT_TYPE_COLORS[company.investment_type] || INVESTMENT_TYPE_COLORS['Share']
    : null;

  // Use report metrics directly (already sorted and limited to 6)
  const displayedMetrics = reportMetrics;

  return (
  <>
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Informations</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditModalOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Investment Info Grid - 4 rows, 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          {/* Row 1: Entry Valuation | Amount Invested */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Valorisation d'entrée</p>
              <p className="text-xs font-medium truncate">
                {formatCurrency(company.entry_valuation_euros)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Wallet className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Montant investi</p>
              <p className="text-xs font-medium truncate">
                {formatCurrency(company.amount_invested_euros)}
              </p>
            </div>
          </div>
          
          {/* Row 2: Ownership | Investment Type */}
          <div className="flex items-center gap-2">
            <PieChart className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Participation</p>
              <p className="text-xs font-medium truncate">
                {formatOwnership(company.ownership_percentage)}
              </p>
            </div>
          </div>
          
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

          {/* Row 3: Domain | Investment Date */}
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Domaine</p>
              {company.domain ? (
                <a 
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate block"
                >
                  {company.domain}
                </a>
              ) : (
                <p className="text-xs font-medium">-</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Date d'investissement</p>
              <p className="text-xs font-medium">
                {company.investment_date 
                  ? format(new Date(company.investment_date), "d MMMM yyyy", { locale: fr })
                  : "-"}
              </p>
            </div>
          </div>

          {/* Row 4: Sectors | Related People */}
          <div className="flex items-start gap-2">
            <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Secteurs</p>
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
              <p className="text-[10px] text-muted-foreground">Related People</p>
              {company.related_people ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs font-medium truncate">{company.related_people}</p>
                  {company.related_people_linkedin && (
                    <a 
                      href={company.related_people_linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#0A66C2] hover:opacity-80 transition-opacity"
                      title="Voir le profil LinkedIn"
                    >
                      <svg 
                        className="h-3 w-3" 
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                      >
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

        {/* Metrics Section - Compact 6 metrics max */}
        {displayedMetrics.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Métriques
              </p>
              
              {/* Compact 2-column grid */}
              <div className="grid grid-cols-2 gap-3">
                {displayedMetrics.map((metric) => {
                  const Icon = METRIC_ICONS[metric.metric_key] || Activity;
                  const numValue = parseFloat(metric.metric_value);
                  const isNegative = !isNaN(numValue) && numValue < 0;
                  const isPositive = !isNaN(numValue) && numValue > 0;
                  
                  return (
                    <div key={metric.id} className="flex flex-col">
                      {/* Line 1: Icon + Label */}
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {formatMetricLabel(metric.metric_key)}
                        </span>
                      </div>
                      
                      {/* Line 2: Value with optional trend icon */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isNegative && "text-destructive"
                          )}
                        >
                          {formatMetricDisplayValue(metric.metric_value, metric.metric_type, metric.metric_key)}
                        </span>
                        {isPositive && !metric.metric_key.includes('growth') && (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Report period indicator */}
              {latestReport?.report_period && (
                <p className="text-[10px] text-muted-foreground italic text-right pt-1">
                  Données: {latestReport.report_period}
                </p>
              )}
            </div>
          </>
        )}

      </CardContent>
    </Card>

    {/* Chat with this deal */}
    <PortfolioChatPanel 
      companyId={company.id} 
      companyName={company.company_name} 
    />

    {/* Edit Modal */}
    <EditPortfolioCompanyModal
      open={editModalOpen}
      onOpenChange={setEditModalOpen}
      company={company}
    />

    {/* Delete Dialog */}
    <DeletePortfolioCompanyDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      company={company}
    />
  </>
  );
}

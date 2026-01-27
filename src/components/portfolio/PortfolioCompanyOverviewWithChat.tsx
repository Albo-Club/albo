/**
 * PortfolioCompanyOverviewWithChat - Sidebar complète avec infos, métriques et chat
 * 
 * Ce composant remplace PortfolioCompanyOverview et ajoute le chat IA en bas
 * Structure:
 * - Informations de l'entreprise
 * - Métriques
 * - Chat with this deal (nouveau)
 */

import { useMemo } from "react";
import { 
  Building, 
  Calendar, 
  DollarSign, 
  Globe, 
  Percent, 
  TrendingUp, 
  Users,
  Briefcase,
  Activity,
  Wallet,
  Clock,
  BarChart3,
  PiggyBank,
  Target,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  Linkedin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SectorBadges } from "@/components/portfolio/SectorBadges";
import { PortfolioChatPanel } from "@/components/portfolio/PortfolioChatPanel";
import {
  formatCurrency,
  formatDate,
  formatPercentage,
} from "@/lib/portfolioFormatters";
import { getInvestmentTypeColors } from "@/types/portfolio";
import { PortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { CompanyReport } from "@/hooks/useCompanyReports";

// ============================================
// Types & Constants
// ============================================

interface ReportMetricItem {
  id: string;
  metric_key: string;
  metric_value: string;
  metric_type: string;
  report_period: string | null;
}

// Icônes pour les métriques
const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  aum: Wallet,
  mrr: BarChart3,
  arr: BarChart3,
  revenue: TrendingUp,
  ebitda: PiggyBank,
  cash_position: DollarSign,
  runway_months: Clock,
  burn_rate: Activity,
  employees: Users,
  customers: Target,
  contracts: Briefcase,
  growth: LineChart,
};

// Priorité d'affichage des métriques
const METRIC_PRIORITY: Record<string, number> = {
  aum: 1,
  mrr: 2,
  arr: 3,
  revenue: 4,
  ebitda: 5,
  cash_position: 6,
  runway_months: 7,
  burn_rate: 8,
  employees: 9,
  customers: 10,
};

// ============================================
// Helper Functions
// ============================================

function formatMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    aum: "AuM",
    mrr: "MRR",
    arr: "ARR",
    revenue: "Revenue",
    ebitda: "EBITDA",
    cash_position: "Cash Position",
    runway_months: "Runway Months",
    burn_rate: "Burn Rate",
    employees: "Employees",
    customers: "Customers",
    contracts: "Contracts",
    growth: "Growth",
  };
  return labels[key.toLowerCase()] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function inferMetricType(key: string): string {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('percent') || lowerKey.includes('ratio') || lowerKey.includes('margin') || lowerKey.includes('growth')) {
    return 'percentage';
  }
  if (lowerKey.includes('amount') || lowerKey.includes('revenue') || lowerKey.includes('mrr') || lowerKey.includes('arr') || 
      lowerKey.includes('aum') || lowerKey.includes('cash') || lowerKey.includes('burn') || lowerKey.includes('ebitda')) {
    return 'currency';
  }
  if (lowerKey.includes('months') || lowerKey.includes('runway')) {
    return 'number';
  }
  return 'number';
}

function formatMetricValue(value: string, key: string, type: string): string {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  const lowerKey = key.toLowerCase();
  
  // Currency values (in cents)
  if (type === 'currency' || lowerKey.includes('aum') || lowerKey.includes('mrr') || 
      lowerKey.includes('arr') || lowerKey.includes('revenue') || lowerKey.includes('cash') ||
      lowerKey.includes('burn') || lowerKey.includes('ebitda')) {
    const absValue = Math.abs(numValue);
    const sign = numValue < 0 ? '-' : '';
    
    if (absValue >= 1_000_000_00) {
      return `${sign}${(absValue / 100_000_000).toFixed(1).replace('.', ',')}M€`;
    }
    if (absValue >= 1_000_00) {
      return `${sign}${Math.round(absValue / 100_000)}k€`;
    }
    return `${sign}${(absValue / 100).toLocaleString('fr-FR')}€`;
  }
  
  // Percentage values
  if (type === 'percentage' || lowerKey.includes('percent') || lowerKey.includes('margin') || lowerKey.includes('growth')) {
    if (Math.abs(numValue) <= 1) {
      return `${(numValue * 100).toFixed(1).replace('.', ',')}%`;
    }
    return `${numValue.toFixed(1).replace('.', ',')}%`;
  }
  
  // Months
  if (lowerKey.includes('months') || lowerKey.includes('runway')) {
    return `${Math.round(numValue)} mois`;
  }
  
  // Count metrics
  if (numValue >= 1_000_000) {
    return `${(numValue / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (numValue >= 10_000) {
    return `${Math.round(numValue / 1_000)}k`;
  }
  return numValue.toLocaleString('fr-FR');
}

// ============================================
// Props
// ============================================

interface PortfolioCompanyOverviewWithChatProps {
  company: PortfolioCompanyWithReport;
  latestReport: CompanyReport | null;
}

// ============================================
// Component
// ============================================

export function PortfolioCompanyOverviewWithChat({ 
  company, 
  latestReport,
}: PortfolioCompanyOverviewWithChatProps) {
  
  // Process metrics from latest report
  const displayedMetrics = useMemo<ReportMetricItem[]>(() => {
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
    ? getInvestmentTypeColors(company.investment_type)
    : null;

  return (
    <div className="space-y-4">
      {/* ============================================ */}
      {/* Card: Informations */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Valorisation d'entrée */}
          {company.entry_valuation_cents && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span>Valorisation d'entrée</span>
              </div>
              <span className="font-medium">
                {formatCurrency(company.entry_valuation_cents)}
              </span>
            </div>
          )}

          {/* Montant investi */}
          {company.amount_invested_cents && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span>Montant investi</span>
              </div>
              <span className="font-medium">
                {formatCurrency(company.amount_invested_cents)}
              </span>
            </div>
          )}

          {/* Participation */}
          {company.ownership_percentage && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Percent className="h-3.5 w-3.5" />
                <span>Participation</span>
              </div>
              <span className="font-medium">
                {formatPercentage(company.ownership_percentage)}
              </span>
            </div>
          )}

          {/* Type d'investissement */}
          {company.investment_type && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />
                <span>Type</span>
              </div>
              <Badge 
                variant="outline"
                className={investmentTypeColors ? `${investmentTypeColors.bg} ${investmentTypeColors.text} border-0` : ''}
              >
                {company.investment_type}
              </Badge>
            </div>
          )}

          {/* Domaine */}
          {company.domain && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span>Domaine</span>
              </div>
              <a 
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {company.domain}
              </a>
            </div>
          )}

          {/* Secteurs */}
          {company.sectors && company.sectors.length > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Building className="h-3.5 w-3.5" />
                <span>Secteurs</span>
              </div>
              <SectorBadges sectors={company.sectors} maxDisplay={3} />
            </div>
          )}

          {/* Related People */}
          {company.related_people && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="h-3.5 w-3.5" />
                <span>Related People</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{company.related_people}</span>
                {company.related_people_linkedin && (
                  <a 
                    href={company.related_people_linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Date d'investissement */}
          {company.investment_date && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Date d'investissement</span>
              </div>
              <span className="font-medium mt-1 block">
                {formatDate(company.investment_date)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* Card: Métriques */}
      {/* ============================================ */}
      {displayedMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Métriques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {displayedMetrics.map((metric) => {
                const Icon = METRIC_ICONS[metric.metric_key.toLowerCase()] || Activity;
                const numValue = parseFloat(metric.metric_value);
                const isNegative = !isNaN(numValue) && numValue < 0;
                const isPositive = !isNaN(numValue) && numValue > 0;
                
                return (
                  <div key={metric.id} className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {formatMetricLabel(metric.metric_key)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`text-sm font-semibold ${
                          isNegative ? 'text-destructive' : ''
                        }`}
                      >
                        {formatMetricValue(metric.metric_value, metric.metric_key, metric.metric_type)}
                      </span>
                      {/* Trend indicator */}
                      {isPositive && metric.metric_key.toLowerCase().includes('growth') && (
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      )}
                      {isNegative && metric.metric_key.toLowerCase().includes('growth') && (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Source du report */}
            {latestReport?.report_period && (
              <p className="text-[10px] text-muted-foreground mt-3 text-right">
                Données: {latestReport.report_period}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* Chat Panel */}
      {/* ============================================ */}
      <PortfolioChatPanel 
        companyId={company.id} 
        companyName={company.company_name} 
      />
    </div>
  );
}

export default PortfolioCompanyOverviewWithChat;

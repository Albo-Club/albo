import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  Wallet, 
  PieChart, 
  Briefcase, 
  Globe, 
  Building2, 
  Calendar,
  AlertTriangle,
  TrendingUp,
  Users,
  Banknote,
  Clock,
  BarChart3,
  PiggyBank,
  Activity,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PortfolioCompanyWithReport } from "@/hooks/usePortfolioCompanyWithReport";
import { SectorBadges } from "./SectorBadges";
import { formatOwnership, formatMetricLabel, parseReportPeriod } from "@/lib/portfolioFormatters";
import { ReportSynthesisModal } from "./ReportSynthesisModal";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import type { PortfolioDocument } from "@/hooks/usePortfolioDocuments";
import type { CompanyReport } from "@/hooks/useCompanyReports";

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
  reports: CompanyReport[];
  selectedReport: CompanyReport | null;
  onReportChange: (reportId: string) => void;
}

export function PortfolioCompanyOverview({ 
  company, 
  reports, 
  selectedReport,
  onReportChange 
}: PortfolioCompanyOverviewProps) {
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PortfolioDocument | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  
  // Use selected report instead of company.latest_report for display
  const latestReport = selectedReport ? {
    id: selectedReport.id,
    report_date: selectedReport.created_at,
    report_title: null,
    report_period: selectedReport.report_period,
    report_type: selectedReport.report_type,
    headline: selectedReport.headline,
    summary: null,
    cleaned_content: selectedReport.cleaned_content,
    key_highlights: selectedReport.key_highlights,
    metrics: selectedReport.metrics,
    processed_at: selectedReport.created_at,
  } : company.latest_report;
  
  // Metrics from the selected report (instead of usePortfolioCompanyMetrics hook)
  const reportMetrics = useMemo<ReportMetricItem[]>(() => {
    if (!selectedReport?.metrics) return [];
    
    return Object.entries(selectedReport.metrics)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value], index) => ({
        id: `${selectedReport.id}-${key}-${index}`,
        metric_key: key,
        metric_value: String(value),
        metric_type: inferMetricType(key),
        report_period: selectedReport.report_period,
      }))
      .sort((a, b) => {
        const priorityA = METRIC_PRIORITY[a.metric_key] || 100;
        const priorityB = METRIC_PRIORITY[b.metric_key] || 100;
        return priorityA - priorityB;
      })
      .slice(0, 6);
  }, [selectedReport]);

  // Fetch report PDF document for DocumentPreviewModal
  useEffect(() => {
    async function fetchReportPdfDocument() {
      if (!latestReport?.id) {
        setPdfDocument(null);
        return;
      }
      
      const { data: reportFile } = await supabase
        .from('report_files')
        .select('id, file_name, storage_path, mime_type, file_size_bytes')
        .eq('report_id', latestReport.id)
        .limit(1)
        .maybeSingle();
      
      if (reportFile) {
        // Create a PortfolioDocument compatible with DocumentPreviewModal
        setPdfDocument({
          id: reportFile.id,
          company_id: company.id,
          type: 'file',
          name: reportFile.file_name,
          parent_id: null,
          storage_path: reportFile.storage_path,
          mime_type: reportFile.mime_type || 'application/pdf',
          file_size_bytes: reportFile.file_size_bytes,
          original_file_name: reportFile.file_name,
          report_file_id: reportFile.id,
          text_content: null,
          source_report_id: latestReport.id,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        setPdfDocument(null);
      }
    }
    
    fetchReportPdfDocument();
  }, [latestReport?.id, company.id]);

  // Download handler for DocumentPreviewModal
  const handleDownloadPdf = async (doc: PortfolioDocument) => {
    if (!doc.storage_path) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('report-files')
        .download(doc.storage_path);
      
      if (error || !data) {
        console.error('Download error:', error);
        return;
      }
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };
  const reportPeriod = latestReport?.report_period;
  const reportDateParsed = parseReportPeriod(reportPeriod) 
    || (latestReport?.report_date ? new Date(latestReport.report_date) : null);
  const isReportOld = reportDateParsed 
    ? differenceInMonths(new Date(), reportDateParsed) >= 1 
    : true;
  
  const formattedReportDate = reportPeriod || (latestReport?.report_date 
    ? format(new Date(latestReport.report_date), "d MMM yyyy", { locale: fr })
    : null);

  const investmentTypeColors = company.investment_type 
    ? INVESTMENT_TYPE_COLORS[company.investment_type] || INVESTMENT_TYPE_COLORS['Share']
    : null;

  // Use report metrics directly (already sorted and limited to 6)
  const displayedMetrics = reportMetrics;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Informations</h3>
          <div className="flex items-center gap-1.5">
            {/* Bouton Synthèse - utilise ReportSynthesisModal */}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setShowSynthesisModal(true)}
              disabled={!latestReport?.cleaned_content}
              title="Voir la synthèse AI"
            >
              <Eye className="h-2.5 w-2.5" />
              Synthèse
            </Button>
            
            {/* Bouton PDF - utilise DocumentPreviewModal */}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setPdfPreviewOpen(true)}
              disabled={!pdfDocument}
              title="Voir le PDF du report"
            >
              <Eye className="h-2.5 w-2.5" />
              PDF
            </Button>
            
            {/* Report period selector - only show if multiple reports */}
            {reports.length > 1 ? (
              <Select value={selectedReport?.id || undefined} onValueChange={onReportChange}>
                <SelectTrigger 
                  className={cn(
                    "h-6 w-[140px] text-[10px] gap-1",
                    isReportOld && "border-amber-500/50 text-amber-600 dark:text-amber-400"
                  )}
                >
                  <SelectValue placeholder="Période">
                    {formattedReportDate || "Période"}
                    {isReportOld && <AlertTriangle className="h-2.5 w-2.5 ml-1" />}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {reports.map((report) => (
                    <SelectItem key={report.id} value={report.id} className="text-xs">
                      {report.report_period || format(new Date(report.created_at), "MMM yyyy", { locale: fr })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : formattedReportDate ? (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] gap-1",
                  isReportOld && "border-amber-500/50 text-amber-600 dark:text-amber-400"
                )}
              >
                {formattedReportDate}
                {isReportOld && <AlertTriangle className="h-2.5 w-2.5" />}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Aucun report
              </Badge>
            )}
          </div>
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
                      
                      {/* Line 3: Report period */}
                      {metric.report_period && (
                        <span className="text-[10px] text-muted-foreground italic">
                          {metric.report_period}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Last News Section - Use selectedReport.headline */}
        {selectedReport?.headline && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Dernières nouvelles
                </p>
                {selectedReport.report_period && (
                  <p className="text-[10px] text-muted-foreground">
                    {selectedReport.report_period}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-4">
                {selectedReport.headline}
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
      
      {/* Modal Synthèse - Utilise ReportSynthesisModal comme dans Documents */}
      <ReportSynthesisModal
        open={showSynthesisModal}
        onOpenChange={setShowSynthesisModal}
        reportPeriod={reportPeriod || null}
        content={latestReport?.cleaned_content || null}
      />

      {/* Modal PDF - Utilise DocumentPreviewModal comme dans Documents */}
      <DocumentPreviewModal
        document={pdfDocument}
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        onDownload={handleDownloadPdf}
      />
    </Card>
  );
}

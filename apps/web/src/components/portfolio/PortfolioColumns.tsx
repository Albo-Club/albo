import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ArrowUpDown, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { PortfolioCompany } from "@/hooks/usePortfolioCompanies";
import {
  formatCurrency,
  formatDate,
  formatPercentage,
} from "@/lib/portfolioFormatters";
import { getInvestmentTypeColors, getInvestmentTypeDisplayLabel } from "@/types/portfolio";
import { getStaleInfo } from "@/lib/staleData";
import { format as formatDateFns } from "date-fns";
import { SectorBadges } from "./SectorBadges";
import { ScoreRing } from "./CompanyAIBanner";
import { cn } from "@/lib/utils";
import { TFunction } from "i18next";

function StaleIcon({ company, t }: { company: PortfolioCompany; t: TFunction }) {
  const stale = getStaleInfo(company.latest_report);
  if (!stale.isStale) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold">{t('portfolio.stale.title')}</p>
          {stale.monthsSinceReceived !== null ? (
            <p>{t('portfolio.stale.tooltipReceived', { months: stale.monthsSinceReceived })}</p>
          ) : (
            <p>{t('portfolio.stale.noReport')}</p>
          )}
          {stale.coverageEnd && (
            <p>
              {t('portfolio.stale.tooltipCoverage', {
                date: formatDateFns(stale.coverageEnd, 'dd MMM yyyy'),
              })}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function AIScoreCell({ company, t }: { company: PortfolioCompany; t: TFunction }) {
  const navigate = useNavigate();
  const score = company.ai_analysis?.health_score?.score;
  const isProcessing = company.ai_analysis_status === "processing";

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center w-10 h-10">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (typeof score === "number" && score > 0) {
    return <ScoreRing score={score} size={40} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground/60 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/portfolio/${company.id}?analyze=true`);
          }}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{t('portfolio.aiAnalysis.launch')}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const getPortfolioColumns = (t: TFunction): ColumnDef<PortfolioCompany>[] => [
  {
    accessorKey: "company_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        {t('portfolio.columns.company')}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const company = row.original;
      return (
        <div className="flex items-center gap-3">
          <CompanyLogo
            domain={company.domain}
            companyName={company.company_name}
            size="sm"
          />
          <span className="font-medium">{company.company_name}</span>
          <StaleIcon company={company} t={t} />
        </div>
      );
    },
  },
  {
    accessorKey: "sectors",
    header: t('portfolio.columns.sector'),
    cell: ({ row }) => {
      const sectors = row.original.sectors;
      return <SectorBadges sectors={sectors} maxDisplay={2} />;
    },
    filterFn: (row, id, filterValues: string[]) => {
      const sectors = row.original.sectors || [];
      if (!filterValues || filterValues.length === 0) return true;
      return filterValues.some((value) => sectors.includes(value));
    },
  },
  {
    id: "ai_score",
    accessorFn: (row) => row.ai_analysis?.health_score?.score ?? 0,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        {t('portfolio.columns.aiScore')}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <AIScoreCell company={row.original} t={t} />,
    sortingFn: "basic",
  },
  {
    accessorKey: "amount_invested_euros",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        {t('portfolio.columns.amountInvested')}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = row.getValue("amount_invested_euros") as number | null;
      return (
        <span className="font-medium tabular-nums">
          {formatCurrency(amount)}
        </span>
      );
    },
  },
  {
    accessorKey: "investment_date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        {t('portfolio.columns.date')}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const date = row.getValue("investment_date") as string | null;
      return <span className="text-muted-foreground">{formatDate(date)}</span>;
    },
  },
  {
    accessorKey: "investment_type",
    header: t('portfolio.columns.type'),
    cell: ({ row }) => {
      const type = row.getValue("investment_type") as string | null;
      if (!type) return <span className="text-muted-foreground">-</span>;
      const colors = getInvestmentTypeColors(type);
      const displayLabel = getInvestmentTypeDisplayLabel(type);
      return (
        <Badge variant="outline" className={cn(colors.bg, colors.text, colors.border)}>
          {displayLabel}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "ownership_percentage",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        {t('portfolio.columns.participation')}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const percentage = row.getValue("ownership_percentage") as number | null;
      return (
        <span className="font-medium tabular-nums">
          {formatPercentage(percentage)}
        </span>
      );
    },
  },
  {
    accessorKey: "domain",
    header: t('portfolio.columns.site'),
    cell: ({ row }) => {
      const domain = row.getValue("domain") as string | null;
      if (!domain) return <span className="text-muted-foreground">-</span>;
      return (
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {domain}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    },
  },
];

// Keep backward compat — but components should use getPortfolioColumns(t)
export const portfolioColumns = getPortfolioColumns(((key: string) => key) as unknown as TFunction);

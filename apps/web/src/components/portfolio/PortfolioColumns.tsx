import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ExternalLink, Loader2, Sparkles } from "lucide-react";
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
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { SectorBadges } from "./SectorBadges";
import { ScoreRing } from "./CompanyAIBanner";
import { cn } from "@/lib/utils";
import { TFunction } from "i18next";

function AIScoreCell({ company, t }: { company: PortfolioCompany; t: TFunction }) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const score = company.ai_analysis?.health_score?.score;
  const isProcessing = company.ai_analysis_status === "processing";

  const triggerAnalysis = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("company-intelligence", {
        body: {
          company_id: company.id,
          mode: "analysis",
          force_refresh: false,
        },
      });
      if (error) throw error;
    },
    onMutate: async () => {
      const queryKey = ["portfolio-companies", workspace?.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PortfolioCompany[]>(queryKey);
      queryClient.setQueryData<PortfolioCompany[]>(queryKey, (rows) =>
        rows?.map((row) =>
          row.id === company.id
            ? { ...row, ai_analysis_status: "processing" }
            : row
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["portfolio-companies", workspace?.id],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["portfolio-companies", workspace?.id],
      });
    },
  });

  if (isProcessing || triggerAnalysis.isPending) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (typeof score === "number" && score > 0) {
    return <ScoreRing score={score} size={32} />;
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
            triggerAnalysis.mutate();
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

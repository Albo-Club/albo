import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
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
import { getInvestmentTypeColors } from "@/types/portfolio";
import { SectorBadges } from "./SectorBadges";
import { cn } from "@/lib/utils";

export const portfolioColumns: ColumnDef<PortfolioCompany>[] = [
  {
    accessorKey: "company_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Entreprise
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
          <div className="flex flex-col">
            <span className="font-medium">{company.company_name}</span>
            {company.preview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px] cursor-help">
                    {company.preview}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p>{company.preview}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "sectors",
    header: "Secteur",
    cell: ({ row }) => {
      const sectors = row.original.sectors;
      return <SectorBadges sectors={sectors} maxDisplay={2} />;
    },
    filterFn: (row, id, filterValues: string[]) => {
      const sectors = row.original.sectors || [];
      if (!filterValues || filterValues.length === 0) return true;
      // Show row if company has at least one of the selected sectors
      return filterValues.some((value) => sectors.includes(value));
    },
  },
  {
    accessorKey: "amount_invested_euros",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Montant investi
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
        Date
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
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("investment_type") as string | null;
      if (!type) return <span className="text-muted-foreground">-</span>;
      const colors = getInvestmentTypeColors(type);
      return (
        <Badge variant="outline" className={cn(colors.bg, colors.text, colors.border)}>
          {type}
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
        Participation
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
    header: "Site",
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

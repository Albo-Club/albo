import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { displayCompanyName, formatAmount } from "@/lib/utils";
import { CheckCircle2, Clock, CircleDashed } from "lucide-react";

export interface Deal {
  id: string;
  user_id: string | null;
  company_name: string | null;
  one_liner: string | null;
  sector: string | null;
  stage: string | null;
  amount_sought: string | null;
  funding_type: string | null;
  status: string;
  source: string | null;
  sender_email: string | null;
  memo_html: string | null;
  additional_context: string | null;
  created_at: string;
  updated_at: string | null;
  analyzed_at: string | null;
  error_message: string | null;
  user_notes: string | null;
  hasDeck?: boolean;
}

export const statuses = [
  { value: "pending", label: "À traiter", icon: CircleDashed },
  { value: "analyzing", label: "En cours", icon: Clock },
  { value: "completed", label: "Analysé", icon: CheckCircle2 },
  { value: "passed", label: "Passé", icon: CircleDashed },
];

export const stages = [
  { value: "Pre-seed", label: "Pre-seed" },
  { value: "Seed", label: "Seed" },
  { value: "Series A", label: "Series A" },
  { value: "Series B", label: "Series B" },
  { value: "Series C", label: "Series C" },
  { value: "Growth", label: "Growth" },
];

export const sectors = [
  { value: "FinTech", label: "FinTech" },
  { value: "HealthTech", label: "HealthTech" },
  { value: "EdTech", label: "EdTech" },
  { value: "CleanTech", label: "CleanTech" },
  { value: "SaaS", label: "SaaS" },
  { value: "Marketplace", label: "Marketplace" },
  { value: "B2B", label: "B2B" },
  { value: "B2C", label: "B2C" },
  { value: "DeepTech", label: "DeepTech" },
  { value: "AI/ML", label: "AI/ML" },
  { value: "Other", label: "Other" },
];

export const fundingTypes = [
  { value: "Equity", label: "Equity" },
  { value: "Royalties", label: "Royalties" },
  { value: "Dette", label: "Dette" },
  { value: "Obligations", label: "Obligations" },
  { value: "BSA AIR", label: "BSA AIR" },
  { value: "SAFE", label: "SAFE" },
  { value: "Convertible", label: "Convertible" },
  { value: "Mixed", label: "Mixed" },
];

export const columns: ColumnDef<Deal>[] = [
  {
    accessorKey: "company_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entreprise" />
    ),
    cell: ({ row }) => {
      const name = displayCompanyName(row.getValue("company_name"));
      const oneLiner = row.original.one_liner;
      return (
        <div className="flex flex-col gap-0.5">
          <button
            className="font-semibold truncate max-w-[200px] text-left hover:underline text-primary"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("open-deal-panel", { detail: { deal: row.original } })
              );
            }}
          >
            {name || "Analyse en cours..."}
          </button>
          {oneLiner && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {oneLiner}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Statut" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusConfig = statuses.find((s) => s.value === status);

      if (!statusConfig) {
        return <Badge variant="outline">{status}</Badge>;
      }

      const Icon = statusConfig.icon;
      const colorClass =
        status === "completed"
          ? "bg-green-500/10 text-green-600 border-green-500/20"
          : status === "analyzing"
          ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
          : "bg-gray-500/10 text-gray-600 border-gray-500/20";

      return (
        <Badge className={colorClass}>
          <Icon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "sector",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Secteur" />
    ),
    cell: ({ row }) => {
      const sector = row.getValue("sector") as string | null;
      if (!sector) return <span className="text-muted-foreground">-</span>;
      return <Badge variant="outline">{sector}</Badge>;
    },
    filterFn: (row, id, value) => {
      const cellValue = row.getValue(id) as string | null;
      if (!cellValue) return false;
      return value.includes(cellValue);
    },
  },
  {
    accessorKey: "stage",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stade" />
    ),
    cell: ({ row }) => {
      const stage = row.getValue("stage") as string | null;
      if (!stage) return <span className="text-muted-foreground">-</span>;

      const colorMap: Record<string, string> = {
        "Pre-seed": "bg-purple-500/10 text-purple-600 border-purple-500/20",
        Seed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        "Series A": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
        "Series B": "bg-teal-500/10 text-teal-600 border-teal-500/20",
        "Series C": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        Growth: "bg-green-500/10 text-green-600 border-green-500/20",
      };

      return (
        <Badge className={colorMap[stage] || "bg-secondary text-secondary-foreground"}>
          {stage}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      const cellValue = row.getValue(id) as string | null;
      if (!cellValue) return false;
      return value.includes(cellValue);
    },
  },
  {
    accessorKey: "amount_sought",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Montant" />
    ),
    cell: ({ row }) => {
      const amountSought = row.original.amount_sought;

      if (amountSought) {
        return (
          <span className="font-medium">{formatAmount(amountSought)}</span>
        );
      }

      return <span className="text-muted-foreground">-</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { displayCompanyName } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  InlineSelectEditor,
  InlineAmountEditor,
  inlineStatusOptions,
  inlineSectorOptions,
  inlineStageOptions,
  statusColorMap,
  stageColorMap,
} from "./InlineCellEditor";

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
  // Propriétaire du deal
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  ownerName?: string;
}

export const statuses = [
  { value: "pending", label: "À traiter" },
  { value: "analyzing", label: "En cours" },
  { value: "completed", label: "Validé" },
  { value: "passed", label: "Refusé" },
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
          <span className="font-semibold truncate max-w-[200px] text-left">
            {name || "Analyse en cours..."}
          </span>
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
      const deal = row.original;

      return (
        <InlineSelectEditor
          dealId={deal.id}
          field="status"
          value={status}
          options={inlineStatusOptions}
          colorMap={statusColorMap}
        />
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
      const deal = row.original;

      return (
        <InlineSelectEditor
          dealId={deal.id}
          field="sector"
          value={sector}
          options={inlineSectorOptions}
        />
      );
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
      const deal = row.original;

      return (
        <InlineSelectEditor
          dealId={deal.id}
          field="stage"
          value={stage}
          options={inlineStageOptions}
          colorMap={stageColorMap}
        />
      );
    },
    filterFn: (row, id, value) => {
      const cellValue = row.getValue(id) as string | null;
      if (!cellValue) return false;
      return value.includes(cellValue);
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date de réception" />
    ),
    cell: ({ row }) => {
      const createdAt = row.getValue("created_at") as string;
      if (!createdAt) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {format(new Date(createdAt), "d MMM yyyy", { locale: fr })}
        </span>
      );
    },
  },
  {
    accessorKey: "ownerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Propriétaire" />
    ),
    cell: ({ row }) => {
      const ownerName = row.getValue("ownerName") as string;
      return (
        <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
          {ownerName || "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "amount_sought",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Montant" />
    ),
    cell: ({ row }) => {
      const deal = row.original;
      return (
        <InlineAmountEditor
          dealId={deal.id}
          value={deal.amount_sought}
        />
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];

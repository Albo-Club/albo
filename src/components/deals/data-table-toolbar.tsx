import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { DataTableViewOptions } from "./data-table-view-options";
import { DataTableUnifiedFilter } from "./DataTableUnifiedFilter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  onAskAI?: () => void;
}

export function DataTableToolbar<TData>({
  table,
  onAskAI,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Rechercher une entreprise..."
            value={(table.getColumn("company_name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("company_name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          <DataTableUnifiedFilter table={table} />
          {onAskAI && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAskAI}
              className="gap-1.5 h-8 px-3 text-sm font-medium bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 text-violet-700 hover:bg-violet-500/20 hover:border-violet-500/50 dark:text-violet-300"
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Button>
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}

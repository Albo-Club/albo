import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";
import { DataTableUnifiedFilter } from "./DataTableUnifiedFilter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
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
        </div>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}

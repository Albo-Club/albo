import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortfolioCompany } from "@/hooks/usePortfolioCompanies";
import { portfolioColumns } from "./PortfolioColumns";
import { DataTableFacetedFilter } from "@/components/deals/data-table-faceted-filter";

interface PortfolioTableProps {
  data: PortfolioCompany[];
}

export function PortfolioTable({ data }: PortfolioTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns: portfolioColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 56,
    getScrollElement: () => tableContainerRef.current,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  // Extract unique options for filters from sectors array
  const sectorOptions = Array.from(
    new Set(data.flatMap((c) => c.sectors || []).filter(Boolean))
  ).map((sector) => ({ label: sector, value: sector }));

  const typeOptions = Array.from(
    new Set(data.map((c) => c.investment_type).filter(Boolean))
  ).map((type) => ({ label: type!, value: type! }));

  const isFiltered = columnFilters.length > 0 || globalFilter.length > 0;

  // Calculate a height that cuts rows to indicate scrollable content
  // Row height ~56px, header ~44px, showing partial row = header + N rows + half row
  const ROW_HEIGHT = 56;
  const HEADER_HEIGHT = 44;
  const VISIBLE_ROWS = 8;
  const PARTIAL_ROW = ROW_HEIGHT * 0.6; // Show 60% of next row
  const tableHeight = HEADER_HEIGHT + (VISIBLE_ROWS * ROW_HEIGHT) + PARTIAL_ROW;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une entreprise..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          {table.getColumn("sectors") && (
            <DataTableFacetedFilter
              column={table.getColumn("sectors")}
              title="Secteur"
              options={sectorOptions}
            />
          )}
          {table.getColumn("investment_type") && (
            <DataTableFacetedFilter
              column={table.getColumn("investment_type")}
              title="Type"
              options={typeOptions}
            />
          )}
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => {
                setColumnFilters([]);
                setGlobalFilter("");
              }}
              className="h-8 px-2 lg:px-3"
            >
              Réinitialiser
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Active filters */}
      {isFiltered && (
        <div className="shrink-0 flex flex-wrap gap-2 mt-4">
          {globalFilter && (
            <Badge variant="secondary" className="gap-1">
              Recherche: {globalFilter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setGlobalFilter("")}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div 
        className="mt-4 rounded-md border"
        style={{ height: `${tableHeight}px`, maxHeight: "calc(100vh - 380px)" }}
      >
        <div
          ref={tableContainerRef}
          className="h-full overflow-y-auto overflow-x-auto"
        >
          <Table style={{ minWidth: "900px" }}>
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualRows.length > 0 ? (
                virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/portfolio/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={portfolioColumns.length}
                    className="h-24 text-center"
                  >
                    Aucune entreprise trouvée.
                  </TableCell>
                </TableRow>
              )}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} />
                </tr>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Counter */}
      <div className="shrink-0 py-2 px-2 text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} entreprise(s)
      </div>
    </div>
  );
}

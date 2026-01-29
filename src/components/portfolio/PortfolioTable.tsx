import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
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

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap gap-2">
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
      <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
        <div
          ref={tableContainerRef}
          className="h-full overflow-y-auto overflow-x-auto"
          style={{ maxHeight: "calc(100vh - 400px)" }}
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

      {/* Pagination */}
      <div className="shrink-0 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {table.getFilteredRowModel().rows.length} entreprise(s)
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Lignes par page</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 25, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} sur{" "}
              {table.getPageCount()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Suivant
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

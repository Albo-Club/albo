import { useState } from "react";
import { Table } from "@tanstack/react-table";
import { Filter, X, ChevronDown, ArrowUp, ArrowDown, Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { inlineStatusOptions, inlineSectorOptions, inlineStageOptions } from "./InlineCellEditor";

interface DataTableUnifiedFilterProps<TData> {
  table: Table<TData>;
}

interface ActiveFilter {
  column: string;
  label: string;
  value: string;
  type: "multi" | "sort" | "compare";
}

export function DataTableUnifiedFilter<TData>({
  table,
}: DataTableUnifiedFilterProps<TData>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Get current column filter values
  const getColumnFilterValues = (columnId: string): string[] => {
    const filterValue = table.getColumn(columnId)?.getFilterValue();
    return Array.isArray(filterValue) ? filterValue : [];
  };

  const handleMultiSelectFilter = (columnId: string, value: string, label: string, columnLabel: string) => {
    const column = table.getColumn(columnId);
    if (!column) return;

    const currentValues = getColumnFilterValues(columnId);
    let newValues: string[];

    if (currentValues.includes(value)) {
      newValues = currentValues.filter((v) => v !== value);
      setActiveFilters(activeFilters.filter((f) => !(f.column === columnId && f.value === value)));
    } else {
      newValues = [...currentValues, value];
      setActiveFilters([...activeFilters, { column: columnId, label: `${columnLabel}: ${label}`, value, type: "multi" }]);
    }

    column.setFilterValue(newValues.length ? newValues : undefined);
  };

  const handleSortFilter = (columnId: string, direction: "asc" | "desc", label: string) => {
    const column = table.getColumn(columnId);
    if (!column) return;

    // Remove existing sort filters for this column
    setActiveFilters(activeFilters.filter((f) => f.column !== columnId || f.type !== "sort"));

    // Toggle sorting
    const currentSort = table.getState().sorting.find((s) => s.id === columnId);
    if (currentSort?.desc === (direction === "desc")) {
      column.clearSorting();
    } else {
      column.toggleSorting(direction === "desc");
      setActiveFilters([
        ...activeFilters.filter((f) => f.column !== columnId || f.type !== "sort"),
        { column: columnId, label, value: direction, type: "sort" },
      ]);
    }
    setIsOpen(false);
  };

  const removeFilter = (filter: ActiveFilter) => {
    if (filter.type === "multi") {
      const column = table.getColumn(filter.column);
      if (column) {
        const currentValues = getColumnFilterValues(filter.column);
        const newValues = currentValues.filter((v) => v !== filter.value);
        column.setFilterValue(newValues.length ? newValues : undefined);
      }
    } else if (filter.type === "sort") {
      const column = table.getColumn(filter.column);
      if (column) {
        column.clearSorting();
      }
    }
    setActiveFilters(activeFilters.filter((f) => f !== filter));
  };

  const clearAllFilters = () => {
    table.resetColumnFilters();
    table.resetSorting();
    setActiveFilters([]);
  };

  const hasActiveFilters = activeFilters.length > 0;

  const filterSections = [
    {
      id: "status",
      label: "Statut",
      type: "multi" as const,
      options: inlineStatusOptions.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      id: "sector",
      label: "Secteur",
      type: "multi" as const,
      options: inlineSectorOptions,
    },
    {
      id: "stage",
      label: "Stade",
      type: "multi" as const,
      options: inlineStageOptions,
    },
    {
      id: "created_at",
      label: "Date de réception",
      type: "sort" as const,
      sortOptions: [
        { value: "desc", label: "Plus récent d'abord", icon: ArrowDown },
        { value: "asc", label: "Plus ancien d'abord", icon: ArrowUp },
      ],
    },
    {
      id: "amount_sought",
      label: "Montant",
      type: "sort" as const,
      sortOptions: [
        { value: "asc", label: "Croissant", icon: ArrowUp },
        { value: "desc", label: "Décroissant", icon: ArrowDown },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                hasActiveFilters && "border-primary text-primary"
              )}
            >
              <Filter className="h-4 w-4" />
              Filtrer
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 z-50" align="start">
            <div className="flex flex-col gap-1">
              {filterSections.map((section) => (
                <div key={section.id} className="border-b last:border-b-0 pb-1 last:pb-0">
                  <button
                    onClick={() =>
                      setExpandedSection(
                        expandedSection === section.id ? null : section.id
                      )
                    }
                    className="flex items-center justify-between w-full px-2 py-2 text-sm font-medium hover:bg-muted rounded-md"
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedSection === section.id && "rotate-180"
                      )}
                    />
                  </button>
                  {expandedSection === section.id && (
                    <div className="pl-2 pr-1 py-1 space-y-1">
                      {section.type === "multi" && section.options?.map((option) => {
                        const isChecked = getColumnFilterValues(section.id).includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded-md"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() =>
                                handleMultiSelectFilter(
                                  section.id,
                                  option.value,
                                  option.label,
                                  section.label
                                )
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                      {section.type === "sort" && section.sortOptions?.map((option) => {
                        const Icon = option.icon;
                        const currentSort = table.getState().sorting.find((s) => s.id === section.id);
                        const isActive =
                          currentSort &&
                          ((option.value === "desc" && currentSort.desc) ||
                            (option.value === "asc" && !currentSort.desc));
                        return (
                          <button
                            key={option.value}
                            onClick={() =>
                              handleSortFilter(
                                section.id,
                                option.value as "asc" | "desc",
                                `${section.label}: ${option.label}`
                              )
                            }
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md text-left",
                              "hover:bg-muted",
                              isActive && "bg-muted text-primary"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Active filter chips */}
        {activeFilters.map((filter, index) => (
          <Badge
            key={`${filter.column}-${filter.value}-${index}`}
            variant="secondary"
            className="h-7 gap-1 pl-2 pr-1"
          >
            <span className="text-xs">{filter.label}</span>
            <button
              onClick={() => removeFilter(filter)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}

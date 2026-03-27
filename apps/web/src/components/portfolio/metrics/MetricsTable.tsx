import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AvailableMetric, TimeSeries } from "@/hooks/useCompanyDashboardMetrics";
import {
  getMetricLabel,
  shortPeriod,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "./metricLabels";
import { scrollToChart } from "./MetricsCharts";
import { toast } from "sonner";

interface Props {
  metrics: AvailableMetric[];
  timeSeries: TimeSeries[];
}

const PAGE_SIZE = 20;

export function MetricsTable({ metrics, timeSeries }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<"key" | "category" | "period_count" | "latest_period">("key");
  const [sortAsc, setSortAsc] = useState(true);

  const tsKeys = useMemo(() => new Set(timeSeries.map((s) => s.key)), [timeSeries]);

  const filtered = useMemo(() => {
    let list = metrics;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          getMetricLabel(m.key).toLowerCase().includes(q) ||
          m.key.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "key":
          cmp = getMetricLabel(a.key).localeCompare(getMetricLabel(b.key));
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "period_count":
          cmp = a.period_count - b.period_count;
          break;
        case "latest_period":
          cmp = a.latest_period.localeCompare(b.latest_period);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [metrics, search, sortCol, sortAsc]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
    setPage(0);
  };

  const handleRowClick = (key: string) => {
    if (tsKeys.has(key)) {
      scrollToChart(key);
    } else {
      toast.info("Pas assez de données pour un graphique (minimum 3 périodes)");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 text-sm font-semibold px-0 hover:bg-transparent">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Toutes les métriques ({metrics.length})
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 mt-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une métrique..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 h-9"
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("key")}>
                  Métrique {sortCol === "key" && (sortAsc ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("category")}>
                  Catégorie {sortCol === "category" && (sortAsc ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("period_count")}>
                  Périodes {sortCol === "period_count" && (sortAsc ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("latest_period")}>
                  Dernière MAJ {sortCol === "latest_period" && (sortAsc ? "↑" : "↓")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((m) => (
                <TableRow
                  key={m.key}
                  className={`cursor-pointer ${tsKeys.has(m.key) ? "hover:bg-accent" : "opacity-70"}`}
                  onClick={() => handleRowClick(m.key)}
                >
                  <TableCell className="font-medium text-sm">{getMetricLabel(m.key)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${CATEGORY_COLORS[m.category] || ""}`}>
                      {CATEGORY_LABELS[m.category] || m.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.period_count}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{shortPeriod(m.latest_period)}</TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Aucune métrique trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              ←
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage(page + 1)}
            >
              →
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

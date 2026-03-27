import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { usePipelineLogs, type PipelineRun } from "@/hooks/usePipelineLogs";
import { RunCard } from "@/components/admin/RunCard";
import { RunTimeline } from "@/components/admin/RunTimeline";
import { RunStatusBadge } from "@/components/admin/RunStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const PERIOD_OPTIONS = [
  { value: "1", label: "24h" },
  { value: "7", label: "7j" },
  { value: "30", label: "30j" },
  { value: "90", label: "90j" },
];

export default function PipelineLogs() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { runs, steps, isLoadingRuns, isLoadingSteps, fetchRuns, fetchSteps } =
    usePipelineLogs();

  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedDays, setSelectedDays] = useState("7");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/portfolio");
      return;
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    const pipeline = selectedPipeline === "all" ? null : selectedPipeline;
    fetchRuns(pipeline, Number(selectedDays));
  }, [selectedPipeline, selectedDays, fetchRuns]);

  const filteredRuns =
    selectedStatus === "all"
      ? runs
      : runs.filter((r) => r.status === selectedStatus);

  const handleRunClick = (run: PipelineRun) => {
    setSelectedRun(run);
    fetchSteps(run.run_id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié !");
  };

  if (!isAdmin) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline Logs</h1>
        <p className="text-muted-foreground text-sm">
          Suivi des pipelines de traitement
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="report">report</SelectItem>
            <SelectItem value="deck">deck</SelectItem>
            <SelectItem value="email-sync">email-sync</SelectItem>
            <SelectItem value="user-signup">User Signup</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedDays} onValueChange={setSelectedDays}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="success">success</SelectItem>
            <SelectItem value="error">error</SelectItem>
            <SelectItem value="warn">warn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Run list */}
      <div className="space-y-2">
        {isLoadingRuns ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border"
            >
              <Skeleton className="h-4 w-4 rounded-full mt-1" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))
        ) : filteredRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucun run trouvé pour ces filtres.
          </p>
        ) : (
          filteredRuns.map((run) => (
            <RunCard
              key={run.run_id}
              run={run}
              onClick={() => handleRunClick(run)}
            />
          ))
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedRun}
        onOpenChange={(open) => !open && setSelectedRun(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0">
          {selectedRun && (
            <div className="flex flex-col h-full">
               <SheetHeader className="p-6 pb-4 border-b">
                <div className="flex items-start gap-2">
                  <RunStatusBadge status={selectedRun.status} size="md" />
                  <div className="min-w-0">
                    <SheetTitle className="text-base leading-snug">
                      {selectedRun.pipeline === 'user-signup'
                        ? 'Nouvelle inscription'
                        : selectedRun.email_subject || "Sans sujet"}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {selectedRun.sender_email}
                      {selectedRun.pipeline !== 'user-signup' && selectedRun.company_match &&
                        ` → ${selectedRun.company_match}`}
                    </SheetDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {selectedRun.pipeline}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(selectedRun.started_at), "d MMM yyyy · HH:mm:ss", { locale: fr })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {selectedRun.duration_s}s
                  </span>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 p-6">
                {/* Timeline */}
                <h3 className="text-sm font-semibold mb-4">Timeline</h3>
                <RunTimeline steps={steps} isLoading={isLoadingSteps} />

                {/* Metadata */}
                <div className="mt-8 pt-4 border-t space-y-2">
                  <h3 className="text-sm font-semibold mb-3">Metadata</h3>
                  <MetaRow
                    label="Run ID"
                    value={selectedRun.run_id}
                    onCopy={() => copyToClipboard(selectedRun.run_id)}
                  />
                  {selectedRun.profile_id && (
                    <MetaRow
                      label="Profile"
                      value={selectedRun.profile_id}
                      onCopy={() =>
                        copyToClipboard(selectedRun.profile_id!)
                      }
                    />
                  )}
                  {selectedRun.unipile_email_id && (
                    <MetaRow
                      label="Unipile ID"
                      value={selectedRun.unipile_email_id}
                      onCopy={() =>
                        copyToClipboard(selectedRun.unipile_email_id!)
                      }
                    />
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MetaRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  const truncated = value.length > 24 ? value.slice(0, 12) + "…" + value.slice(-8) : value;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        onClick={onCopy}
        className="flex items-center gap-1.5 text-xs font-mono text-foreground hover:text-primary transition-colors"
      >
        {truncated}
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

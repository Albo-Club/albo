import { Badge } from "@/components/ui/badge";
import { RunStatusBadge } from "./RunStatusBadge";
import { UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { PipelineRun } from "@/hooks/usePipelineLogs";

interface RunCardProps {
  run: PipelineRun;
  onClick: () => void;
}

export function RunCard({ run, onClick }: RunCardProps) {
  const isSignup = run.pipeline === "user-signup";

  const subject = run.email_subject
    ? run.email_subject.length > 60
      ? run.email_subject.slice(0, 60) + "…"
      : run.email_subject
    : "Sans sujet";

  const timeAgo = formatDistanceToNow(new Date(run.started_at), {
    locale: fr,
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-lg border bg-card text-left hover:bg-accent/50 transition-colors"
    >
      <div className="mt-1">
        {isSignup ? (
          <UserPlus className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <RunStatusBadge status={run.status} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{subject}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0 ${isSignup ? "bg-blue-50 text-blue-700 border-blue-200" : ""}`}
          >
            {run.pipeline}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {run.duration_s}s · {run.step_count} steps
          </span>
          {run.status === "error" && run.error_message && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-red-500 truncate max-w-[200px]">
                {run.error_message.length > 50
                  ? run.error_message.slice(0, 50) + "…"
                  : run.error_message}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        {run.sender_email && (
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
            {run.sender_email}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
      </div>
    </button>
  );
}

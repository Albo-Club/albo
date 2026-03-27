import { CheckCircle2, XCircle, Circle } from "lucide-react";
import { format } from "date-fns";
import type { PipelineStep } from "@/hooks/usePipelineLogs";

interface StepRowProps {
  step: PipelineStep;
  isLast: boolean;
  durationToNext: number | null;
}

function StepIcon({ level }: { level: string }) {
  switch (level) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function StepRow({ step, isLast, durationToNext }: StepRowProps) {
  const time = format(new Date(step.created_at), "HH:mm:ss");

  return (
    <>
      <div className="flex gap-3 relative">
        {/* Timeline connector */}
        {!isLast && (
          <div className="absolute left-[7px] top-6 bottom-0 w-px bg-border" style={{ height: durationToNext !== null ? 'calc(100% + 1.5rem)' : '100%' }} />
        )}

        {/* Icon */}
        <div className="relative z-10 mt-0.5 shrink-0">
          <StepIcon level={step.level} />
        </div>

        {/* Content */}
        <div className="flex-1 pb-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{time}</span>
            <span className="font-medium text-sm">{step.step}</span>
          </div>
          <p className={`text-sm mt-0.5 ${step.level === "error" ? "text-red-500" : "text-muted-foreground"}`}>
            {step.message}
          </p>
        </div>
      </div>

      {/* Duration connector */}
      {durationToNext !== null && durationToNext > 0 && (
        <div className="flex gap-3 py-1">
          <div className="flex justify-center w-4 shrink-0">
            <div className="w-px bg-border" />
          </div>
          <span className="text-xs text-muted-foreground">↓ {durationToNext}s</span>
        </div>
      )}
    </>
  );
}

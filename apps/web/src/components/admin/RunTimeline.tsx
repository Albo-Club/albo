import { Skeleton } from "@/components/ui/skeleton";
import { StepRow } from "./StepRow";
import type { PipelineStep } from "@/hooks/usePipelineLogs";

interface RunTimelineProps {
  steps: PipelineStep[];
  isLoading: boolean;
}

export function RunTimeline({ steps, isLoading }: RunTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!steps.length) {
    return <p className="text-sm text-muted-foreground py-4">Aucun step trouvé pour ce run.</p>;
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        const durationToNext =
          next
            ? Math.round(
                (new Date(next.created_at).getTime() - new Date(step.created_at).getTime()) / 1000
              )
            : null;

        return (
          <StepRow
            key={`${step.step}-${step.created_at}`}
            step={step}
            isLast={i === steps.length - 1}
            durationToNext={durationToNext}
          />
        );
      })}
    </div>
  );
}

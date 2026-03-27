import { Loader2, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useImportProgress } from '@/hooks/useImportProgress';

export function ImportProgressBanner() {
  const { job, isComplete } = useImportProgress();

  if (!job) return null;

  const progress = job.progress;
  const currentBatch = progress?.current_batch ?? 0;
  const totalBatches = progress?.total_batches ?? 1;
  const companiesProcessed = progress?.companies_processed ?? 0;
  const progressPercent = totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3">
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {isComplete ? 'Import terminé !' : 'Import du portfolio'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isComplete
              ? `${companiesProcessed} sociétés importées`
              : `${companiesProcessed} sociétés traitées`}
          </p>
        </div>
        {!isComplete && totalBatches > 1 && (
          <span className="text-xs font-medium text-muted-foreground">{progressPercent}%</span>
        )}
      </div>
      {!isComplete && totalBatches > 1 && (
        <Progress value={progressPercent} className="mt-3 h-1.5" />
      )}
    </div>
  );
}

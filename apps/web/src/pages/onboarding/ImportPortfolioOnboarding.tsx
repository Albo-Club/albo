import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { CompanyDomainsEditor } from '@/components/portfolio/CompanyDomainsEditor';

type Step = 'upload' | 'processing' | 'results';

interface ImportResults {
  success: boolean;
  summary: {
    created: number;
    updated: number;
    failed: number;
    companies_processed?: number;
    companies_created?: number;
    companies_updated?: number;
  };
}

interface Company {
  id: string;
  company_name: string;
  domain: string | null;
}

interface ImportProgress {
  current_batch: number;
  total_batches: number;
  companies_processed: number;
  companies_created: number;
  companies_updated: number;
}

export default function ImportPortfolioOnboarding() {
  const { user } = useAuth();
  const { workspace, refetch: refetchWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Sync legacy domain field to company_domains table after import
  useEffect(() => {
    const syncDomainsToNewTable = async () => {
      if (!companies || companies.length === 0 || !user?.id) return;
      for (const company of companies) {
        if (company.domain) {
          await supabase
            .from('company_domains')
            .upsert({
              company_id: company.id,
              domain: company.domain.toLowerCase().trim(),
              is_primary: true,
              created_by: user.id,
            }, { onConflict: 'company_id,domain' });
        }
      }
    };
    syncDomainsToNewTable();
  }, [companies, user?.id]);

  const companiesWithoutDomain = companies.filter(c => !c.domain || c.domain.trim() === '');

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const startTime = Date.now();
    const TIMEOUT = 5 * 60 * 1000; // 5 minutes

    pollRef.current = setInterval(async () => {
      // Timeout safety
      if (Date.now() - startTime > TIMEOUT) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        toast.error("L'import prend trop de temps. Vérifiez dans le portfolio.");
        handleSkip();
        return;
      }

      try {
        const { data: job, error } = await supabase
          .from('import_jobs')
          .select('status, progress, result, error')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Poll error:', error);
          return;
        }

        // Update progress
        if (job.progress) {
          setProgress(job.progress as unknown as ImportProgress);
        }

        if (job.status === 'completed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;

          // Load freshly imported companies
          const { data: freshCompanies } = await supabase
            .from('portfolio_companies')
            .select('id, company_name, domain')
            .eq('workspace_id', workspace?.id)
            .order('company_name');

          setCompanies(freshCompanies || []);

          const result = job.result as any;
          setImportResults({
            success: true,
            summary: {
              created: result?.summary?.companies_created ?? result?.summary?.created ?? (job.progress as any)?.companies_created ?? 0,
              updated: result?.summary?.companies_updated ?? result?.summary?.updated ?? (job.progress as any)?.companies_updated ?? 0,
              failed: result?.summary?.failed ?? 0,
            },
          });

          setStep('results');
        } else if (job.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast.error(job.error || "L'import a échoué");
          setStep('upload');
        }
        // If 'processing' or 'pending', keep polling
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  }, [workspace?.id]);

  const handleFileSelect = async (file: File) => {
    setStep('processing');
    setProgress(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `imports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolio-imports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('portfolio-imports')
        .createSignedUrl(filePath, 3600);

      if (!urlData?.signedUrl) throw new Error('Failed to get signed URL');

      const { data, error } = await supabase.functions.invoke('import-portfolio-csv', {
        body: {
          fileUrl: urlData.signedUrl,
          workspaceId: workspace?.id,
          fileName: file.name,
          mode: 'upsert',
        },
      });

      if (error) throw error;

      // Async 202 response — advance immediately, banner handles progress
      if (data?.async && data?.jobId) {
        toast.success(
          `Import lancé ! ${data.totalRows || ''} sociétés en cours d'enrichissement par notre IA...`
        );

        // Cleanup temp file
        supabase.storage.from('portfolio-imports').remove([filePath]).catch(() => {});

        // Advance onboarding — use supabase.auth.getUser() directly for reliability
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          await supabase
            .from('profiles')
            .update({ onboarding_status: 'connect_email' })
            .eq('id', authData.user.id);
        }
        await refetchWorkspace();
        navigate('/onboarding/connect-email');
        return;
      }

      // Cleanup temp file in background (legacy path)
      supabase.storage.from('portfolio-imports').remove([filePath]).catch(console.error);

      // Legacy synchronous fallback
      const receivedJobId = data?.jobId;
      if (receivedJobId) {
        setJobId(receivedJobId);
        startPolling(receivedJobId);
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error("Erreur lors de l'import");
      setStep('upload');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const advanceToNextStep = async () => {
    if (!user?.id) return;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    await supabase
      .from('profiles')
      .update({ onboarding_status: 'connect_email' })
      .eq('id', user.id);
    await refetchWorkspace();
    navigate('/onboarding/connect-email');
  };

  const handleSkip = advanceToNextStep;

  const handleContinue = advanceToNextStep;

  // ── Upload step ──
  if (step === 'upload') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-background rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-semibold text-center text-foreground">
            Importez votre portefeuille
          </h1>
          <p className="text-muted-foreground text-center mt-2 mb-8 text-sm">
            Uploadez un fichier CSV ou Excel contenant vos sociétés en portefeuille
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-foreground font-medium">Glissez votre fichier ici</p>
            <p className="text-xs text-muted-foreground mt-1">ou cliquez pour sélectionner</p>
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground mt-4 px-1">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Pour faciliter l'extraction, le fichier doit au minimum contenir : <span className="font-medium">Nom de l'entreprise</span>, <span className="font-medium">Montant investi</span>, <span className="font-medium">Date d'investissement</span>, <span className="font-medium">Valorisation d'entrée</span>, <span className="font-medium">Nom de domaine de l'entreprise</span>
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-3">
            Formats acceptés : CSV, Excel (.xlsx, .xls)
          </p>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-6"
          >
            Skip this step
          </button>
        </div>
      </div>
    );
  }

  // ── Processing step ──
  if (step === 'processing') {
    const progressPercent = progress && progress.total_batches > 0
      ? Math.round((progress.current_batch / progress.total_batches) * 100)
      : 0;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-background rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-semibold text-center text-foreground">
            Import en cours...
          </h1>
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Notre IA enrichit vos sociétés une par une</p>
              <p className="text-xs text-muted-foreground">Cela peut prendre quelques secondes</p>
            </div>

            {/* Progress bar */}
            {progress && progress.total_batches > 0 && (
              <div className="w-full max-w-xs space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {progress.companies_processed || 0} société{(progress.companies_processed || 0) > 1 ? 's' : ''} traitée{(progress.companies_processed || 0) > 1 ? 's' : ''}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Results step ──
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-semibold text-foreground">
            Vérifiez les domaines
          </h1>
        </div>
        <p className="text-muted-foreground text-center text-sm mb-6">
          Ajoutez ou corrigez les noms de domaine pour chaque entreprise. Vous pouvez ajouter plusieurs domaines par entreprise. Chaque domaine ajouté lancera automatiquement une recherche dans vos emails.
        </p>

        {/* Summary */}
        {importResults && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-foreground">{importResults.summary.created} importées</span>
            </div>
            {importResults.summary.updated > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span className="text-foreground">{importResults.summary.updated} mises à jour</span>
              </div>
            )}
            {importResults.summary.failed > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-foreground">{importResults.summary.failed} erreurs</span>
              </div>
            )}
          </div>
        )}

        {companiesWithoutDomain.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 mb-4 px-1">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>
              {companiesWithoutDomain.length} entreprise(s) sans nom de domaine — la synchronisation email ne fonctionnera pas pour celles-ci. Vous pourrez les ajouter plus tard.
            </p>
          </div>
        )}

        {/* Domain validation list */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-0 mb-4 p-4 space-y-4">
          {companies.map((company) => (
            <div key={company.id} className="pb-3 border-b last:border-0">
              <p className="text-sm font-medium text-foreground mb-2 truncate">
                {company.company_name}
              </p>
              <CompanyDomainsEditor companyId={company.id} compact />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Button onClick={handleContinue} className="w-full">
            Continuer
          </Button>
          <button
            type="button"
            onClick={handleContinue}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Je ferai ça plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

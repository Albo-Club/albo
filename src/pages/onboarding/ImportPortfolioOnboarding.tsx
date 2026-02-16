import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader2, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Step = 'upload' | 'processing' | 'results';

interface ImportResults {
  summary: {
    created: number;
    updated: number;
    failed: number;
  };
}

interface Company {
  id: string;
  company_name: string;
  domain: string | null;
}

export default function ImportPortfolioOnboarding() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editableDomains, setEditableDomains] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleFileSelect = async (file: File) => {
    setStep('processing');

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

      setImportResults(data);

      const { data: freshCompanies } = await supabase
        .from('portfolio_companies')
        .select('id, company_name, domain')
        .eq('workspace_id', workspace?.id)
        .order('company_name');

      setCompanies(freshCompanies || []);

      const domains: Record<string, string> = {};
      (freshCompanies || []).forEach((c: Company) => {
        domains[c.id] = c.domain || '';
      });
      setEditableDomains(domains);

      setStep('results');

      await supabase.storage.from('portfolio-imports').remove([filePath]);
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

  const handleSkip = async () => {
    if (!user?.id) return;
    await supabase
      .from('profiles')
      .update({ onboarding_status: 'connect_email' })
      .eq('id', user.id);
    navigate('/onboarding/connect-email');
  };

  const handleValidateDomains = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updates = Object.entries(editableDomains).filter(([id, domain]) => {
        const original = companies.find(c => c.id === id);
        return original && domain !== (original.domain || '');
      });

      for (const [id, domain] of updates) {
        await supabase
          .from('portfolio_companies')
          .update({ domain: domain || null })
          .eq('id', id);
      }

      await supabase
        .from('profiles')
        .update({ onboarding_status: 'connect_email' })
        .eq('id', user.id);

      navigate('/onboarding/connect-email');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const missingDomainsCount = Object.values(editableDomains).filter(d => !d).length;

  // ── Upload step ──
  if (step === 'upload') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-semibold text-center text-gray-900">
            Importez votre portefeuille
          </h1>
          <p className="text-gray-500 text-center mt-2 mb-8 text-sm">
            Uploadez un fichier CSV ou Excel contenant vos sociétés en portefeuille
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="h-10 w-10 text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 font-medium">Glissez votre fichier ici</p>
            <p className="text-xs text-gray-400 mt-1">ou cliquez pour sélectionner</p>
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            Formats acceptés : CSV, Excel (.xlsx, .xls)
          </p>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors mt-6"
          >
            Skip this step
          </button>
        </div>
      </div>
    );
  }

  // ── Processing step ──
  if (step === 'processing') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-semibold text-center text-gray-900">
            Analyse en cours...
          </h1>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-gray-500">Notre IA analyse votre fichier...</p>
            <p className="text-xs text-gray-400">Cela peut prendre quelques secondes</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Results step ──
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-semibold text-gray-900">
            Portefeuille importé
          </h1>
        </div>
        <p className="text-gray-500 text-center text-sm mb-6">
          Vérifiez les noms de domaine avant la synchronisation email
        </p>

        {/* Summary */}
        {importResults && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-gray-700">{importResults.summary.created} importées</span>
            </div>
            {importResults.summary.updated > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span className="text-gray-700">{importResults.summary.updated} mises à jour</span>
              </div>
            )}
            {importResults.summary.failed > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-gray-700">{importResults.summary.failed} erreurs</span>
              </div>
            )}
          </div>
        )}

        {/* Domain validation list */}
        <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0 mb-4">
          {companies.map((company) => (
            <div key={company.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {company.company_name}
                </p>
              </div>
              <div className="w-48">
                <Input
                  value={editableDomains[company.id] || ''}
                  onChange={(e) =>
                    setEditableDomains((prev) => ({
                      ...prev,
                      [company.id]: e.target.value,
                    }))
                  }
                  placeholder="exemple.com"
                  className="text-sm h-8"
                />
              </div>
              {editableDomains[company.id] ? (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {missingDomainsCount > 0 && (
          <p className="text-xs text-amber-600 text-center mb-4">
            ⚠️ {missingDomainsCount} entreprise(s) sans nom de domaine — la synchronisation email ne fonctionnera pas pour celles-ci
          </p>
        )}

        <Button
          onClick={handleValidateDomains}
          disabled={saving}
          className="w-full bg-gray-900 hover:bg-gray-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Validate domains & continue'
          )}
        </Button>
      </div>
    </div>
  );
}

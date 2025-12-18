import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Loader2, FileText, X } from 'lucide-react';

const N8N_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/619a0db8-a332-4d7d-bcbb-79e2fcd06141';

export default function SubmitDeal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 50 MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }
      if (droppedFile.size > 50 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 50 MB');
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const extractCompanyName = (fileName: string): string => {
    // Remove .pdf extension and clean up the name
    const name = fileName.replace(/\.pdf$/i, '');
    // Remove common patterns like "pitch deck", "deck", dates, etc.
    const cleaned = name
      .replace(/[-_]/g, ' ')
      .replace(/pitch\s*deck/gi, '')
      .replace(/deck/gi, '')
      .replace(/\d{4}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'Analyse en cours...';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Veuillez sélectionner un fichier PDF');
      return;
    }

    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create deal in "pending" status
      const companyName = extractCompanyName(file.name);
      
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          user_id: user.id,
          company_name: companyName,
          startup_name: companyName,
          status: 'pending',
          sector: 'Other',
          stage: 'Seed',
          country: 'France',
        })
        .select()
        .single();

      if (dealError) throw dealError;

      toast.info('Analyse en cours...', { duration: 10000 });
      
      // Navigate immediately to the deal page (will show loader)
      navigate(`/deal/${deal.id}`);

      // Step 2: Send to N8N webhook
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deal_id', deal.id);
      formData.append('user_id', user.id);

      try {
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`N8N Error: ${response.status}`);
        }

        const result = await response.json();

        // Step 4: Update deal with N8N response
        const { error: updateError } = await supabase
          .from('deals')
          .update({
            company_name: result.company_name || companyName,
            startup_name: result.company_name || companyName,
            memo_content: result.memo_content,
            status: 'completed',
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', deal.id);

        if (updateError) throw updateError;

        toast.success('Analyse terminée !');
      } catch (n8nError: any) {
        console.error('N8N Error:', n8nError);
        
        // Update deal with error status
        await supabase
          .from('deals')
          .update({
            status: 'error',
            error_message: n8nError.message || 'Erreur lors de l\'analyse',
          })
          .eq('id', deal.id);

        toast.error('Erreur lors de l\'analyse. Vous pouvez relancer l\'analyse depuis la page du deal.');
      }
    } catch (error: any) {
      console.error('Error submitting deal:', error);
      toast.error(error.message || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Soumettre un Deal</h1>
        <p className="text-muted-foreground">Uploadez votre pitch deck pour analyse automatique</p>
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Pitch Deck</CardTitle>
          <CardDescription>
            Uploadez simplement votre pitch deck en PDF. L'analyse extraira automatiquement toutes les informations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <div className="mt-2">
                {file ? (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label 
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-1">
                        Glissez-déposez votre pitch deck
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ou cliquez pour sélectionner un fichier
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">PDF uniquement (max. 50MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || !file}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analyser le Deck
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Loader2, FileText, X } from 'lucide-react';

const N8N_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/2551cfc4-1892-4926-9f17-746c9a51be71';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export default function SubmitDeal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');

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
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          user_id: user.id,
          company_name: null, // Will be filled by N8N
          status: 'pending',
          source: 'form',
          additional_context: additionalContext || null,
        })
        .select()
        .single();

      if (dealError) throw dealError;

      toast.info('Analyse en cours... Cela peut prendre jusqu\'à une minute.', { duration: 60000 });

      // Step 2: Send PDF to N8N webhook
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deal_id', deal.id);
      formData.append('additional_context', additionalContext || '');

      try {
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`N8N Error: ${response.status}`);
        }

        const result = await response.json();

        // Step 3: Update deal with N8N response
        if (result.status === 'completed') {
          await supabase
            .from('deals')
            .update({
              company_name: result.company_name,
              memo_html: result.memo_html,
              status: 'completed',
              analyzed_at: new Date().toISOString(),
            })
            .eq('id', deal.id);

          toast.success('Analyse terminée !');
        } else {
          await supabase
            .from('deals')
            .update({
              status: 'error',
              error_message: result.error || 'Échec de l\'analyse',
            })
            .eq('id', deal.id);

          toast.error(result.error || 'Échec de l\'analyse');
        }

        // Step 4: Store PDF in deck_files
        try {
          const base64Content = await fileToBase64(file);
          
          await supabase
            .from('deck_files')
            .insert({
              deal_id: deal.id,
              filename: file.name,
              base64_content: base64Content,
              mime_type: 'application/pdf',
            });
        } catch (storageError) {
          console.error('Error storing deck file:', storageError);
          // Non-blocking error - deal is still created
        }

        navigate('/dashboard');
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

        toast.error('Erreur lors de l\'analyse. Vous pouvez réessayer depuis la page du deal.');
        navigate('/dashboard');
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

            {/* Additional Context */}
            <div className="space-y-2">
              <Label htmlFor="additional-context">Contexte additionnel (optionnel)</Label>
              <Textarea
                id="additional-context"
                placeholder="Fournissez tout contexte utile pour l'analyse (ex: contenu d'email, notes, questions spécifiques...)"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={4}
                className="resize-none"
              />
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
                    Analyse en cours...
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

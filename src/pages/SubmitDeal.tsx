import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Loader2, FileText, X } from 'lucide-react';

const SECTORS = [
  'FinTech',
  'HealthTech',
  'EdTech',
  'CleanTech',
  'E-commerce',
  'SaaS',
  'AI/ML',
  'Marketplace',
  'Gaming',
  'Other',
];

const STAGES = [
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B',
  'Series C+',
];

const COUNTRIES = [
  'France',
  'United States',
  'United Kingdom',
  'Germany',
  'Spain',
  'Italy',
  'Other',
];

export default function SubmitDeal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    startup_name: '',
    company_name: '',
    website: '',
    sector: '',
    stage: '',
    country: '',
  });

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
      // 1. Create the deal
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          user_id: user.id,
          startup_name: formData.startup_name,
          company_name: formData.company_name || null,
          website: formData.website || null,
          sector: formData.sector,
          stage: formData.stage,
          country: formData.country,
          status: 'pending',
        })
        .select()
        .single();

      if (dealError) throw dealError;

      // 2. Upload the file
      const filePath = `${user.id}/${deal.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('deck-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Create deck_files record
      const { error: deckError } = await supabase
        .from('deck_files')
        .insert({
          deal_id: deal.id,
          file_name: file.name,
          storage_path: filePath,
          mime_type: file.type,
          file_size_bytes: file.size,
        });

      if (deckError) throw deckError;

      toast.success('Deal soumis avec succès !');
      navigate(`/deal/${deal.id}`);
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
        <p className="text-muted-foreground">Uploadez votre pitch deck pour analyse</p>
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Informations du Deal</CardTitle>
          <CardDescription>
            Remplissez les informations de la startup et uploadez le pitch deck
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <Label>Pitch Deck (PDF)</Label>
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
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Cliquez pour uploader ou glissez-déposez
                      </p>
                      <p className="text-xs text-muted-foreground">PDF (max. 50MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Startup Name */}
            <div>
              <Label htmlFor="startup_name">Nom de la Startup *</Label>
              <Input
                id="startup_name"
                value={formData.startup_name}
                onChange={(e) => setFormData({ ...formData, startup_name: e.target.value })}
                placeholder="Ex: TechStartup"
                required
                className="mt-2"
              />
            </div>

            {/* Company Name */}
            <div>
              <Label htmlFor="company_name">Nom de l'entreprise (si différent)</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Ex: TechStartup SAS"
                className="mt-2"
              />
            </div>

            {/* Website */}
            <div>
              <Label htmlFor="website">Site Web</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className="mt-2"
              />
            </div>

            {/* Sector */}
            <div>
              <Label htmlFor="sector">Secteur *</Label>
              <Select
                value={formData.sector}
                onValueChange={(value) => setFormData({ ...formData, sector: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Sélectionner un secteur" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stage */}
            <div>
              <Label htmlFor="stage">Stade de développement *</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => setFormData({ ...formData, stage: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Sélectionner un stade" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Country */}
            <div>
              <Label htmlFor="country">Pays *</Label>
              <Select
                value={formData.country}
                onValueChange={(value) => setFormData({ ...formData, country: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Sélectionner un pays" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || !file || !formData.startup_name || !formData.sector || !formData.stage || !formData.country}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Soumission...
                  </>
                ) : (
                  'Soumettre le Deal'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

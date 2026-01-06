import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, RefreshCw, Save, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import AnalysisLoader from '@/components/AnalysisLoader';
import { MemoHtmlFrame } from '@/components/MemoHtmlFrame';
import { displayCompanyName, formatAmount, parseAmount } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const N8N_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/619a0db8-a332-4d7d-bcbb-79e2fcd06141';

interface Deal {
  id: string;
  user_id: string | null;
  company_name: string | null;
  sector: string | null;
  sub_sector: string | null;
  stage: string | null;
  status: string;
  source: string | null;
  sender_email: string | null;
  memo_html: string | null;
  memo_content: string | null;
  one_liner: string | null;
  additional_context: string | null;
  amount_sought: string | null;
  investment_amount_eur: number | null;
  funding_type: string | null;
  created_at: string;
  updated_at: string | null;
  analyzed_at: string | null;
  error_message: string | null;
}

interface EditableFields {
  company_name: string;
  status: string;
  one_liner: string;
  sector: string;
  sub_sector: string;
  stage: string;
  amount_sought: string;
  funding_type: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nouveau' },
  { value: 'reviewing', label: 'En revue' },
  { value: 'pending', label: 'En attente' },
  { value: 'analyzed', label: 'Analysé' },
  { value: 'completed', label: 'Terminé' },
  { value: 'passed', label: 'Passé' },
  { value: 'error', label: 'Erreur' },
];

const STAGE_OPTIONS = [
  { value: 'Pre-seed', label: 'Pre-seed' },
  { value: 'Seed', label: 'Seed' },
  { value: 'Series A', label: 'Series A' },
  { value: 'Series B', label: 'Series B' },
  { value: 'Series C+', label: 'Series C+' },
  { value: 'Growth', label: 'Growth' },
];

const SECTOR_OPTIONS = [
  { value: 'Tech', label: 'Tech' },
  { value: 'FinTech', label: 'FinTech' },
  { value: 'HealthTech', label: 'HealthTech' },
  { value: 'EdTech', label: 'EdTech' },
  { value: 'CleanTech', label: 'CleanTech' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Marketplace', label: 'Marketplace' },
  { value: 'DeepTech', label: 'DeepTech' },
  { value: 'Other', label: 'Autre' },
];

const FUNDING_TYPE_OPTIONS = [
  { value: 'Equity', label: 'Equity' },
  { value: 'Convertible', label: 'Convertible' },
  { value: 'SAFE', label: 'SAFE' },
  { value: 'BSA-AIR', label: 'BSA-AIR' },
  { value: 'Debt', label: 'Dette' },
  { value: 'Grant', label: 'Subvention' },
];

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [editedFields, setEditedFields] = useState<EditableFields>({
    company_name: '',
    status: '',
    one_liner: '',
    sector: '',
    sub_sector: '',
    stage: '',
    amount_sought: '',
    funding_type: '',
  });

  useEffect(() => {
    if (id) {
      loadDeal();

      const channel = supabase
        .channel(`deal-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'deals',
            filter: `id=eq.${id}`
          },
          (payload) => {
            console.log('Deal updated:', payload);
            const newDeal = payload.new as Deal;
            setDeal(prev => prev ? { ...prev, ...newDeal } : null);
            initializeEditedFields(newDeal);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const initializeEditedFields = (dealData: Deal) => {
    const displayAmount = dealData.investment_amount_eur 
      ? formatAmount(String(dealData.investment_amount_eur))
      : dealData.amount_sought 
        ? formatAmount(dealData.amount_sought)
        : '';

    setEditedFields({
      company_name: displayCompanyName(dealData.company_name) || '',
      status: dealData.status || 'new',
      one_liner: dealData.one_liner || '',
      sector: dealData.sector || '',
      sub_sector: dealData.sub_sector || '',
      stage: dealData.stage || '',
      amount_sought: displayAmount,
      funding_type: dealData.funding_type || '',
    });
  };

  const loadDeal = async () => {
    try {
      const { data: dealData, error: dealError } = await supabase
        .from('deals')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (dealError) throw dealError;
      if (!dealData) {
        toast.error('Deal non trouvé');
        navigate('/dashboard');
        return;
      }
      
      setDeal(dealData);
      initializeEditedFields(dealData);
    } catch (error: any) {
      console.error('Error loading deal:', error);
      toast.error('Erreur lors du chargement du deal');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!deal) return;
    
    setSaving(true);
    try {
      const updateData = {
        company_name: editedFields.company_name || null,
        status: editedFields.status,
        one_liner: editedFields.one_liner || null,
        sector: editedFields.sector || null,
        sub_sector: editedFields.sub_sector || null,
        stage: editedFields.stage || null,
        amount_sought: parseAmount(editedFields.amount_sought) || null,
        funding_type: editedFields.funding_type || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('deals')
        .update(updateData)
        .eq('id', deal.id);

      if (error) throw error;
      
      toast.success('Deal sauvegardé');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!deal) return;
    
    setRetrying(true);
    
    try {
      await supabase
        .from('deals')
        .update({ status: 'pending', error_message: null })
        .eq('id', deal.id);

      toast.info('Relance de l\'analyse...');

      const formData = new FormData();
      formData.append('deal_id', deal.id);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`N8N Error: ${response.status}`);
      }

      const result = await response.json();

      await supabase
        .from('deals')
        .update({
          company_name: result.company_name || deal.company_name,
          memo_html: result.memo_html,
          status: 'completed',
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deal.id);

      toast.success('Analyse terminée !');
    } catch (error: any) {
      console.error('Retry error:', error);
      
      await supabase
        .from('deals')
        .update({
          status: 'error',
          error_message: error.message || 'Erreur lors de l\'analyse',
        })
        .eq('id', deal.id);

      toast.error('Erreur lors de l\'analyse');
    } finally {
      setRetrying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'analyzed':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {status === 'analyzed' ? 'Analysé' : 'Terminé'}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Analyse en cours...
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erreur
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateField = (field: keyof EditableFields, value: string) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Deal non trouvé</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Retour au Dashboard
        </Button>
      </div>
    );
  }

  // Show analysis loader for pending deals
  if (deal.status === 'pending') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{displayCompanyName(deal.company_name) || 'Analyse en cours...'}</h1>
              {getStatusBadge(deal.status)}
            </div>
          </div>
        </div>
        <AnalysisLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/dashboard')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 space-y-2">
              <Label htmlFor="company_name">Nom de l'entreprise</Label>
              <Input
                id="company_name"
                value={editedFields.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="Nom de l'entreprise"
                className="text-xl font-semibold h-12"
              />
            </div>
            
            <div className="w-full md:w-48 space-y-2">
              <Label>Statut</Label>
              <Select
                value={editedFields.status}
                onValueChange={(value) => updateField('status', value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="h-12 px-6"
              size="lg"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
          
          {deal.analyzed_at && (
            <p className="text-sm text-muted-foreground mt-4 ml-12">
              Analysé le {new Date(deal.analyzed_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error State Banner */}
      {deal.status === 'error' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{deal.error_message || 'Une erreur s\'est produite lors de l\'analyse'}</span>
            </div>
            <Button onClick={handleRetryAnalysis} disabled={retrying} variant="outline">
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Relancer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Résumé</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editedFields.one_liner}
            onChange={(e) => updateField('one_liner', e.target.value)}
            placeholder="Description courte de l'entreprise (one-liner)..."
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Key Data Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Données Clés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sector */}
            <div className="space-y-2">
              <Label>Secteur</Label>
              <Select
                value={editedFields.sector}
                onValueChange={(value) => updateField('sector', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-sector */}
            <div className="space-y-2">
              <Label>Sous-secteur</Label>
              <Input
                value={editedFields.sub_sector}
                onChange={(e) => updateField('sub_sector', e.target.value)}
                placeholder="Ex: B2B SaaS"
              />
            </div>

            {/* Stage */}
            <div className="space-y-2">
              <Label>Stade</Label>
              <Select
                value={editedFields.stage}
                onValueChange={(value) => updateField('stage', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Sought */}
            <div className="space-y-2">
              <Label>Montant recherché</Label>
              <Input
                value={editedFields.amount_sought}
                onChange={(e) => updateField('amount_sought', e.target.value)}
                placeholder="Ex: 500k€ ou 1.5M€"
              />
            </div>

            {/* Funding Type */}
            <div className="space-y-2">
              <Label>Type de financement</Label>
              <Select
                value={editedFields.funding_type}
                onValueChange={(value) => updateField('funding_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {FUNDING_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Memo Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mémo d'Investissement</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deal.memo_html ? (
            <div className="h-[70vh] border-t">
              <MemoHtmlFrame html={deal.memo_html} title={`Mémo - ${editedFields.company_name}`} />
            </div>
          ) : deal.memo_content ? (
            <div className="p-6 prose prose-sm max-w-none dark:prose-invert bg-card rounded-b-lg">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {deal.memo_content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              Aucun mémo disponible pour ce deal.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

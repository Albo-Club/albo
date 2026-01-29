import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTORS_LIST, INVESTMENT_TYPES_LIST, getSectorColors } from '@/types/portfolio';

interface AddPortfolioCompanyModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddPortfolioCompanyModal({ open, onClose }: AddPortfolioCompanyModalProps) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSector, setNewSector] = useState('');

  // Step 1 fields
  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [preview, setPreview] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [founders, setFounders] = useState<string[]>(['']);

  // Step 2 fields
  const [investmentDate, setInvestmentDate] = useState<Date | undefined>();
  const [amountInvested, setAmountInvested] = useState('');
  const [investmentType, setInvestmentType] = useState('');
  const [entryValuation, setEntryValuation] = useState('');

  // Calculate ownership percentage
  const ownershipPercentage = (() => {
    const amount = parseFloat(amountInvested);
    const valuation = parseFloat(entryValuation);
    if (!isNaN(amount) && !isNaN(valuation) && valuation > 0) {
      return ((amount / valuation) * 100).toFixed(4);
    }
    return null;
  })();

  const resetForm = () => {
    setStep(1);
    setCompanyName('');
    setDomain('');
    setPreview('');
    setSectors([]);
    setFounders(['']);
    setInvestmentDate(undefined);
    setAmountInvested('');
    setInvestmentType('');
    setEntryValuation('');
    setNewSector('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleSector = (sector: string) => {
    setSectors(prev =>
      prev.includes(sector)
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    );
  };

  const addCustomSector = () => {
    if (newSector.trim() && !sectors.includes(newSector.trim())) {
      setSectors(prev => [...prev, newSector.trim()]);
      setNewSector('');
    }
  };

  const addFounder = () => {
    setFounders(prev => [...prev, '']);
  };

  const removeFounder = (index: number) => {
    setFounders(prev => prev.filter((_, i) => i !== index));
  };

  const updateFounder = (index: number, value: string) => {
    setFounders(prev => prev.map((f, i) => i === index ? value : f));
  };

  const handleNext = () => {
    if (!companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!workspace?.id) {
      toast.error("Aucun workspace sélectionné");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data
      const amountEuros = amountInvested ? parseFloat(amountInvested) : null;
      const valuationEuros = entryValuation ? parseFloat(entryValuation) : null;
      const ownershipDecimal = amountEuros && valuationEuros && valuationEuros > 0
        ? amountEuros / valuationEuros
        : null;
      const foundersString = founders.filter(f => f.trim()).join(', ');

      const { error } = await supabase.from('portfolio_companies').insert({
        workspace_id: workspace.id,
        company_name: companyName.trim(),
        domain: domain.trim() || null,
        preview: preview.trim() || null,
        sectors: sectors.length > 0 ? sectors : null,
        related_people: foundersString || null,
        investment_date: investmentDate ? format(investmentDate, 'yyyy-MM-dd') : null,
        amount_invested_euros: amountEuros,
        investment_type: investmentType || null,
        entry_valuation_euros: valuationEuros,
        ownership_percentage: ownershipDecimal,
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['portfolio-companies'] });
      toast.success("Entreprise ajoutée avec succès !");
      handleClose();
    } catch (error: any) {
      console.error('Error adding company:', error);
      toast.error(error.message || "Erreur lors de l'ajout de l'entreprise");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <h1 className="text-2xl font-semibold text-center text-foreground">
          {step === 1 ? "Ajouter une entreprise" : "Détails de l'investissement"}
        </h1>
        <p className="text-muted-foreground text-center mt-2 mb-8 text-sm">
          {step === 1 ? "Informations générales" : "Étape 2 sur 2"}
        </p>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">Nom de l'entreprise *</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domaine web</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
              />
              <p className="text-xs text-muted-foreground">Utilisé pour le logo</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                placeholder="Une brève description de l'entreprise..."
                rows={3}
              />
            </div>

            {/* Sectors */}
            <div className="space-y-2">
              <Label>Secteurs</Label>
              <div className="flex flex-wrap gap-2">
                {SECTORS_LIST.map(sector => {
                  const isSelected = sectors.includes(sector);
                  const colors = getSectorColors(sector);
                  return (
                    <Badge
                      key={sector}
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        "cursor-pointer transition-all text-xs",
                        isSelected && `${colors.bg} ${colors.text} ${colors.border} border`
                      )}
                      onClick={() => toggleSector(sector)}
                    >
                      {isSelected && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {sector}
                    </Badge>
                  );
                })}
              </div>
              {/* Add custom sector */}
              <div className="flex gap-2 mt-2">
                <Input
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value)}
                  placeholder="Autre secteur..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSector())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addCustomSector}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {/* Custom sectors badges */}
              {sectors.filter(s => !SECTORS_LIST.includes(s)).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {sectors.filter(s => !SECTORS_LIST.includes(s)).map(sector => (
                    <Badge
                      key={sector}
                      className="cursor-pointer"
                      onClick={() => toggleSector(sector)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {sector}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Founders */}
            <div className="space-y-2">
              <Label>Fondateurs</Label>
              {founders.map((founder, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={founder}
                    onChange={(e) => updateFounder(index, e.target.value)}
                    placeholder="Nom du fondateur"
                    className="flex-1"
                  />
                  {founders.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFounder(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFounder}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un fondateur
              </Button>
            </div>

            {/* Continue button */}
            <Button onClick={handleNext} className="w-full">
              Continuer
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Investment Date */}
            <div className="space-y-2">
              <Label>Date d'investissement</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !investmentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {investmentDate ? format(investmentDate, "PPP", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={investmentDate}
                    onSelect={setInvestmentDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Amount Invested */}
            <div className="space-y-2">
              <Label htmlFor="amount">Montant investi (€)</Label>
              <Input
                id="amount"
                type="number"
                value={amountInvested}
                onChange={(e) => setAmountInvested(e.target.value)}
                placeholder="50000"
              />
            </div>

            {/* Investment Type */}
            <div className="space-y-2">
              <Label>Type d'investissement</Label>
              <Select value={investmentType} onValueChange={setInvestmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES_LIST.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entry Valuation */}
            <div className="space-y-2">
              <Label htmlFor="valuation">Valorisation post-money (€)</Label>
              <Input
                id="valuation"
                type="number"
                value={entryValuation}
                onChange={(e) => setEntryValuation(e.target.value)}
                placeholder="1000000"
              />
            </div>

            {/* Calculated Ownership */}
            {ownershipPercentage && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Participation calculée</p>
                <p className="text-lg font-semibold">{ownershipPercentage}%</p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ajout...
                  </>
                ) : (
                  "Ajouter"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-1 mt-6">
          {[1, 2].map(s => (
            <div
              key={s}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                s <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

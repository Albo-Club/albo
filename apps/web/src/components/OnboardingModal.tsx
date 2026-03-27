import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SECTORS = ['FinTech', 'HealthTech', 'Climate', 'B2B SaaS', 'Marketplace', 'DeepTech', 'EdTech', 'PropTech'];

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '',
    investment_focus: [] as string[],
    check_size_min: '',
    check_size_max: '',
    country: '',
  });

  const handleNext = () => {
    if (step === 1 && !data.name) {
      toast.error(t('onboarding.errors.nameRequired', 'Name is required'));
      return;
    }
    setStep(step + 1);
  };

  const toggleSector = (sector: string) => {
    setData(prev => ({
      ...prev,
      investment_focus: prev.investment_focus.includes(sector)
        ? prev.investment_focus.filter(s => s !== sector)
        : [...prev.investment_focus, sector]
    }));
  };

  const handleComplete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          investment_focus: data.investment_focus,
          check_size_min: data.check_size_min ? parseInt(data.check_size_min) * 1000 : null,
          check_size_max: data.check_size_max ? parseInt(data.check_size_max) * 1000 : null,
          country: data.country || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(t('onboarding.success', 'Profile saved successfully!'));
      onComplete();
    } catch (error: any) {
      toast.error(error.message || t('onboarding.errors.saveFailed', 'Failed to save profile'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('onboarding.welcome.title', 'Welcome to Albo!')}</DialogTitle>
          <DialogDescription>
            {t('onboarding.welcome.description', "Let's set up your profile to get started.")}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>{t('onboarding.step1.nameLabel', 'Your Name')}</Label>
              <Input
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder={t('onboarding.step1.namePlaceholder', 'John Doe')}
                className="mt-2"
              />
            </div>
            <Button onClick={handleNext} className="w-full">
              {t('onboarding.continue', 'Continue')}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>{t('onboarding.step2.sectorsLabel', 'Investment Focus')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('onboarding.step2.sectorsDescription', 'Select the sectors you are interested in.')}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {SECTORS.map(sector => (
                  <Badge
                    key={sector}
                    variant={data.investment_focus.includes(sector) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleSector(sector)}
                  >
                    {data.investment_focus.includes(sector) && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {sector}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                {t('onboarding.back', 'Back')}
              </Button>
              <Button onClick={handleNext} className="flex-1">
                {t('onboarding.continue', 'Continue')}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>{t('onboarding.step3.checkSizeLabel', 'Check Size')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('onboarding.step3.checkSizeDescription', 'What is your typical investment range?')}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Input
                  type="number"
                  value={data.check_size_min}
                  onChange={(e) => setData({ ...data, check_size_min: e.target.value })}
                  placeholder="10"
                  className="flex-1"
                />
                <span>{t('onboarding.step3.to', 'to')}</span>
                <Input
                  type="number"
                  value={data.check_size_max}
                  onChange={(e) => setData({ ...data, check_size_max: e.target.value })}
                  placeholder="500"
                  className="flex-1"
                />
                <span>k€</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                {t('onboarding.back', 'Back')}
              </Button>
              <Button onClick={handleNext} className="flex-1">
                {t('onboarding.continue', 'Continue')}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label>{t('onboarding.step4.locationLabel', 'Location')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('onboarding.step4.locationDescription', 'Where are you based?')}
              </p>
              <Select value={data.country} onValueChange={(value) => setData({ ...data, country: value })}>
                <SelectTrigger className="mt-3">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="France">France</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="Spain">Spain</SelectItem>
                  <SelectItem value="Italy">Italy</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                {t('onboarding.back', 'Back')}
              </Button>
              <Button onClick={handleComplete} className="flex-1">
                {t('onboarding.getStarted', 'Get Started')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-1 mt-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowRight, User, Phone, MapPin, Linkedin } from 'lucide-react';
import { Logo } from '@/components/Logo';

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'UK', name: 'Royaume-Uni' },
  { code: 'US', name: 'États-Unis' },
  { code: 'OTHER', name: 'Autre' }
];

interface ProfileFormData {
  name: string;
  linkedin_url: string;
  phone: string;
  country: string;
}

export default function CompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profileSource, setProfileSource] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [dealsCount, setDealsCount] = useState(0);
  const [errors, setErrors] = useState<{ name?: string; linkedin_url?: string }>({});

  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    linkedin_url: '',
    phone: '',
    country: ''
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      setUserEmail(user.email || '');

      // Check if profile is already complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_complete, profile_source, name')
        .eq('id', user.id)
        .maybeSingle();

      // If profile is already complete, redirect to dashboard
      if (profile?.is_complete === true) {
        const from = (location.state as any)?.from || '/dashboard';
        navigate(from, { replace: true });
        return;
      }

      setProfileSource(profile?.profile_source || null);
      
      // Pre-fill name if exists
      if (profile?.name) {
        setFormData(prev => ({ ...prev, name: profile.name }));
      }

      // Compter les deals associés à cet email
      if (user.email) {
        const { count } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .or(`user_id.eq.${user.id},sender_email.ilike.${user.email}`);
        
        setDealsCount(count || 0);
      }

      setChecking(false);
    };

    checkSession();
  }, [navigate, location.state]);

  const validate = (): boolean => {
    const newErrors: { name?: string; linkedin_url?: string } = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
    }

    // Validate LinkedIn URL if provided
    if (formData.linkedin_url.trim()) {
      const linkedinUrl = formData.linkedin_url.trim().toLowerCase();
      if (!linkedinUrl.includes('linkedin.com')) {
        newErrors.linkedin_url = 'Veuillez entrer une URL LinkedIn valide';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name.trim(),
          linkedin_url: formData.linkedin_url.trim() || null,
          phone: formData.phone || null,
          country: formData.country || null,
          is_complete: true,
          onboarding_status: 'workspace_pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profil complété ! 🎉');

      // Continue to workspace creation step
      navigate('/onboarding/workspace', { replace: true });

    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Erreur: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <Card className="shadow-elegant overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border">
            <div className="flex flex-col items-center gap-3 mb-2">
              <Logo width={100} height={36} className="text-foreground" />
              <span className="text-lg font-medium text-foreground">Bienvenue sur Albo</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-4 text-center">
              Complétez votre profil
            </h1>
          </div>

          {/* Info Card - Si des deals existent */}
          {dealsCount > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {dealsCount} deal{dealsCount > 1 ? 's' : ''} vous attend{dealsCount > 1 ? 'ent' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Envoyé{dealsCount > 1 ? 's' : ''} à {userEmail}
                  </p>
                </div>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email (readonly) */}
              {userEmail && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={userEmail}
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nom complet <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jean Dupont"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* LinkedIn */}
              <div className="space-y-2">
                <Label htmlFor="linkedin_url" className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  Profil LinkedIn
                  <span className="text-muted-foreground text-xs">(optionnel)</span>
                </Label>
                <Input
                  id="linkedin_url"
                  type="url"
                  placeholder="https://linkedin.com/in/votre-profil"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  className={errors.linkedin_url ? 'border-destructive' : ''}
                />
                {errors.linkedin_url && (
                  <p className="text-sm text-destructive">{errors.linkedin_url}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Téléphone
                  <span className="text-muted-foreground text-xs">(optionnel)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+33 6 00 00 00 00"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              {/* Country */}
              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Pays
                  <span className="text-muted-foreground text-xs">(optionnel)</span>
                </Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un pays" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(country => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Submit button */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    Accéder à mes deals
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          En continuant, vous acceptez nos conditions d'utilisation
        </p>
      </div>
    </div>
  );
}

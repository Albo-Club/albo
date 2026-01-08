import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

const INVESTMENT_SECTORS = [
  { id: 'foodtech', label: 'Foodtech' },
  { id: 'fintech', label: 'Fintech' },
  { id: 'healthtech', label: 'Healthtech' },
  { id: 'saas', label: 'SaaS' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'biotech', label: 'Biotech' },
  { id: 'cleantech', label: 'Cleantech' },
  { id: 'edtech', label: 'Edtech' },
  { id: 'proptech', label: 'Proptech' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'ai', label: 'AI / ML' },
  { id: 'other', label: 'Autre' }
];

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

export default function CompleteProfile() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    country: '',
    investmentFocus: [] as string[],
    checkSizeMin: '',
    checkSizeMax: ''
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        toast.error('Lien invalide ou expiré. Veuillez vous réinscrire.');
        navigate('/auth');
        return;
      }

      // Vérifier si le profil est déjà complet
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single();

      // Si le profil a déjà un nom (autre que l'email), rediriger vers dashboard
      if (profile?.name && profile.name !== session.user.email) {
        navigate('/dashboard');
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || '');
      setChecking(false);
    };

    checkSession();
  }, [navigate]);

  const handleInvestmentFocusChange = (sectorId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      investmentFocus: checked
        ? [...prev.investmentFocus, sectorId]
        : prev.investmentFocus.filter(id => id !== sectorId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Veuillez entrer votre nom');
      return;
    }

    setLoading(true);

    try {
      // 1. Mettre à jour le mot de passe
      const { error: passwordError } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (passwordError) throw passwordError;

      // 2. Mettre à jour le profil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name.trim(),
          phone: formData.phone || null,
          country: formData.country || null,
          investment_focus: formData.investmentFocus.length > 0 ? formData.investmentFocus : null,
          check_size_min: formData.checkSizeMin ? parseInt(formData.checkSizeMin) : null,
          check_size_max: formData.checkSizeMax ? parseInt(formData.checkSizeMax) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      toast.success('Profil créé avec succès ! Bienvenue 🎉');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Erreur lors de la création du profil');
    } finally {
      setLoading(false);
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
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
        </div>

        <Card className="shadow-elegant">
          <CardHeader className="text-center">
            <CardTitle>Finalisez votre inscription</CardTitle>
            <CardDescription>{userEmail}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section Sécurité */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Sécurité</h3>

                <div>
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 caractères"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirmez votre mot de passe"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
              </div>

              <hr className="border-border" />

              {/* Section Profil */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Votre profil</h3>

                <div>
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+33 6 00 00 00 00"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="country">Pays</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => setFormData({ ...formData, country: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Sélectionner" />
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
                </div>
              </div>

              <hr className="border-border" />

              {/* Section Investissement */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Préférences d'investissement</h3>

                <div>
                  <Label>Secteurs d'intérêt</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    {INVESTMENT_SECTORS.map(sector => (
                      <div key={sector.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={sector.id}
                          checked={formData.investmentFocus.includes(sector.id)}
                          onCheckedChange={(checked) =>
                            handleInvestmentFocusChange(sector.id, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={sector.id}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {sector.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="checkSizeMin">Ticket min (€)</Label>
                    <Input
                      id="checkSizeMin"
                      type="number"
                      placeholder="10000"
                      value={formData.checkSizeMin}
                      onChange={(e) => setFormData({ ...formData, checkSizeMin: e.target.value })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="checkSizeMax">Ticket max (€)</Label>
                    <Input
                      id="checkSizeMax"
                      type="number"
                      placeholder="100000"
                      value={formData.checkSizeMax}
                      onChange={(e) => setFormData({ ...formData, checkSizeMax: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

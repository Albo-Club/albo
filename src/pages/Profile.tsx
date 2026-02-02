/**
 * 👤 Profile Page - Paramètres du compte utilisateur
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, User, Briefcase, CheckCircle2, Mail, Plug, RefreshCw, Unplug, Server, AlertCircle } from 'lucide-react';
import { ImageUploader } from '@/components/onboarding/ImageUploader';

// ============================================================
// CONSTANTES
// ============================================================

const SECTORS = [
  'SaaS', 'Fintech', 'HealthTech', 'EdTech', 'CleanTech', 'E-commerce',
  'Marketplace', 'Consumer', 'B2B', 'DeepTech', 'AI/ML', 'Crypto/Web3',
  'Gaming', 'Media', 'FoodTech', 'PropTech', 'Mobility', 'HR Tech',
  'LegalTech', 'InsurTech', 'Other'
];

// ============================================================
// TYPES
// ============================================================

interface Profile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  country: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  investment_focus: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
}

interface ConnectedAccount {
  id: string;
  channel_type: string;
  provider: 'GOOGLE' | 'MICROSOFT' | 'IMAP';
  provider_account_id: string;
  email: string | null;
  display_name: string | null;
  status: 'pending' | 'active' | 'needs_reconnect' | 'disconnected' | 'syncing';
  connected_at: string;
  last_synced_at: string | null;
  disconnected_at: string | null;
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function Profile() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    country: '',
    linkedin_url: '',
    avatar_url: null as string | null,
  });
  
  const [investmentData, setInvestmentData] = useState({
    investment_focus: [] as string[],
    check_size_min: '',
    check_size_max: '',
  });

  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connectingEmail, setConnectingEmail] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadConnectedAccounts();
    }
  }, [user]);

  // Gérer le retour depuis Unipile (query params ?connection=success ou ?connection=failed)
  useEffect(() => {
    const connectionStatus = searchParams.get('connection');
    if (connectionStatus === 'success') {
      toast.success('Compte email connecté avec succès !', {
        description: 'Votre boîte mail est maintenant liée à Albo.',
      });
      // Recharger les comptes après un court délai (le webhook peut prendre 1-2s)
      setTimeout(() => loadConnectedAccounts(), 2000);
      // Nettoyer le query param de l'URL
      searchParams.delete('connection');
      setSearchParams(searchParams, { replace: true });
    } else if (connectionStatus === 'failed') {
      toast.error('Échec de la connexion email', {
        description: 'Veuillez réessayer ou utiliser un autre fournisseur.',
      });
      searchParams.delete('connection');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      setProfile(data);
      
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        country: data.country || '',
        linkedin_url: data.linkedin_url || '',
        avatar_url: data.avatar_url || null,
      });
      
      setInvestmentData({
        investment_focus: data.investment_focus || [],
        check_size_min: data.check_size_min?.toString() || '',
        check_size_max: data.check_size_max?.toString() || '',
      });
      
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast.error('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  };

  const loadConnectedAccounts = async () => {
    if (!user) return;
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'disconnected')
        .order('connected_at', { ascending: false });

      if (error) throw error;
      setConnectedAccounts((data || []) as ConnectedAccount[]);
    } catch (error: any) {
      console.error('Error loading connected accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleAvatarChange = async (url: string | null) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;
      
    } catch (error: any) {
      console.error('Error saving avatar:', error);
      toast.error('Erreur lors de la sauvegarde');
      setFormData(prev => ({ ...prev, avatar_url: profile?.avatar_url || null }));
    }
  };

  const toggleSector = (sector: string) => {
    setInvestmentData(prev => {
      const currentFocus = prev.investment_focus;
      if (currentFocus.includes(sector)) {
        return {
          ...prev,
          investment_focus: currentFocus.filter(s => s !== sector),
        };
      } else {
        return {
          ...prev,
          investment_focus: [...currentFocus, sector],
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('Vous devez être connecté');
      return;
    }

    setSaving(true);

    try {
      const updateData = {
        name: formData.name.trim() || null,
        phone: formData.phone.trim() || null,
        country: formData.country.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        investment_focus: investmentData.investment_focus.length > 0 
          ? investmentData.investment_focus 
          : null,
        check_size_min: investmentData.check_size_min 
          ? parseInt(investmentData.check_size_min, 10) 
          : null,
        check_size_max: investmentData.check_size_max 
          ? parseInt(investmentData.check_size_max, 10) 
          : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profil mis à jour avec succès !');
      await loadProfile();
      
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error('Erreur lors de la sauvegarde', {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectEmail = async () => {
    setConnectingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-unipile-link');

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Aucun lien reçu');
      }
    } catch (error: any) {
      console.error('Error generating Unipile link:', error);
      toast.error('Erreur lors de la connexion email', {
        description: error.message || 'Veuillez réessayer.',
      });
      setConnectingEmail(false);
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('connected_accounts')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString(),
        })
        .eq('id', accountId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Compte déconnecté');
      await loadConnectedAccounts();
    } catch (error: any) {
      console.error('Error disconnecting account:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'GOOGLE':
      case 'MICROSOFT':
        return <Mail className="h-4 w-4" />;
      case 'IMAP':
        return <Server className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'GOOGLE': return 'Gmail';
      case 'MICROSOFT': return 'Outlook';
      case 'IMAP': return 'IMAP';
      default: return provider;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Connecté</Badge>;
      case 'syncing':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Synchronisation</Badge>;
      case 'needs_reconnect':
        return <Badge variant="destructive" className="bg-amber-100 text-amber-700 hover:bg-amber-100"><AlertCircle className="h-3 w-3 mr-1" />Reconnexion requise</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En attente...</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon Profil</h1>
        <p className="text-muted-foreground">
          Gérez vos informations personnelles et préférences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1 : Photo de profil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Photo de profil
            </CardTitle>
            <CardDescription>
              Cette photo sera visible par les autres membres de votre workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUploader
              currentImage={formData.avatar_url}
              onImageChange={handleAvatarChange}
              bucket="avatars"
              userId={user?.id || 'temp'}
              fallbackInitial={formData.name || user?.email || '?'}
              size="lg"
            />
          </CardContent>
        </Card>

        {/* SECTION 2 : Informations personnelles */}
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Ces informations permettent aux autres membres de vous contacter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                value={profile?.email || ''} 
                disabled 
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Jean Dupont"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+33 6 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Pays</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                placeholder="France"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin">URL LinkedIn</Label>
              <Input
                id="linkedin"
                type="url"
                value={formData.linkedin_url}
                onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/jeandupont"
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3 : Préférences d'investissement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Préférences d'investissement
            </CardTitle>
            <CardDescription>
              Aidez vos collègues à savoir quels deals vous intéressent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Secteurs d'intérêt</Label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(sector => {
                  const isSelected = investmentData.investment_focus.includes(sector);
                  return (
                    <Badge
                      key={sector}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleSector(sector)}
                    >
                      {isSelected && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {sector}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Ticket d'investissement</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="check_min" className="text-xs text-muted-foreground">
                    Minimum (€)
                  </Label>
                  <Input
                    id="check_min"
                    type="number"
                    value={investmentData.check_size_min}
                    onChange={(e) => setInvestmentData(prev => ({ 
                      ...prev, 
                      check_size_min: e.target.value 
                    }))}
                    placeholder="10000"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_max" className="text-xs text-muted-foreground">
                    Maximum (€)
                  </Label>
                  <Input
                    id="check_max"
                    type="number"
                    value={investmentData.check_size_max}
                    onChange={(e) => setInvestmentData(prev => ({ 
                      ...prev, 
                      check_size_max: e.target.value 
                    }))}
                    placeholder="100000"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4 : Comptes connectés (email) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Comptes connectés
            </CardTitle>
            <CardDescription>
              Connectez votre boîte email pour recevoir et envoyer des messages depuis Albo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Liste des comptes connectés */}
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des comptes...
              </div>
            ) : connectedAccounts.length > 0 ? (
              <div className="space-y-3">
                {connectedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
                        {getProviderIcon(account.provider)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {account.email || account.display_name || 'Compte email'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {getProviderLabel(account.provider)}
                          </span>
                          {getStatusBadge(account.status)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnectAccount(account.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Unplug className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun compte email connecté</p>
              </div>
            )}

            <Separator />

            {/* Bouton pour connecter un nouveau compte */}
            <Button
              type="button"
              variant="outline"
              onClick={handleConnectEmail}
              disabled={connectingEmail}
              className="w-full"
            >
              {connectingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirection vers le fournisseur...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connecter un compte email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* BOUTON DE SAUVEGARDE */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer les modifications'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

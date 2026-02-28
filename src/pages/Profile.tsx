/**
 * 👤 Profile Page - Paramètres du compte utilisateur
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, User, Mail, Plug, RefreshCw, Unplug, Server, AlertCircle, LogOut, Clock } from 'lucide-react';
import { ImageUploader } from '@/components/onboarding/ImageUploader';
import { EmailConsentModal } from '@/components/email/EmailConsentModal';

// ============================================================
// CONSTANTES
// ============================================================


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
  provider: 'GOOGLE' | 'MICROSOFT' | 'IMAP' | 'OUTLOOK';
  provider_account_id: string;
  email: string | null;
  display_name: string | null;
  status: 'pending_consent' | 'syncing' | 'active' | 'sync_error' | 'disconnected' | 'pending' | 'needs_reconnect';
  connected_at: string;
  last_synced_at: string | null;
  disconnected_at: string | null;
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace, allWorkspaces, isOwner, userRole, members, leaveWorkspace } = useWorkspace();
  
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  
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
  

  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connectingEmail, setConnectingEmail] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // États pour la modal de consentement
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [pendingConsentAccount, setPendingConsentAccount] = useState<ConnectedAccount | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadConnectedAccounts();
    }
  }, [user, workspace?.id]);

  // Écouter les changements en temps réel sur connected_accounts
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('connected_accounts_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connected_accounts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Account status changed:', payload);
          // Recharger la liste quand un compte change
          loadConnectedAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Gérer le retour depuis Unipile (query params ?connection=success ou ?connection=failed)
  useEffect(() => {
    const connectionStatus = searchParams.get('connection');
    if (connectionStatus === 'success') {
      // ⚠️ NE PAS afficher de toast ici - la modal s'en charge
      // Recharger les comptes après un délai (le webhook prend 1-2s)
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
      
      
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast.error('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  };

  const loadConnectedAccounts = async () => {
    if (!user || !workspace?.id) return;
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('id, provider, provider_account_id, email, display_name, status, connected_at, last_synced_at, disconnected_at, channel_type')
        .eq('user_id', user.id)
        .eq('workspace_id', workspace.id)
        .neq('status', 'disconnected')
        .order('connected_at', { ascending: false });

      if (error) throw error;
      
      const accounts = (data || []) as ConnectedAccount[];
      setConnectedAccounts(accounts);

      // Vérifier s'il y a un compte en attente de consentement
      const pendingAccount = accounts.find((a) => a.status === 'pending_consent');
      if (pendingAccount) {
        setPendingConsentAccount(pendingAccount);
        setConsentModalOpen(true);
      }
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
      const { data, error } = await supabase.functions.invoke('generate-unipile-link', {
        body: { workspace_id: workspace?.id }
      });

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

  const handleLeaveWorkspace = async () => {
    setLeaving(true);
    try {
      await leaveWorkspace();
      toast.success('Vous avez quitté le workspace');
      navigate('/portfolio');
    } catch (error: any) {
      console.error('Error leaving workspace:', error);
      toast.error(error.message || 'Erreur lors de la sortie du workspace');
    } finally {
      setLeaving(false);
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Mon Profil</h1>
          {userRole === 'owner' && (
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Propriétaire</Badge>
          )}
          {userRole === 'admin' && (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Administrateur</Badge>
          )}
          {userRole === 'member' && (
            <Badge variant="secondary">Membre</Badge>
          )}
        </div>
        {workspace && (
          <p className="text-sm text-muted-foreground mt-1">
            Workspace actif : <span className="font-medium text-foreground">{workspace.name}</span>
          </p>
        )}
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

        {/* SECTION 3 : Comptes connectés (email) */}
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
            {!isAdminOrOwner ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                La connexion email est réservée aux administrateurs de workspace.
              </p>
            ) : (
              <>
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {account.email || account.display_name || 'Compte email'}
                              </p>
                              {account.status === 'syncing' && (
                                <span className="flex items-center gap-1 text-xs text-blue-600">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Synchronisation...
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {getProviderLabel(account.provider)}
                              </span>
                              {account.status === 'syncing' ? (
                                <Badge variant="secondary" className="text-xs">
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Sync en cours
                                </Badge>
                              ) : account.status === 'pending_consent' ? (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  En attente
                                </Badge>
                              ) : account.status === 'sync_error' ? (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Erreur
                                </Badge>
                              ) : account.status === 'needs_reconnect' ? (
                                <Badge variant="destructive" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Reconnexion requise
                                </Badge>
                              ) : account.status === 'active' ? (
                                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                                  Connecté
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {account.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {(account.status === 'active' || account.status === 'sync_error' || account.status === 'needs_reconnect') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnectAccount(account.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Unplug className="h-4 w-4" />
                          </Button>
                        )}
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
              </>
            )}
          </CardContent>
        </Card>

        {/* SECTION 5 : Quitter le workspace (seulement si membre d'un workspace et pas owner) */}
        {workspace && !isOwner && (
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <LogOut className="h-5 w-5" />
                Quitter le workspace
              </CardTitle>
              <CardDescription>
                Vous ne serez plus membre de ce workspace et n'aurez plus accès aux deals partagés.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border border-orange-200 bg-orange-50">
                <div>
                  <p className="font-medium">Quitter "{workspace.name}"</p>
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez rejoindre à nouveau ce workspace si vous recevez une nouvelle invitation.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-100">
                      <LogOut className="mr-2 h-4 w-4" />
                      Quitter
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Quitter ce workspace ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vous allez quitter le workspace "{workspace.name}". 
                        Vous n'aurez plus accès aux deals partagés avec ce workspace.
                        Vous pourrez rejoindre à nouveau si vous recevez une nouvelle invitation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleLeaveWorkspace}
                        disabled={leaving}
                        className="bg-orange-600 text-white hover:bg-orange-700"
                      >
                        {leaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sortie en cours...
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-2 h-4 w-4" />
                            Quitter le workspace
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}

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

      {/* Modal de consentement */}
      <EmailConsentModal
        open={consentModalOpen}
        onOpenChange={setConsentModalOpen}
        account={pendingConsentAccount}
        onSuccess={() => {
          setPendingConsentAccount(null);
          // La liste se mettra à jour via Realtime
        }}
        onCancel={() => {
          setPendingConsentAccount(null);
          loadConnectedAccounts();
        }}
      />
    </div>
  );
}

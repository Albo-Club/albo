import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Users, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react';
import logo from '@/assets/logo.svg';
import { APP_CONFIG } from '@/config/app';

interface InvitationDetails {
  id: string;
  workspace_name: string;
  role: string;
  email: string;
  expires_at: string;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  
  // Nouveaux états pour gestion profil et membership
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userAlreadyMember, setUserAlreadyMember] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    name: '',
    password: '',
    linkedinUrl: '',
    whatsappNumber: '',
  });

  useEffect(() => {
    loadInvitation();
  }, [token, user]);

  const loadInvitation = async () => {
    if (!token) {
      setError('Lien d\'invitation invalide');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('workspace_invitations')
        .select(`
          id,
          email,
          role,
          expires_at,
          accepted_at,
          workspace_id,
          workspaces:workspace_id (name)
        `)
        .eq('token', token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Cette invitation est invalide ou a expiré.');
        setLoading(false);
        return;
      }

      // Stocker le workspace_id
      setWorkspaceId(data.workspace_id);

      // Track membership in a local var to avoid relying on async state updates
      let isMember = false;

      // Si l'utilisateur est connecté, vérifier le profil ET l'appartenance au workspace
      if (user?.id) {
        // Vérifier si le profil est complet
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_complete, name')
          .eq('id', user.id)
          .maybeSingle();
        
        // Le profil est complet si is_complete === true ET name existe
        const isComplete = profileData?.is_complete === true && !!profileData?.name;
        setProfileComplete(isComplete);

        // Vérifier si l'utilisateur est déjà membre du workspace
        if (data.workspace_id) {
          const { data: memberData } = await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', data.workspace_id)
            .eq('user_id', user.id)
            .maybeSingle();
          
          isMember = !!memberData;
          setUserAlreadyMember(isMember);
        }
      }

      // L'invitation a été "acceptée" mais l'utilisateur peut ne pas avoir terminé l'onboarding
      if (data.accepted_at) {
        if (user?.id) {
          // Si l'utilisateur est déjà membre, on peut afficher l'état "déjà accepté"
          if (isMember) {
            setAlreadyAccepted(true);
          } else {
            // Sinon, permettre de continuer le processus (ex: onboarding non terminé)
            setAlreadyAccepted(false);
          }
        } else {
          // Pas connecté, permettre de continuer (créer un compte ou se connecter)
          setAlreadyAccepted(false);
        }
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('Cette invitation a expiré');
        setLoading(false);
        return;
      }

      const workspaceData = data.workspaces as unknown as { name: string } | null;
      
      setInvitation({
        id: data.id,
        workspace_name: workspaceData?.name || 'Workspace',
        role: data.role,
        email: data.email,
        expires_at: data.expires_at,
      });

      setSignupData(prev => ({ ...prev, email: data.email }));
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Erreur lors du chargement de l\'invitation');
      setLoading(false);
    }
  };

  // Aller au workspace (avec vérification profil)
  const goToWorkspace = () => {
    if (workspaceId) {
      localStorage.setItem('currentWorkspaceId', workspaceId);
    }
    
    // Si profil incomplet, rediriger vers complete-profile
    if (profileComplete === false) {
      localStorage.setItem('pending_invitation', token!);
      navigate('/complete-profile', { 
        state: { from: `/invite/${token}` }
      });
    } else {
      navigate('/dashboard');
    }
  };

  // Rediriger vers complete-profile avec contexte
  const goToCompleteProfile = () => {
    if (workspaceId) {
      localStorage.setItem('currentWorkspaceId', workspaceId);
    }
    localStorage.setItem('pending_invitation', token!);
    navigate('/complete-profile', { 
      state: { from: `/invite/${token}` }
    });
  };

  const handleAccept = async () => {
    if (!token || !user?.id || !invitation) return;

    // Vérifier si le profil est complet avant d'accepter
    if (profileComplete === false) {
      toast.error('Veuillez d\'abord compléter votre profil');
      goToCompleteProfile();
      return;
    }

    setAccepting(true);
    try {
      const { data: workspaceIdResult, error } = await supabase.rpc('accept_workspace_invitation', {
        _token: token,
        _user_id: user.id,
      });

      if (error) {
        // Vérifier si l'erreur est "déjà membre"
        if (error.message.includes('already a member')) {
          toast.info('Vous êtes déjà membre de ce workspace');
          goToWorkspace();
          return;
        }
        toast.error('Erreur lors de l\'acceptation de l\'invitation.');
        setAccepting(false);
        return;
      }

      if (workspaceIdResult) {
        localStorage.setItem('currentWorkspaceId', workspaceIdResult);
      }

      toast.success(`Félicitations ! Vous avez rejoint "${invitation.workspace_name}" avec succès.`);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      toast.error('Erreur lors de l\'acceptation de l\'invitation.');
      setAccepting(false);
    }
  };

  const handleLogin = () => {
    localStorage.setItem('pending_invitation', token!);
    navigate('/auth', { state: { redirectTo: `/invite/${token}` } });
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupData.email || !signupData.password || !signupData.name) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (signupData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setAccepting(true);
    try {
      // Garder le token en mémoire pour reprendre après confirmation email (setup-password -> complete-profile -> retour ici)
      localStorage.setItem('pending_invitation', token!);

      const { data: signupResult, error: signupError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            name: signupData.name,
          },
          // Continuer le nouveau flux d'onboarding (setup-password -> complete-profile -> workspace)
          emailRedirectTo: `${APP_CONFIG.baseUrl}/setup-password`,
        },
      });

      if (signupError) {
        if (signupError.message.includes('already registered')) {
          toast.error('Cet email a déjà un compte. Connectez-vous pour accepter l\'invitation.');
          handleLogin();
          return;
        }
        throw signupError;
      }

      // Si l'email est auto-confirmé, on a une session et on peut finaliser l'acceptation.
      // Sinon, on attend la confirmation email (le lien redirige vers /setup-password).
      if (signupResult.session && signupResult.user) {
        // Update profile with additional info - marquer comme complet car nom fourni
        await supabase.from('profiles').upsert({
          id: signupResult.user.id,
          email: signupData.email,
          name: signupData.name,
          linkedin_url: signupData.linkedinUrl || null,
          whatsapp_number: signupData.whatsappNumber || null,
          is_complete: true,
        });

        // Accept the invitation
        const { data: workspaceIdResult, error } = await supabase.rpc('accept_workspace_invitation', {
          _token: token!,
          _user_id: signupResult.user.id,
        });

        if (error) {
          toast.error('Erreur lors de l\'acceptation de l\'invitation.');
          setAccepting(false);
          return;
        }

        if (workspaceIdResult) {
          localStorage.setItem('currentWorkspaceId', workspaceIdResult);
        }

        // On a terminé l'acceptation, on peut nettoyer le token pending
        localStorage.removeItem('pending_invitation');

        toast.success(`Félicitations ! Vous avez rejoint "${invitation?.workspace_name}" avec succès.`);

        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        toast.success('Vérifiez votre email pour confirmer votre compte');
      }
    } catch (err: any) {
      console.error('Error during signup:', err);
      toast.error(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // État "Déjà accepté" avec vérification profil
  if (alreadyAccepted) {
    // Cas 1: Utilisateur connecté ET déjà membre
    if (userAlreadyMember && user) {
      // Sous-cas: Profil incomplet
      if (profileComplete === false) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Vous êtes déjà membre !</h2>
                <p className="text-muted-foreground mb-4">
                  Vous faites déjà partie du workspace "{invitation?.workspace_name}".
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    ⚠️ Veuillez d'abord compléter votre profil pour accéder au workspace.
                  </p>
                </div>
                <Button onClick={goToCompleteProfile} className="w-full">
                  Compléter mon profil
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Sous-cas: Profil complet → accès direct
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Vous êtes déjà membre !</h2>
              <p className="text-muted-foreground mb-4">
                Vous faites déjà partie du workspace "{invitation?.workspace_name}" avec le compte {user.email}.
              </p>
              <Button onClick={goToWorkspace} className="w-full">
                Accéder au workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Cas 2: Utilisateur non connecté
    if (!user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Invitation déjà acceptée</h2>
              <p className="text-muted-foreground mb-4">
                Cette invitation a déjà été utilisée. Connectez-vous pour accéder au workspace.
              </p>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => {
                    if (workspaceId) {
                      localStorage.setItem('currentWorkspaceId', workspaceId);
                    }
                    localStorage.setItem('pending_invitation', token!);
                    navigate('/auth', { state: { redirectTo: `/invite/${token}` } });
                  }} 
                  className="w-full"
                >
                  Se connecter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Cas 3: Utilisateur connecté mais pas membre (autre compte a accepté)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation déjà utilisée</h2>
            <p className="text-muted-foreground mb-2">
              Cette invitation a été acceptée par un autre compte.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Vous êtes connecté en tant que {user.email}.
              <br />
              Demandez une nouvelle invitation si nécessaire.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Aller au dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }} 
                className="w-full"
              >
                Se connecter avec un autre compte
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation invalide</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User logged in with DIFFERENT email - vérifier aussi le profil
  if (user && invitation && user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="Logo" className="h-10 mx-auto mb-4" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Rejoindre {invitation.workspace_name}
            </CardTitle>
            <CardDescription>
              Vous avez été invité à rejoindre ce workspace en tant que{' '}
              <span className="font-medium">{invitation.role}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invitation info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Invitation envoyée à</p>
              <p className="font-medium">{invitation.email}</p>
            </div>
            
            {/* Warning: different emails */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Vous êtes connecté avec un autre compte</p>
              <p className="text-sm text-amber-700 dark:text-amber-500">Compte actuel : {user.email}</p>
            </div>

            {/* Avertissement profil incomplet */}
            {profileComplete === false && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  ℹ️ Vous devrez compléter votre profil après avoir rejoint le workspace.
                </p>
              </div>
            )}

            {/* Option 1: Join with current account */}
            <div className="space-y-2">
              <Button onClick={handleAccept} disabled={accepting} className="w-full">
                {accepting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Rejoindre avec {user.email}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Vous rejoindrez le workspace avec votre compte actuel
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  ou
                </span>
              </div>
            </div>

            {/* Option 2: Log out and connect with invitation email */}
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Se connecter avec {invitation.email}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Vous serez déconnecté et pourrez vous connecter avec l'email de l'invitation
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User logged in with SAME email - vérifier le profil
  if (user && invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="Logo" className="h-10 mx-auto mb-4" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Rejoindre {invitation.workspace_name}
            </CardTitle>
            <CardDescription>
              Vous avez été invité à rejoindre ce workspace en tant que{' '}
              <span className="font-medium">{invitation.role}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invitation info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Invitation envoyée à</p>
              <p className="font-medium">{invitation.email}</p>
            </div>
            
            {/* Connected account info */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Vous êtes connecté en tant que</p>
              <p className="font-medium text-green-800 dark:text-green-200">{user.email}</p>
            </div>

            {/* Avertissement profil incomplet */}
            {profileComplete === false && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  ⚠️ Vous devrez compléter votre profil après avoir rejoint le workspace.
                </p>
              </div>
            )}

            <Button onClick={handleAccept} disabled={accepting} className="w-full">
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Rejoindre le workspace
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              En rejoignant, vous acceptez de partager vos informations avec les membres du workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not logged in - show signup form with login option
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Logo" className="h-10 mx-auto mb-4" />
          <CardTitle>Rejoindre {invitation?.workspace_name}</CardTitle>
          <CardDescription>
            Créez votre compte pour rejoindre le workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login button prominently displayed */}
          <div className="space-y-2">
            <Button variant="default" onClick={handleLogin} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              J'ai déjà un compte - Se connecter
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Ou créer un compte
              </span>
            </div>
          </div>

          <form onSubmit={handleSignupAndAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={signupData.email}
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                L'email de l'invitation ne peut pas être modifié
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                value={signupData.name}
                onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                placeholder="Votre nom"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                placeholder="Minimum 6 caractères"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn (optionnel)</Label>
              <Input
                id="linkedin"
                value={signupData.linkedinUrl}
                onChange={(e) => setSignupData({ ...signupData, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp (optionnel)</Label>
              <Input
                id="whatsapp"
                value={signupData.whatsappNumber}
                onChange={(e) => setSignupData({ ...signupData, whatsappNumber: e.target.value })}
                placeholder="+33 6 12 34 56 78"
              />
            </div>

            <Button type="submit" disabled={accepting} className="w-full">
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Créer mon compte et rejoindre
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

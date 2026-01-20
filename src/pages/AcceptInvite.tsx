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
  }, [token]);

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

      if (data.accepted_at) {
        setError('Cette invitation a déjà été acceptée. Connectez-vous pour accéder à votre workspace.');
        setLoading(false);
        return;
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

      // Pre-fill email in signup form
      setSignupData(prev => ({ ...prev, email: data.email }));
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Erreur lors du chargement de l\'invitation');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !user?.id || !invitation) return;

    setAccepting(true);
    try {
      const { data: workspaceId, error } = await supabase.rpc('accept_workspace_invitation', {
        _token: token,
        _user_id: user.id,
      });

      if (error) {
        toast.error('Erreur lors de l\'acceptation de l\'invitation.');
        setAccepting(false);
        return;
      }

      // Save workspace ID to switch automatically after redirect
      if (workspaceId) {
        localStorage.setItem('currentWorkspaceId', workspaceId);
      }

      toast.success(`Félicitations ! Vous avez rejoint "${invitation.workspace_name}" avec succès.`);
      
      // Delay navigation to let user see the success message
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
      const { data: signupResult, error: signupError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            name: signupData.name,
          },
          emailRedirectTo: `${APP_CONFIG.baseUrl}/invite/${token}`,
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

      if (signupResult.user) {
        // Update profile with additional info
        await supabase.from('profiles').upsert({
          id: signupResult.user.id,
          email: signupData.email,
          name: signupData.name,
          linkedin_url: signupData.linkedinUrl || null,
          whatsapp_number: signupData.whatsappNumber || null,
        });

        // Accept the invitation
        const { data: workspaceId, error } = await supabase.rpc('accept_workspace_invitation', {
          _token: token!,
          _user_id: signupResult.user.id,
        });

        if (error) {
          toast.error('Erreur lors de l\'acceptation de l\'invitation.');
          setAccepting(false);
          return;
        }

        // Save workspace ID to switch automatically after redirect
        if (workspaceId) {
          localStorage.setItem('currentWorkspaceId', workspaceId);
        }

        toast.success(`Félicitations ! Vous avez rejoint "${invitation?.workspace_name}" avec succès.`);
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        // Email confirmation required
        localStorage.setItem('pending_invitation', token!);
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation invalide</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in with DIFFERENT email - show two options
  if (user && invitation && user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="Albo" className="h-8 mx-auto mb-4" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Rejoindre {invitation.workspace_name}
            </CardTitle>
            <CardDescription>
              Vous avez été invité à rejoindre ce workspace en tant que{' '}
              <span className="font-medium capitalize">{invitation.role}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invitation info */}
            <div className="bg-muted rounded-lg p-4 text-center text-sm">
              <p className="text-muted-foreground">Invitation envoyée à</p>
              <p className="font-medium">{invitation.email}</p>
            </div>
            
            {/* Warning: different emails */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center text-sm">
              <p className="text-amber-700 dark:text-amber-400 font-medium">Vous êtes connecté avec un autre compte</p>
              <p className="text-amber-600 dark:text-amber-500">Compte actuel : {user.email}</p>
            </div>

            {/* Option 1: Join with current account */}
            <div className="space-y-2">
              <Button onClick={handleAccept} disabled={accepting} className="w-full">
                {accepting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Rejoindre avec {user.email}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
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
                  // Page will reload and show login/signup form
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Se connecter avec {invitation.email}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Vous serez déconnecté et pourrez vous connecter ou créer un compte avec l'email de l'invitation
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in with SAME email - simple accept button
  if (user && invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="Albo" className="h-8 mx-auto mb-4" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Rejoindre {invitation.workspace_name}
            </CardTitle>
            <CardDescription>
              Vous avez été invité à rejoindre ce workspace en tant que{' '}
              <span className="font-medium capitalize">{invitation.role}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invitation info */}
            <div className="bg-muted rounded-lg p-4 text-center text-sm">
              <p className="text-muted-foreground">Invitation envoyée à</p>
              <p className="font-medium">{invitation.email}</p>
            </div>
            
            {/* Connected account info */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center text-sm">
              <p className="text-green-600 dark:text-green-400">Vous êtes connecté en tant que</p>
              <p className="font-medium text-green-800 dark:text-green-200">{user.email}</p>
            </div>

            <Button onClick={handleAccept} disabled={accepting} className="w-full">
              {accepting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Rejoindre le workspace
            </Button>
            
            <p className="text-center text-xs text-muted-foreground">
              En rejoignant, vous acceptez de partager vos informations avec les membres du workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not logged in - show signup form with login option
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <img src={logo} alt="Albo" className="h-8 mx-auto mb-4" />
          <CardTitle>Rejoindre {invitation?.workspace_name}</CardTitle>
          <CardDescription>
            Créez votre compte pour rejoindre le workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Login button prominently displayed */}
          <div className="mb-6">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleLogin}
            >
              <LogIn className="mr-2 h-4 w-4" />
              J'ai déjà un compte - Se connecter
            </Button>
          </div>

          <div className="relative mb-6">
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
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                className="mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Vous pouvez utiliser une adresse email différente
              </p>
            </div>

            <div>
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                value={signupData.name}
                onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                placeholder="Jean Dupont"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                placeholder="••••••••"
                className="mt-1"
                required
                minLength={6}
              />
            </div>

            <div>
              <Label htmlFor="linkedin">LinkedIn URL</Label>
              <Input
                id="linkedin"
                type="url"
                value={signupData.linkedinUrl}
                onChange={(e) => setSignupData({ ...signupData, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={signupData.whatsappNumber}
                onChange={(e) => setSignupData({ ...signupData, whatsappNumber: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={accepting} className="w-full">
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer mon compte et rejoindre
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

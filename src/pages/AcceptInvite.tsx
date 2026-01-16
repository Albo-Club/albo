import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
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
  const [needsSignup, setNeedsSignup] = useState(false);

  // Signup form state
  const [signupData, setSignupData] = useState({
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
      // Fetch invitation details
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
        .is('accepted_at', null)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Cette invitation est invalide ou a expiré.');
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

      // If user is logged in
      if (user) {
        if (user.email?.toLowerCase() === data.email.toLowerCase()) {
          // Auto-accept invitation
          await acceptInvitation(token, user.id);
        } else {
          setError(`Cette invitation est pour ${data.email}. Connectez-vous avec ce compte.`);
          setLoading(false);
        }
      } else {
        // User needs to login or signup
        setNeedsSignup(true);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Erreur lors du chargement de l\'invitation');
      setLoading(false);
    }
  };

  const acceptInvitation = async (inviteToken: string, userId: string) => {
    try {
      const { data: workspaceId, error } = await supabase.rpc('accept_workspace_invitation', {
        _token: inviteToken,
        _user_id: userId,
      });

      if (error) {
        setError('Erreur lors de l\'acceptation de l\'invitation.');
        setLoading(false);
        return;
      }

      toast.success(`Bienvenue dans ${invitation?.workspace_name || 'le workspace'} !`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Erreur lors de l\'acceptation de l\'invitation.');
      setLoading(false);
    }
  };

  const handleLogin = () => {
    localStorage.setItem('pending_invitation', token!);
    navigate('/auth');
  };

  const handleAccept = async () => {
    if (!token || !user?.id) {
      handleLogin();
      return;
    }

    setAccepting(true);
    await acceptInvitation(token, user.id);
    setAccepting(false);
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation?.email || !signupData.password || !signupData.name) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (signupData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setAccepting(true);
    try {
      // Sign up
      const { data: signupResult, error: signupError } = await supabase.auth.signUp({
        email: invitation.email,
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
          email: invitation.email,
          name: signupData.name,
          linkedin_url: signupData.linkedinUrl || null,
          whatsapp_number: signupData.whatsappNumber || null,
        });

        // Accept the invitation
        await acceptInvitation(token!, signupResult.user.id);
      } else {
        // Email confirmation required - store token for after confirmation
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  // User is logged in - show accept button
  if (user && !needsSignup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={logo} alt="Albo" className="h-8 mx-auto mb-4" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Rejoindre {invitation?.workspace_name}
            </CardTitle>
            <CardDescription>
              Vous avez été invité à rejoindre ce workspace en tant que{' '}
              <span className="font-medium capitalize">{invitation?.role}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Connecté en tant que</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <Button onClick={handleAccept} disabled={accepting} className="w-full">
              {accepting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Rejoindre le workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User needs to sign up
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
          <form onSubmit={handleSignupAndAccept} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ''}
                disabled
                className="mt-1 bg-muted"
              />
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

            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate('/auth', { state: { redirectTo: `/invite/${token}` } })}
              >
                Se connecter
              </Button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

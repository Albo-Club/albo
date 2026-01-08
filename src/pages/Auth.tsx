import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

export default function Auth() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpSent, setSignUpSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error('Une erreur est survenue. Vérifiez votre email.');
    } else {
      setResetSent(true);
    }

    setResetLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(signInData.email, signInData.password);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: crypto.randomUUID(), // Mot de passe temporaire
        options: {
          emailRedirectTo: `${window.location.origin}/complete-profile`
        }
      });
      
      if (error) throw error;
      
      setSignUpSent(true);
      toast.success('Email envoyé ! Vérifiez votre boîte de réception.');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  // Reset password form
  if (showResetPassword) {
    if (resetSent) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-elegant text-center">
            <CardContent className="pt-6">
              <div className="text-6xl mb-4">📧</div>
              <h2 className="text-xl font-bold mb-2">Email envoyé !</h2>
              <p className="text-muted-foreground mb-4">
                Si un compte existe avec l'adresse <strong>{resetEmail}</strong>,
                vous recevrez un lien pour réinitialiser votre mot de passe.
              </p>
              <Button variant="outline" onClick={() => {
                setShowResetPassword(false);
                setResetSent(false);
                setResetEmail('');
              }}>
                Retour à la connexion
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </div>
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Réinitialiser le mot de passe</CardTitle>
              <CardDescription>
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    className="mt-2"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading || !resetEmail}>
                  {resetLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowResetPassword(false)}
                >
                  Retour
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground">AI-Powered Investment Deck Analysis</p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>Connectez-vous ou créez un compte pour commencer</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full mb-6"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuer avec Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou continuer avec email</span>
              </div>
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      placeholder="vous@exemple.com"
                      required
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signin-password">Mot de passe</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      className="mt-2"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Connexion...' : 'Se connecter'}
                  </Button>
                  <div className="text-center mt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(true)}
                      className="text-sm text-muted-foreground hover:text-primary underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {signUpSent ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-4">📧</div>
                    <h3 className="font-semibold mb-2">Email envoyé !</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Cliquez sur le lien dans votre email pour finaliser votre inscription.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSignUpSent(false);
                        setSignUpEmail('');
                      }}
                    >
                      Réessayer avec un autre email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                      <Label htmlFor="signup-email">Email professionnel</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        placeholder="vous@entreprise.com"
                        required
                        className="mt-2"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Envoi...' : "Recevoir le lien d'inscription"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Vous recevrez un email pour finaliser votre inscription
                    </p>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => navigate('/')} className="text-sm">
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

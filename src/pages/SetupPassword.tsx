import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import logo from '@/assets/logo.svg';

const SetupPassword = () => {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Vérification de la session au chargement
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Lien invalide ou expiré. Veuillez vous réinscrire.');
        navigate('/auth');
        return;
      }
      
      setUserEmail(session.user.email || null);
      
      // Vérifier si l'utilisateur a déjà complété son profil (donc déjà un mot de passe)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_complete, name')
        .eq('id', session.user.id)
        .maybeSingle();
      
      // Si le profil est déjà complet, l'utilisateur n'a pas besoin de setup-password
      if (profile?.is_complete === true && profile?.name) {
        navigate('/portfolio', { replace: true });
        return;
      }
      
      setSessionChecked(true);
    };
    
    checkSession();
  }, [navigate]);

  // Validation du mot de passe
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    
    if (score <= 1) return { score, label: 'Faible', color: 'bg-destructive' };
    if (score <= 2) return { score, label: 'Moyen', color: 'bg-orange-500' };
    if (score <= 3) return { score, label: 'Bon', color: 'bg-yellow-500' };
    return { score, label: 'Excellent', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;

      // Mettre à jour le statut d'onboarding
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ onboarding_status: 'workspace_pending' })
          .eq('id', user.id);
      }
      
      toast.success('Mot de passe créé avec succès !');
      
      // Rediriger vers la création de workspace (nouveau flow)
      navigate('/onboarding/workspace');
      
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast.error(error.message || 'Erreur lors de la création du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Albo" className="h-10" />
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center gap-1">
              <div className="h-2 w-8 rounded-full bg-primary" />
              <div className="h-2 w-8 rounded-full bg-muted" />
              <div className="h-2 w-8 rounded-full bg-muted" />
            </div>
            <span className="text-sm text-muted-foreground ml-2">Étape 1/3</span>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">
                Sécurisez votre compte
              </CardTitle>
              <CardDescription>
                Créez un mot de passe pour accéder à Albo
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Email display */}
              {userEmail && (
                <div className="bg-muted/50 rounded-lg p-3 mb-6">
                  <p className="text-xs text-muted-foreground">Compte</p>
                  <p className="font-medium text-sm">{userEmail}</p>
                </div>
              )}

              <form onSubmit={handleSetPassword} className="space-y-4">
                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 caractères"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Force : {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Confirm password field */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Retapez votre mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Match indicator */}
                  {confirmPassword.length > 0 && (
                    <p className={`text-xs ${password === confirmPassword ? 'text-green-600' : 'text-destructive'}`}>
                      {password === confirmPassword ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
                    </p>
                  )}
                </div>
                
                {/* Submit button */}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Security note */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  🔒 Votre mot de passe est chiffré et ne sera jamais partagé
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Help link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Besoin d'aide ?{' '}
            <a href="mailto:support@alboteam.com" className="text-primary hover:underline">
              Contactez-nous
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupPassword;

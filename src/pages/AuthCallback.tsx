import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Attendre que Supabase traite le hash d'authentification
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }

        if (!session?.user) {
          // Réessayer après un délai si pas de session
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (!retrySession?.user) {
            console.log('No session found, redirecting to auth');
            navigate('/auth', { replace: true });
            return;
          }
          
          await checkProfileAndRedirect(retrySession.user.id, retrySession.user.email);
          return;
        }

        // Check for pending invitation first
        const pendingToken = localStorage.getItem('pending_invitation');
        if (pendingToken) {
          localStorage.removeItem('pending_invitation');
          navigate(`/invite/${pendingToken}`, { replace: true });
          return;
        }

        await checkProfileAndRedirect(session.user.id, session.user.email);
        
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Une erreur est survenue');
        setTimeout(() => navigate('/auth', { replace: true }), 3000);
      }
    };

    const checkProfileAndRedirect = async (userId: string, userEmail?: string) => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_complete, name, onboarding_status')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
      }

      console.log('Profile check:', profile);

      // Logique de redirection basée sur l'état du profil
      if (!profile) {
        // Pas de profil = nouveau user, aller à setup-password
        console.log('Redirecting to setup-password (no profile)');
        navigate('/setup-password', { replace: true });
      } else if (profile.is_complete === false || !profile.name) {
        // Profil incomplet = aller à onboarding/profile
        console.log('Redirecting to onboarding/profile');
        navigate('/onboarding/profile', { replace: true });
      } else if (profile.onboarding_status === 'workspace_pending') {
        // Profil complet mais pas de workspace
        console.log('Redirecting to onboarding/workspace');
        navigate('/onboarding/workspace', { replace: true });
      } else if (profile.onboarding_status === 'invite_team') {
        // Workspace créé, étape invitation
        console.log('Redirecting to onboarding/invite');
        navigate('/onboarding/invite', { replace: true });
      } else {
        // Tout est bon, aller au portfolio
        console.log('Redirecting to portfolio');
        navigate('/portfolio', { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Erreur d'authentification
          </h2>
          <p className="text-muted-foreground mb-4">{errorMessage}</p>
          <p className="text-sm text-muted-foreground">
            Redirection dans quelques secondes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Connexion en cours...</p>
      </div>
    </div>
  );
}

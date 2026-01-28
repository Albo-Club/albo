import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { EmailOtpType } from '@supabase/supabase-js';

export default function AuthConfirm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Vérification en cours...');

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type') as EmailOtpType | null;

        console.log('Auth Confirm - Params:', { token_hash: !!token_hash, type });

        if (token_hash && type) {
          setMessage('Vérification du lien...');
          
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type,
          });

          if (error) {
            console.error('Verify OTP error:', error);
            throw error;
          }

          console.log('OTP verified successfully, type:', type);
          setStatus('success');

          switch (type) {
            case 'signup':
            case 'email':
              setMessage('Email confirmé ! Redirection...');
              toast.success('Email confirmé avec succès !');
              setTimeout(() => navigate('/setup-password', { replace: true }), 1000);
              break;

            case 'recovery':
              setMessage('Lien valide ! Redirection vers le changement de mot de passe...');
              toast.success('Vous pouvez maintenant changer votre mot de passe');
              setTimeout(() => navigate('/reset-password', { replace: true }), 1000);
              break;

            case 'email_change':
              setMessage('Email mis à jour !');
              toast.success('Votre email a été mis à jour');
              setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
              break;

            case 'invite':
              setMessage('Invitation acceptée !');
              toast.success('Invitation acceptée');
              setTimeout(() => navigate('/setup-password', { replace: true }), 1000);
              break;

            default:
              await handleProfileBasedRedirect();
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          await handleProfileBasedRedirect();
        } else {
          throw new Error('Lien invalide ou expiré');
        }

      } catch (error: any) {
        console.error('Auth confirmation error:', error);
        setStatus('error');
        setMessage(error.message || 'Une erreur est survenue');
        setTimeout(() => navigate('/auth', { replace: true }), 3000);
      }
    };

    const handleProfileBasedRedirect = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth', { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_complete, name, onboarding_status')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        navigate('/setup-password', { replace: true });
      } else if (!profile.is_complete || !profile.name) {
        navigate('/onboarding/profile', { replace: true });
      } else if (profile.onboarding_status === 'workspace_pending') {
        navigate('/onboarding/workspace', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    };

    handleConfirmation();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-4" />
            <p className="text-foreground">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Erreur</h2>
            <p className="text-muted-foreground mb-4">{message}</p>
            <p className="text-sm text-muted-foreground">
              Redirection dans quelques secondes...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

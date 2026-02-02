/**
 * 📧 ConnectEmailOnboarding - Étape de connexion email pendant l'onboarding
 * 
 * Permet à l'utilisateur de connecter son compte email (Gmail, Outlook, IMAP)
 * via Unipile pendant le processus d'onboarding.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2, Server, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// Type pour les comptes connectés
interface ConnectedAccount {
  id: string;
  provider: 'GOOGLE' | 'MICROSOFT' | 'IMAP';
  email: string | null;
  display_name: string | null;
  status: string;
  connected_at: string;
}

export default function ConnectEmailOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [connectingEmail, setConnectingEmail] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [completing, setCompleting] = useState(false);

  // --------------------------------------------------------
  // Charger les comptes connectés
  // --------------------------------------------------------
  const loadConnectedAccounts = async () => {
    if (!user?.id) return;
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('id, provider, email, display_name, status, connected_at')
        .eq('user_id', user.id)
        .eq('channel_type', 'email')
        .neq('status', 'disconnected');

      if (error) throw error;
      setConnectedAccounts((data as ConnectedAccount[]) || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (user) loadConnectedAccounts();
  }, [user]);

  // --------------------------------------------------------
  // Gérer le retour depuis Unipile
  // --------------------------------------------------------
  useEffect(() => {
    const connectionStatus = searchParams.get('connection');
    if (connectionStatus === 'success') {
      toast.success('Email account connected successfully!', {
        description: 'Your inbox is now linked to Albo.',
      });
      setTimeout(() => loadConnectedAccounts(), 2000);
      searchParams.delete('connection');
      setSearchParams(searchParams, { replace: true });
    } else if (connectionStatus === 'failed') {
      toast.error('Email connection failed', {
        description: 'Please try again or use a different provider.',
      });
      searchParams.delete('connection');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // --------------------------------------------------------
  // Connecter un email via Unipile
  // --------------------------------------------------------
  const handleConnectEmail = async () => {
    setConnectingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-unipile-link', {
        body: { redirect_url: '/onboarding/connect-email' },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No link received');
      }
    } catch (error: any) {
      console.error('Error generating Unipile link:', error);
      toast.error('Error connecting email', {
        description: error.message || 'Please try again.',
      });
      setConnectingEmail(false);
    }
  };

  // --------------------------------------------------------
  // Terminer l'onboarding
  // --------------------------------------------------------
  const handleComplete = async () => {
    if (!user?.id) return;
    setCompleting(true);
    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_status: 'completed',
          onboarding_completed_at: new Date().toISOString(),
          is_complete: true,
        })
        .eq('id', user.id);

      navigate('/opportunities');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast.error('Error completing setup');
    } finally {
      setCompleting(false);
    }
  };

  // --------------------------------------------------------
  // Passer cette étape (skip)
  // --------------------------------------------------------
  const handleSkip = async () => {
    await handleComplete();
  };

  // --------------------------------------------------------
  // Helper : icône du provider
  // --------------------------------------------------------
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'GOOGLE':
      case 'MICROSOFT':
        return <Mail className="h-4 w-4" />;
      case 'IMAP':
        return <Server className="h-4 w-4" />;
      default:
        return <Unplug className="h-4 w-4" />;
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

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------
  const hasConnectedAccount = connectedAccounts.length > 0;

  return (
    <OnboardingModal 
      title="Connect your email" 
      subtitle="Link your inbox to centralize deal communications."
    >
      <div className="space-y-6">

        {/* Liste des comptes connectés */}
        {loadingAccounts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : connectedAccounts.length > 0 ? (
          <div className="space-y-2">
            {connectedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {getProviderIcon(account.provider)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {account.email || account.display_name || 'Email account'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getProviderLabel(account.provider)}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No email account connected yet</p>
          </div>
        )}

        <Separator />

        {/* Bouton connecter */}
        <Button
          type="button"
          variant="outline"
          onClick={handleConnectEmail}
          disabled={connectingEmail}
          className="w-full"
        >
          {connectingEmail ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting to provider...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              {hasConnectedAccount ? 'Connect another account' : 'Connect an email account'}
            </>
          )}
        </Button>

        {/* Bouton Continue / Skip */}
        <Button
          type="button"
          onClick={hasConnectedAccount ? handleComplete : handleSkip}
          disabled={completing}
          className="w-full"
        >
          {completing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finishing...
            </>
          ) : hasConnectedAccount ? (
            'Continue'
          ) : (
            'Skip for now'
          )}
        </Button>
      </div>
    </OnboardingModal>
  );
}

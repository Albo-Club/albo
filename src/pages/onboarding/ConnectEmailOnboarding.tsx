/**
 * 📧 ConnectEmailOnboarding - Étape de connexion email pendant l'onboarding
 * 
 * Permet à l'utilisateur de connecter son compte email (Gmail, Outlook, IMAP)
 * via Unipile pendant le processus d'onboarding.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2, Server, Unplug, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { EmailConsentModal } from '@/components/email/EmailConsentModal';

// Type pour les comptes connectés
interface ConnectedAccount {
  id: string;
  provider: 'GOOGLE' | 'MICROSOFT' | 'IMAP' | 'OUTLOOK';
  provider_account_id: string;
  email: string | null;
  display_name: string | null;
  status: 'pending_consent' | 'syncing' | 'active' | 'sync_error' | 'disconnected' | 'pending' | 'needs_reconnect';
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

  // États pour la modal de consentement
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [pendingConsentAccount, setPendingConsentAccount] = useState<ConnectedAccount | null>(null);

  // --------------------------------------------------------
  // Charger les comptes connectés
  // --------------------------------------------------------
  const loadConnectedAccounts = async () => {
    if (!user?.id) return;
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('id, provider, provider_account_id, email, display_name, status, connected_at')
        .eq('user_id', user.id)
        .eq('channel_type', 'email')
        .neq('status', 'disconnected');

      if (error) throw error;
      
      const accounts = (data as ConnectedAccount[]) || [];
      setConnectedAccounts(accounts);

      // Vérifier s'il y a un compte en attente de consentement
      const pendingAccount = accounts.find((a) => a.status === 'pending_consent');
      if (pendingAccount) {
        setPendingConsentAccount(pendingAccount);
        setConsentModalOpen(true);
      }
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
  // Écouter les changements en temps réel sur connected_accounts
  // --------------------------------------------------------
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('connected_accounts_onboarding_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connected_accounts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Account status changed (onboarding):', payload);
          // Recharger la liste quand un compte change
          loadConnectedAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // --------------------------------------------------------
  // Gérer le retour depuis Unipile
  // --------------------------------------------------------
  useEffect(() => {
    const connectionStatus = searchParams.get('connection');
    if (connectionStatus === 'success') {
      // ⚠️ NE PAS afficher de toast ici - la modal s'en charge
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
  // Consider an account as "ready" if it's active or syncing (not pending_consent)
  const hasReadyAccount = connectedAccounts.some((a) => a.status === 'active' || a.status === 'syncing');

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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {account.email || account.display_name || 'Email account'}
                    </p>
                    {/* Spinner inline pour syncing */}
                    {account.status === 'syncing' && (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Syncing...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getProviderLabel(account.provider)}
                  </p>
                </div>
                {/* Status indicator */}
                {account.status === 'syncing' ? (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Syncing
                  </Badge>
                ) : account.status === 'pending_consent' ? (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                ) : account.status === 'sync_error' ? (
                  <Badge variant="destructive" className="text-xs shrink-0">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                )}
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
          onClick={hasReadyAccount ? handleComplete : handleSkip}
          disabled={completing}
          className="w-full"
        >
          {completing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finishing...
            </>
          ) : hasReadyAccount ? (
            'Continue'
          ) : (
            'Skip for now'
          )}
        </Button>
      </div>

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
    </OnboardingModal>
  );
}

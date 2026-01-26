/**
 * 📧 InviteTeamNew - Page d'invitation pendant l'onboarding (style Twenty CRM)
 * 
 * Cette page permet d'inviter des membres après la création du workspace.
 * Corrections appliquées :
 * - Attente du chargement du workspace
 * - Rechargement automatique si workspace non chargé
 * - Affichage des erreurs clair
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_CONFIG } from '@/config/app';

export default function InviteTeamNew() {
  const { user } = useAuth();
  const { workspace, loading: workspaceLoading, refetch } = useWorkspace();
  const navigate = useNavigate();
  
  const [emails, setEmails] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // --------------------------------------------------------
  // Effet : S'assurer que le workspace est chargé
  // --------------------------------------------------------
  useEffect(() => {
    const initWorkspace = async () => {
      // Si le workspace n'est pas chargé, essayer de le recharger
      if (!workspace && user?.id && !workspaceLoading) {
        console.log('Workspace not loaded, refetching...');
        await refetch();
      }
      setInitializing(false);
    };

    initWorkspace();
  }, [workspace, user?.id, workspaceLoading, refetch]);

  // --------------------------------------------------------
  // Handler : Changement d'email
  // --------------------------------------------------------
  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  // --------------------------------------------------------
  // Handler : Copier le lien d'invitation
  // --------------------------------------------------------
  const handleCopyLink = async () => {
    if (!workspace?.id) {
      toast.error('Workspace non trouvé. Veuillez rafraîchir la page.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspace.id,
          email: 'anyone@link.invite', // Email placeholder pour les liens
          role: 'member',
          invited_by: user?.id,
        })
        .select('token')
        .single();

      if (error) throw error;

      const inviteLink = `${window.location.origin}/invite/${data.token}`;
      await navigator.clipboard.writeText(inviteLink);
      
      setCopied(true);
      toast.success('Lien d\'invitation copié !');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      console.error('Error creating invite link:', error);
      toast.error('Impossible de créer le lien d\'invitation');
    }
  };

  // --------------------------------------------------------
  // Fonction : Envoyer une invitation directement (sans passer par le context)
  // Cette approche contourne le problème de canManageMembers pendant l'onboarding
  // --------------------------------------------------------
  const sendInvitation = async (email: string) => {
    if (!workspace?.id || !user?.id) {
      throw new Error('Workspace ou utilisateur non trouvé');
    }

    // 1. Récupérer le nom de l'inviteur
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    // 2. Créer l'invitation dans la base de données
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspace.id,
        email: email.toLowerCase(),
        role: 'member',
        invited_by: user.id
      })
      .select('id, token')
      .single();

    if (error) {
      // Vérifier si c'est une erreur de doublon
      if (error.code === '23505') {
        throw new Error(`Une invitation a déjà été envoyée à ${email}`);
      }
      throw error;
    }

    // 3. Envoyer l'email via Edge Function
    const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        email: email.toLowerCase(),
        workspaceName: workspace.name,
        inviterName: inviterProfile?.name || user.email || 'Un membre',
        role: 'member',
        token: invitation.token,
        appUrl: APP_CONFIG.baseUrl
      }
    });

    if (emailError) {
      console.error('Email error:', emailError);
      // Rollback: supprimer l'invitation si l'email a échoué
      await supabase.from('workspace_invitations').delete().eq('id', invitation.id);
      throw new Error(`Impossible d'envoyer l'email à ${email}`);
    }

    return invitation;
  };

  // --------------------------------------------------------
  // Handler : Terminer l'onboarding
  // --------------------------------------------------------
  const handleFinish = async () => {
    if (!user?.id) return;
    
    setLoading(true);

    try {
      // Filtrer les emails valides
      const validEmails = emails.filter(email => 
        email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      );

      // Envoyer les invitations
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const email of validEmails) {
        try {
          await sendInvitation(email.trim());
          successCount++;
        } catch (error: any) {
          console.error(`Failed to invite ${email}:`, error);
          errorCount++;
          errors.push(error.message || `Erreur pour ${email}`);
        }
      }

      // Afficher les résultats
      if (successCount > 0) {
        toast.success(`${successCount} invitation(s) envoyée(s) !`);
      }
      
      if (errorCount > 0) {
        errors.forEach(err => toast.error(err));
      }

      // Marquer l'onboarding comme terminé
      await supabase
        .from('profiles')
        .update({ 
          onboarding_status: 'completed',
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error finishing onboarding:', error);
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------
  // Handler : Passer l'étape
  // --------------------------------------------------------
  const handleSkip = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('profiles')
        .update({ 
          onboarding_status: 'completed',
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error skipping:', error);
      navigate('/dashboard');
    }
  };

  // --------------------------------------------------------
  // Handler : Rafraîchir le workspace
  // --------------------------------------------------------
  const handleRefresh = async () => {
    setInitializing(true);
    await refetch();
    setInitializing(false);
  };

  // --------------------------------------------------------
  // Rendu : État de chargement initial
  // --------------------------------------------------------
  if (initializing || workspaceLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Préparation de l'invitation...</p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Rendu : Erreur si pas de workspace
  // --------------------------------------------------------
  if (!workspace) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Oups !</h1>
            <p className="text-lg text-muted-foreground">
              Impossible de charger votre workspace.
              <br />
              Essayez de rafraîchir la page.
            </p>
          </div>
          <div className="flex gap-4">
            <Button onClick={handleRefresh} variant="outline" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Rafraîchir
            </Button>
            <Button onClick={handleSkip} variant="secondary" size="lg">
              Passer cette étape
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Rendu principal
  // --------------------------------------------------------
  return (
    <OnboardingModal 
      title="Invitez votre équipe" 
      subtitle="Entrez les adresses e-mail des personnes que vous souhaitez inviter."
    >
      <div className="space-y-6">
        {/* Email inputs */}
        <div className="space-y-3">
          {emails.map((email, index) => (
            <Input
              key={index}
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(index, e.target.value)}
              placeholder={
                index === 0 ? 'tim@apple.com' :
                index === 1 ? 'steve@apple.com' :
                'jony@apple.com'
              }
              disabled={loading}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              ou
            </span>
          </div>
        </div>

        {/* Copy link button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleCopyLink}
          className="w-full justify-center"
        >
          {copied ? (
            <Check className="w-4 h-4 mr-2 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          <span>
            {copied ? 'Lien copié !' : 'Copier le lien d\'invitation'}
          </span>
        </Button>

        {/* Finish Button */}
        <Button 
          type="button"
          onClick={handleFinish}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            emails.some(e => e.trim()) ? 'Envoyer les invitations' : 'Terminer'
          )}
        </Button>

        {/* Skip link */}
        <button 
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Passer pour l'instant
        </button>
      </div>
    </OnboardingModal>
  );
}

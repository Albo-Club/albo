import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function InviteTeamNew() {
  const { user } = useAuth();
  const { workspace, inviteMember } = useWorkspace();
  const navigate = useNavigate();
  
  const [emails, setEmails] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleCopyLink = async () => {
    if (!workspace?.id) {
      toast.error('No workspace found');
      return;
    }

    // Générer un lien d'invitation
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
      toast.success('Invitation link copied!');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      console.error('Error creating invite link:', error);
      toast.error('Failed to create invitation link');
    }
  };

  const handleFinish = async () => {
    if (!user?.id) return;
    
    setLoading(true);

    try {
      // Filtrer les emails valides
      const validEmails = emails.filter(email => 
        email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      );

      // Envoyer les invitations
      for (const email of validEmails) {
        try {
          await inviteMember(email.trim(), 'member');
        } catch (error: any) {
          console.error(`Failed to invite ${email}:`, error);
          // Continuer avec les autres emails
        }
      }

      if (validEmails.length > 0) {
        toast.success(`${validEmails.length} invitation(s) sent!`);
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
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <OnboardingModal 
      title="Invite your team" 
      subtitle="Get your team onboarded quickly"
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
                index === 1 ? 'phil@apple.com' :
                'jony@apple.com'
              }
            />
          ))}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">
              or
            </span>
          </div>
        </div>

        {/* Copy link button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleCopyLink}
          className="w-full justify-center text-gray-700"
        >
          {copied ? (
            <Check className="w-4 h-4 mr-2 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          <span>
            {copied ? 'Link copied!' : 'Copy invitation link'}
          </span>
        </Button>

        {/* Finish Button */}
        <Button 
          type="button"
          onClick={handleFinish}
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Finishing...
            </>
          ) : (
            'Finish'
          )}
        </Button>

        {/* Skip link */}
        <button 
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip
        </button>
      </div>
    </OnboardingModal>
  );
}

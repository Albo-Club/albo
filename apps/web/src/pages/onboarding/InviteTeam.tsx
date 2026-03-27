/**
 * 👥 Page: InviteTeam (Onboarding Step 3)
 * 
 * Permet à l'utilisateur d'inviter des membres dans son workspace.
 * Cette étape est optionnelle et peut être sautée.
 */

import { useState } from 'react';
import { 
  Users, 
  Mail, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Sparkles,
  Copy,
  Check,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceRole } from '@/contexts/WorkspaceContext';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface PendingInvite {
  email: string;
  role: WorkspaceRole;
}

export default function InviteTeam() {
  const { user } = useAuth();
  const { workspace, inviteMember } = useWorkspace();
  const { completeOnboarding } = useOnboardingStatus();
  
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentRole, setCurrentRole] = useState<WorkspaceRole>('member');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // --------------------------------------------------------
  // Ajouter une invitation à la liste
  // --------------------------------------------------------
  const handleAddInvite = () => {
    if (!currentEmail.trim()) {
      toast.error('Veuillez entrer une adresse email');
      return;
    }

    // Validation basique de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(currentEmail)) {
      toast.error('Adresse email invalide');
      return;
    }

    // Vérifier les doublons
    if (pendingInvites.some(inv => inv.email.toLowerCase() === currentEmail.toLowerCase())) {
      toast.error('Cette adresse email est déjà dans la liste');
      return;
    }

    // Vérifier que ce n'est pas l'email de l'utilisateur actuel
    if (currentEmail.toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('Vous ne pouvez pas vous inviter vous-même');
      return;
    }

    setPendingInvites([
      ...pendingInvites,
      { email: currentEmail.trim().toLowerCase(), role: currentRole }
    ]);
    setCurrentEmail('');
    setCurrentRole('member');
  };

  // --------------------------------------------------------
  // Supprimer une invitation de la liste
  // --------------------------------------------------------
  const handleRemoveInvite = (email: string) => {
    setPendingInvites(pendingInvites.filter(inv => inv.email !== email));
  };

  // --------------------------------------------------------
  // Envoyer toutes les invitations
  // --------------------------------------------------------
  const handleSendInvites = async () => {
    if (pendingInvites.length === 0) {
      // Pas d'invitations, terminer directement
      await completeOnboarding();
      return;
    }

    setLoading(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const invite of pendingInvites) {
        try {
          await inviteMember(invite.email, invite.role);
          successCount++;
        } catch (error) {
          console.error(`Error inviting ${invite.email}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} invitation${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''} !`
        );
      }

      if (errorCount > 0) {
        toast.warning(`${errorCount} invitation${errorCount > 1 ? 's' : ''} ont échoué`);
      }

      // Terminer l'onboarding
      await completeOnboarding();
    } catch (error: any) {
      console.error('Error sending invites:', error);
      toast.error('Erreur lors de l\'envoi des invitations');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------
  // Copier le lien d'invitation
  // --------------------------------------------------------
  const handleCopyInviteLink = async () => {
    // Générer un lien d'invitation générique pour le workspace
    const inviteUrl = `${window.location.origin}/invite?workspace=${workspace?.id}`;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      toast.success('Lien copié !');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  // --------------------------------------------------------
  // Passer cette étape
  // --------------------------------------------------------
  const handleSkip = async () => {
    await completeOnboarding();
  };

  return (
    <OnboardingLayout showSkip>
      <div className="space-y-6">
        {/* Workspace actuel */}
        {workspace && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{workspace.name}</p>
                  <p className="text-sm text-muted-foreground">Votre workspace</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulaire d'ajout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Ajouter des membres
            </CardTitle>
            <CardDescription>
              Entrez les adresses email de vos collègues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="collegue@entreprise.com"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInvite())}
                />
              </div>
              <Select value={currentRole} onValueChange={(v) => setCurrentRole(v as WorkspaceRole)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={handleAddInvite}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Liste des invitations en attente */}
            {pendingInvites.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {pendingInvites.length} invitation{pendingInvites.length > 1 ? 's' : ''} en attente
                </p>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.email}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 group"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{invite.email}</span>
                        <Badge variant="outline" className="text-xs">
                          {invite.role === 'admin' ? 'Admin' : 'Membre'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveInvite(invite.email)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button onClick={handleSendInvites} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                {pendingInvites.length > 0 
                  ? `Envoyer (${pendingInvites.length}) et terminer`
                  : 'Terminer sans inviter'
                }
              </>
            )}
          </Button>

          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            Passer et terminer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Alternative : Copier le lien */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              ou
            </span>
          </div>
        </div>

        <Button variant="outline" onClick={handleCopyInviteLink} className="w-full">
          {copiedLink ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-500" />
              Lien copié !
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copier le lien d'invitation
            </>
          )}
        </Button>

        {/* Info box */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Rôles des membres</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Membre</strong> : peut voir et commenter les deals</li>
                  <li>• <strong>Admin</strong> : peut gérer les membres et paramètres</li>
                  <li>• Vous êtes <strong>Owner</strong> et avez tous les droits</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  );
}

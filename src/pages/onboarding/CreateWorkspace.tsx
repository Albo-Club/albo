/**
 * 🏢 Page: CreateWorkspace (Onboarding Step 2)
 * 
 * Permet à l'utilisateur de :
 * - Créer un nouveau workspace
 * - Ou rejoindre un workspace existant (via invitation)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, ArrowRight, Sparkles, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingStatus } from '@/types/onboarding';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CreateWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setOnboardingStatus, goToNextStep } = useOnboardingStatus();
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // --------------------------------------------------------
  // Créer un nouveau workspace
  // --------------------------------------------------------
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workspaceName.trim()) {
      toast.error('Veuillez entrer un nom pour votre workspace');
      return;
    }

    if (!user?.id) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);

    try {
      // Appeler la fonction RPC pour créer le workspace
      const { data: workspaceId, error } = await supabase.rpc('create_workspace', {
        _name: workspaceName.trim(),
        _owner_id: user.id,
      });

      if (error) throw error;

      // Sauvegarder le workspace ID pour le charger automatiquement
      if (workspaceId) {
        localStorage.setItem('currentWorkspaceId', workspaceId);
      }

      toast.success('Workspace créé avec succès ! 🎉');

      // Passer à l'étape suivante (invitation d'équipe)
      await goToNextStep();
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast.error(error.message || 'Erreur lors de la création du workspace');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------
  // Rejoindre un workspace via code d'invitation
  // --------------------------------------------------------
  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      toast.error('Veuillez entrer un code d\'invitation');
      return;
    }

    if (!user?.id) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);

    try {
      // Vérifier et accepter l'invitation
      const { data: workspaceId, error } = await supabase.rpc('accept_workspace_invitation', {
        _token: inviteCode.trim(),
        _user_id: user.id,
      });

      if (error) {
        if (error.message.includes('expired')) {
          toast.error('Cette invitation a expiré');
        } else if (error.message.includes('not found')) {
          toast.error('Code d\'invitation invalide');
        } else {
          throw error;
        }
        return;
      }

      // Sauvegarder le workspace ID
      if (workspaceId) {
        localStorage.setItem('currentWorkspaceId', workspaceId);
      }

      toast.success('Vous avez rejoint le workspace ! 🎉');

      // Marquer l'onboarding comme terminé (pas besoin d'inviter si on rejoint)
      await setOnboardingStatus(OnboardingStatus.COMPLETED);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error joining workspace:', error);
      toast.error(error.message || 'Erreur lors de la jonction au workspace');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------
  // Sauter et continuer seul (mode personnel)
  // --------------------------------------------------------
  const handleSkipWorkspace = async () => {
    // L'utilisateur peut continuer sans workspace (mode personnel)
    await setOnboardingStatus(OnboardingStatus.COMPLETED);
    toast.info('Vous pouvez créer un workspace plus tard dans les paramètres');
    navigate('/dashboard');
  };

  return (
    <OnboardingLayout showSkip={false}>
      <div className="space-y-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'create' | 'join')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="gap-2">
              <Building2 className="h-4 w-4" />
              Créer
            </TabsTrigger>
            <TabsTrigger value="join" className="gap-2">
              <Users className="h-4 w-4" />
              Rejoindre
            </TabsTrigger>
          </TabsList>

          {/* ========== TAB: Créer un workspace ========== */}
          <TabsContent value="create" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Nouveau workspace</CardTitle>
                    <CardDescription>
                      Créez un espace pour votre équipe ou votre fonds
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Nom du workspace</Label>
                    <Input
                      id="workspace-name"
                      placeholder="Ex: Mon Fonds VC, Albo Team..."
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      disabled={loading}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Vous pourrez le modifier plus tard dans les paramètres
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        Créer le workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: Rejoindre un workspace ========== */}
          <TabsContent value="join" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Rejoindre une équipe</CardTitle>
                    <CardDescription>
                      Entrez le code d'invitation reçu par email
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Code d'invitation</Label>
                    <Input
                      id="invite-code"
                      placeholder="Collez votre code ici..."
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Le code se trouve dans l'email d'invitation
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Vérification...
                      </>
                    ) : (
                      <>
                        Rejoindre le workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ========== Option: Continuer seul ========== */}
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

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={handleSkipWorkspace}
        >
          Continuer en mode personnel
        </Button>

        {/* ========== Info box ========== */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Pourquoi créer un workspace ?</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Partagez vos deals avec votre équipe</li>
                  <li>• Collaborez sur les analyses et mémos</li>
                  <li>• Gérez les permissions par rôle</li>
                  <li>• Centralisez votre deal flow</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </OnboardingLayout>
  );
}

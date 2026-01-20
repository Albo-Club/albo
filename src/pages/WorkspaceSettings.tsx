import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace, WorkspaceRole } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Users, Plus, Crown, Shield, User, X, Clock, Send, Building2, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

const roleIcons: Record<WorkspaceRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: 'bg-amber-100 text-amber-800 border-amber-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  member: 'bg-gray-100 text-gray-800 border-gray-200',
};

const roleLabels: Record<WorkspaceRole, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
};

export default function WorkspaceSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    workspace,
    members,
    invitations,
    userRole,
    loading,
    isOwner,
    canManageMembers,
    createWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
    cancelInvitation,
    migrateDeals,
    deleteWorkspace,
  } = useWorkspace();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviting, setInviting] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const [migrating, setMigrating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error('Veuillez entrer un nom');
      return;
    }

    setCreating(true);
    try {
      await createWorkspace(workspaceName.trim());
      toast.success('Workspace créé !');
      setIsCreateDialogOpen(false);
      setWorkspaceName('');
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Veuillez entrer un email');
      return;
    }

    setInviting(true);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole);
      toast.success(`Invitation envoyée à ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('member');
    } catch (error: any) {
      console.error('Error inviting:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setRemoving(true);
    try {
      await removeMember(memberToRemove);
      toast.success('Membre retiré');
      setMemberToRemove(null);
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || 'Erreur');
    } finally {
      setRemoving(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    try {
      await updateMemberRole(memberId, newRole);
      toast.success('Rôle mis à jour');
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Erreur');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
      toast.success('Invitation annulée');
    } catch (error: any) {
      console.error('Error canceling invitation:', error);
      toast.error(error.message || 'Erreur');
    }
  };

  const handleMigrateDeals = async () => {
    setMigrating(true);
    try {
      const count = await migrateDeals();
      toast.success(`${count} deal${count > 1 ? 's' : ''} migré${count > 1 ? 's' : ''} vers le workspace`);
    } catch (error: any) {
      console.error('Error migrating deals:', error);
      toast.error(error.message || 'Erreur lors de la migration');
    } finally {
      setMigrating(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace?.id) return;

    setDeleting(true);
    try {
      await deleteWorkspace(workspace.id);
      toast.success('Workspace supprimé');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No workspace yet
  if (!workspace) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Workspace</h1>
          <p className="text-muted-foreground">Créez ou rejoignez un workspace pour collaborer</p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun workspace</h3>
            <p className="text-muted-foreground mb-6">
              Créez un workspace pour collaborer avec votre équipe sur les deals
            </p>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un Workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un Workspace</DialogTitle>
                  <DialogDescription>
                    Donnez un nom à votre workspace. Vous pourrez ensuite inviter des membres.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="workspace-name">Nom du workspace</Label>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Ex: Albo Fund"
                    className="mt-2"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateWorkspace} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberToRemoveData = members.find(m => m.id === memberToRemove);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Workspace</h1>
        <p className="text-muted-foreground">Gérez votre équipe et les accès</p>
      </div>

      {/* Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {workspace.name}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            Votre rôle : 
            <Badge className={roleColors[userRole!]}>
              {roleLabels[userRole!]}
            </Badge>
          </CardDescription>
        </CardHeader>
        {isOwner && (
          <CardContent>
            <Button variant="outline" onClick={handleMigrateDeals} disabled={migrating}>
              {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Migrer mes deals existants vers ce workspace
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Membres ({members.length})
          </CardTitle>
          <CardDescription>
            Membres de votre workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role];
              const isCurrentUser = member.user_id === user?.id;
              const canEdit = canManageMembers && !isCurrentUser && member.role !== 'owner';
              const canRemove = canManageMembers && !isCurrentUser && member.role !== 'owner';

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {member.profile?.name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.profile?.name || 'Utilisateur'}
                        {isCurrentUser && <span className="text-muted-foreground ml-1">(vous)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value as WorkspaceRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Membre</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={roleColors[member.role]}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleLabels[member.role]}
                      </Badge>
                    )}
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMemberToRemove(member.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite Member */}
      {canManageMembers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Inviter un membre
            </CardTitle>
            <CardDescription>
              Envoyez une invitation par email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-3">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Membre</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Inviter
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {canManageMembers && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Invitations en attente ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(invitation.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[invitation.role]}>
                      {roleLabels[invitation.role]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemoveData?.profile?.name || 'Ce membre'} sera retiré du workspace et n'aura plus accès aux deals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Danger Zone - Only for owner */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Actions irréversibles sur votre workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div>
                <p className="font-medium">Supprimer ce workspace</p>
                <p className="text-sm text-muted-foreground">
                  Cette action est irréversible. Tous les membres seront retirés et les partages de deals supprimés.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le workspace "{workspace?.name}" sera définitivement supprimé, 
                      tous les membres seront retirés et tous les partages de deals seront supprimés.
                      Les deals eux-mêmes ne seront pas supprimés, ils resteront dans les espaces personnels de leurs propriétaires.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteWorkspace}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Suppression...
                        </>
                      ) : (
                        'Supprimer définitivement'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

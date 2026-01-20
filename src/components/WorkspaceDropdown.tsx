import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace, WorkspaceRole } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ChevronDown,
  Check,
  Plus,
  User,
  Settings,
  UserPlus,
  Link,
  LogOut,
  Loader2,
  X,
} from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

export function WorkspaceDropdown() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const {
    workspace,
    allWorkspaces,
    invitations,
    canManageMembers,
    isOwner,
    switchWorkspace,
    createWorkspace,
    inviteMember,
    cancelInvitation,
    migrateDeals,
    refetch,
  } = useWorkspace();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isReferDialogOpen, setIsReferDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviting, setInviting] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error('Veuillez entrer un nom');
      return;
    }

    setCreating(true);
    try {
      await createWorkspace(workspaceName.trim());
      // Auto-migrate deals
      try {
        const count = await migrateDeals();
        if (count > 0) {
          toast.success(`Workspace créé ! ${count} deal${count > 1 ? 's' : ''} migré${count > 1 ? 's' : ''}.`);
        } else {
          toast.success('Workspace créé !');
        }
      } catch {
        toast.success('Workspace créé !');
      }
      setIsCreateDialogOpen(false);
      setWorkspaceName('');
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmails.trim()) {
      toast.error('Veuillez entrer au moins un email');
      return;
    }

    const emails = inviteEmails.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      toast.error('Veuillez entrer au moins un email valide');
      return;
    }

    setInviting(true);
    try {
      for (const email of emails) {
        await inviteMember(email, inviteRole);
      }
      toast.success(`${emails.length > 1 ? 'Invitations envoyées' : 'Invitation envoyée'} !`);
      setInviteEmails('');
      setInviteRole('member');
      await refetch();
    } catch (error: any) {
      console.error('Error inviting:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi');
    } finally {
      setInviting(false);
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

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/auth?ref=${user?.id}`;
    navigator.clipboard.writeText(referralLink);
    toast.success('Lien copié !');
    setIsReferDialogOpen(false);
  };

  const workspaceInitial = workspace?.name?.charAt(0).toUpperCase() || 'A';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 px-2 h-auto py-2 hover:bg-sidebar-accent ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
              {workspaceInitial}
            </div>
            {!isCollapsed && (
              <>
                <span className="font-medium truncate flex-1 text-left">
                  {workspace?.name || 'Mon espace'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-64 bg-popover border shadow-lg z-50"
          sideOffset={4}
        >
          {/* List of all workspaces */}
          {allWorkspaces.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Vos workspaces
              </DropdownMenuLabel>
              {allWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    ws.id === workspace?.id && "bg-accent"
                  )}
                >
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.id === workspace?.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {/* New workspace */}
          <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New workspace
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Settings links */}
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Account settings
          </DropdownMenuItem>

          {isOwner && (
            <DropdownMenuItem onClick={() => navigate('/workspace')}>
              <Settings className="mr-2 h-4 w-4" />
              Workspace settings
            </DropdownMenuItem>
          )}

          {canManageMembers && (
            <DropdownMenuItem onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite team members
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => setIsReferDialogOpen(true)}>
            <Link className="mr-2 h-4 w-4" />
            Refer another team
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Sign out */}
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a Workspace</DialogTitle>
            <DialogDescription>
              Give your workspace a name. Your existing deals will be automatically migrated.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ex: Albo Fund"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Team Members Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite team members</DialogTitle>
            <DialogDescription>
              Invite colleagues to collaborate in {workspace?.name || 'your workspace'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-emails">Email addresses</Label>
              <Input
                id="invite-emails"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="email@example.com, email2@example.com"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Can manage members and deals</SelectItem>
                  <SelectItem value="member">Member - Can view deals only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send invitations
            </Button>
          </DialogFooter>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-medium">Pending invitations</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-auto">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{invitation.email}</span>
                      <Badge variant="secondary" className="text-xs">
                        {invitation.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refer Another Team Dialog */}
      <Dialog open={isReferDialogOpen} onOpenChange={setIsReferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refer another team</DialogTitle>
            <DialogDescription>
              Share this link with other investment teams to invite them to create their own workspace on Albo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/auth?ref=${user?.id}`}
                className="flex-1 bg-muted"
              />
              <Button onClick={copyReferralLink} variant="secondary">
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

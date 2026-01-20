import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { APP_CONFIG } from '@/config/app';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  profile?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  token: string;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
  inviter?: {
    name: string;
  };
}

interface WorkspaceWithRole extends Workspace {
  userRole: WorkspaceRole;
  joinedAt: string;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  allWorkspaces: WorkspaceWithRole[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  userRole: WorkspaceRole | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
  isPersonalMode: boolean;
  switchWorkspace: (workspaceId: string) => void;
  switchToPersonal: () => void;
  createWorkspace: (name: string) => Promise<string>;
  inviteMember: (email: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, newRole: WorkspaceRole) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  migrateDeals: () => Promise<number>;
  leaveWorkspace: () => Promise<void>;
  shareDealsToWorkspace: (targetWorkspaceId: string) => Promise<number>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [userRole, setUserRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersonalMode, setIsPersonalMode] = useState(false);

  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const canManageMembers = isAdmin;

  const loadWorkspaceData = useCallback(async (targetWorkspaceId?: string) => {
    if (!user?.id) {
      setWorkspace(null);
      setAllWorkspaces([]);
      setMembers([]);
      setInvitations([]);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      // Load ALL workspaces the user belongs to
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          joined_at,
          workspaces:workspace_id (
            id,
            name,
            owner_id,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (workspacesError) {
        console.error('Error loading workspaces:', workspacesError);
        setLoading(false);
        return;
      }

      if (!workspacesData || workspacesData.length === 0) {
        setWorkspace(null);
        setAllWorkspaces([]);
        setMembers([]);
        setInvitations([]);
        setUserRole(null);
        setLoading(false);
        return;
      }

      // Transform the data
      const workspaces: WorkspaceWithRole[] = workspacesData.map(wm => {
        const ws = wm.workspaces as unknown as Workspace;
        return {
          ...ws,
          userRole: wm.role as WorkspaceRole,
          joinedAt: wm.joined_at,
        };
      });
      setAllWorkspaces(workspaces);

      // Determine which workspace to use
      const savedWorkspaceId = targetWorkspaceId || localStorage.getItem('currentWorkspaceId');
      const selectedWorkspace = workspaces.find(w => w.id === savedWorkspaceId) || workspaces[0];
      
      setCurrentWorkspaceId(selectedWorkspace.id);
      setWorkspace(selectedWorkspace);
      setUserRole(selectedWorkspace.userRole);
      localStorage.setItem('currentWorkspaceId', selectedWorkspace.id);

      // Load members for the selected workspace
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select(`
          id,
          workspace_id,
          user_id,
          role,
          joined_at
        `)
        .eq('workspace_id', selectedWorkspace.id)
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.error('Error loading members:', membersError);
      } else {
        // Fetch profiles separately for each member
        const membersWithProfiles = await Promise.all(
          (membersData || []).map(async (member) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, name, email')
              .eq('id', member.user_id)
              .single();
            
            return {
              ...member,
              profile: profileData || undefined
            } as WorkspaceMember;
          })
        );
        setMembers(membersWithProfiles);
      }

      // Load pending invitations (only for admin/owner)
      if (selectedWorkspace.userRole === 'owner' || selectedWorkspace.userRole === 'admin') {
        const { data: invitationsData, error: invitationsError } = await supabase
          .from('workspace_invitations')
          .select('*')
          .eq('workspace_id', selectedWorkspace.id)
          .is('accepted_at', null)
          .order('created_at', { ascending: false });

        if (invitationsError) {
          console.error('Error loading invitations:', invitationsError);
        } else {
          setInvitations(invitationsData || []);
        }
      } else {
        setInvitations([]);
      }
    } catch (error) {
      console.error('Error in loadWorkspaceData:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const newWorkspace = allWorkspaces.find(w => w.id === workspaceId);
    if (newWorkspace && newWorkspace.id !== currentWorkspaceId) {
      setIsPersonalMode(false);
      setCurrentWorkspaceId(workspaceId);
      setWorkspace(newWorkspace);
      setUserRole(newWorkspace.userRole);
      localStorage.setItem('currentWorkspaceId', workspaceId);
      // Reload members and invitations for the new workspace
      loadWorkspaceData(workspaceId);
    }
  }, [allWorkspaces, currentWorkspaceId, loadWorkspaceData]);

  const switchToPersonal = useCallback(() => {
    setIsPersonalMode(true);
    setCurrentWorkspaceId(null);
    setWorkspace(null);
    setUserRole(null);
    setMembers([]);
    setInvitations([]);
    localStorage.removeItem('currentWorkspaceId');
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const createWorkspace = async (name: string): Promise<string> => {
    if (!user?.id) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('create_workspace', {
      _name: name,
      _owner_id: user.id
    });

    if (error) throw error;
    
    await loadWorkspaceData();
    return data as string;
  };

  const inviteMember = async (email: string, role: WorkspaceRole) => {
    if (!workspace?.id || !user?.id) throw new Error('No workspace');
    if (!canManageMembers) throw new Error('Permission denied');

    // Get inviter profile name
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    // Create invitation in database
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspace.id,
        email: email.toLowerCase(),
        role,
        invited_by: user.id
      })
      .select('id, token')
      .single();

    if (error) throw error;

    // Send invitation email via Edge Function
    const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        email: email.toLowerCase(),
        workspaceName: workspace.name,
        inviterName: inviterProfile?.name || user.email || 'A team member',
        role: role as 'admin' | 'member',
        token: invitation.token,
        appUrl: APP_CONFIG.baseUrl
      }
    });

    if (emailError) {
      // Rollback: delete invitation if email failed
      await supabase.from('workspace_invitations').delete().eq('id', invitation.id);
      throw new Error('Failed to send invitation email');
    }

    await loadWorkspaceData();
  };

  const removeMember = async (memberId: string) => {
    if (!canManageMembers) throw new Error('Permission denied');

    const memberToRemove = members.find(m => m.id === memberId);
    if (memberToRemove?.role === 'owner') throw new Error('Cannot remove owner');

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    await loadWorkspaceData();
  };

  const updateMemberRole = async (memberId: string, newRole: WorkspaceRole) => {
    if (!canManageMembers) throw new Error('Permission denied');
    if (newRole === 'owner') throw new Error('Cannot assign owner role');

    const memberToUpdate = members.find(m => m.id === memberId);
    if (memberToUpdate?.role === 'owner') throw new Error('Cannot change owner role');

    const { error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) throw error;
    await loadWorkspaceData();
  };

  const cancelInvitation = async (invitationId: string) => {
    if (!canManageMembers) throw new Error('Permission denied');

    const { error } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) throw error;
    await loadWorkspaceData();
  };

  const migrateDeals = async (): Promise<number> => {
    if (!user?.id || !workspace?.id) throw new Error('No workspace');

    const { data, error } = await supabase.rpc('migrate_deals_to_workspace', {
      _user_id: user.id,
      _workspace_id: workspace.id
    });

    if (error) throw error;
    return data as number;
  };

  const leaveWorkspace = async () => {
    if (!user?.id || !workspace?.id) throw new Error('No workspace');
    if (isOwner) throw new Error('Owner cannot leave workspace');

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id);

    if (error) throw error;
    await loadWorkspaceData();
  };

  const shareDealsToWorkspace = async (targetWorkspaceId: string): Promise<number> => {
    if (!user?.id) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('share_my_deals_to_workspace', {
      _user_id: user.id,
      _target_workspace_id: targetWorkspaceId
    });

    if (error) throw error;

    return (data as number) || 0;
  };

  const deleteWorkspace = async (workspaceId: string): Promise<boolean> => {
    if (!user?.id) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('delete_workspace', {
      _workspace_id: workspaceId,
      _user_id: user.id
    });

    if (error) throw error;

    // Switch to personal mode or another workspace after deletion
    switchToPersonal();
    await loadWorkspaceData();

    return data as boolean;
  };

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      allWorkspaces,
      members,
      invitations,
      userRole,
      loading,
      isOwner,
      isAdmin,
      canManageMembers,
      isPersonalMode,
      switchWorkspace,
      switchToPersonal,
      createWorkspace,
      inviteMember,
      removeMember,
      updateMemberRole,
      cancelInvitation,
      migrateDeals,
      leaveWorkspace,
      shareDealsToWorkspace,
      deleteWorkspace,
      refetch: loadWorkspaceData
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

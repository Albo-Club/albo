-- =====================================================
-- MIGRATION 3: RLS Policies
-- Run this in your Supabase SQL Editor AFTER migration 2
-- =====================================================

-- =====================================================
-- WORKSPACES POLICIES
-- =====================================================

-- Select: Members can view their workspace
CREATE POLICY "Members can view their workspace"
ON public.workspaces FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(id, auth.uid())
);

-- Insert: Any authenticated user can create a workspace (function enforces one per user)
CREATE POLICY "Users can create workspaces"
ON public.workspaces FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Update: Only admin or owner can update
CREATE POLICY "Admins can update workspace"
ON public.workspaces FOR UPDATE
TO authenticated
USING (public.is_workspace_admin_or_owner(auth.uid(), id))
WITH CHECK (public.is_workspace_admin_or_owner(auth.uid(), id));

-- Delete: Only owner can delete
CREATE POLICY "Owner can delete workspace"
ON public.workspaces FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- =====================================================
-- WORKSPACE_MEMBERS POLICIES
-- =====================================================

-- Select: Members can view other members in their workspace
CREATE POLICY "Members can view workspace members"
ON public.workspace_members FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
);

-- Insert: Only admin/owner can add members (via RPC function recommended)
CREATE POLICY "Admins can add members"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_admin_or_owner(auth.uid(), workspace_id)
);

-- Update: Only admin/owner can update roles
CREATE POLICY "Admins can update member roles"
ON public.workspace_members FOR UPDATE
TO authenticated
USING (public.is_workspace_admin_or_owner(auth.uid(), workspace_id))
WITH CHECK (
  public.is_workspace_admin_or_owner(auth.uid(), workspace_id)
  AND role != 'owner' -- Cannot change owner role
);

-- Delete: Admin/owner can remove members (except owner)
CREATE POLICY "Admins can remove members"
ON public.workspace_members FOR DELETE
TO authenticated
USING (
  public.is_workspace_admin_or_owner(auth.uid(), workspace_id)
  AND role != 'owner' -- Cannot remove owner
  AND user_id != auth.uid() -- Cannot remove self if owner
);

-- =====================================================
-- WORKSPACE_INVITATIONS POLICIES
-- =====================================================

-- Select: Admins can see all invitations, users can see their own pending invitations
CREATE POLICY "View workspace invitations"
ON public.workspace_invitations FOR SELECT
TO authenticated
USING (
  public.can_manage_workspace_invitations(auth.uid(), workspace_id)
  OR (email = auth.email() AND accepted_at IS NULL)
);

-- Insert: Only admin/owner can create invitations
CREATE POLICY "Admins can create invitations"
ON public.workspace_invitations FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_workspace_invitations(auth.uid(), workspace_id)
);

-- Update: Admin/owner can update, or user accepting their own invitation
CREATE POLICY "Update invitations"
ON public.workspace_invitations FOR UPDATE
TO authenticated
USING (
  public.can_manage_workspace_invitations(auth.uid(), workspace_id)
  OR (email = auth.email() AND accepted_at IS NULL)
);

-- Delete: Only admin/owner can cancel invitations
CREATE POLICY "Admins can delete invitations"
ON public.workspace_invitations FOR DELETE
TO authenticated
USING (
  public.can_manage_workspace_invitations(auth.uid(), workspace_id)
);

-- =====================================================
-- UPDATE DEALS POLICIES (add workspace visibility)
-- =====================================================

-- Drop existing SELECT policy if exists (you may need to check the policy name)
-- DROP POLICY IF EXISTS "Users can view own deals" ON public.deals;

-- New SELECT policy: user's own deals OR workspace deals
CREATE POLICY "Users can view workspace or own deals"
ON public.deals FOR SELECT
TO authenticated
USING (
  -- User's own deals (no workspace)
  (workspace_id IS NULL AND user_id = auth.uid())
  OR (workspace_id IS NULL AND sender_email ILIKE auth.email())
  -- Workspace deals
  OR public.is_workspace_member(workspace_id, auth.uid())
);

-- Update INSERT policy to set workspace_id
-- DROP POLICY IF EXISTS "Users can insert own deals" ON public.deals;

CREATE POLICY "Users can insert deals"
ON public.deals FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Update policy for deals
CREATE POLICY "Users can update workspace or own deals"
ON public.deals FOR UPDATE
TO authenticated
USING (
  (workspace_id IS NULL AND user_id = auth.uid())
  OR public.is_workspace_member(workspace_id, auth.uid())
);

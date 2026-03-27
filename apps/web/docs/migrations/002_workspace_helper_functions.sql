-- =====================================================
-- MIGRATION 2: Helper Functions (Security Definer)
-- Run this in your Supabase SQL Editor AFTER migration 1
-- =====================================================

-- 1. Check if user is a member of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

-- 2. Get the workspace ID for a user (returns NULL if no workspace)
CREATE OR REPLACE FUNCTION public.get_user_workspace_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 3. Check if user is admin or owner of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id 
    AND workspace_id = _workspace_id 
    AND role IN ('owner', 'admin')
  )
$$;

-- 4. Check if user can manage invitations (is admin or owner)
CREATE OR REPLACE FUNCTION public.can_manage_workspace_invitations(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_workspace_admin_or_owner(_user_id, _workspace_id)
$$;

-- 5. Get user's role in a workspace
CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id UUID, _workspace_id UUID)
RETURNS workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id
  LIMIT 1
$$;

-- 6. Function to create a workspace and add owner as member
CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT, _owner_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id UUID;
  _existing_workspace UUID;
BEGIN
  -- Check if user already has a workspace
  SELECT workspace_id INTO _existing_workspace
  FROM public.workspace_members
  WHERE user_id = _owner_id
  LIMIT 1;
  
  IF _existing_workspace IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;
  
  -- Create the workspace
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (_name, _owner_id)
  RETURNING id INTO _workspace_id;
  
  -- Add owner as member with owner role
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, _owner_id, 'owner');
  
  RETURN _workspace_id;
END;
$$;

-- 7. Function to accept an invitation
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token TEXT, _user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _existing_workspace UUID;
BEGIN
  -- Check if user already has a workspace
  SELECT workspace_id INTO _existing_workspace
  FROM public.workspace_members
  WHERE user_id = _user_id
  LIMIT 1;
  
  IF _existing_workspace IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;
  
  -- Find the invitation
  SELECT * INTO _invitation
  FROM public.workspace_invitations
  WHERE token = _token
  AND accepted_at IS NULL
  AND expires_at > NOW();
  
  IF _invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Add user as workspace member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_invitation.workspace_id, _user_id, _invitation.role);
  
  -- Mark invitation as accepted
  UPDATE public.workspace_invitations
  SET accepted_at = NOW()
  WHERE id = _invitation.id;
  
  RETURN _invitation.workspace_id;
END;
$$;

-- 8. Function to migrate existing deals to workspace
CREATE OR REPLACE FUNCTION public.migrate_deals_to_workspace(_user_id UUID, _workspace_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE public.deals
  SET workspace_id = _workspace_id
  WHERE user_id = _user_id
  AND workspace_id IS NULL;
  
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

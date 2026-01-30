import { useState, useEffect } from "react";
import { Target, Wallet } from "lucide-react";
import { WorkspaceDropdown } from "@/components/WorkspaceDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{
    name: string | null;
    avatar_url: string | null;
  } | null>(null);

  // Charger le profil avec avatar_url
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setProfile(data);
      }
    };

    loadProfile();

    // S'abonner aux changements du profil
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`,
        },
        (payload) => {
          if (payload.new) {
            setProfile({
              name: payload.new.name,
              avatar_url: payload.new.avatar_url,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const userName = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Utilisateur";
  const userEmail = user?.email || "";
  const avatarUrl = profile?.avatar_url || null;

  const navMainItems = [
    {
      title: "Opportunités",
      url: "/opportunities",
      icon: Target,
    },
    {
      title: "Portfolio",
      url: "/portfolio",
      icon: Wallet,
    },
  ];

  const navSecondaryItems: { title: string; url: string; icon: typeof Target }[] = [];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceDropdown />
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser 
          user={{ 
            name: userName, 
            email: userEmail,
            avatar_url: avatarUrl,
          }} 
          onSignOut={handleSignOut} 
        />
      </SidebarFooter>
    </Sidebar>
  );
}

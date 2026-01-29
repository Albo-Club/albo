import { Target, Wallet } from "lucide-react";
import { WorkspaceDropdown } from "@/components/WorkspaceDropdown";
import { useAuth } from "@/contexts/AuthContext";
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

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Utilisateur";
  const userEmail = user?.email || "";

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
          user={{ name: userName, email: userEmail }} 
          onSignOut={handleSignOut} 
        />
      </SidebarFooter>
    </Sidebar>
  );
}

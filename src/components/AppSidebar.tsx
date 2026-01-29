import { useNavigate } from "react-router-dom";
import { Home, Target, Wallet, Send } from "lucide-react";
import { WorkspaceDropdown } from "@/components/WorkspaceDropdown";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

const FLAGGED_USERS = [
  'test@albo.app',
  'mael@alboteam.com',
  'benjamin@alboteam.com',
  'raphaelle@alboteam.com'
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Utilisateur";
  const userEmail = user?.email || "";

  // Filter nav items based on feature flags
  const canSeeDashboard = FLAGGED_USERS.includes(userEmail.toLowerCase());

  const navMainItems = [
    ...(canSeeDashboard ? [{
      title: "Vue d'ensemble",
      url: "/dashboard",
      icon: Home,
    }] : []),
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

  const navSecondaryItems = [
    { title: "Feedback", url: "#", icon: Send },
  ];

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

      <SidebarRail />
    </Sidebar>
  );
}

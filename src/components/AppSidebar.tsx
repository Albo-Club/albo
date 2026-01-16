import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Wallet, Table2, Plus, Settings } from "lucide-react";
import logo from "@/assets/logo.svg";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Wallet,
  },
  {
    title: "Deals",
    url: "/dashboard",
    icon: Table2,
  },
  {
    title: "Submit Deal",
    url: "/submit",
    icon: Plus,
  },
  {
    title: "Workspace",
    url: "/workspace",
    icon: Settings,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, signOut } = useAuth();
  const { workspace } = useWorkspace();

  const userData = {
    name: user?.user_metadata?.name || "User",
    email: user?.email || "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard" className="flex items-center gap-2">
                <img src={logo} alt="Albo" className="h-6 w-auto" />
                {workspace && (
                  <span className="text-xs font-medium text-muted-foreground truncate max-w-24">
                    {workspace.name}
                  </span>
                )}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={signOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

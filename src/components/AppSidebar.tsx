import { NavLink, useNavigate } from "react-router-dom";
import { Wallet, Table2, Plus, LogOut, ChevronLeft, ChevronRight, User as UserIcon } from "lucide-react";
import { WorkspaceDropdown } from "@/components/WorkspaceDropdown";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FLAGGED_USERS = [
  'test@albo.app',
  'mael@alboteam.com',
  'benjamin@alboteam.com',
  'raphaelle@alboteam.com'
];

const navItems = [
  {
    title: "Dashboard",
    url: "/portfolio",
    icon: Wallet,
    flagged: true,
  },
  {
    title: "Deals",
    url: "/dashboard",
    icon: Table2,
    flagged: false,
  },
  {
    title: "Soumettre un deal",
    url: "/submit",
    icon: Plus,
    flagged: false,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Utilisateur";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Filter nav items based on feature flags
  const canSeeDashboard = FLAGGED_USERS.includes(userEmail.toLowerCase());
  const filteredNavItems = navItems.filter(item => {
    if (item.flagged) {
      return canSeeDashboard;
    }
    return true;
  });

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            {isCollapsed ? (
              <div className="flex items-center justify-center p-2">
                <Logo width={24} height={24} className="h-6 w-6" />
              </div>
            ) : (
              <WorkspaceDropdown />
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2",
                          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex flex-col items-start text-left flex-1 min-w-0">
                      <span className="text-sm font-medium truncate w-full">
                        {userName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {userEmail}
                      </span>
                    </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isCollapsed ? "right" : "top"}
                align="start"
                className="w-56"
              >
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Mon profil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

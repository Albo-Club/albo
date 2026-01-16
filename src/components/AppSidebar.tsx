import { Wallet, Table2, Plus } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { WorkspaceDropdown } from "@/components/WorkspaceDropdown";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
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
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <WorkspaceDropdown />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

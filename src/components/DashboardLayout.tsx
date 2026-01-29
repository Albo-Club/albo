import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AIPanelProvider, useAIPanel } from "@/contexts/AIPanelContext";
import { AskAISidePanel } from "@/components/AskAISidePanel";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface DashboardLayoutProps {
  children: ReactNode;
}

const routeLabels: Record<string, string> = {
  "/dashboard": "Vue d'ensemble",
  "/opportunities": "Opportunités",
  "/portfolio": "Portfolio",
  "/submit": "Soumettre un deal",
  "/profile": "Profil",
  "/admin": "Administration",
  "/workspace-settings": "Paramètres du workspace",
};

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { isOpen, togglePanel } = useAIPanel();
  const location = useLocation();

  // Get current page label
  const currentPath = location.pathname;
  const pageLabel = routeLabels[currentPath] || "Page";

  // Check if we're on a detail page (e.g., /portfolio/123)
  const pathParts = currentPath.split("/").filter(Boolean);
  const isDetailPage = pathParts.length > 1;
  const parentPath = isDetailPage ? `/${pathParts[0]}` : null;
  const parentLabel = parentPath ? routeLabels[parentPath] : null;

  return (
    <SidebarProvider defaultOpen={true} className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset
        className={cn(
          "transition-all duration-300 ease-in-out flex flex-col h-svh md:h-[calc(100svh-1rem)] overflow-hidden",
          isOpen ? "md:mr-[400px]" : "mr-0"
        )}
      >
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {isDetailPage && parentLabel ? (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href={parentPath!}>
                      {parentLabel}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Détail</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={togglePanel}
              className="gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 text-violet-700 hover:bg-violet-500/20 hover:border-violet-500/50 dark:text-violet-300 dark:border-violet-400/30"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none min-h-0">
          <div className="max-w-7xl mx-auto w-full min-w-0 p-4 py-6">
            {children}
          </div>
        </div>
      </SidebarInset>
      <AskAISidePanel />
    </SidebarProvider>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AIPanelProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AIPanelProvider>
  );
}

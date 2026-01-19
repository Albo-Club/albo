import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AIPanelProvider, useAIPanel } from "@/contexts/AIPanelContext";
import { AskAISidePanel } from "@/components/AskAISidePanel";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { isOpen, togglePanel } = useAIPanel();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div
          className={cn(
            "flex flex-col flex-1 transition-all duration-300 ease-in-out",
            isOpen ? "md:mr-[400px]" : "mr-0"
          )}
        >
          <header className="h-14 flex items-center justify-between border-b px-4">
            <SidebarTrigger />
            <Button
              variant={isOpen ? "default" : "outline"}
              size="sm"
              onClick={togglePanel}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
        <AskAISidePanel />
      </div>
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

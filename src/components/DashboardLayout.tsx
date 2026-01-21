import { ReactNode, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AIPanelProvider, useAIPanel } from "@/contexts/AIPanelContext";
import { AskAISidePanel } from "@/components/AskAISidePanel";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

function SidebarAutoClose() {
  const { open, setOpen } = useSidebar();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      const trigger = document.querySelector('[data-sidebar="trigger"]');
      
      if (open && 
          sidebar && 
          !sidebar.contains(event.target as Node) &&
          trigger &&
          !trigger.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  return null;
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { isOpen, togglePanel } = useAIPanel();

  return (
    <SidebarProvider defaultOpen={false}>
      <SidebarAutoClose />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div
          className={cn(
            "flex flex-col flex-1 transition-all duration-300 ease-in-out",
            isOpen ? "md:mr-[400px]" : "mr-0"
          )}
        >
          <header className="h-14 flex items-center justify-between border-b px-4 sticky top-0 bg-background z-10">
            <SidebarTrigger />
            <Button
              variant="outline"
              size="sm"
              onClick={togglePanel}
              className="gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 text-violet-700 hover:bg-violet-500/20 hover:border-violet-500/50 dark:text-violet-300 dark:border-violet-400/30"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6 w-full">
              {children}
            </div>
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

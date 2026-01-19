import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";

interface DealTabsProps {
  overviewContent: ReactNode;
  emailsContent?: ReactNode;
  foldersContent?: ReactNode;
  metricsContent?: ReactNode;
  notesContent?: ReactNode;
}

export function DealTabs({
  overviewContent,
  emailsContent,
  foldersContent,
  metricsContent,
  notesContent,
}: DealTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto">
        <TabsTrigger
          value="overview"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="emails"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          disabled={!emailsContent}
        >
          Emails
        </TabsTrigger>
        <TabsTrigger
          value="folders"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          disabled={!foldersContent}
        >
          Documents
        </TabsTrigger>
        <TabsTrigger
          value="metrics"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          disabled={!metricsContent}
        >
          Metrics
        </TabsTrigger>
        <TabsTrigger
          value="notes"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          disabled={!notesContent}
        >
          Notes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        {overviewContent}
      </TabsContent>

      <TabsContent value="emails" className="mt-6">
        {emailsContent || (
          <div className="text-center py-12 text-muted-foreground">
            Aucun email associé à ce deal
          </div>
        )}
      </TabsContent>

      <TabsContent value="folders" className="mt-6">
        {foldersContent || (
          <div className="text-center py-12 text-muted-foreground">
            Aucun document associé à ce deal
          </div>
        )}
      </TabsContent>

      <TabsContent value="metrics" className="mt-6">
        {metricsContent || (
          <div className="text-center py-12 text-muted-foreground">
            Aucune métrique disponible
          </div>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-6">
        {notesContent || (
          <div className="text-center py-12 text-muted-foreground">
            Aucune note pour ce deal
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

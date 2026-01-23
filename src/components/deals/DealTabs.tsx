import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          disabled={!emailsContent}
        >
          Emails
          {!emailsContent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted-foreground/20 text-muted-foreground">
              Soon
            </Badge>
          )}
        </TabsTrigger>
        
        <TabsTrigger
          value="folders"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          disabled={!foldersContent}
        >
          Documents
          {!foldersContent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted-foreground/20 text-muted-foreground">
              Soon
            </Badge>
          )}
        </TabsTrigger>
        
        <TabsTrigger
          value="metrics"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          disabled={!metricsContent}
        >
          Metrics
          {!metricsContent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted-foreground/20 text-muted-foreground">
              Soon
            </Badge>
          )}
        </TabsTrigger>
        
        <TabsTrigger
          value="notes"
          className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
          disabled={!notesContent}
        >
          Notes
          {!notesContent && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted-foreground/20 text-muted-foreground">
              Soon
            </Badge>
          )}
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

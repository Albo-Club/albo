import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemoHtmlFrame } from "@/components/MemoHtmlFrame";

interface MemoWidgetProps {
  memoHtml: string;
  companyName: string;
  className?: string;
}

export function MemoWidget({ memoHtml, companyName, className }: MemoWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <Card className={cn("flex flex-col h-[calc(100vh-280px)] min-h-[400px]", className)}>
        <CardHeader className="flex-shrink-0 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Mémo d'investissement</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(true)}
            className="h-8 w-8"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div 
            className="h-full overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <MemoHtmlFrame html={memoHtml} title={companyName} />
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle>Mémo d'investissement - {companyName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <MemoHtmlFrame html={memoHtml} title={companyName} className="h-full w-full" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

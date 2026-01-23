import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Loader2 } from 'lucide-react';
import { MemoHtmlFrame } from '@/components/MemoHtmlFrame';
import { displayCompanyName } from '@/lib/utils';
import { useState } from 'react';

interface MemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoHtml: string;
  companyName: string;
  hasDeck?: boolean;
  onDownloadDeck?: () => Promise<void>;
}

export function MemoModal({ 
  open, 
  onOpenChange, 
  memoHtml, 
  companyName, 
  hasDeck,
  onDownloadDeck 
}: MemoModalProps) {
  const displayName = displayCompanyName(companyName);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadDeck = async () => {
    if (!onDownloadDeck) return;
    setDownloading(true);
    try {
      await onDownloadDeck();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 [&>button.absolute]:hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{displayName}</DialogTitle>
            <div className="flex items-center gap-2">
              {hasDeck && onDownloadDeck && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDeck}
                  disabled={downloading}
                  className="gap-2"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Télécharger le deck
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden bg-background">
          <MemoHtmlFrame html={memoHtml} title={`Mémo - ${displayName}`} className="h-full w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}


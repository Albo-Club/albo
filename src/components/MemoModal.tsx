import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoHtml: string;
  companyName: string;
}

export function MemoModal({ open, onOpenChange, memoHtml, companyName }: MemoModalProps) {
  // Wrap HTML content with proper styling
  const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          padding: 24px;
          max-width: 100%;
          margin: 0;
          background: white;
        }
        h1 { font-size: 1.75rem; margin-bottom: 1rem; color: #111; }
        h2 { font-size: 1.5rem; margin-top: 2rem; margin-bottom: 0.75rem; color: #222; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
        h3 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333; }
        p { margin-bottom: 1rem; }
        ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        li { margin-bottom: 0.25rem; }
        table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        strong { font-weight: 600; }
        blockquote { border-left: 3px solid #ddd; padding-left: 1rem; margin: 1rem 0; color: #666; }
      </style>
    </head>
    <body>${memoHtml}</body>
    </html>
  `;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              Mémo d'investissement - {companyName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-white">
          <iframe
            srcDoc={styledHtml}
            className="w-full h-full border-0"
            title={`Mémo - ${companyName}`}
            sandbox="allow-same-origin"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { ArrowLeft, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  formatEmailDateFull, 
  getInitials, 
  getDisplayName, 
  sanitizeEmailHtml,
  formatFileSize 
} from '@/lib/emailFormatters';
import type { UnipileEmail, EmailAttachment } from '@/hooks/useInboxEmails';

interface EmailDetail {
  body: string;
  body_plain: string;
  attachments: EmailAttachment[];
}

interface EmailReadingViewProps {
  email: UnipileEmail;
  emailDetail: EmailDetail | null;
  isLoadingDetail: boolean;
  onBack: () => void;
}

export function EmailReadingView({ 
  email, 
  emailDetail, 
  isLoadingDetail, 
  onBack 
}: EmailReadingViewProps) {
  const senderName = getDisplayName(email.from);
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => getDisplayName(r)).join(', ') || '';
  const ccRecipients = email.cc?.length > 0 ? email.cc.map(r => getDisplayName(r)).join(', ') : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Top bar with back button and date */}
      <div className="p-3 border-b shrink-0 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <span className="text-xs text-muted-foreground">
          {formatEmailDateFull(email.date)}
        </span>
      </div>

      {/* Email content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Subject */}
          <h1 className="text-xl font-semibold mb-4">
            {email.subject || '(Sans sujet)'}
          </h1>

          {/* Sender info */}
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getInitials(senderName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{senderName}</span>
                <span className="text-muted-foreground text-sm">&lt;{senderEmail}&gt;</span>
              </div>
              
              <div className="text-xs text-muted-foreground mt-1">
                À : {recipients}
                {ccRecipients && (
                  <span> · Cc : {ccRecipients}</span>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Body with loading state */}
          {isLoadingDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : emailDetail ? (
            <>
              {/* Render HTML in iframe */}
              {emailDetail.body ? (
                <div className="email-body-container -mx-2">
                  <iframe
                    srcDoc={sanitizeEmailHtml(emailDetail.body)}
                    title="Email content"
                    className="w-full border-0 min-h-[300px]"
                    sandbox="allow-same-origin"
                    onLoad={(e) => {
                      // Auto-resize iframe
                      const iframe = e.target as HTMLIFrameElement;
                      if (iframe.contentDocument) {
                        iframe.style.height = iframe.contentDocument.body.scrollHeight + 20 + 'px';
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {emailDetail.body_plain || 'Aucun contenu'}
                </div>
              )}

              {/* Attachments */}
              {emailDetail.attachments && emailDetail.attachments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    {emailDetail.attachments.length} pièce{emailDetail.attachments.length > 1 ? 's' : ''} jointe{emailDetail.attachments.length > 1 ? 's' : ''}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {emailDetail.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer text-sm"
                        title={`${att.name} (${formatFileSize(att.size)})`}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]">{att.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFileSize(att.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              {email.snippet || 'Cliquez pour charger le contenu...'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
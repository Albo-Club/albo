import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatEmailDateFull, getInitials, getDisplayName } from '@/lib/emailFormatters';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailReadingViewProps {
  email: UnipileEmail;
  onBack: () => void;
}

export function EmailReadingView({ email, onBack }: EmailReadingViewProps) {
  const senderName = getDisplayName(email.from);
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => getDisplayName(r)).join(', ') || '';
  const ccRecipients = email.cc?.length > 0 ? email.cc.map(r => getDisplayName(r)).join(', ') : null;

  // Determine if body is HTML
  const bodyContent = email.body || email.body_plain || '';
  const isHtml = bodyContent.trim().startsWith('<') && 
    (bodyContent.includes('</') || bodyContent.includes('/>'));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Top bar with back button */}
      <div className="p-3 border-b shrink-0 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
      </div>

      {/* Email content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Subject */}
          <h1 className="text-xl font-semibold mb-4">
            {email.subject || '(Sans sujet)'}
          </h1>
          
          {email.folders && email.folders.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {email.folders.map((folder, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {folder}
                </Badge>
              ))}
            </div>
          )}

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
              
              <div className="text-xs text-muted-foreground mt-1">
                {formatEmailDateFull(email.date)}
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Body */}
          {isHtml ? (
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyContent }}
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {bodyContent || 'Aucun contenu'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

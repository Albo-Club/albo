import { Mail, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatEmailDateFull, getInitials, getDisplayName } from '@/lib/emailFormatters';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailPreviewProps {
  email: UnipileEmail | null;
  onBack?: () => void;
  isMobile?: boolean;
}

export function EmailPreview({ email, onBack, isMobile }: EmailPreviewProps) {
  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Mail className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Sélectionnez un email pour le lire</p>
      </div>
    );
  }

  const senderName = getDisplayName(email.from);
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => getDisplayName(r)).join(', ') || '';
  const ccRecipients = email.cc?.length > 0 ? email.cc.map(r => getDisplayName(r)).join(', ') : null;

  // Determine if body is HTML
  const bodyContent = email.body || email.body_plain || '';
  const isHtml = bodyContent.trim().startsWith('<') && 
    (bodyContent.includes('</') || bodyContent.includes('/>'));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mobile back button */}
      {isMobile && onBack && (
        <div className="p-2 border-b shrink-0">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </div>
      )}

      {/* Email header */}
      <div className="p-4 border-b shrink-0">
        <h2 className="text-xl font-semibold mb-3">
          {email.subject || '(Sans sujet)'}
        </h2>
        
        {email.folders && email.folders.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {email.folders.map((folder, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {folder}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {getInitials(senderName)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-semibold text-sm">{senderName}</span>
                <span className="text-muted-foreground text-sm ml-1">&lt;{senderEmail}&gt;</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatEmailDateFull(email.date)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              À : {recipients}
            </p>
            {ccRecipients && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Cc : {ccRecipients}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Email body */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isHtml ? (
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyContent }}
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {bodyContent}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

import { ArrowLeft, Paperclip, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SenderAvatar } from '@/components/ui/SenderAvatar';
import { formatEmailDateFull, getInitials, getDisplayName } from '@/lib/emailFormatters';
import { useEmailDetail } from '@/hooks/useEmailDetail';
import { EmailBodyFrame } from '@/components/inbox/EmailBodyFrame';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface CompanyEmailReadingViewProps {
  email: UnipileEmail;
  onBack: () => void;
}

export function CompanyEmailReadingView({ email, onBack }: CompanyEmailReadingViewProps) {
  const senderName = getDisplayName(email.from);
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => getDisplayName(r)).join(', ') || '';

  // Pass account_id to ensure correct fetching from Unipile
  const { detail, isLoading, error } = useEmailDetail(email.id, email.account_id);

  // Determine what body to show
  const bodyContent = detail?.body_html || detail?.body_plain || '';
  const hasBody = bodyContent.length > 0;

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Header sticky */}
      <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-medium text-lg truncate flex-1">
          {email.subject || '(Sans sujet)'}
        </h2>
      </div>

      {/* Contenu scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {/* Header email */}
          <div className="flex items-start gap-4">
            <SenderAvatar
              senderName={senderName}
              senderEmail={senderEmail}
              size="lg"
            />

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-semibold truncate">{senderName}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    &lt;{senderEmail}&gt;
                  </span>
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatEmailDateFull(email.date)}
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                à {recipients}
              </div>
            </div>
          </div>

          {/* Attachments badge */}
          {email.has_attachments && (
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">Pièce(s) jointe(s)</Badge>
            </div>
          )}

          <Separator />

          {/* Body content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Chargement du contenu...
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Impossible de charger le contenu de l'email.
              </p>
            </div>
          ) : hasBody ? (
            <div className="min-h-[200px]">
              {detail?.body_html ? (
                <EmailBodyFrame html={detail.body_html} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {detail?.body_plain}
                </pre>
              )}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Le contenu de cet email n'est pas encore disponible.
              </p>
              <p className="text-xs text-muted-foreground/70">
                La synchronisation peut prendre quelques instants.
              </p>
            </div>
          )}

          {/* Attachments list */}
          {detail?.attachments && detail.attachments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">
                  Pièces jointes ({detail.attachments.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detail.attachments.map((att) => (
                    <Badge key={att.id} variant="outline" className="gap-1.5 py-1.5">
                      <Download className="h-3 w-3" />
                      {att.filename}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

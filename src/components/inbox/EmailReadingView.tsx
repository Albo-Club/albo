import { ArrowLeft, Paperclip, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatEmailDateFull, getInitials, getDisplayName } from '@/lib/emailFormatters';
import { useEmailDetail } from '@/hooks/useEmailDetail';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailReadingViewProps {
  email: UnipileEmail;
  onBack: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function EmailReadingView({ email, onBack }: EmailReadingViewProps) {
  const senderName = getDisplayName(email.from);
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => getDisplayName(r)).join(', ') || '';
  const ccRecipients = email.cc?.length > 0 ? email.cc.map(r => getDisplayName(r)).join(', ') : null;

  const { detail, isLoading, error, isPending, retry } = useEmailDetail(email.id);

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

          {/* Pending banner */}
          {isPending && (
            <Alert className="mb-4 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                Le contenu de cet email est en cours de téléchargement, veuillez patienter...
              </AlertDescription>
            </Alert>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Chargement du contenu...</p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Erreur lors du chargement : {error.message}</span>
                <Button variant="outline" size="sm" onClick={() => retry()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Body content */}
          {!isLoading && !error && detail && (
            <>
              {detail.body_html ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: detail.body_html }}
                />
              ) : detail.body_plain ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {detail.body_plain}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Aucun contenu</p>
              )}

              {/* Attachments section */}
              {detail.attachments && detail.attachments.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Pièces jointes ({detail.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {detail.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            Télécharger
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

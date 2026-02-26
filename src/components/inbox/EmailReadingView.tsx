import { useState } from 'react';
import { ArrowLeft, Paperclip, AlertCircle, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SenderAvatar } from '@/components/ui/SenderAvatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatEmailDateFull, getInitials, getDisplayName } from '@/lib/emailFormatters';
import { useEmailDetail } from '@/hooks/useEmailDetail';
import { EmailBodyFrame } from './EmailBodyFrame';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailReadingViewProps {
  email: UnipileEmail;
  onBack: () => void;
  accountId?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function EmailReadingView({ email, onBack, accountId }: EmailReadingViewProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const senderName = getDisplayName(email.from);
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => getDisplayName(r)).join(', ') || '';
  const ccRecipients = email.cc?.length > 0 ? email.cc.map(r => getDisplayName(r)).join(', ') : null;

  const { detail, isLoading, error, retry } = useEmailDetail(
    email.id,
    accountId || email.account_id
  );

  // Fonction pour télécharger une pièce jointe
  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    setDownloadingId(attachmentId);
    try {
      const { data, error } = await supabase.functions.invoke('download-attachment', {
        body: {
          email_id: email.id,
          attachment_id: attachmentId,
          filename: filename,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors du téléchargement');
      }

      // Créer un blob à partir des données reçues
      const blob = new Blob([data], { type: 'application/octet-stream' });
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Téléchargement terminé');
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Erreur lors du téléchargement', {
        description: err.message || 'Veuillez réessayer',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header sticky : bouton retour + sujet */}
      <div className="px-4 py-3 border-b shrink-0 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold truncate">
          {email.subject || '(Sans sujet)'}
        </h1>
      </div>

      {/* Contenu scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-5">
          {/* Header email : from, to, date */}
          <div className="flex items-start gap-3 mb-1">
            <SenderAvatar
              senderName={senderName}
              senderEmail={senderEmail}
              size="md"
              className="mt-0.5"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-sm truncate">{senderName}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    &lt;{senderEmail}&gt;
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatEmailDateFull(email.date)}
                </span>
              </div>

              <div className="text-xs text-muted-foreground mt-0.5">
                to {recipients}
                {ccRecipients && <span className="ml-1">· Cc: {ccRecipients}</span>}
              </div>
            </div>
          </div>

          {/* Badges folders */}
          {email.folders && email.folders.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 ml-12">
              {email.folders.map((folder, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {folder}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          {/* État chargement initial */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Chargement…</p>
            </div>
          )}

          {/* État erreur */}
          {error && !isLoading && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">Erreur : {error.message}</span>
                <Button variant="outline" size="sm" onClick={retry}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Contenu email */}
          {!isLoading && !error && detail && (
            <>
              {detail.body_html ? (
                <EmailBodyFrame html={detail.body_html} />
              ) : detail.body_plain ? (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {detail.body_plain}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Aucun contenu disponible
                </p>
              )}

              {/* Pièces jointes */}
              {detail.attachments && detail.attachments.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" />
                      {detail.attachments.length} pièce{detail.attachments.length > 1 ? 's' : ''} jointe{detail.attachments.length > 1 ? 's' : ''}
                    </h3>
                    <div className="space-y-2">
                      {detail.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-muted/30"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate text-sm">{attachment.filename}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatFileSize(attachment.size)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 shrink-0"
                            disabled={downloadingId === attachment.id}
                            onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                          >
                            {downloadingId === attachment.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Téléchargement...
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5" />
                                Télécharger
                              </>
                            )}
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

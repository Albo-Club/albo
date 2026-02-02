import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Inbox as InboxIcon,
  Send,
  FileEdit,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Paperclip,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useInboxEmails, UnipileEmail, ConnectedEmailAccount } from '@/hooks/useInboxEmails';
import { formatDistanceToNow, format, isToday, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

type FolderType = 'INBOX' | 'SENT' | 'DRAFTS' | 'SPAM' | 'TRASH';

interface FolderItem {
  id: FolderType;
  label: string;
  icon: typeof InboxIcon;
}

const folders: FolderItem[] = [
  { id: 'INBOX', label: 'Boîte de réception', icon: InboxIcon },
  { id: 'SENT', label: 'Envoyés', icon: Send },
  { id: 'DRAFTS', label: 'Brouillons', icon: FileEdit },
  { id: 'SPAM', label: 'Spam', icon: AlertTriangle },
  { id: 'TRASH', label: 'Corbeille', icon: Trash2 },
];

function formatEmailDate(dateString: string): string {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: fr });
  }
  
  if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale: fr });
  }
  
  return format(date, 'dd/MM/yy', { locale: fr });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function EmailListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
          <Skeleton className="h-2 w-2 rounded-full mt-2" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmailListItemProps {
  email: UnipileEmail;
  isSelected: boolean;
  onClick: () => void;
}

function EmailListItem({ email, isSelected, onClick }: EmailListItemProps) {
  const senderName = email.from?.display_name || email.from?.identifier || 'Inconnu';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-muted'
      )}
    >
      {/* Unread indicator */}
      <div className="mt-2 shrink-0">
        {!email.read ? (
          <div className="h-2 w-2 rounded-full bg-primary" />
        ) : (
          <div className="h-2 w-2" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        {/* Header: sender + date */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sm truncate',
            !email.read && 'font-semibold'
          )}>
            {senderName}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {email.has_attachments && (
              <Paperclip className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatEmailDate(email.date)}
            </span>
          </div>
        </div>
        
        {/* Subject */}
        <p className={cn(
          'text-sm truncate mt-0.5',
          !email.read ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {email.subject || '(Sans sujet)'}
        </p>
        
        {/* Preview/snippet */}
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {email.body_plain?.slice(0, 100) || ''}
        </p>
      </div>
    </button>
  );
}

interface EmailPreviewProps {
  email: UnipileEmail | null;
  onBack?: () => void;
  isMobile?: boolean;
}

function EmailPreview({ email, onBack, isMobile }: EmailPreviewProps) {
  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Mail className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Sélectionnez un email pour le lire</p>
      </div>
    );
  }

  const senderName = email.from?.display_name || email.from?.identifier || 'Inconnu';
  const senderEmail = email.from?.identifier || '';
  const recipients = email.to?.map(r => r.display_name || r.identifier).join(', ') || '';

  // Determine if body is HTML
  const bodyContent = email.body || email.body_plain || '';
  const isHtml = bodyContent.trim().startsWith('<') && 
    (bodyContent.includes('</') || bodyContent.includes('/>'));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mobile back button */}
      {isMobile && onBack && (
        <div className="p-2 border-b">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </div>
      )}

      {/* Email header */}
      <div className="p-4 border-b shrink-0">
        <h2 className="text-lg font-semibold mb-3">
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
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
            {getInitials(senderName)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{senderName}</p>
                <p className="text-xs text-muted-foreground">{senderEmail}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(email.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              À: {recipients}
            </p>
          </div>
        </div>
      </div>

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
              {bodyContent.split('\n').map((line, idx) => (
                <p key={idx} className="mb-2">{line || '\u00A0'}</p>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Inbox() {
  const navigate = useNavigate();
  const [selectedFolder, setSelectedFolder] = useState<FolderType>('INBOX');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const { emails, accounts, isLoading, error, refetch, isFetching } = useInboxEmails({
    folder: selectedFolder,
    limit: 50,
  });

  const selectedEmail = useMemo(() => {
    if (!selectedEmailId) return null;
    return emails.find(e => e.id === selectedEmailId) || null;
  }, [emails, selectedEmailId]);

  const currentFolderItem = folders.find(f => f.id === selectedFolder) || folders[0];

  const handleEmailClick = (email: UnipileEmail) => {
    setSelectedEmailId(email.id);
    setMobileView('detail');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const handleFolderChange = (folder: FolderType) => {
    setSelectedFolder(folder);
    setSelectedEmailId(null);
    setMobileView('list');
  };

  // Desktop layout
  const desktopLayout = (
    <div className="hidden md:flex h-full">
      {/* Left sidebar - Accounts & Folders */}
      <div className="w-64 border-r flex flex-col shrink-0">
        <ScrollArea className="flex-1">
          {/* Accounts section */}
          <div className="p-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Comptes
            </h3>
            {accounts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Aucun compte connecté
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => navigate('/profile')}
                  className="text-xs"
                >
                  <Mail className="h-3 w-3 mr-1.5" />
                  Connecter un email
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
                  >
                    <div className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      account.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                    )} />
                    <span className="truncate text-xs">
                      {account.email || account.display_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-2" />

          {/* Folders section */}
          <div className="p-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Dossiers
            </h3>
            <div className="space-y-0.5">
              {folders.map((folder) => {
                const Icon = folder.icon;
                const isActive = selectedFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderChange(folder.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                      'hover:bg-muted/50',
                      isActive && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{folder.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Center - Email list */}
      <div className="w-80 border-r flex flex-col shrink-0">
        {/* List header */}
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-medium text-sm">{currentFolderItem.label}</h2>
            <p className="text-xs text-muted-foreground">
              {emails.length} email{emails.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actualiser</TooltipContent>
          </Tooltip>
        </div>

        {/* Email list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <EmailListSkeleton />
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-sm text-destructive mb-2">
                Erreur lors du chargement
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">Aucun email</p>
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Connectez un compte email pour commencer
                </p>
              )}
            </div>
          ) : (
            <div className="p-1">
              {emails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  isSelected={selectedEmailId === email.id}
                  onClick={() => handleEmailClick(email)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right - Email preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <EmailPreview email={selectedEmail} />
      </div>
    </div>
  );

  // Mobile layout
  const mobileLayout = (
    <div className="md:hidden flex flex-col h-full">
      {mobileView === 'list' ? (
        <>
          {/* Mobile folder selector */}
          <div className="p-3 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <select
                value={selectedFolder}
                onChange={(e) => handleFolderChange(e.target.value as FolderType)}
                className="text-sm font-medium bg-transparent border-none focus:ring-0 p-0"
              >
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                ({emails.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>

          {/* Mobile email list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <EmailListSkeleton />
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-sm text-destructive mb-2">Erreur</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Réessayer
                </Button>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun email</p>
                {accounts.length === 0 && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-3"
                    onClick={() => navigate('/profile')}
                  >
                    Connecter un email
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-1">
                {emails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={false}
                    onClick={() => handleEmailClick(email)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      ) : (
        <EmailPreview 
          email={selectedEmail} 
          onBack={handleBackToList}
          isMobile 
        />
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)] -m-4 -mt-6 bg-background">
      {desktopLayout}
      {mobileLayout}
    </div>
  );
}

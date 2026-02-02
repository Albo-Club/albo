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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useInboxEmails, UnipileEmail, ConnectedEmailAccount } from '@/hooks/useInboxEmails';
import { EmailListItem } from '@/components/inbox/EmailListItem';
import { EmailPreview } from '@/components/inbox/EmailPreview';
import { EmailListSkeleton } from '@/components/inbox/EmailListSkeleton';

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
      <div className="w-56 border-r flex flex-col shrink-0">
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
      <div className="w-[400px] border-r flex flex-col shrink-0">
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
            <div className="divide-y">
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
              <div className="divide-y">
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

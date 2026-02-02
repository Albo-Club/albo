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
  Search,
  X,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useInboxEmails, UnipileEmail, ConnectedEmailAccount } from '@/hooks/useInboxEmails';
import { EmailListItem } from '@/components/inbox/EmailListItem';
import { EmailReadingView } from '@/components/inbox/EmailReadingView';
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
  const [selectedEmail, setSelectedEmail] = useState<UnipileEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { emails, accounts, isLoading, error, refetch, isFetching } = useInboxEmails({
    folder: selectedFolder,
    limit: 50,
  });

  // Gmail-style search filtering
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    
    const query = searchQuery.toLowerCase().trim();
    
    return emails.filter((email) => {
      // Operator from:
      if (query.startsWith('from:')) {
        const val = query.slice(5).trim();
        return (
          email.from.display_name.toLowerCase().includes(val) ||
          email.from.identifier.toLowerCase().includes(val)
        );
      }
      
      // Operator to:
      if (query.startsWith('to:')) {
        const val = query.slice(3).trim();
        return email.to.some(
          (t) => t.display_name.toLowerCase().includes(val) || t.identifier.toLowerCase().includes(val)
        );
      }
      
      // Operator subject:
      if (query.startsWith('subject:')) {
        const val = query.slice(8).trim();
        return email.subject.toLowerCase().includes(val);
      }
      
      // Operator has:attachment
      if (query === 'has:attachment' || query === 'has:attachments') {
        return email.has_attachments === true;
      }
      
      // Operator is:unread
      if (query === 'is:unread') {
        return email.read === false;
      }
      
      // Operator is:read
      if (query === 'is:read') {
        return email.read === true;
      }
      
      // Global search
      return (
        email.from.display_name.toLowerCase().includes(query) ||
        email.from.identifier.toLowerCase().includes(query) ||
        email.subject.toLowerCase().includes(query) ||
        (email.snippet || '').toLowerCase().includes(query) ||
        (email.body_plain || '').toLowerCase().includes(query) ||
        email.to.some(
          (t) => t.display_name.toLowerCase().includes(query) || t.identifier.toLowerCase().includes(query)
        )
      );
    });
  }, [emails, searchQuery]);

  const currentFolderItem = folders.find(f => f.id === selectedFolder) || folders[0];

  const handleEmailClick = (email: UnipileEmail) => {
    setSelectedEmail(email);
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
  };

  const handleFolderChange = (folder: FolderType) => {
    setSelectedFolder(folder);
    setSelectedEmail(null);
    setSearchQuery('');
  };

  // Sidebar component (shared between desktop and mobile)
  const renderSidebar = () => (
    <div className="w-56 border-r flex flex-col shrink-0 bg-background">
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
  );

  // Email list with search bar
  const renderEmailList = () => (
    <div className="flex-1 flex flex-col min-w-0">
      {/* List header */}
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-medium text-sm">{currentFolderItem.label}</h2>
          <p className="text-xs text-muted-foreground">
            {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
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

      {/* Search bar */}
      <div className="p-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher dans les emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-2">
            {filteredEmails.length} résultat{filteredEmails.length !== 1 ? 's' : ''} pour "{searchQuery}"
          </p>
        )}
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
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Aucun résultat' : 'Aucun email'}
            </p>
            {!searchQuery && accounts.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Connectez un compte email pour commencer
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredEmails.map((email) => (
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
    </div>
  );

  // Desktop layout - 2 columns (sidebar + email list/reading view)
  const desktopLayout = (
    <div className="hidden md:flex h-full">
      {renderSidebar()}
      
      {selectedEmail ? (
        <EmailReadingView 
          email={selectedEmail} 
          onBack={handleBackToList}
        />
      ) : (
        renderEmailList()
      )}
    </div>
  );

  // Mobile layout
  const mobileLayout = (
    <div className="md:hidden flex flex-col h-full">
      {selectedEmail ? (
        <EmailReadingView 
          email={selectedEmail} 
          onBack={handleBackToList}
        />
      ) : (
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
                ({filteredEmails.length})
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

          {/* Mobile search bar */}
          <div className="p-3 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
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
            ) : filteredEmails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Aucun résultat' : 'Aucun email'}
                </p>
                {!searchQuery && accounts.length === 0 && (
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
                {filteredEmails.map((email) => (
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

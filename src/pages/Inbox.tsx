import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Inbox as InboxIcon,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useInboxEmails, UnipileEmail, ConnectedEmailAccount } from '@/hooks/useInboxEmails';
import { useEmailRealtime } from '@/hooks/useEmailRealtime';
import { EmailListItem } from '@/components/inbox/EmailListItem';
import { EmailReadingView } from '@/components/inbox/EmailReadingView';
import { EmailListSkeleton } from '@/components/inbox/EmailListSkeleton';

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export default function Inbox() {
  const navigate = useNavigate();
  const [selectedEmail, setSelectedEmail] = useState<UnipileEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

  const { emails, accounts, isLoading, error, refetch, isFetching } = useInboxEmails({
    limit: 50,
  });

  useEmailRealtime();

  // Extract unique companies and owners from emails
  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    emails.forEach((e) =>
      (e.companies || []).forEach((c) => map.set(c.id, { id: c.id, name: c.name }))
    );
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [emails]);

  const uniqueOwners = useMemo(() => {
    const map = new Map<string, { user_id: string; name: string; email: string; avatar_url: string | null }>();
    emails.forEach((e) =>
      (e.owners || []).forEach((o) => map.set(o.user_id, o))
    );
    return Array.from(map.values()).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [emails]);

  // Filtering logic
  const filteredEmails = useMemo(() => {
    let result = emails;

    // Company chip filter
    if (selectedCompanyId) {
      result = result.filter((e) => (e.companies || []).some((c) => c.id === selectedCompanyId));
    }

    // Owner chip filter
    if (selectedOwnerId) {
      result = result.filter((e) => (e.owners || []).some((o) => o.user_id === selectedOwnerId));
    }

    // Search query
    if (!searchQuery.trim()) return result;

    const query = searchQuery.toLowerCase().trim();

    return result.filter((email) => {
      if (query.startsWith('from:')) {
        const val = query.slice(5).trim();
        return (
          email.from.display_name.toLowerCase().includes(val) ||
          email.from.identifier.toLowerCase().includes(val)
        );
      }
      if (query.startsWith('to:')) {
        const val = query.slice(3).trim();
        return email.to.some(
          (t) => t.display_name.toLowerCase().includes(val) || t.identifier.toLowerCase().includes(val)
        );
      }
      if (query.startsWith('subject:')) {
        const val = query.slice(8).trim();
        return email.subject.toLowerCase().includes(val);
      }
      if (query === 'has:attachment' || query === 'has:attachments') {
        return email.has_attachments === true;
      }
      if (query === 'is:unread') return email.read === false;
      if (query === 'is:read') return email.read === true;
      if (query.startsWith('company:')) {
        const val = query.slice(8).trim();
        return (email.companies || []).some((c) => c.name.toLowerCase().includes(val));
      }
      if (query.startsWith('owner:')) {
        const val = query.slice(6).trim();
        return (email.owners || []).some(
          (o) => (o.name || '').toLowerCase().includes(val) || o.email.toLowerCase().includes(val)
        );
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
  }, [emails, searchQuery, selectedCompanyId, selectedOwnerId]);

  const handleEmailClick = (email: UnipileEmail) => setSelectedEmail(email);
  const handleBackToList = () => setSelectedEmail(null);

  // Sidebar: accounts only
  const renderSidebar = () => (
    <div className="w-56 border-r flex flex-col shrink-0 bg-background">
      <ScrollArea className="flex-1">
        <div className="p-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Comptes
          </h3>
          {accounts.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">Aucun compte connecté</p>
              <Button size="sm" variant="outline" onClick={() => navigate('/profile')} className="text-xs">
                <Mail className="h-3 w-3 mr-1.5" />
                Connecter un email
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                  <div className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    account.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  )} />
                  <span className="truncate text-xs">{account.email || account.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Filter chips
  const renderFilters = () => (
    <div className="p-3 border-b shrink-0 space-y-2">
      {/* Company filter chips */}
      {uniqueCompanies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCompanyId(null)}
            className={cn(
              'text-xs rounded-full px-2.5 py-1 transition-colors',
              !selectedCompanyId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            Toutes
          </button>
          {uniqueCompanies.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCompanyId(selectedCompanyId === c.id ? null : c.id)}
              className={cn(
                'text-xs rounded-full px-2.5 py-1 transition-colors',
                selectedCompanyId === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Owner filter chips */}
      {uniqueOwners.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedOwnerId(null)}
            className={cn(
              'text-xs rounded-full px-2.5 py-1 transition-colors',
              !selectedOwnerId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            Tous
          </button>
          {uniqueOwners.map((o) => (
            <button
              key={o.user_id}
              onClick={() => setSelectedOwnerId(selectedOwnerId === o.user_id ? null : o.user_id)}
              className={cn(
                'text-xs rounded-full px-2.5 py-1 transition-colors flex items-center gap-1.5',
                selectedOwnerId === o.user_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <div
                className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white shrink-0 overflow-hidden"
                style={{ backgroundColor: o.avatar_url ? undefined : hashColor(o.name || o.email) }}
              >
                {o.avatar_url ? (
                  <img src={o.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (o.name || o.email)[0]?.toUpperCase()
                )}
              </div>
              {(o.name || o.email).split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Email list
  const renderEmailList = () => (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-medium text-sm">Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
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
            <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0">
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

      {/* Filter chips */}
      {renderFilters()}

      {/* Email list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <EmailListSkeleton />
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-destructive mb-2">Erreur lors du chargement</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Réessayer</Button>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || selectedCompanyId || selectedOwnerId ? 'Aucun résultat' : 'Aucun email'}
            </p>
            {!searchQuery && !selectedCompanyId && !selectedOwnerId && accounts.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Connectez un compte email pour commencer</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredEmails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                isSelected={selectedEmail?.id === email.id}
                onClick={() => handleEmailClick(email)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // Desktop layout
  const desktopLayout = (
    <div className="hidden md:flex h-full">
      {renderSidebar()}
      {selectedEmail ? (
        <EmailReadingView email={selectedEmail} onBack={handleBackToList} />
      ) : (
        renderEmailList()
      )}
    </div>
  );

  // Mobile layout
  const mobileLayout = (
    <div className="md:hidden flex flex-col h-full">
      {selectedEmail ? (
        <EmailReadingView email={selectedEmail} onBack={handleBackToList} />
      ) : (
        <>
          {/* Mobile header */}
          <div className="p-3 border-b flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-medium text-sm">Inbox</h2>
              <span className="text-xs text-muted-foreground">({filteredEmails.length})</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>

          {/* Mobile search */}
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
                <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Mobile filters */}
          {renderFilters()}

          {/* Mobile email list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <EmailListSkeleton />
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-sm text-destructive mb-2">Erreur</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>Réessayer</Button>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Aucun résultat' : 'Aucun email'}
                </p>
                {!searchQuery && accounts.length === 0 && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/profile')}>
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

import { Search, X, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatEmailDate, getDisplayName } from '@/lib/emailFormatters';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailNavSidebarProps {
  emails: UnipileEmail[];
  selectedEmail: UnipileEmail | null;
  onSelectEmail: (email: UnipileEmail) => void;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function EmailNavSidebar({
  emails,
  selectedEmail,
  onSelectEmail,
  onClose,
  searchQuery,
  onSearchChange,
}: EmailNavSidebarProps) {
  return (
    <div className="w-80 border-r border-border flex flex-col shrink-0 bg-background">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-xs text-muted-foreground">
          {emails.length} email{emails.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 p-0"
          title="Revenir à la liste"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Compact search */}
      <div className="px-2 py-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm bg-muted/30 border-none"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange('')}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Compact email list */}
      <ScrollArea className="flex-1">
        {emails.map((email) => (
          <button
            key={email.id}
            className={cn(
              'w-full text-left px-3 py-2 transition-colors',
              'hover:bg-muted/50',
              selectedEmail?.id === email.id && 'bg-primary/10 border-l-2 border-l-primary'
            )}
            onClick={() => onSelectEmail(email)}
          >
            <div className="flex items-center gap-2 mb-0.5">
              {/* Unread indicator */}
              <div className="w-1.5 shrink-0">
                {!email.read && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>
              {/* Sender name */}
              <span className={cn(
                'flex-1 truncate text-sm',
                !email.read ? 'font-semibold' : 'font-normal'
              )}>
                {getDisplayName(email.from)}
              </span>
              {/* Attachment icon */}
              {email.has_attachments && (
                <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              {/* Compact date */}
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatEmailDate(email.date)}
              </span>
            </div>
            {/* Subject truncated */}
            <p className={cn(
              'text-xs truncate pl-3.5',
              !email.read ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {email.subject || '(Sans sujet)'}
            </p>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}
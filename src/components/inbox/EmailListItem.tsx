import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEmailDate, getDisplayName } from '@/lib/emailFormatters';
import { fetchEmailDetailFn } from '@/hooks/useEmailDetail';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailListItemProps {
  email: UnipileEmail;
  isSelected: boolean;
  onClick: () => void;
}

export function EmailListItem({ email, isSelected, onClick }: EmailListItemProps) {
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const senderName = getDisplayName(email.from);
  const snippet = email.snippet || email.body_plain?.slice(0, 80) || '';

  // Prefetch le détail après 300ms de hover
  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ['email-detail', email.id],
        queryFn: () => fetchEmailDetailFn(email.id),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'w-full text-left flex items-center gap-3 py-2.5 px-3 transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-muted'
      )}
    >
      {/* Indicateur non lu */}
      <div className="shrink-0 w-2">
        {!email.read && (
          <div className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>
      
      {/* Nom expéditeur */}
      <span className={cn(
        'shrink-0 w-36 truncate text-sm',
        !email.read ? 'font-semibold' : 'font-normal'
      )}>
        {senderName}
      </span>
      
      {/* Sujet + Snippet */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className={cn(
          'truncate text-sm',
          !email.read ? 'font-medium text-foreground' : 'text-foreground'
        )}>
          {email.subject || '(Sans sujet)'}
        </span>
        {snippet && (
          <>
            <span className="text-muted-foreground text-sm shrink-0"> — </span>
            <span className="truncate text-sm text-muted-foreground">
              {snippet}
            </span>
          </>
        )}
      </div>
      
      {/* Icône pièce jointe + date */}
      <div className="shrink-0 flex items-center gap-2">
        {email.has_attachments && (
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground w-12 text-right">
          {formatEmailDate(email.date)}
        </span>
      </div>
    </button>
  );
}

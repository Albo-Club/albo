import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEmailDate, getDisplayName } from '@/lib/emailFormatters';
import { fetchEmailDetailFn } from '@/hooks/useEmailDetail';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SenderAvatar } from '@/components/ui/SenderAvatar';
import type { UnipileEmail } from '@/hooks/useInboxEmails';

interface EmailListItemProps {
  email: UnipileEmail;
  isSelected: boolean;
  onClick: () => void;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitial(name: string): string {
  if (!name) return '?';
  if (name.includes('@')) return name[0].toUpperCase();
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

export function EmailListItem({ email, isSelected, onClick }: EmailListItemProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const senderName = getDisplayName(email.from);
  const snippet = email.snippet || email.body_plain?.slice(0, 80) || '';

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ['email-detail', email.id],
        queryFn: () => fetchEmailDetailFn(email.id),
        staleTime: 5 * 60 * 1000,
      });
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleCompanyClick = (e: React.MouseEvent, companyId: string) => {
    e.stopPropagation();
    navigate(`/portfolio/${companyId}`);
  };

  const owners = email.owners || [];
  const companies = email.companies || [];
  const visibleCompanies = companies.slice(0, 2);
  const extraCompanies = companies.length > 2 ? companies.length - 2 : 0;

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
      {/* Unread indicator */}
      <div className="shrink-0 w-2">
        {!email.read && (
          <div className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>

      {/* Stacked owner avatars */}
      <div className="shrink-0 flex items-center" style={{ minWidth: owners.length > 1 ? `${24 + (owners.length - 1) * 16}px` : '24px' }}>
        {owners.map((owner, i) => (
          <Tooltip key={owner.user_id}>
            <TooltipTrigger asChild>
              <div
                className="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white shrink-0 overflow-hidden"
                style={{
                  marginLeft: i > 0 ? '-8px' : '0',
                  zIndex: owners.length - i,
                  backgroundColor: owner.avatar_url ? undefined : hashColor(owner.name || owner.email),
                }}
              >
                {owner.avatar_url ? (
                  <img src={owner.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitial(owner.name || owner.email)
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{owner.name}</p>
              <p className="text-muted-foreground">{owner.email}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      
      {/* Sender name */}
      <span className={cn(
        'shrink-0 w-36 truncate text-sm',
        !email.read ? 'font-semibold' : 'font-normal'
      )}>
        {senderName}
      </span>
      
      {/* Subject + snippet + report icon */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className={cn(
          'truncate text-sm',
          !email.read ? 'font-medium text-foreground' : 'text-foreground'
        )}>
          {email.subject || '(Sans sujet)'}
        </span>
        {email.is_potential_report && (
          <BarChart3 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        )}
        {snippet && (
          <>
            <span className="text-muted-foreground text-sm shrink-0"> — </span>
            <span className="truncate text-sm text-muted-foreground">
              {snippet}
            </span>
          </>
        )}
      </div>

      {/* Company badges */}
      {companies.length > 0 && (
        <div className="shrink-0 flex items-center gap-1">
          {visibleCompanies.map((c) => (
            <span
              key={c.id}
              onClick={(e) => handleCompanyClick(e, c.id)}
              className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 hover:bg-primary/10 cursor-pointer truncate max-w-[80px]"
            >
              {c.name}
            </span>
          ))}
          {extraCompanies > 0 && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
              +{extraCompanies}
            </span>
          )}
        </div>
      )}
      
      {/* Attachment icon + date */}
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

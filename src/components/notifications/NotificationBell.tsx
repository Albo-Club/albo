import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNotifications, type Notification as NotifType } from '@/hooks/useNotifications';
import { timeAgo } from '@/lib/timeago';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function NotificationItem({
  notif,
  onSelect,
}: {
  notif: NotifType;
  onSelect: (notif: NotifType) => void;
}) {
  const meta = notif.metadata;

  return (
    <button
      onClick={() => onSelect(notif)}
      className={cn(
        'flex items-start gap-3 w-full text-left px-4 py-3 cursor-pointer transition-colors hover:bg-accent',
        !notif.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
    >
      {/* Blue dot */}
      <div className="flex items-center pt-2 w-3 shrink-0">
        {!notif.is_read && (
          <span className="w-2 h-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        {meta.sender_avatar_url && (
          <AvatarImage src={meta.sender_avatar_url} alt={meta.sender_name} />
        )}
        <AvatarFallback className="text-xs bg-muted">
          {getInitials(meta.sender_name || 'U')}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm leading-snug">
            <span className="font-semibold">{meta.sender_name}</span>
            {' '}a envoyé un report :
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo(notif.created_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {meta.report_title} — {meta.report_period}
        </p>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleSelect = (notif: NotifType) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.metadata?.company_id) {
      navigate(`/portfolio/${notif.metadata.company_id}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="text-xs text-primary hover:underline"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune notification
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

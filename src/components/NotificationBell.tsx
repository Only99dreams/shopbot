import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Package, Truck, Wallet, BadgeCheck, MessageSquare, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const ICONS: Record<AppNotification['type'], typeof Bell> = {
  system: Bell,
  order: Package,
  delivery: Truck,
  payout: Wallet,
  verification: BadgeCheck,
  message: MessageSquare,
};

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export function NotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="rounded-full">{unreadCount} new</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            notifications.map((item) => {
              const Icon = ICONS[item.type] ?? Bell;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'group flex gap-3 border-b px-4 py-3 last:border-b-0 transition-colors',
                    item.is_read ? 'bg-background' : 'bg-primary/5',
                  )}
                >
                  <button
                    className="flex flex-1 gap-3 text-left"
                    onClick={() => {
                      if (!item.is_read) markRead.mutate(item.id);
                      if (item.link) navigate(item.link);
                    }}
                  >
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn('truncate text-sm', !item.is_read && 'font-semibold')}>
                          {item.title}
                        </span>
                        {!item.is_read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                      </span>
                      {item.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {relativeTime(item.created_at)}
                      </span>
                    </span>
                  </button>
                  <button
                    className="self-start p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete notification"
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

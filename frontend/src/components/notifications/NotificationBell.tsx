import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/features/notifications/api";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Convert an absolute notification link to an in-app path, if possible. */
function toInternalPath(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link, window.location.origin);
    if (url.origin !== window.location.origin) {
      // Different origin (e.g. configured FRONTEND_URL): keep path + query only.
      return url.pathname + url.search;
    }
    return url.pathname + url.search;
  } catch {
    return link.startsWith("/") ? link : null;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => listNotifications({ limit: 30 }),
    refetchInterval: 60_000,
  });

  const notifications = query.data ?? [];
  const unread = notifications.filter((n) => !n.is_read).length;

  const readMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const onClickNotification = (n: Notification) => {
    if (!n.is_read) readMut.mutate(n.id);
    const path = toInternalPath(n.link);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md gap-0 p-0">
          <SheetHeader className="flex-row items-center justify-between border-b px-5 py-4 pr-12">
            <SheetTitle>Notifications</SheetTitle>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => readAllMut.mutate()}
                disabled={readAllMut.isPending}
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {query.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="grid place-items-center px-6 py-16 text-center">
                <Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">You're all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onClickNotification(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/60",
                        !n.is_read && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.is_read ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{n.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {n.body}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

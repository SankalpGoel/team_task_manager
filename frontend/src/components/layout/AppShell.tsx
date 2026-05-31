import {
  Activity,
  Folder,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Tag,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMe } from "@/features/auth/useMe";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { cn, initials } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  managerPlus?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/projects", label: "Projects", icon: Folder },
  { to: "/app/activity", label: "Activity", icon: Activity },
  { to: "/app/members", label: "Members", icon: Users, adminOnly: true },
  { to: "/app/labels", label: "Labels", icon: Tag, managerPlus: true },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  useMe();
  useWebSocket();
  useKeyboardShortcuts();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.activeRole());
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const visible = NAV.filter((item) => {
    if (item.adminOnly && role !== "admin") return false;
    if (item.managerPlus && role !== "admin" && role !== "manager") return false;
    return true;
  });

  const navList = (onNavigate?: () => void) => (
    <ul className="space-y-1">
      {visible.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === "/app"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground font-medium",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex h-14 items-center gap-2 border-b bg-background px-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden md:inline-flex"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="font-semibold tracking-tight">Team Task Manager</div>
        <div className="ml-4 hidden md:block">
          <WorkspaceSwitcher />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <NotificationBell />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials(user?.full_name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{user?.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/app/profile")}>Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/app/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <aside className="hidden w-56 shrink-0 border-r bg-background md:block">
            <nav className="p-3">{navList()}</nav>
          </aside>
        )}
        <main className="min-w-0 flex-1 overflow-auto bg-muted/30">
          <Outlet />
        </main>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="border-b px-4 py-4 pr-12">
            <SheetTitle>Team Task Manager</SheetTitle>
          </SheetHeader>
          <nav className="p-3">
            <div className="mb-3">
              <WorkspaceSwitcher />
            </div>
            {navList(() => setMobileNavOpen(false))}
          </nav>
        </SheetContent>
      </Sheet>

      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}

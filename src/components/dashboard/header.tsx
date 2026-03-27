"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Menu,
  Search,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/firebase/auth";
import { ROUTES, USER_ROLES, COLLECTIONS } from "@/constants";
import { getGreeting, formatDate } from "@/lib/date-utils";
import { getInitials, cn } from "@/lib/utils";
import { db } from "@/lib/firebase/client";
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from "firebase/firestore";
import type { UserProfile } from "@/types";

/**
 * Dashboard Header component
 */

interface HeaderProps {
  user: UserProfile;
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export function Header({ user, onMenuClick, sidebarCollapsed }: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  // Close notification panel on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifications]);

  // Fetch recent notifications from Firestore
  const { data: notifications = [] } = useQuery({
    queryKey: ["header-notifications", user.uid],
    queryFn: async () => {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "Notification",
          message: data.message || "",
          type: data.type || "info",
          read: data.read ?? false,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        };
      });
    },
    refetchInterval: 60_000,
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Get user role display name
  const roleLabel = USER_ROLES[user.role]?.label || user.role;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Greeting */}
        <div className="hidden md:block">
          <p className="text-sm text-muted-foreground">{getGreeting()},</p>
          <p className="font-medium">{user.displayName || 'User'}</p>
        </div>
      </div>

      {/* Center section - Search */}
      <div className="hidden max-w-md flex-1 px-4 md:block lg:px-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search employees, sites..."
            className="w-full pl-10"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-popover shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowNotifications(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif: any) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex gap-3 border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/50",
                        !notif.read && "bg-primary/5"
                      )}
                    >
                      <div className="mt-0.5">
                        {notif.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : notif.type === "warning" || notif.type === "alert" ? (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{notif.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(notif.createdAt, 'DATE_TIME')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2"
            >
              {/* Avatar */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium">
                    {getInitials(user.displayName || user.email)}
                  </span>
                )}
              </div>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium">{user.displayName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
              align="end"
              sideOffset={8}
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-sm font-semibold">
                My Account
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              
              <DropdownMenu.Item asChild>
                <Link
                  href={`${ROUTES.SETTINGS.LIST}?tab=profile`}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenu.Item>
              
              <DropdownMenu.Item asChild>
                <Link
                  href={ROUTES.SETTINGS.LIST}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenu.Item>
              
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

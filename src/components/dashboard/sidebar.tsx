"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2,
  LayoutDashboard,
  Users,
  MapPin,
  Clock,
  DollarSign,
  Wallet,
  CreditCard,
  BarChart3,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/firebase/auth";
import { ROUTES, USER_ROLES } from "@/constants";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

/**
 * Sidebar navigation component
 */

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  userRole: UserRole;
}

// Navigation items configuration
const navItems = [
  {
    title: "Dashboard",
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    roles: ['owner', 'ceo', 'manager', 'supervisor'],
  },
  {
    title: "Employees",
    href: ROUTES.EMPLOYEES.LIST,
    icon: Users,
    roles: ['owner', 'ceo', 'manager'],
  },
  {
    title: "Work Sites",
    href: ROUTES.SITES.LIST,
    icon: MapPin,
    roles: ['owner', 'ceo', 'manager'],
  },
  {
    title: "Attendance",
    href: ROUTES.ATTENDANCE.LIST,
    icon: Clock,
    roles: ['owner', 'ceo', 'manager', 'supervisor'],
  },
  {
    title: "Payroll",
    href: ROUTES.PAYROLL.LIST,
    icon: DollarSign,
    roles: ['owner', 'ceo', 'manager'],
  },
  {
    title: "Advances",
    href: ROUTES.ADVANCES.LIST,
    icon: Wallet,
    roles: ['owner', 'ceo', 'manager'],
  },
  {
    title: "Loans",
    href: ROUTES.LOANS.LIST,
    icon: CreditCard,
    roles: ['owner', 'ceo', 'manager'],
  },
  {
    title: "Reports",
    href: ROUTES.REPORTS.LIST,
    icon: BarChart3,
    roles: ['owner', 'ceo', 'manager'],
  },
  {
    title: "Audit Logs",
    href: ROUTES.AUDIT_LOGS,
    icon: FileText,
    roles: ['owner', 'ceo'],
  },
  {
    title: "Settings",
    href: ROUTES.SETTINGS.LIST,
    icon: Settings,
    roles: ['owner', 'ceo', 'manager'],
  },
];

export function Sidebar({ collapsed, onCollapsedChange, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // Redirect will be handled by auth provider
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Check if a route is active
  const isActive = (href: string) => {
    if (href === ROUTES.DASHBOARD) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href={ROUTES.DASHBOARD} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">
              EMS<span className="text-primary">Admin</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0")} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout button */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center px-2"
          )}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={() => onCollapsedChange(!collapsed)}
        className={cn(
          "absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}

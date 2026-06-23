"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarDrawer } from "@/components/dashboard/sidebar-drawer";
import { Header } from "@/components/dashboard/header";
import { useAuth, useRequireAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Loader2, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/firebase/auth";

/**
 * Dashboard Layout
 * Wraps all dashboard pages with sidebar, header, and authentication protection
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isLoading } = useRequireAuth();
  const { profile, isPendingApproval } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no profile (auth redirect will happen)
  if (!profile) {
    return null;
  }

  // Show pending approval page
  if (isPendingApproval) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/20">
            <Clock className="h-10 w-10 text-yellow-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Account Pending Approval</h1>
            <p className="text-muted-foreground">
              Your account is awaiting approval from an administrator.
              You will be notified once your account has been reviewed and a role has been assigned.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 w-full">
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {profile.displayName}</p>
              <p><span className="text-muted-foreground">Email:</span> {profile.email}</p>
              <p><span className="text-muted-foreground">Status:</span>{' '}
                <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-500">
                  Pending
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={async () => { await signOut(); }}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile drawer (hidden on md+) */}
      <SidebarDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        userRole={profile.role!}
      />

      {/* Desktop sidebar (hidden on mobile, visible on md+) */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          userRole={profile.role}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          user={profile}
          onMenuClick={() => setDrawerOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Page content */}
        <main
          className={cn(
            "flex-1 overflow-auto",
            "bg-muted/30"
          )}
        >
          <div className="container mx-auto p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

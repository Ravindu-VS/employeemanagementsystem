"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarDrawer } from "@/components/dashboard/sidebar-drawer";
import { Header } from "@/components/dashboard/header";
import { useAuth, useRequireAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * Dashboard Layout
 * Wraps all dashboard pages with sidebar, header, and authentication protection
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isLoading } = useRequireAuth();
  const { profile } = useAuth();
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile drawer (hidden on md+) */}
      <SidebarDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        userRole={profile.role}
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

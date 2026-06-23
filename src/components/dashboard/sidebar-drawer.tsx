"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

/**
 * Sidebar Drawer for Mobile
 * Wraps the Sidebar component in a drawer that only appears on mobile (<md breakpoint)
 * On desktop (md+), the sidebar is rendered directly in the layout
 */

interface SidebarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  userRole: UserRole;
}

export function SidebarDrawer({
  open,
  onOpenChange,
  collapsed,
  onCollapsedChange,
  userRole,
}: SidebarDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => onOpenChange(false)}
        />

        {/* Drawer content */}
        <Dialog.Content
          className={cn(
            "fixed left-0 top-0 bottom-0 z-50 h-screen w-64 bg-card shadow-lg transition-transform duration-300 ease-in-out transform",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className={cn(
                "absolute -right-12 top-4 flex h-10 w-10 items-center justify-center rounded-full",
                "text-white transition-colors hover:bg-white/20 focus:outline-none"
              )}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>

          {/* Sidebar content */}
          <Sidebar
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            userRole={userRole}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

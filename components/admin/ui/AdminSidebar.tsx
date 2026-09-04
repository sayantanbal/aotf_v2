"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  BookOpen,
  Briefcase,
  MessageSquare,
  MessageCircle,
  Star,
  Users,
  GraduationCap,
  Megaphone,
  FileText,
  Activity,
  Settings,
  CalendarDays,
  Menu,
  X,
  ChevronRight,
  CreditCard,
  LogOut,
  User,
} from "lucide-react";
import { Avatar } from "@heroui/avatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import type { AdminPermissionKey } from "@/lib/admin/admin-permissions";

// ─── Nav items ─────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** If set, the item is only shown when the admin has this permission === true */
  permission?: AdminPermissionKey;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/agenda-view", label: "Updates", icon: CalendarDays },
  {
    href: "/admin/tuitions",
    label: "Tuitions",
    icon: BookOpen,
    permission: "canManagePosts",
  },
  {
    href: "/admin/jobs",
    label: "Jobs",
    icon: Briefcase,
    permission: "canManageJobs",
  },
  {
    href: "/admin/enquiries",
    label: "Enquiries",
    icon: MessageSquare,
    permission: "canHandleEnquiries",
  },
  {
    href: "/admin/feedbacks",
    label: "Feedbacks",
    icon: Star,
    permission: "canHandleFeedbacks",
  },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    permission: "canManageUsers",
  },
  {
    href: "/admin/whatsapp",
    label: "WhatsApp Groups",
    icon: MessageCircle,
    permission: "canManageWhatsAppGroups",
  },
  {
    href: "/admin/teachers",
    label: "Renowned Teachers",
    icon: GraduationCap,
    permission: "canManageRenownedTeachers",
  },
  { href: "/admin/ads", label: "Ads", icon: Megaphone },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    permission: "canViewPayments",
  },
  {
    href: "/admin/activity",
    label: "Activity",
    icon: Activity,
    permission: "canViewAuditLogs",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    permission: "canManageAdmins",
  },
];

// ─── Skeleton row ───────────────────────────────────────────────────────────

function NavSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="h-[17px] w-[17px] rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div
            className="h-3 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse"
            style={{ width: `${48 + (i % 3) * 20}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  // Resolve permissions from Clerk publicMetadata
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const permissions = {
    ...(metadata as Record<string, boolean>),
    ...((metadata.permissions ?? {}) as Record<string, boolean>),
  };

  // Filter nav items based on permissions
  const visibleItems = isLoaded
    ? NAV_ITEMS.filter(
        (item) => !item.permission || permissions[item.permission] === true,
      )
    : [];

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <>
      {/* ── Hamburger button (always visible, top-left) ── */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-xl
          bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-zinc-200 dark:border-zinc-700
          shadow-sm hover:shadow-md text-zinc-700 dark:text-zinc-200 transition-all"
      >
        <Menu size={20} />
      </button>

      {/* ── Backdrop ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="drawer"
            ref={drawerRef}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 left-0 z-50 h-full w-72 flex flex-col
              bg-white dark:bg-zinc-900
              border-r border-zinc-200 dark:border-zinc-700
              shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight">
                Admin Panel
              </span>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800
                  text-zinc-500 dark:text-zinc-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav links or skeleton */}
            {!isLoaded ? (
              <NavSkeleton />
            ) : (
              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`
                        group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                        transition-all duration-150 relative
                        ${
                          active
                            ? "bg-primary/10 text-primary dark:bg-primary/20"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                        }
                      `}
                    >
                      <Icon
                        size={17}
                        className={
                          active
                            ? "text-primary"
                            : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                        }
                      />
                      <span className="flex-1">{label}</span>
                      {active && (
                        <ChevronRight
                          size={14}
                          className="text-primary opacity-70"
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-700">
              {isLoaded && user ? (
                <Dropdown placement="top-start">
                  <DropdownTrigger>
                    <div className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <Avatar
                        src={user.imageUrl}
                        name={user.fullName || "Admin"}
                        className="w-8 h-8 text-tiny"
                      />
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="text-sm font-medium truncate text-zinc-800 dark:text-zinc-100">
                          {user.fullName || "Admin"}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {user.primaryEmailAddress?.emailAddress}
                        </span>
                      </div>
                    </div>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Admin Profile Actions"
                    className="w-full"
                  >
                    <DropdownItem
                      key="profile"
                      startContent={<User size={16} />}
                      href="/admin/profile"
                    >
                      My Profile
                    </DropdownItem>
                    <DropdownItem
                      key="logout"
                      className="text-danger"
                      color="danger"
                      startContent={<LogOut size={16} />}
                      onPress={() => signOut({ redirectUrl: "/admin/login" })}
                    >
                      Sign Out
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-2">
                  AOTF Admin · v2
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

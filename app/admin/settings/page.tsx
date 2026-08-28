"use client";

import { reportClientError } from "@/lib/client-report-error";
import React, { useState, useMemo, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { Tabs, Tab } from "@heroui/tabs";
import { Switch } from "@heroui/switch";
import { Avatar } from "@heroui/avatar";
import { Tooltip } from "@heroui/tooltip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import {
  Settings,
  Shield,
  Bell,
  FileText,
  UserPlus,
  Trash2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Save,
  RotateCcw,
  Users,
  Crown,
  Headset,
  Building2,
  Globe,
  CreditCard,
  Percent,
  IndianRupee,
  Clock,
  BellRing,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  Copy,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { siteConfig } from "@/config/site";
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_PERMISSION_KEYS,
  type AdminPermissionKey,
} from "@/lib/admin/admin-permissions";

type AdminRole = string;

type AdminRoleOption = {
  name: string;
  displayName: string;
  permissions: string[];
  isSystemRole?: boolean;
  level?: number;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  role: AdminRole;
  status: "active" | "inactive";
  createdAt: string;
  lastLogin?: string;
  permissions?: Record<string, boolean>;
  avatarUrl?: string;
}

type SettingsTab = "accounts" | "notifications" | "terms";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleLabel(role: string, roles: AdminRoleOption[]) {
  const match = roles.find((r) => r.name === role);
  if (match) return match.displayName;
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "support_admin") return "Support Admin";
  return role.replace(/_/g, " ");
}

function getRoleColor(role: string): "danger" | "primary" | "default" {
  if (role === "super_admin") return "danger";
  if (role === "support_admin" || role === "admin") return "primary";
  return "default";
}

function getRoleIcon(role: string) {
  if (role === "super_admin") return <Crown size={14} />;
  if (role === "support_admin") return <Headset size={14} />;
  if (role === "admin") return <Building2 size={14} />;
  return <Shield size={14} />;
}

function formatDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d?: string): string {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function permissionsFromRole(roles: AdminRoleOption[], roleName: string) {
  const role = roles.find((r) => r.name === roleName);
  const defaults = new Set(role?.permissions ?? []);
  return ADMIN_PERMISSION_KEYS.reduce<Record<AdminPermissionKey, boolean>>(
    (acc, key) => {
      acc[key] = defaults.has(key);
      return acc;
    },
    {} as Record<AdminPermissionKey, boolean>,
  );
}

function mergePermissionState(
  base: Record<AdminPermissionKey, boolean>,
  override?: Record<string, boolean>,
) {
  const next = { ...base } as Record<AdminPermissionKey, boolean>;
  if (override) {
    for (const key of ADMIN_PERMISSION_KEYS) {
      if (typeof override[key] === "boolean") {
        next[key] = Boolean(override[key]);
      }
    }
  }
  return next;
}

function normalizeAdminRole(role: unknown): AdminRole {
  if (typeof role === "string" && role.trim()) {
    if (role === "moderator") return "support_admin";
    return role.trim().toLowerCase();
  }
  return "admin";
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("accounts");

  return (
    <div className="container mx-auto px-4 max-w-5xl space-y-2">
      {/* Header */}
      <h1 className="text-2xl font-bold text-default-900 flex items-center gap-2">
        <Settings size={24} className="text-default-500" />
        Settings
      </h1>
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as SettingsTab)}
        aria-label="Admin settings tabs"
        color="primary"
        className="w-full"
      >
        <Tab key="accounts" title="Accounts" />
        {/* <Tab key="notifications" title="Notifications" /> */}
        <Tab key="terms" title="Policies" />
      </Tabs>

      {activeTab === "accounts" ? <AdminAccountsSection /> : null}
      {/* {activeTab === "notifications" ? <NotificationSettingsSection /> : null} */}
      {activeTab === "terms" ? <TermsSettingsSection /> : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: Admin Accounts
// ═════════════════════════════════════════════════════════════════════════════

function AdminAccountsSection() {
  const { user } = useUser();
  const meta = (user as any)?.publicMetadata as
    | Record<string, unknown>
    | undefined;
  const isSuperAdmin =
    meta?.role === "super_admin" || meta?.aotfRole === "SUPER_ADMIN";
  const [myAdmin, setMyAdmin] = useState<{
    role: string;
    permissions: Record<string, boolean>;
  } | null>(null);
  const [roles, setRoles] = useState<AdminRoleOption[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const adminId = (meta as any)?.adminId;
        if (!adminId) return;
        const res = await fetch(`/api/v1/admin/admins/${adminId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setMyAdmin(json.admin ?? null);
      } catch (e) {
        reportClientError(e, { feature: "admin-settings" });
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [meta]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/roles");
        if (!res.ok) {
          throw new Error("Failed to load roles");
        }
        const json = await res.json();
        const list = (json?.roles ?? []) as Array<Record<string, unknown>>;
        if (!mounted) return;
        setRoles(
          list.map((role) => ({
            name: String(role.name ?? ""),
            displayName: String(role.displayName ?? role.name ?? ""),
            permissions: Array.isArray(role.permissions)
              ? role.permissions.map((p) => String(p))
              : [],
            isSystemRole: Boolean(role.isSystemRole),
            level: typeof role.level === "number" ? role.level : undefined,
          })),
        );
      } catch (err) {
        reportClientError(err, { feature: "admin-settings" });
        if (!mounted) return;
        setRoleError(
          err instanceof Error ? err.message : "Failed to load roles",
        );
        setRoles([
          {
            name: "super_admin",
            displayName: "Super Admin",
            permissions: [],
            isSystemRole: true,
            level: 100,
          },
          {
            name: "admin",
            displayName: "Admin",
            permissions: [],
            isSystemRole: true,
            level: 50,
          },
          {
            name: "support_admin",
            displayName: "Support Admin",
            permissions: [],
            isSystemRole: true,
            level: 10,
          },
        ]);
      } finally {
        if (mounted) setIsLoadingRoles(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/admins");
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json?.admins ?? []) as Array<Record<string, unknown>>;
        if (!mounted) return;
        setAdmins(
          rows.map((row) => ({
            id: String(row._id ?? ""),
            name: String(row.name ?? ""),
            username: String(row.username ?? ""),
            email: String(row.email ?? ""),
            role: normalizeAdminRole(row.role),
            status: row.isActive === false ? "inactive" : "active",
            createdAt: String(row.createdAt ?? new Date().toISOString()),
            lastLogin:
              typeof row.lastLogin === "string" ? row.lastLogin : undefined,
            permissions:
              typeof row.permissions === "object" && row.permissions !== null
                ? (row.permissions as Record<string, boolean>)
                : undefined,
            avatarUrl:
              typeof row.avatarUrl === "string" ? row.avatarUrl : undefined,
          })),
        );
      } catch (e) {
        reportClientError(e, { feature: "admin-settings" });
        console.error("Failed to fetch admins:", e);
      } finally {
        if (mounted) setIsLoadingAdmins(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Add Admin modal
  const {
    isOpen: isAddOpen,
    onOpen: openAdd,
    onClose: closeAdd,
  } = useDisclosure();
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    username: "",
    email: "",
    role: "admin" as AdminRole,
    password: "",
    confirmPassword: "",
  });
  const [newAdminPermissions, setNewAdminPermissions] = useState<
    Record<AdminPermissionKey, boolean>
  >(() => permissionsFromRole(roles, "admin"));
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!roles.length) return;
    setNewAdminPermissions((prev) =>
      mergePermissionState(permissionsFromRole(roles, newAdmin.role), prev),
    );
  }, [roles, newAdmin.role]);

  useEffect(() => {
    if (!roles.length) return;
    setNewRolePermissions((prev) =>
      mergePermissionState(permissionsFromRole(roles, "admin"), prev),
    );
  }, [roles]);

  const {
    isOpen: isRoleOpen,
    onOpen: openRole,
    onClose: closeRole,
  } = useDisclosure();
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    displayName: "",
  });
  const [newRolePermissions, setNewRolePermissions] = useState<
    Record<AdminPermissionKey, boolean>
  >(() => permissionsFromRole(roles, "admin"));

  // Delete modal
  const {
    isOpen: isDeleteOpen,
    onOpen: openDelete,
    onClose: closeDelete,
  } = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password change modal
  const {
    isOpen: isPwdOpen,
    onOpen: openPwd,
    onClose: closePwd,
  } = useDisclosure();
  const [pwdTarget, setPwdTarget] = useState<AdminAccount | null>(null);
  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  // Permissions modal
  const {
    isOpen: isPermOpen,
    onOpen: openPerm,
    onClose: closePerm,
  } = useDisclosure();
  const [permTarget, setPermTarget] = useState<AdminAccount | null>(null);
  const [permState, setPermState] = useState<
    Record<AdminPermissionKey, boolean>
  >(() => permissionsFromRole(roles, "admin"));
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Filtered admins
  const filteredAdmins = useMemo(() => {
    if (!searchTerm.trim()) return admins;
    const q = searchTerm.toLowerCase();
    return admins.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.id.includes(q),
    );
  }, [admins, searchTerm]);

  const superAdminCount = admins.filter((a) => a.role === "super_admin").length;
  const supportAdminCount = admins.filter(
    (a) => a.role === "support_admin",
  ).length;

  const availableRoles = isSuperAdmin ? roles : [];

  // ── Add Admin ──────────────────────────────────────────────────────────

  const validateAddForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!newAdmin.name.trim()) errors.name = "Name is required";
    else if (!/^[a-zA-Z\s]+$/.test(newAdmin.name.trim()))
      errors.name = "Name can only contain letters and spaces";
    if (!newAdmin.username.trim()) errors.username = "Username is required";
    else if (!/^[a-z0-9._-]{3,32}$/i.test(newAdmin.username.trim()))
      errors.username =
        "Username must be 3-32 chars and only letters, numbers, dot, underscore, or hyphen";
    else if (
      admins.some(
        (a) =>
          a.username.toLowerCase() === newAdmin.username.trim().toLowerCase(),
      )
    )
      errors.username = "An admin with this username already exists";
    if (!newAdmin.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAdmin.email.trim()))
      errors.email = "Enter a valid email";
    else if (
      admins.some(
        (a) => a.email.toLowerCase() === newAdmin.email.trim().toLowerCase(),
      )
    )
      errors.email = "An admin with this email already exists";
    if (!newAdmin.password) errors.password = "Password is required";
    else if (newAdmin.password.length < 8)
      errors.password = "Password must be at least 8 characters";
    if (newAdmin.password !== newAdmin.confirmPassword)
      errors.confirmPassword = "Passwords do not match";
    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddAdmin = async () => {
    if (!validateAddForm()) return;
    setIsAdding(true);
    try {
      const payload = {
        username: newAdmin.username.trim().toLowerCase(),
        email: newAdmin.email.trim().toLowerCase(),
        name: newAdmin.name.trim(),
        password: newAdmin.password,
        role: newAdmin.role,
        permissions: newAdminPermissions,
      };

      const res = await fetch("/api/v1/admin/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        addToast({
          description: json?.error || "Failed to create admin",
          color: "danger",
        });
        return;
      }

      const createdAdmin: AdminAccount = {
        id: String(
          json?.admin?.id ??
            json.adminId ??
            `adm-${String(admins.length + 1).padStart(3, "0")}`,
        ),
        name: String(json?.admin?.name ?? newAdmin.name.trim()),
        username: String(
          json?.admin?.username ?? newAdmin.username.trim().toLowerCase(),
        ),
        email: String(
          json?.admin?.email ?? newAdmin.email.trim().toLowerCase(),
        ),
        role: normalizeAdminRole(json?.admin?.role ?? newAdmin.role),
        status: json?.admin?.isActive === false ? "inactive" : "active",
        createdAt: String(json?.admin?.createdAt ?? new Date().toISOString()),
        avatarUrl:
          typeof json?.admin?.avatarUrl === "string"
            ? json.admin.avatarUrl
            : undefined,
      };

      setAdmins((prev) => [createdAdmin, ...prev]);

      addToast({
        description: `Admin "${createdAdmin.name}" created successfully`,
        color: "success",
      });

      setNewAdmin({
        name: "",
        username: "",
        email: "",
        role: "admin",
        password: "",
        confirmPassword: "",
      });
      setNewAdminPermissions(permissionsFromRole(roles, "admin"));
      setAddErrors({});
      closeAdd();
    } catch (err) {
      reportClientError(err, { feature: "admin-settings" });
      console.error("Add admin error:", err);
      addToast({ description: "Failed to create admin", color: "danger" });
    } finally {
      setIsAdding(false);
    }
  };

  const buildPermissionList = (record: Record<AdminPermissionKey, boolean>) =>
    ADMIN_PERMISSION_KEYS.filter((key) => Boolean(record[key]));

  const handleCreateRole = async () => {
    if (!newRole.name.trim() || !newRole.displayName.trim()) {
      addToast({
        description: "Role name and display name are required",
        color: "danger",
      });
      return;
    }

    setIsCreatingRole(true);
    try {
      const res = await fetch("/api/v1/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRole.name.trim(),
          displayName: newRole.displayName.trim(),
          permissions: buildPermissionList(newRolePermissions),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast({
          description: json?.error || "Failed to create role",
          color: "danger",
        });
        return;
      }

      const created = json?.role as AdminRoleOption | undefined;
      if (created) {
        setRoles((prev) => [
          ...prev,
          {
            name: created.name,
            displayName: created.displayName,
            permissions: Array.isArray(created.permissions)
              ? created.permissions.map((p) => String(p))
              : [],
            isSystemRole: Boolean(created.isSystemRole),
            level:
              typeof created.level === "number" ? created.level : undefined,
          },
        ]);
        setNewAdmin((prev) => ({ ...prev, role: created.name }));
        const createdPerms = new Set(
          Array.isArray(created.permissions) ? created.permissions : [],
        );
        setNewAdminPermissions(
          ADMIN_PERMISSION_KEYS.reduce<Record<AdminPermissionKey, boolean>>(
            (acc, key) => {
              acc[key] = createdPerms.has(key);
              return acc;
            },
            {} as Record<AdminPermissionKey, boolean>,
          ),
        );
      }

      addToast({ description: "Role created successfully", color: "success" });
      setNewRole({ name: "", displayName: "" });
      setNewRolePermissions(permissionsFromRole(roles, "admin"));
      closeRole();
    } catch (err) {
      reportClientError(err, { feature: "admin-settings" });
      addToast({
        description:
          err instanceof Error ? err.message : "Failed to create role",
        color: "danger",
      });
    } finally {
      setIsCreatingRole(false);
    }
  };

  // ── Delete Admin ───────────────────────────────────────────────────────

  const handleDeleteClick = (admin: AdminAccount) => {
    setDeleteTarget(admin);
    openDelete();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/admin/admins/${deleteTarget.id}/terminate`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast({
          description: json?.error || "Failed to delete admin",
          color: "danger",
        });
        return;
      }

      setAdmins((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      addToast({
        description: `Admin "${deleteTarget.name}" deleted`,
        color: "success",
      });
      closeDelete();
      setDeleteTarget(null);
    } catch {
      addToast({ description: "Failed to delete admin", color: "danger" });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Change Password ────────────────────────────────────────────────────

  const openChangePassword = (admin: AdminAccount) => {
    setPwdTarget(admin);
    setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPwdErrors({});
    setShowOldPwd(false);
    setShowNewPwd(false);
    openPwd();
  };

  const openPermissions = async (admin: AdminAccount) => {
    setPermTarget(admin);
    setPermState(
      mergePermissionState(
        permissionsFromRole(roles, admin.role),
        admin.permissions,
      ),
    );
    openPerm();

    if (!admin.permissions) {
      try {
        const res = await fetch(`/api/v1/admin/admins/${admin.id}`);
        if (!res.ok) return;
        const json = await res.json();
        const perms =
          typeof json?.admin?.permissions === "object" &&
          json.admin.permissions !== null
            ? (json.admin.permissions as Record<string, boolean>)
            : undefined;
        if (perms) {
          setPermState(
            mergePermissionState(permissionsFromRole(roles, admin.role), perms),
          );
        }
      } catch {
        // ignore
      }
    }
  };

  const validatePwdForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!pwdForm.oldPassword)
      errors.oldPassword = "Current password is required";
    if (!pwdForm.newPassword) errors.newPassword = "New password is required";
    else if (pwdForm.newPassword.length < 8)
      errors.newPassword = "Password must be at least 8 characters";
    else if (pwdForm.newPassword === pwdForm.oldPassword)
      errors.newPassword = "New password must differ from current password";
    if (pwdForm.newPassword !== pwdForm.confirmPassword)
      errors.confirmPassword = "Passwords do not match";
    setPwdErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePwdForm()) return;
    setIsChangingPwd(true);
    try {
      // TODO: wire to real API
      await new Promise((r) => setTimeout(r, 800));
      addToast({
        description: `Password updated for ${pwdTarget?.name}`,
        color: "success",
      });
      closePwd();
      setPwdTarget(null);
    } catch {
      addToast({
        description: "Failed to change password",
        color: "danger",
      });
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permTarget) return;
    setIsSavingPerms(true);
    try {
      const res = await fetch(`/api/v1/admin/admins/${permTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permState }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast({
          description: json?.error || "Failed to update permissions",
          color: "danger",
        });
        return;
      }

      setAdmins((prev) =>
        prev.map((admin) =>
          admin.id === permTarget.id
            ? { ...admin, permissions: permState }
            : admin,
        ),
      );
      addToast({ description: "Permissions updated", color: "success" });
      closePerm();
      setPermTarget(null);
    } catch {
      addToast({
        description: "Failed to update permissions",
        color: "danger",
      });
    } finally {
      setIsSavingPerms(false);
    }
  };

  // ── Toggle Status ──────────────────────────────────────────────────────

  const toggleAdminStatus = async (admin: AdminAccount) => {
    const isActivating = admin.status !== "active";
    const endpoint = `/api/v1/admin/admins/${admin.id}/${isActivating ? "reactivate" : "deactivate"}`;

    // Optimistic update
    setAdmins((prev) =>
      prev.map((a) =>
        a.id === admin.id
          ? { ...a, status: isActivating ? "active" : "inactive" }
          : a,
      ),
    );

    try {
      const res = await fetch(endpoint, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Revert on failure
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === admin.id ? { ...a, status: admin.status } : a,
          ),
        );
        addToast({
          description: json?.error || `Failed to ${isActivating ? "activate" : "deactivate"} admin`,
          color: "danger",
        });
        return;
      }

      addToast({
        description: `${admin.name} ${isActivating ? "activated" : "deactivated"}`,
        color: "success",
      });
    } catch {
      // Revert on failure
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id ? { ...a, status: admin.status } : a,
        ),
      );
      addToast({
        description: `Failed to ${isActivating ? "activate" : "deactivate"} admin`,
        color: "danger",
      });
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    addToast({ description: `Copied ${id}`, color: "primary" });
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Floating Add Admin Button (visible to super admins only) */}
      {isSuperAdmin && (
        <div className="fixed bottom-6 right-6 z-50">
          <Tooltip content="Add Admin" placement="left" color="primary">
            <Button
              color="primary"
              onPress={openAdd}
              isIconOnly
              radius="full"
              size="lg"
              className="shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all"
            >
              <UserPlus size={20} />
            </Button>
          </Tooltip>
        </div>
      )}
      {/* Search */}
      <Input
        placeholder="Search by name, username, email or ID…"
        value={searchTerm}
        onValueChange={setSearchTerm}
        variant="bordered"
        size="sm"
        isClearable
        onClear={() => setSearchTerm("")}
        classNames={{ inputWrapper: "bg-default-50" }}
      />
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-3">
        <Chip variant="flat" color="danger" startContent={<Crown size={14} />}>
          {superAdminCount} Super Admin{superAdminCount !== 1 ? "s" : ""}
        </Chip>
        <Chip
          variant="flat"
          color="primary"
          startContent={<Headset size={14} />}
        >
          {supportAdminCount} Support Admin
          {supportAdminCount !== 1 ? "s" : ""}
        </Chip>
      </div>

      {/* Admin Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredAdmins.map((admin) => (
          <AdminCard
            key={admin.id}
            admin={admin}
            roles={roles}
            onDelete={handleDeleteClick}
            onChangePassword={openChangePassword}
            onPermissions={openPermissions}
            onToggleStatus={toggleAdminStatus}
            onCopyId={copyId}
            canDelete={!(admin.role === "super_admin" && superAdminCount <= 1)}
            canEditPermissions={isSuperAdmin}
          />
        ))}
      </div>

      {filteredAdmins.length === 0 && (
        <Card>
          <CardBody className="py-12 text-center">
            {isLoadingAdmins ? (
              <div className="py-10 flex justify-center">
                <Spinner size="lg" color="primary" />
              </div>
            ) : (
              <>
                <Users size={48} className="mx-auto text-default-300 mb-3" />
                <p className="text-default-500">
                  {searchTerm
                    ? "No admins match your search"
                    : "No admin accounts found"}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* ────────── Add Admin Modal ────────── */}
      <Modal
        isOpen={isAddOpen}
        onClose={closeAdd}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <UserPlus size={20} className="text-primary" />
            Add New Admin
          </ModalHeader>
          <ModalBody className="gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Full Name"
                placeholder="e.g. John Doe"
                value={newAdmin.name}
                onValueChange={(v) => {
                  setNewAdmin((p) => ({ ...p, name: v }));
                  setAddErrors((e) => {
                    const n = { ...e };
                    delete n.name;
                    return n;
                  });
                }}
                isRequired
                variant="bordered"
                isInvalid={!!addErrors.name}
                errorMessage={addErrors.name}
                startContent={<Users size={16} className="text-default-400" />}
              />
              <Input
                label="Username"
                placeholder="e.g. admin.user"
                value={newAdmin.username}
                onValueChange={(v) => {
                  setNewAdmin((p) => ({ ...p, username: v }));
                  setAddErrors((e) => {
                    const n = { ...e };
                    delete n.username;
                    return n;
                  });
                }}
                isRequired
                variant="bordered"
                isInvalid={!!addErrors.username}
                errorMessage={addErrors.username}
                startContent={<Users size={16} className="text-default-400" />}
              />
              <Select
                label="Role"
                selectedKeys={[newAdmin.role]}
                onChange={(e) =>
                  setNewAdmin((p) => ({
                    ...p,
                    role: e.target.value as AdminRole,
                  }))
                }
                variant="bordered"
                isRequired
                startContent={getRoleIcon(newAdmin.role)}
              >
                {availableRoles.map((role) => (
                  <SelectItem key={role.name}>{role.displayName}</SelectItem>
                ))}
              </Select>
              {isSuperAdmin ? (
                <Button variant="flat" color="secondary" onPress={openRole}>
                  New Role
                </Button>
              ) : null}
            </div>

            <Input
              label="Email Address"
              placeholder="admin@aotf.in"
              type="email"
              value={newAdmin.email}
              onValueChange={(v) => {
                setNewAdmin((p) => ({ ...p, email: v }));
                setAddErrors((e) => {
                  const n = { ...e };
                  delete n.email;
                  return n;
                });
              }}
              isRequired
              variant="bordered"
              isInvalid={!!addErrors.email}
              errorMessage={addErrors.email}
              startContent={<Mail size={16} className="text-default-400" />}
            />

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Password"
                placeholder="Min. 8 characters"
                type={showNewPassword ? "text" : "password"}
                value={newAdmin.password}
                onValueChange={(v) => {
                  setNewAdmin((p) => ({ ...p, password: v }));
                  setAddErrors((e) => {
                    const n = { ...e };
                    delete n.password;
                    return n;
                  });
                }}
                isRequired
                variant="bordered"
                isInvalid={!!addErrors.password}
                errorMessage={addErrors.password}
                startContent={<Lock size={16} className="text-default-400" />}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff size={16} className="text-default-400" />
                    ) : (
                      <Eye size={16} className="text-default-400" />
                    )}
                  </button>
                }
              />
              <Input
                label="Confirm Password"
                placeholder="Re-enter password"
                type={showNewPassword ? "text" : "password"}
                value={newAdmin.confirmPassword}
                onValueChange={(v) => {
                  setNewAdmin((p) => ({ ...p, confirmPassword: v }));
                  setAddErrors((e) => {
                    const n = { ...e };
                    delete n.confirmPassword;
                    return n;
                  });
                }}
                isRequired
                variant="bordered"
                isInvalid={!!addErrors.confirmPassword}
                errorMessage={addErrors.confirmPassword}
                startContent={<Lock size={16} className="text-default-400" />}
              />
            </div>

            <Divider />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield size={14} className="text-primary" />
                Permissions
              </div>
              <PermissionChecklist
                value={newAdminPermissions}
                onChange={setNewAdminPermissions}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeAdd} isDisabled={isAdding}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleAddAdmin}
              isLoading={isAdding}
            >
              Create Admin
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────── Create Role Modal ────────── */}
      <Modal
        isOpen={isRoleOpen}
        onClose={closeRole}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Create Role
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label="Role Name"
              placeholder="customer_relationship_manager"
              value={newRole.name}
              onValueChange={(v) => setNewRole((p) => ({ ...p, name: v }))}
              variant="bordered"
              isRequired
            />
            <Input
              label="Display Name"
              placeholder="Customer Relationship Manager"
              value={newRole.displayName}
              onValueChange={(v) =>
                setNewRole((p) => ({ ...p, displayName: v }))
              }
              variant="bordered"
              isRequired
            />
            <PermissionChecklist
              value={newRolePermissions}
              onChange={setNewRolePermissions}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={closeRole}
              isDisabled={isCreatingRole}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleCreateRole}
              isLoading={isCreatingRole}
            >
              Create Role
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────── Delete Confirmation Modal ────────── */}
      <Modal isOpen={isDeleteOpen} onClose={closeDelete}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={22} className="text-danger" />
              Delete Admin Account
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you want to permanently delete this admin account?
            </p>
            {deleteTarget && (
              <Card className="mt-2 bg-danger-50/50">
                <CardBody className="gap-1">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={deleteTarget.avatarUrl}
                      name={getInitials(deleteTarget.name)}
                      size="sm"
                      classNames={{
                        base:
                          deleteTarget.role === "super_admin"
                            ? "bg-danger/10"
                            : "bg-primary/10",
                        name:
                          deleteTarget.role === "super_admin"
                            ? "text-danger"
                            : "text-primary",
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {deleteTarget.name}
                      </p>
                      <p className="text-xs text-default-500">
                        {deleteTarget.email}
                      </p>
                    </div>
                  </div>
                  <Divider className="my-2" />
                  <p className="text-sm">
                    <span className="font-semibold">Role:</span>{" "}
                    <Chip
                      size="sm"
                      color={getRoleColor(deleteTarget.role)}
                      variant="flat"
                    >
                      {getRoleLabel(deleteTarget.role, roles)}
                    </Chip>
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">ID:</span>{" "}
                    <span className="text-default-500">{deleteTarget.id}</span>
                  </p>
                </CardBody>
              </Card>
            )}
            <p className="text-sm text-danger-500 mt-2">
              This action cannot be undone. The admin will lose all access
              immediately.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={closeDelete}
              isDisabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={confirmDelete}
              isLoading={isDeleting}
            >
              Delete Admin
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────── Change Password Modal ────────── */}
      <Modal isOpen={isPwdOpen} onClose={closePwd}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Lock size={20} className="text-warning" />
            Change Password
          </ModalHeader>
          <ModalBody className="gap-4">
            {pwdTarget && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-default-50">
                <Avatar
                  src={pwdTarget.avatarUrl}
                  name={getInitials(pwdTarget.name)}
                  size="sm"
                  classNames={{
                    base:
                      pwdTarget.role === "super_admin"
                        ? "bg-danger/10"
                        : "bg-primary/10",
                    name:
                      pwdTarget.role === "super_admin"
                        ? "text-danger"
                        : "text-primary",
                  }}
                />
                <div>
                  <p className="text-sm font-semibold">{pwdTarget.name}</p>
                  <p className="text-xs text-default-500">{pwdTarget.email}</p>
                </div>
              </div>
            )}

            <Input
              label="Current Password"
              type={showOldPwd ? "text" : "password"}
              value={pwdForm.oldPassword}
              onValueChange={(v) => {
                setPwdForm((p) => ({ ...p, oldPassword: v }));
                setPwdErrors((e) => {
                  const n = { ...e };
                  delete n.oldPassword;
                  return n;
                });
              }}
              isRequired
              variant="bordered"
              isInvalid={!!pwdErrors.oldPassword}
              errorMessage={pwdErrors.oldPassword}
              startContent={<Lock size={16} className="text-default-400" />}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowOldPwd(!showOldPwd)}
                >
                  {showOldPwd ? (
                    <EyeOff size={16} className="text-default-400" />
                  ) : (
                    <Eye size={16} className="text-default-400" />
                  )}
                </button>
              }
            />

            <Input
              label="New Password"
              type={showNewPwd ? "text" : "password"}
              value={pwdForm.newPassword}
              onValueChange={(v) => {
                setPwdForm((p) => ({ ...p, newPassword: v }));
                setPwdErrors((e) => {
                  const n = { ...e };
                  delete n.newPassword;
                  return n;
                });
              }}
              isRequired
              variant="bordered"
              isInvalid={!!pwdErrors.newPassword}
              errorMessage={pwdErrors.newPassword}
              description="Minimum 8 characters"
              startContent={<Lock size={16} className="text-default-400" />}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                >
                  {showNewPwd ? (
                    <EyeOff size={16} className="text-default-400" />
                  ) : (
                    <Eye size={16} className="text-default-400" />
                  )}
                </button>
              }
            />

            <Input
              label="Confirm New Password"
              type={showNewPwd ? "text" : "password"}
              value={pwdForm.confirmPassword}
              onValueChange={(v) => {
                setPwdForm((p) => ({ ...p, confirmPassword: v }));
                setPwdErrors((e) => {
                  const n = { ...e };
                  delete n.confirmPassword;
                  return n;
                });
              }}
              isRequired
              variant="bordered"
              isInvalid={!!pwdErrors.confirmPassword}
              errorMessage={pwdErrors.confirmPassword}
              startContent={<Lock size={16} className="text-default-400" />}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={closePwd}
              isDisabled={isChangingPwd}
            >
              Cancel
            </Button>
            <Button
              color="warning"
              variant="flat"
              onPress={handleChangePassword}
              isLoading={isChangingPwd}
            >
              Update Password
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────── Permissions Modal ────────── */}
      <Modal
        isOpen={isPermOpen}
        onClose={closePerm}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Edit Permissions
          </ModalHeader>
          <ModalBody className="gap-4">
            {permTarget ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-default-50">
                <Avatar
                  src={permTarget.avatarUrl}
                  name={getInitials(permTarget.name)}
                  size="sm"
                  classNames={{
                    base:
                      permTarget.role === "super_admin"
                        ? "bg-danger/10"
                        : "bg-primary/10",
                    name:
                      permTarget.role === "super_admin"
                        ? "text-danger"
                        : "text-primary",
                  }}
                />
                <div>
                  <p className="text-sm font-semibold">{permTarget.name}</p>
                  <p className="text-xs text-default-500">{permTarget.email}</p>
                </div>
              </div>
            ) : null}

            <PermissionChecklist
              value={permState}
              onChange={setPermState}
              disabled={!isSuperAdmin}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={closePerm}
              isDisabled={isSavingPerms}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSavePermissions}
              isLoading={isSavingPerms}
              isDisabled={!isSuperAdmin}
            >
              Save Permissions
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ─── Admin Card Sub-component ─────────────────────────────────────────────────

function AdminCard({
  admin,
  roles,
  onDelete,
  onChangePassword,
  onPermissions,
  onToggleStatus,
  onCopyId,
  canDelete,
  canEditPermissions,
}: {
  admin: AdminAccount;
  roles: AdminRoleOption[];
  onDelete: (a: AdminAccount) => void;
  onChangePassword: (a: AdminAccount) => void;
  onPermissions: (a: AdminAccount) => void;
  onToggleStatus: (a: AdminAccount) => void;
  onCopyId: (id: string) => void;
  canDelete: boolean;
  canEditPermissions: boolean;
}) {
  const isActive = admin.status === "active";
  const roleLabel = getRoleLabel(admin.role, roles);
  const roleColor = getRoleColor(admin.role);
  const roleIcon = getRoleIcon(admin.role);

  return (
    <Card className="border border-divider/50 hover:shadow-md transition-shadow">
      <CardHeader className="pb-1">
        <div className="flex items-center gap-3 w-full">
          <Avatar
            src={admin.avatarUrl}
            name={getInitials(admin.name)}
            size="md"
            classNames={{
              base: `${admin.role === "super_admin" ? "bg-danger/10" : "bg-primary/10"}`,
              name: `text-sm font-bold ${admin.role === "super_admin" ? "text-danger" : "text-primary"}`,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-default-900 truncate">
                {admin.name}
              </h3>
              <Chip
                size="sm"
                color={isActive ? "success" : "default"}
                variant="dot"
                classNames={{ content: "text-xs" }}
              >
                {isActive ? "Active" : "Inactive"}
              </Chip>
            </div>
            <div className="flex items-center gap-1.5">
              <Chip
                size="sm"
                color={roleColor}
                variant="flat"
                startContent={roleIcon}
                classNames={{ content: "text-xs" }}
              >
                {roleLabel}
              </Chip>
              <button
                onClick={() => onCopyId(admin.id)}
                className="flex items-center gap-0.5 text-[11px] text-default-400 hover:text-primary transition-colors"
              >
                <Copy size={10} />
                {admin.id}
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody className="pt-1 pb-2 space-y-2">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-default-400 shrink-0" />
            <span className="text-default-600 truncate">{admin.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-default-400 shrink-0" />
            <span className="text-default-600">@{admin.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-default-400 shrink-0" />
            <span className="text-default-500 text-xs">
              Last login: {formatDateTime(admin.lastLogin)}
            </span>
          </div>
        </div>
        <p className="text-xs text-default-400">
          Created {formatDate(admin.createdAt)}
        </p>
      </CardBody>

      <CardFooter className="gap-2 pt-0">
        <Button
          size="sm"
          variant="flat"
          color={isActive ? "warning" : "success"}
          onPress={() => onToggleStatus(admin)}
          className="flex-1"
        >
          {isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button
          size="sm"
          variant="flat"
          color="secondary"
          startContent={<Lock size={14} />}
          onPress={() => onChangePassword(admin)}
          className="flex-1"
        >
          Password
        </Button>
        <Button
          size="sm"
          variant="flat"
          color="primary"
          startContent={<Shield size={14} />}
          onPress={() => onPermissions(admin)}
          className="flex-1"
          isDisabled={!canEditPermissions}
        >
          Permissions
        </Button>
        <Tooltip
          content={
            canDelete ? "Delete admin" : "Cannot delete the only super admin"
          }
          color={canDelete ? "danger" : "default"}
        >
          <span>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              isIconOnly
              onPress={() => onDelete(admin)}
              isDisabled={!canDelete}
            >
              <Trash2 size={14} />
            </Button>
          </span>
        </Tooltip>
      </CardFooter>
    </Card>
  );
}

function PermissionChecklist({
  value,
  onChange,
  disabled,
}: {
  value: Record<AdminPermissionKey, boolean>;
  onChange: (next: Record<AdminPermissionKey, boolean>) => void;
  disabled?: boolean;
}) {
  const groups = ADMIN_PERMISSION_CATALOG.reduce<
    Record<string, Array<{ key: AdminPermissionKey; label: string }>>
  >((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push({ key: item.key, label: item.label });
    return acc;
  }, {});

  const groupLabels: Record<string, string> = {
    users: "User management",
    content: "Content management",
    support: "Support",
    finance: "Finance",
    analytics: "Analytics",
    admin: "Admin management",
  };

  return (
    <div className="space-y-4">
      {Object.keys(groups).map((groupKey) => (
        <Card key={groupKey} className="bg-default-50">
          <CardHeader className="pb-2">
            <h4 className="text-sm font-semibold">
              {groupLabels[groupKey] ?? groupKey}
            </h4>
          </CardHeader>
          <CardBody className="pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
            {groups[groupKey].map((perm) => (
              <Switch
                key={perm.key}
                isSelected={Boolean(value[perm.key])}
                onValueChange={(checked) =>
                  onChange({
                    ...value,
                    [perm.key]: checked,
                  })
                }
                isDisabled={disabled}
                size="sm"
              >
                {perm.label}
              </Switch>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: General Settings
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: Notification Settings
// ═════════════════════════════════════════════════════════════════════════════

function NotificationSettingsSection() {
  const [notifications, setNotifications] = useState({
    emailNewEnquiry: true,
    emailEnquiryStatusChange: true,
    emailNewApplication: true,
    emailDailyDigest: false,
    smsNewEnquiry: true,
    smsUrgentAlerts: true,
    smsApplicationUpdate: false,
    pushNewEnquiry: true,
    pushNewApplication: true,
    pushAdExpiry: true,
    pushSystemAlerts: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const toggleNotification = (key: string) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: wire to real API
      await new Promise((r) => setTimeout(r, 600));
      addToast({
        description: "Notification preferences saved",
        color: "success",
      });
      setIsDirty(false);
    } catch {
      addToast({
        description: "Failed to save preferences",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Save bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-3 rounded-lg bg-warning-50 border border-warning-200"
          >
            <p className="text-sm text-warning-700 font-medium">
              You have unsaved changes
            </p>
            <Button
              size="sm"
              color="primary"
              startContent={<Save size={14} />}
              onPress={handleSave}
              isLoading={isSaving}
            >
              Save Changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Email Notifications</h3>
              <p className="text-xs text-default-500">
                Choose which emails you want to receive
              </p>
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="gap-0">
          <NotificationToggle
            label="New Enquiry Received"
            description="Get notified when a new enquiry is submitted"
            icon={<MessageSquare size={16} className="text-primary" />}
            isSelected={notifications.emailNewEnquiry}
            onToggle={() => toggleNotification("emailNewEnquiry")}
          />
          <Divider />
          <NotificationToggle
            label="Enquiry Status Change"
            description="Notifications when enquiry status is updated"
            icon={<CheckCircle2 size={16} className="text-success" />}
            isSelected={notifications.emailEnquiryStatusChange}
            onToggle={() => toggleNotification("emailEnquiryStatusChange")}
          />
          <Divider />
          <NotificationToggle
            label="New Application"
            description="When a teacher or candidate applies to a post"
            icon={<Users size={16} className="text-warning" />}
            isSelected={notifications.emailNewApplication}
            onToggle={() => toggleNotification("emailNewApplication")}
          />
          <Divider />
          <NotificationToggle
            label="Daily Digest"
            description="A summary of all activities sent every morning"
            icon={<Clock size={16} className="text-secondary" />}
            isSelected={notifications.emailDailyDigest}
            onToggle={() => toggleNotification("emailDailyDigest")}
          />
        </CardBody>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/10">
              <Smartphone size={18} className="text-success" />
            </div>
            <div>
              <h3 className="text-base font-semibold">SMS Notifications</h3>
              <p className="text-xs text-default-500">
                SMS alerts for critical events
              </p>
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="gap-0">
          <NotificationToggle
            label="New Enquiry Alert"
            description="SMS when a new enquiry comes in"
            icon={<MessageSquare size={16} className="text-success" />}
            isSelected={notifications.smsNewEnquiry}
            onToggle={() => toggleNotification("smsNewEnquiry")}
          />
          <Divider />
          <NotificationToggle
            label="Urgent Alerts"
            description="Critical system and payment alerts via SMS"
            icon={<AlertTriangle size={16} className="text-danger" />}
            isSelected={notifications.smsUrgentAlerts}
            onToggle={() => toggleNotification("smsUrgentAlerts")}
          />
          <Divider />
          <NotificationToggle
            label="Application Updates"
            description="SMS when applications are approved or declined"
            icon={<CheckCircle2 size={16} className="text-primary" />}
            isSelected={notifications.smsApplicationUpdate}
            onToggle={() => toggleNotification("smsApplicationUpdate")}
          />
        </CardBody>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning/10">
              <BellRing size={18} className="text-warning" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Push Notifications</h3>
              <p className="text-xs text-default-500">
                In-app and browser push notifications
              </p>
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="gap-0">
          <NotificationToggle
            label="New Enquiry"
            description="Push notification for new enquiries"
            icon={<MessageSquare size={16} className="text-warning" />}
            isSelected={notifications.pushNewEnquiry}
            onToggle={() => toggleNotification("pushNewEnquiry")}
          />
          <Divider />
          <NotificationToggle
            label="New Application"
            description="Push when someone applies to a post"
            icon={<Users size={16} className="text-primary" />}
            isSelected={notifications.pushNewApplication}
            onToggle={() => toggleNotification("pushNewApplication")}
          />
          <Divider />
          <NotificationToggle
            label="Ad Expiry Reminder"
            description="Reminder when an ad is about to expire"
            icon={<Clock size={16} className="text-danger" />}
            isSelected={notifications.pushAdExpiry}
            onToggle={() => toggleNotification("pushAdExpiry")}
          />
          <Divider />
          <NotificationToggle
            label="System Alerts"
            description="Critical system alerts and downtime warnings"
            icon={<AlertTriangle size={16} className="text-danger" />}
            isSelected={notifications.pushSystemAlerts}
            onToggle={() => toggleNotification("pushSystemAlerts")}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function TermsSettingsSection() {
  const policies = [
    {
      label: "Terms of Service",
      description:
        "Review the platform terms used across onboarding and contracts.",
      href: "/terms",
      icon: <FileText size={18} className="text-primary" />,
    },
    {
      label: "Privacy Policy",
      description: "Confirm data handling disclosures and retention policies.",
      href: "/privacy-policy",
      icon: <Shield size={18} className="text-success" />,
    },
    {
      label: "Refund Policy",
      description:
        "Check refund rules applied to paid registrations and disputes.",
      href: "/refund-policy",
      icon: <RotateCcw size={18} className="text-warning" />,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-default-500" />
            <h3 className="text-base font-semibold">Policies & Documents</h3>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          {policies.map((policy) => (
            <div
              key={policy.label}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-default-100 p-2">
                  {policy.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-default-900">
                    {policy.label}
                  </p>
                  <p className="text-xs text-default-500">
                    {policy.description}
                  </p>
                </div>
              </div>
              <Button
                variant="flat"
                color="primary"
                size="sm"
                onPress={() =>
                  window.open(policy.href, "_blank", "noopener,noreferrer")
                }
              >
                View
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card className="bg-default-50">
        <CardBody className="space-y-2 text-sm text-default-600">
          <p className="font-medium text-default-700">Support contacts</p>
          <p>Email: {siteConfig.contact.email}</p>
          <p>Phone: {siteConfig.contact.phone}</p>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Notification Toggle Row ──────────────────────────────────────────────────

function NotificationToggle({
  label,
  description,
  icon,
  isSelected,
  onToggle,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-default-100">{icon}</div>
        <div>
          <p className="text-sm font-medium text-default-800">{label}</p>
          <p className="text-xs text-default-500">{description}</p>
        </div>
      </div>
      <Switch
        isSelected={isSelected}
        onValueChange={onToggle}
        size="sm"
        color="primary"
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: Consultancy Terms
// ═════════════════════════════════════════════════════════════════════════════

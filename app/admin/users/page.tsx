"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Pagination } from "@heroui/pagination";
import { addToast } from "@heroui/toast";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Globe,
  RefreshCw,
  Ban,
  BadgeCheck,
  Trash2,
  CheckCircle2,
  XCircle,
  CreditCard,
  UserCheck,
} from "lucide-react";
import AdminSearchBar from "@/components/admin/ui/AdminSearchBar";
import { reportClientError } from "@/lib/client-report-error";
import { formatPhone } from "@/lib/utils/phone";
import { Chip } from "@heroui/chip";

type Role = "teacher" | "candidate";
type Status = "all" | "active" | "blocked" | "deleted";

type UserData = {
  id: string;
  clerkId: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  whatsapp?: string | null;
  role: Role;
  createdAt: string;
  updatedAt?: string;
  status?: "active" | "inactive";
  statusValue: "active" | "blocked" | "deleted";
  onboardingCompleted: boolean;
  detailsCompleted: boolean;
  paymentCompleted: boolean;
  whatsappGroupCompleted: boolean;
  createdByAdmin: boolean;
  createdByAdminClerkId: string | null;
  createdByAdminUsername: string | null;
  hasTuitionAccess: boolean;
  hasCandidateAccess: boolean;
  avatarUrl?: string | null;
  lastLogin?: string | null;
  profileUrl: string;
  verifyUrl: string;
  location?: string | null;
  qualification?: string | null;
  board?: string | null;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SummaryState = {
  total: number;
  active: number;
  blocked: number;
  deleted: number;
  teachers: number;
  candidates: number;
};

type ApiUser = {
  id: string;
  clerkId: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  role: "teacher" | "teacher_candidate";
  status: "active" | "blocked" | "deleted";
  onboardingCompleted: boolean;
  detailsCompleted: boolean;
  paymentCompleted: boolean;
  whatsappGroupCompleted: boolean;
  createdByAdmin: boolean;
  createdByAdminClerkId: string | null;
  createdByAdminUsername: string | null;
  hasTuitionAccess: boolean;
  hasCandidateAccess: boolean;
  avatarUrl: string | null;
  lastLogin: string | null;
  profileUrl: string;
  verifyUrl: string;
  location: string | null;
  qualification: string | null;
  board: string | null;
  createdAt: string;
  updatedAt: string;
};

type RolePagePayload = {
  users: ApiUser[];
  pagination: PaginationState;
};

type BundleResponse = {
  summary?: SummaryState;
  byRole?: {
    teacher: RolePagePayload;
    candidate: RolePagePayload;
  };
  error?: string;
};

type PageResponse = {
  users: ApiUser[];
  summary?: SummaryState;
  pagination?: PaginationState;
  error?: string;
};

const statusLabels: Record<Exclude<Status, "all">, string> = {
  active: "Active",
  blocked: "Blocked",
  deleted: "Deleted",
};

const PAGE_SIZE = 10;

function toFriendlyRole(role: string): Role {
  return role === "teacher_candidate" ? "candidate" : "teacher";
}

function mapUser(user: ApiUser): UserData {
  return {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    username: user.username,
    email: user.email ?? "—",
    phone: user.phone,
    whatsapp: user.whatsapp,
    role: toFriendlyRole(user.role),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    statusValue: user.status,
    status: user.status === "active" ? "active" : "inactive",
    onboardingCompleted: user.onboardingCompleted,
    detailsCompleted: user.detailsCompleted ?? false,
    paymentCompleted: user.paymentCompleted ?? false,
    whatsappGroupCompleted: user.whatsappGroupCompleted ?? false,
    createdByAdmin: user.createdByAdmin ?? false,
    createdByAdminClerkId: user.createdByAdminClerkId ?? null,
    createdByAdminUsername: user.createdByAdminUsername ?? null,
    hasTuitionAccess: user.hasTuitionAccess ?? false,
    hasCandidateAccess: user.hasCandidateAccess ?? false,
    avatarUrl: user.avatarUrl,
    lastLogin: user.lastLogin,
    profileUrl: user.profileUrl,
    verifyUrl: user.verifyUrl,
    location: user.location,
    qualification: user.qualification,
    board: user.board,
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function cacheKey(role: Role, page: number, status: Status, search: string) {
  return `${role}:${page}:${status}:${search}`;
}

export default function UsersPage() {
  const [selectedTab, setSelectedTab] = useState<Role>("teacher");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageByRole, setPageByRole] = useState<Record<Role, number>>({
    teacher: 1,
    candidate: 1,
  });
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [usersByRole, setUsersByRole] = useState<Record<Role, UserData[]>>({
    teacher: [],
    candidate: [],
  });
  const [paginationByRole, setPaginationByRole] = useState<
    Record<Role, PaginationState>
  >({
    teacher: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 },
    candidate: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 },
  });

  const pageCache = useRef<Map<string, UserData[]>>(new Map());
  const paginationCache = useRef<Map<string, PaginationState>>(new Map());
  const filterKey = useMemo(
    () => `${statusFilter}:${debouncedSearch}`,
    [statusFilter, debouncedSearch],
  );

  const currentPage = pageByRole[selectedTab];
  const users = usersByRole[selectedTab];
  const pagination = paginationByRole[selectedTab];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const applyRolePage = useCallback(
    (role: Role, payload: RolePagePayload, page: number) => {
      const mapped = payload.users.map(mapUser);
      const key = cacheKey(role, page, statusFilter, debouncedSearch);
      pageCache.current.set(key, mapped);
      paginationCache.current.set(key, payload.pagination);

      setUsersByRole((prev) => ({ ...prev, [role]: mapped }));
      setPaginationByRole((prev) => ({ ...prev, [role]: payload.pagination }));
      setPageByRole((prev) => ({ ...prev, [role]: payload.pagination.page }));
    },
    [statusFilter, debouncedSearch],
  );

  const loadBundle = useCallback(
    async (sync: boolean, silent = false) => {
      silent ? setIsRefreshing(true) : setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("bundle", "1");
        if (sync) params.set("sync", "1");
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (debouncedSearch.trim())
          params.set("search", debouncedSearch.trim());

        const res = await fetch(`/api/admin/app-users?${params.toString()}`);
        const data = (await res.json().catch(() => ({}))) as BundleResponse;

        if (!res.ok) {
          throw new Error(data.error || "Failed to load users");
        }

        pageCache.current.clear();
        paginationCache.current.clear();
        setPageByRole({ teacher: 1, candidate: 1 });
        setSummary(data.summary ?? null);

        if (data.byRole?.teacher) {
          applyRolePage("teacher", data.byRole.teacher, 1);
        }
        if (data.byRole?.candidate) {
          applyRolePage("candidate", data.byRole.candidate, 1);
        }
      } catch (err) {
        reportClientError(err, { feature: "admin-users" });
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [applyRolePage, debouncedSearch, statusFilter],
  );

  const loadRolePage = useCallback(
    async (role: Role, page: number, silent = false) => {
      const key = cacheKey(role, page, statusFilter, debouncedSearch);
      const cachedUsers = pageCache.current.get(key);
      const cachedPagination = paginationCache.current.get(key);

      if (cachedUsers && cachedPagination) {
        setUsersByRole((prev) => ({ ...prev, [role]: cachedUsers }));
        setPaginationByRole((prev) => ({ ...prev, [role]: cachedPagination }));
        setPageByRole((prev) => ({ ...prev, [role]: cachedPagination.page }));
        return;
      }

      silent ? setIsRefreshing(true) : setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("role", role);
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (debouncedSearch.trim())
          params.set("search", debouncedSearch.trim());

        const res = await fetch(`/api/admin/app-users?${params.toString()}`);
        const data = (await res.json().catch(() => ({}))) as PageResponse;

        if (!res.ok) {
          throw new Error(data.error || "Failed to load users");
        }

        if (data.summary) setSummary(data.summary);
        if (data.users && data.pagination) {
          applyRolePage(
            role,
            { users: data.users, pagination: data.pagination },
            page,
          );
        }
      } catch (err) {
        reportClientError(err, { feature: "admin-users" });
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [applyRolePage, debouncedSearch, statusFilter],
  );

  useEffect(() => {
    void loadBundle(false);
  }, [filterKey, loadBundle]);

  useEffect(() => {
    const onRefresh = () => void loadBundle(true, true);
    window.addEventListener("admin-users-refresh", onRefresh);
    return () => window.removeEventListener("admin-users-refresh", onRefresh);
  }, [loadBundle]);

  const handleTabChange = (key: React.Key) => {
    const role = key as Role;
    setSelectedTab(role);
    const page = pageByRole[role];
    const keyStr = cacheKey(role, page, statusFilter, debouncedSearch);
    const cachedUsers = pageCache.current.get(keyStr);
    const cachedPagination = paginationCache.current.get(keyStr);

    if (cachedUsers && cachedPagination) {
      setUsersByRole((prev) => ({ ...prev, [role]: cachedUsers }));
      setPaginationByRole((prev) => ({ ...prev, [role]: cachedPagination }));
      return;
    }

    void loadRolePage(role, page);
  };

  const handlePageChange = (nextPage: number) => {
    setPageByRole((prev) => ({ ...prev, [selectedTab]: nextPage }));
    void loadRolePage(selectedTab, nextPage);
  };

  const handleStatusChange = async (
    userId: string,
    nextStatus: "active" | "blocked" | "deleted",
  ) => {
    setActioningId(userId);
    try {
      const res = await fetch(`/api/admin/app-users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to update user status");
      }

      addToast({
        description: `User ${statusLabels[nextStatus]} successfully`,
        color: "success",
      });
      void loadBundle(false, true);
    } catch (err) {
      reportClientError(err, {
        feature: "admin-users",
        extra: { action: "update-status" },
      });
      addToast({
        description:
          err instanceof Error ? err.message : "Failed to update user",
        color: "danger",
      });
    } finally {
      setActioningId(null);
    }
  };

  const handleRecoverPayment = async (userId: string) => {
    setActioningId(userId);
    try {
      const res = await fetch(
        `/api/admin/app-users/${userId}/recover-payment`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to recover payment");
      }

      addToast({
        description: "Payment marked as complete",
        color: "success",
      });
      void loadBundle(false, true);
    } catch (err) {
      reportClientError(err, {
        feature: "admin-users",
        extra: { action: "recover-payment" },
      });
      addToast({
        description:
          err instanceof Error ? err.message : "Failed to recover payment",
        color: "danger",
      });
    } finally {
      setActioningId(null);
    }
  };

  const tabSummary =
    selectedTab === "teacher"
      ? {
          total: summary?.teachers ?? 0,
          active: users.filter((u) => u.statusValue === "active").length,
        }
      : {
          total: summary?.candidates ?? 0,
          active: users.filter((u) => u.statusValue === "active").length,
        };

  return (
    <div className="w-full space-y-2 px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users Management</h1>
          <p className="text-sm text-default-500 mt-1">
            Manage real teacher and candidate accounts
          </p>
        </div>
      </div>
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={handleTabChange}
        aria-label="User roles"
        color="primary"
        className="w-full justify-center"
      >
        <Tab key="teacher" title={`Teachers (${summary?.teachers ?? 0})`} />
        <Tab
          key="candidate"
          title={`Candidates (${summary?.candidates ?? 0})`}
        />
      </Tabs>
      <AdminSearchBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by name, username, email or phone…"
        onClearAll={() => {
          setSearchQuery("");
          setStatusFilter("all");
        }}
      />

      <div className="flex justify-between items-center gap-2">
        <Select
          label="Status"
          placeholder="Filter by status"
          selectedKeys={[statusFilter]}
          className="max-w-full"
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as Status | undefined;
            setStatusFilter(value ?? "all");
          }}
        >
          <SelectItem key="all">All statuses</SelectItem>
          <SelectItem key="active">Active</SelectItem>
          <SelectItem key="deleted">Deleted</SelectItem>
        </Select>
        <Button
          isIconOnly
          size="lg"
          variant="flat"
          color="primary"
          startContent={<RefreshCw size={16} />}
          isLoading={isRefreshing}
          onPress={() => void loadBundle(true, true)}
        />
      </div>

      <div className="flex gap-2 text-xs text-default-500 ">
        <span className="rounded-full bg-default-100 px-3 py-1">
          {tabSummary.total} {selectedTab}s
        </span>
        <span className="rounded-full bg-default-100 px-3 py-1">
          {summary?.active ?? 0} active
        </span>
        <span className="rounded-full bg-default-100 px-3 py-1">
          {summary?.deleted ?? 0} deleted
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-default-500">
          {isRefreshing ? "Loading users…" : "Syncing and loading users…"}
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {users.map((user) => (
            <Card key={user.id} className="w-full border border-default-200">
              <CardHeader className="flex gap-3">
                <div className="w-full flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary font-semibold">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(user.name) || (
                          <User className="text-primary" size={24} />
                        )
                      )}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-md font-semibold">{user.name}</p>
                      <p className="text-small text-default-500 capitalize">
                        {user.role}
                      </p>
                      <p className="text-tiny text-default-400">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  <Chip
                    size="sm"
                    variant="flat"
                    color={
                      user.statusValue === "active"
                        ? "success"
                        : user.statusValue === "blocked"
                          ? "warning"
                          : "default"
                    }
                  >
                    {statusLabels[user.statusValue]}
                  </Chip>
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-default-400" />
                  <span className="text-default-600">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-default-400" />
                  <span className="text-default-600">
                    {user.phone ? formatPhone(user.phone) : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-default-400" />
                  <span className="text-default-600">
                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw size={16} className="text-default-400" />
                  <span className="text-default-600">
                    Last login:{" "}
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={16} className="text-default-400" />
                  <span className="text-default-600">
                    Onboarding:{" "}
                    {user.onboardingCompleted ? "Complete" : "Pending"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={user.detailsCompleted ? "success" : "default"}
                    startContent={
                      user.detailsCompleted ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <XCircle size={13} />
                      )
                    }
                  >
                    Details {user.detailsCompleted ? "complete" : "pending"}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={user.paymentCompleted ? "success" : "warning"}
                    startContent={
                      user.paymentCompleted ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <XCircle size={13} />
                      )
                    }
                  >
                    Payment {user.paymentCompleted ? "complete" : "pending"}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={user.whatsappGroupCompleted ? "success" : "default"}
                    startContent={
                      user.whatsappGroupCompleted ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <XCircle size={13} />
                      )
                    }
                  >
                    WhatsApp{" "}
                    {user.whatsappGroupCompleted ? "joined" : "pending"}
                  </Chip>
                </div>
                {user.createdByAdmin && (
                  <div className="flex items-center gap-2 text-sm text-default-500">
                    <UserCheck size={16} className="text-default-400" />
                    <span>
                      Created by admin
                      {user.createdByAdminUsername
                        ? `: ${user.createdByAdminUsername}`
                        : ""}
                    </span>
                  </div>
                )}
              </CardBody>
              <CardFooter className="gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="flex-1"
                  as="a"
                  href={user.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Profile
                </Button>
                {user.statusValue !== "deleted" ? (
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    startContent={<Trash2 size={16} />}
                    isLoading={actioningId === user.id}
                    onPress={() => {
                      if (
                        window.confirm(
                          `Delete ${user.name}? This will mark the account as deleted.`,
                        )
                      ) {
                        void handleStatusChange(user.id, "deleted");
                      }
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
              </CardFooter>
              <CardFooter className="gap-2 pt-0">
                {!user.paymentCompleted && user.statusValue !== "deleted" ? (
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<CreditCard size={16} />}
                    isLoading={actioningId === user.id}
                    onPress={() => {
                      if (window.confirm(`Recover payment for ${user.name}?`)) {
                        void handleRecoverPayment(user.id);
                      }
                    }}
                  >
                    Recover payment
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <div className="text-center py-12">
          <User size={48} className="mx-auto text-default-300 mb-4" />
          <p className="text-default-500">
            No {selectedTab}s found for the current filters.
          </p>
        </div>
      )}

      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex justify-center py-4">
          <Pagination
            total={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            showControls
          />
        </div>
      )}
    </div>
  );
}

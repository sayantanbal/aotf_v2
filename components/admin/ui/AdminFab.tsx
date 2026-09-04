"use client";

/**
 * components/admin/ui/AdminFab.tsx
 *
 * Single FAB that performs a context-aware action based on the current URL: *   /admin/tuitions* → navigate to /admin/tuitions/create
 *   /admin/jobs*     → navigate to /admin/jobs/create
 *   /admin/ads*      → scroll to create-ad form on the page
 *   /admin/users*    → open Create User modal
 *   anywhere else    → hidden
 */

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Plus } from "lucide-react";
import { motion } from "motion/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "teacher" | "candidate";

const PAGE_ACTIONS = [
  { matchPath: "/admin/tuitions", action: "tuition" },
  { matchPath: "/admin/jobs", action: "job" },
  { matchPath: "/admin/ads", action: "ad" },
  { matchPath: "/admin/users", action: "user" },
] as const;

// Pages that render their own FAB — hide the global one to avoid duplicates
const SELF_MANAGED_FAB_PATHS = ["/admin/renowned-teachers", "/admin/settings"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminFab() {
  const router = useRouter();
  const pathname = usePathname();

  // User creation modal
  const {
    isOpen: isUserOpen,
    onOpen: openUser,
    onClose: closeUser,
  } = useDisclosure();
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "teacher" as Role,
  });
  const [isCreating, setIsCreating] = useState(false);
  // Pages that render their own FAB — suppress the global one
  if (SELF_MANAGED_FAB_PATHS.some((p) => pathname.startsWith(p))) return null;

  // Determine which action this page maps to (if any)
  const matched = PAGE_ACTIONS.find((p) => {
    // exact match only
    if (pathname === p.matchPath) return true;

    // allow query params but block subroutes like /create
    if (pathname.startsWith(p.matchPath + "?")) return true;

    return false;
  });

  // Don't render the FAB on unrelated pages
  if (!matched) return null;
  const handleFab = () => {
    if (matched.action === "tuition") router.push("/admin/tuitions/create");
    else if (matched.action === "job") router.push("/admin/jobs/create");
    else if (matched.action === "ad") {
      // Scroll to the create-ad form section on the ads page
      const el = document.getElementById("create-ad-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (matched.action === "user") openUser();
  };

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      addToast({
        description: "Name and email are required",
        color: "danger",
      });
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/app-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name.trim(),
          email: newUser.email.trim(),
          role: newUser.role,
          legalAcceptedAt: new Date().toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }
      addToast({
        description: `${newUser.role === "teacher" ? "Teacher" : "Candidate"} created successfully`,
        color: "success",
      });
      window.dispatchEvent(new CustomEvent("admin-users-refresh"));
      setNewUser({ name: "", email: "", role: "teacher" });
      closeUser();
    } catch (err) {
      addToast({
        description:
          err instanceof Error ? err.message : "Failed to create user",
        color: "danger",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <motion.button
        onClick={handleFab}
        aria-label="Quick action"
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full
          bg-linear-to-br from-indigo-500 to-purple-600
          text-white shadow-xl flex items-center justify-center
          hover:shadow-2xl transition-shadow"
      >
        <Plus size={26} />
      </motion.button>

      {/* Create User Modal */}
      <Modal isOpen={isUserOpen} onClose={closeUser} size="sm">
        <ModalContent>
          <ModalHeader>Create New User</ModalHeader>
          <ModalBody className="gap-3">
            <Input
              label="Full Name"
              placeholder="e.g. Anita Sharma"
              value={newUser.name}
              onValueChange={(v) => setNewUser((p) => ({ ...p, name: v }))}
              isRequired
              variant="bordered"
            />
            <Input
              label="Email"
              placeholder="user@example.com"
              type="email"
              value={newUser.email}
              onValueChange={(v) => setNewUser((p) => ({ ...p, email: v }))}
              isRequired
              variant="bordered"
            />
            <Select
              label="Role"
              selectedKeys={[newUser.role]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as Role | undefined;
                if (value) setNewUser((p) => ({ ...p, role: value }));
              }}
              isRequired
              variant="bordered"
            >
              <SelectItem key="teacher">Teacher</SelectItem>
              <SelectItem key="candidate">Candidate</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeUser} isDisabled={isCreating}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleCreateUser}
              isLoading={isCreating}
            >
              Create User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

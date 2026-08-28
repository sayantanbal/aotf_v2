"use client";

import { SignIn, useClerk, useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AdminLoginContent() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    let cancelled = false;

    const redirectWithError = async (
      error: "deactivated" | "locked" | "forbidden",
    ) => {
      if (cancelled) return;

      setIsSwitchingAccount(true);

      try {
        await signOut({ redirectUrl: `/admin/login?error=${error}` });
      } catch (signOutError) {
        console.error(
          "[admin-login] Failed to sign out current user:",
          signOutError,
        );
      }

      if (!cancelled) {
        router.replace(`/admin/login?error=${error}`);
      }
    };

    const ensureAdminAccess = async () => {
      if (!user?.publicMetadata || user.publicMetadata.isAdmin !== true) {
        await redirectWithError("forbidden");
        return;
      }

      try {
        const res = await fetch("/api/v1/admin/admins", { cache: "no-store" });
        if (res.ok) {
          if (!cancelled) {
            router.replace("/admin/tuitions");
          }
          return;
        }

        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const message = payload.error?.toLowerCase() ?? "";

        if (message.includes("deactivated")) {
          await redirectWithError("deactivated");
          return;
        }

        if (message.includes("locked")) {
          await redirectWithError("locked");
          return;
        }

        await redirectWithError("forbidden");
      } catch (error) {
        console.error("[admin-login] Failed to verify admin status:", error);
        await redirectWithError("forbidden");
      }
    };

    void ensureAdminAccess();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router, signOut, user]);

  if (!isLoaded || isSwitchingAccount) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p>
            {isSwitchingAccount
              ? "Switching from your current account to admin sign-in..."
              : "Loading admin sign-in..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      {error && (
        <div className="mb-6 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-900">
            Access Denied
          </h3>
          <p className="text-sm text-red-700">
            {error === "locked" && (
              <>
                Your account has been locked due to multiple failed login
                attempts or administrative action. Please contact the superadmin
                to unlock your account.
              </>
            )}
            {error === "deactivated" && (
              <>
                Your admin account has been deactivated. Please contact the
                superadmin for assistance.
              </>
            )}
            {error === "forbidden" && (
              <>
                You do not have admin access. Please use the regular login page.
              </>
            )}
          </p>
        </div>
      )}

      <div className="mb-4 text-center">
        <h1 className="mb-2 text-3xl font-bold">Admin Login</h1>
        <p className="text-gray-600">Sign in to access the admin panel</p>
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl="/admin/tuitions"
        fallbackRedirectUrl="/admin/tuitions"
        signUpUrl={"/admin/signup"}
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
          },
        }}
      />

      <div className="mt-6 max-w-md rounded-lg bg-yellow-50 p-4 text-center">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Security Notice:</strong> After 5 failed login attempts,
          your account will be locked. Only the superadmin can unlock it.
        </p>
      </div>
    </div>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          Loading...
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}

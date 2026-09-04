/**
 * GET /api/v1/cron/manage-unpaid-users
 *
 * Single daily cron (Vercel free-tier compatible) that handles two thresholds
 * in one pass:
 *
 *   25–29 days old → WARN (send deletion warning email, mark as warned)
 *   30+ days old   → PURGE (delete from Clerk, which fires user.deleted
 *                     webhook → MongoDB soft-delete)
 *
 * Auth: Bearer CRON_SECRET in the Authorization header.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";

import { reportError } from "@/lib/sentry-report";

const CRON_MONITOR_SLUG = "manage-unpaid-users";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: CRON_MONITOR_SLUG, status: "in_progress" },
    {
      schedule: { type: "crontab", value: "30 21 * * *" },
      checkinMargin: 5,
      maxRuntime: 30,
    },
  );

  await dbConnect();

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const twentyFiveDaysAgo = new Date(now - 25 * 24 * 60 * 60 * 1000);

  // Single query — all unpaid users older than 25 days
  const unpaidUsers = (
    await User.find(
      {
        status: "active",
        onboardingCompleted: false,
        registrationPaymentId: null,
        createdAt: { $lte: twentyFiveDaysAgo },
      },
      {
        clerkId: 1,
        _id: 1,
        username: 1,
        paymentCompleted: 1,
        createdAt: 1,
        deletionWarningEmailSentAt: 1,
      },
    ).lean()
  ).filter((user) => user.paymentCompleted !== true);

  if (unpaidUsers.length === 0) {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: CRON_MONITOR_SLUG,
      status: "ok",
    });
    return NextResponse.json({ warned: 0, deleted: 0, failed: [] });
  }

  const client = await clerkClient();
  const results = {
    warned: 0,
    deleted: 0,
    failed: [] as { clerkId: string; error: string }[],
  };

  for (const u of unpaidUsers) {
    const clerkId = u.clerkId as string;
    const isDue30Days = (u.createdAt as Date) <= thirtyDaysAgo;

    if (isDue30Days) {
      // ── PURGE — older than 30 days ──────────────────────────────
      try {
        await client.users.deleteUser(clerkId);
        results.deleted++;
        console.log(
          `[manage-unpaid] Purged ${clerkId} (created: ${(u.createdAt as Date).toISOString()})`,
        );
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? (err as { status: number }).status
            : null;
        if (status === 404) {
          // Already gone in Clerk — sync MongoDB manually
          await User.updateOne({ clerkId }, { status: "deleted" });
          results.deleted++;
          console.log(
            `[manage-unpaid] Clerk 404 — manually soft-deleted ${clerkId}`,
          );
        } else {
          results.failed.push({
            clerkId,
            error: err instanceof Error ? err.message : String(err),
          });
          console.error(`[manage-unpaid] Failed to purge ${clerkId}:`, err);
        }
      }
    } else if (!u.deletionWarningEmailSentAt) {
      // ── WARN — between 25–30 days, not yet warned ──────────────
      try {
        // TODO: Send warning email via your email provider (Resend, SES, etc.)
        // const clerkUser = await client.users.getUser(clerkId);
        // const email = clerkUser.emailAddresses[0]?.emailAddress;
        // const deletionDate = new Date((u.createdAt as Date).getTime() + 30*24*60*60*1000);
        // await sendDeletionWarningEmail({ email, username: u.username, deletionDate });

        await User.updateOne(
          { clerkId },
          { deletionWarningEmailSentAt: new Date() },
        );
        results.warned++;
        console.log(
          `[manage-unpaid] Warned ${clerkId} (created: ${(u.createdAt as Date).toISOString()})`,
        );
      } catch (err) {
        results.failed.push({
          clerkId,
          error: err instanceof Error ? err.message : String(err),
        });
        console.error(`[manage-unpaid] Failed to warn ${clerkId}:`, err);
      }
    }
    // else: warning already sent, between 25–30 days — skip, wait for 30-day mark
  }

  console.log(`[manage-unpaid] Results:`, results);

  if (results.failed.length > 0) {
    reportError(new Error("manage-unpaid-users cron had failures"), {
      tags: { layer: "cron", job: CRON_MONITOR_SLUG },
      extra: {
        failed: results.failed,
        warned: results.warned,
        deleted: results.deleted,
      },
    });
  }

  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: CRON_MONITOR_SLUG,
    status: results.failed.length > 0 ? "error" : "ok",
  });

  return NextResponse.json(results);
}

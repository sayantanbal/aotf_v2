import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import User from "@/lib/models/User";
import { logActivity } from "@/lib/admin/logActivity";
import { syncUserMetadataToClerk } from "@/lib/services/clerk-sync.service";

/**
 * POST /api/admin/app-users/[userId]/recover-payment
 * Marks a user's payment as complete and reconciles all access flags.
 * Requires `canRecoverPayments` permission (or super_admin).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  await dbConnect();

  const { userId: adminClerkId, sessionClaims } = await auth();
  if (!adminClerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve admin metadata
  let metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(adminClerkId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      // fall through
    }
  }

  if (metadata?.isAdmin !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentAdmin = await Admin.findOne({ clerkId: adminClerkId });
  if (!currentAdmin || !currentAdmin.isActive) {
    return NextResponse.json({ error: "Forbidden: admin not active" }, { status: 403 });
  }

  const canRecover =
    currentAdmin.role === "super_admin" ||
    Boolean(currentAdmin.permissions.canRecoverPayments);

  if (!canRecover) {
    return NextResponse.json(
      { error: "You don't have permission to recover payments" },
      { status: 403 },
    );
  }

  const { userId } = await params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const userDoc = await User.findById(userId);
  if (!userDoc) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (userDoc.paymentCompleted) {
    return NextResponse.json({
      ok: true,
      message: "Payment already marked as complete — no change.",
      idempotent: true,
    });
  }

  userDoc.paymentCompleted = true;
  await userDoc.save(); // pre-save hook derives onboardingCompleted and access flags

  // Sync to Clerk
  void syncUserMetadataToClerk(userDoc.clerkId);

  // Audit log
  try {
    await logActivity({
      admin: currentAdmin,
      action: "payment_recovery",
      module: "USER_MGMT",
      targetType: "User",
      targetId: userDoc._id,
      metadata: {
        targetClerkId: userDoc.clerkId,
        recoveredBy: adminClerkId,
      },
    });
  } catch (logErr) {
    console.error("[recover-payment] Failed to write audit log:", logErr);
  }

  return NextResponse.json({
    ok: true,
    paymentCompleted: userDoc.paymentCompleted,
    onboardingCompleted: userDoc.onboardingCompleted,
    hasTuitionAccess: userDoc.hasTuitionAccess,
    hasCandidateAccess: userDoc.hasCandidateAccess,
  });
}

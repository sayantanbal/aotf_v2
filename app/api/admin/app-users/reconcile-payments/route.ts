import { auth, clerkClient } from "@clerk/nextjs/server";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import Profile from "@/lib/models/Profile";
import User from "@/lib/models/User";
import { logActivity } from "@/lib/admin/logActivity";
import { syncUserMetadataToClerk } from "@/lib/services/clerk-sync.service";
import { withApiErrorHandling } from "@/lib/api-utils";

type RazorpayPayment = {
  contact?: string | number | null;
  email?: string | null;
  status?: string | null;
};

type RazorpayPaymentList = { items?: RazorpayPayment[] };

function digits(value?: string | number | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function samePhone(left?: string | number | null, right?: string | number | null) {
  const leftDigits = digits(left);
  const rightDigits = digits(right);
  return (
    leftDigits.length >= 10 &&
    rightDigits.length >= 10 &&
    leftDigits.slice(-10) === rightDigits.slice(-10)
  );
}

function sameEmail(left?: string | null, right?: string | null) {
  return Boolean(
    left && right && left.trim().toLowerCase() === right.trim().toLowerCase(),
  );
}

function isSuccessfulPayment(payment: RazorpayPayment) {
  return payment.status === "captured" || payment.status === "authorized";
}

async function requirePaymentRecoveryAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      // Fall through to the database admin check.
    }
  }

  if (metadata?.isAdmin !== true) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const admin = await Admin.findOne({ clerkId: userId });
  if (!admin?.isActive) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: admin not active" },
        { status: 403 },
      ),
    };
  }
  if (admin.role !== "super_admin" && !admin.permissions.canRecoverPayments) {
    return {
      error: NextResponse.json(
        { error: "You don't have permission to recover payments" },
        { status: 403 },
      ),
    };
  }

  return { admin };
}

async function post() {
  await dbConnect();
  const access = await requirePaymentRecoveryAdmin();
  if (access.error) return access.error;

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  const pendingUsers = (await User.find({ paymentCompleted: false }).select(
    "_id clerkId status role",
  )).filter(
    (user) =>
      user.status !== "deleted" &&
      (user.role === "teacher" || user.role === "teacher_candidate"),
  );
  const client = await clerkClient();
  const paymentCache = new Map<string, RazorpayPayment[]>();
  const matched: string[] = [];
  const searched = { phone: 0, email: 0 };
  let missingClerkUsers = 0;

  const findPayments = async (query: "contact" | "email", value: string) => {
    const cacheKey = `${query}:${value.toLowerCase()}`;
    const cached = paymentCache.get(cacheKey);
    if (cached) return cached;
    const result = (await razorpay.payments.all({
      [query]: value,
      count: 100,
    })) as RazorpayPaymentList;
    const payments = result.items ?? [];
    paymentCache.set(cacheKey, payments);
    return payments;
  };

  for (const user of pendingUsers) {
    const profile = await Profile.findOne({ clerkId: user.clerkId })
      .select("phone")
      .lean();
    const phone = profile?.phone;
    let paymentFound = false;
    let matchedBy: "phone" | "email" | null = null;

    if (phone && digits(phone).length >= 10) {
      searched.phone += 1;
      const phoneValue = `+91${digits(phone).slice(-10)}`;
      const payments = await findPayments("contact", phoneValue);
      paymentFound = payments.some(
        (payment) => isSuccessfulPayment(payment) && samePhone(payment.contact, phone),
      );
      if (paymentFound) matchedBy = "phone";
    }

    if (!paymentFound) {
      let clerkUser;
      try {
        clerkUser = await client.users.getUser(user.clerkId);
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          missingClerkUsers += 1;
          continue;
        }
        throw error;
      }
      const email =
        clerkUser.emailAddresses.find(
          (item) => item.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
      if (email) {
        searched.email += 1;
        const payments = await findPayments("email", email);
        paymentFound = payments.some(
          (payment) => isSuccessfulPayment(payment) && sameEmail(payment.email, email),
        );
        if (paymentFound) matchedBy = "email";
      }
    }

    if (!paymentFound) continue;
    const userDoc = await User.findById(user._id);
    if (!userDoc || userDoc.paymentCompleted) continue;
    userDoc.paymentCompleted = true;
    await userDoc.save();
    void syncUserMetadataToClerk(userDoc.clerkId);
    matched.push(String(userDoc._id));
    await logActivity({
      admin: access.admin,
      action: "payment_reconciliation",
      module: "USER_MGMT",
      targetType: "User",
      targetId: userDoc._id,
      metadata: { targetClerkId: userDoc.clerkId, matchedBy },
    });
  }

  return NextResponse.json({
    ok: true,
    checked: pendingUsers.length,
    searched,
    matched: matched.length,
    missingClerkUsers,
  });
}

export const POST = withApiErrorHandling(
  post,
  "POST /api/admin/app-users/reconcile-payments",
);
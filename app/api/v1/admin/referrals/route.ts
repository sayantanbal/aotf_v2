import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import Referral from "@/lib/models/Referral";

async function requireAdmin(userId: string) {
  const { sessionClaims } = await auth();
  let metadata = sessionClaims?.publicMetadata as
    | Record<string, unknown>
    | undefined;

  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      metadata = undefined;
    }
  }

  if (metadata?.isAdmin !== true) {
    return false;
  }

  await dbConnect();
  const admin = await Admin.findOne({ clerkId: userId }, { role: 1 }).lean();
  return Boolean(admin);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requireAdmin(userId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const referrals = await Referral.find(
    {},
    { referralUserName: 1, referralPhoneNumber: 1 },
  ).lean();
  const counts = new Map<string, { label: string; phone: string; count: number }>();

  for (const referral of referrals) {
    const name = referral.referralUserName?.trim();
    const phone = referral.referralPhoneNumber?.trim();
    if (!name || !phone) continue;
    const key = `${name}||${phone}`;
    counts.set(key, {
      label: name,
      phone,
      count: (counts.get(key)?.count ?? 0) + 1,
    });
  }

  const options = Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, ...value }));

  return NextResponse.json({ referrals: options });
}

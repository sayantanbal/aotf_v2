import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Profile from "@/lib/models/Profile";
import Subject from "@/lib/models/Subject";
import User from "@/lib/models/User";
import { formatDisplayDate } from "@/lib/utils/display-date";
import { withApiErrorHandling } from "@/lib/api-utils";

type Role = "teacher" | "candidate";

function parseVerificationId(
  raw: string,
): { role: Role; username: string } | null {
  const decoded = decodeURIComponent(raw).trim();
  const match = /^AOTF-([TC])-(.+)$/i.exec(decoded);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  const role: Role = match[1].toUpperCase() === "C" ? "candidate" : "teacher";
  const username = match[2].trim().toLowerCase();

  if (!username || username.length > 30) {
    return null;
  }

  return { role, username };
}

function formatMaskedPhone(phone: string | null): string {
  if (!phone) return "—";

  const trimmed = phone.trim();
  if (!trimmed) return "—";

  // Keep already-masked values stable.
  if (/x/i.test(trimmed)) {
    return trimmed;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length < 3) {
    return "—";
  }

  const localNumber = digitsOnly.slice(-10);
  const countryDigits = digitsOnly.slice(0, -10);
  const countryCode = countryDigits ? `+${countryDigits}` : "+91";

  const visibleTail = localNumber.slice(-3);
  const maskedHead = "X".repeat(Math.max(localNumber.length - 3, 0));

  return `${countryCode} ${maskedHead}${visibleTail}`;
}

// ─── GET /api/v1/verify/[id] ─────────────────────────────────────────────────

async function get(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = parseVerificationId(id);
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: "ID not found" },
      { status: 404 },
    );
  }

  await dbConnect();

  const profile = await Profile.findOne({
    username: parsed.username,
  }).collation({
    locale: "en_US",
    strength: 2,
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: "ID not found" },
      { status: 404 },
    );
  }
  const profileSubjectKeys = profile.subjects ?? [];
  const subjectDocs = profileSubjectKeys.length
    ? await Subject.find(
        { $or: profileSubjectKeys.map((key) => ({ key })) },
        { key: 1, label: 1 },
      ).lean()
    : [];
  const subjectLabels = new Map(subjectDocs.map((subject) => [subject.key, subject.label]));

  const user = await User.findOne(
    { _id: profile.userId },
    "clerkId role plan onboardingCompleted paymentCompleted status createdAt",
  );

  if (!user || user.status === "deleted") {
    return NextResponse.json(
      { success: false, error: "ID not found" },
      { status: 404 },
    );
  }

  const canonicalRole: Role =
    user.role === "teacher_candidate" ? "candidate" : "teacher";

  if (parsed.role !== canonicalRole) {
    return NextResponse.json(
      { success: false, error: "ID not found" },
      { status: 404 },
    );
  }

  const isCandidateId = canonicalRole === "candidate";
  const role: Role = canonicalRole;
  const planLabel =
    user.plan?.current === "teacher_candidate" ? "premium" : undefined;

  let accountHolderName = profile.displayName?.trim() || "";
  let accountAvatar = profile.avatarUrl || "";

  // Use Clerk profile as source-of-truth fallback for full name and avatar.
  if ((!accountHolderName || !accountAvatar) && user.clerkId) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(user.clerkId);
      const fullName =
        [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        clerkUser.fullName?.trim() ||
        "";

      if (!accountHolderName && fullName) {
        accountHolderName = fullName;
      }
      if (!accountAvatar && clerkUser.imageUrl) {
        accountAvatar = clerkUser.imageUrl;
      }
    } catch {
      // Non-fatal: continue with DB fallbacks.
    }
  }

  const person = {
    role,
    username: profile.username,
    name: accountHolderName || profile.username,
    bio: profile.bio,
    photo: accountAvatar || "/AOTF.svg",
    qualification: profile.qualification,
    subjects: (profile.subjects ?? []).map((subject) => subjectLabels.get(subject) ?? subject),
    employeeId: `AOTF-${isCandidateId ? "C" : "T"}-${profile.username.toUpperCase()}`,
    phone: formatMaskedPhone(`${profile.phone}`),
    location: profile.location || profile.address,
    joinDate: formatDisplayDate(user.createdAt),
    expiryDate: "—",
    isVerified: Boolean(user.paymentCompleted),
    plan: planLabel,
    status: user.status === "blocked" ? "suspended" : (user.paymentCompleted ? "active" : "in_progress"),
    profileUrl: `/u/${encodeURIComponent(profile.username)}`,
  };

  return NextResponse.json({
    success: true,
    person,
  });
}

export const GET = withApiErrorHandling(get, "GET /api/v1/verify/[id]");

/**
 * Normalizes legacy teacher data into the fields used by the new app schema.
 * This keeps the migration script deterministic and makes the mapping
 * straightforward to test without needing a live DB connection.
 */

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullIfEmpty(value) {
  const next = trimString(value);
  return next === "" ? null : next;
}

function normalizeExperienceRange(value) {
  const raw = trimString(value || "");
  if (!raw) return null;

  const normalized = raw.replace(/\s+/g, "").toLowerCase();
  if (normalized === "0-1" || normalized === "2-5" || normalized === "6-10" || normalized === "10+") {
    return normalized;
  }

  const matched = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (matched) {
    const [, start, end] = matched;
    const startNum = Number(start);
    const endNum = Number(end);
    if (endNum <= 1) return "0-1";
    if (endNum <= 5) return "2-5";
    if (endNum <= 10) return "6-10";
    return "10+";
  }

  const plusMatched = normalized.match(/^(\d+)\+$/);
  if (plusMatched) {
    const num = Number(plusMatched[1]);
    return num >= 10 ? "10+" : num >= 6 ? "6-10" : num >= 2 ? "2-5" : "0-1";
  }

  const singleMatched = normalized.match(/^(\d+)$/);
  if (singleMatched) {
    const num = Number(singleMatched[1]);
    if (num >= 10) return "10+";
    if (num >= 6) return "6-10";
    if (num >= 2) return "2-5";
    return "0-1";
  }

  return null;
}

function normalizeBoard(board) {
  const raw = trimString(board || "");
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper === "WB-BENGALI VERSION" || upper === "WB-BENGALI") return "WB-Bengali";
  if (upper === "WB-ENGLISH VERSION" || upper === "WB-ENGLISH") return "WB-English";
  if (upper === "CBSE" || upper === "ICSE" || upper === "ISC" || upper === "IB") return upper;
  if (upper.includes("WB")) {
    return upper.includes("ENGLISH") ? "WB-English" : "WB-Bengali";
  }

  return raw;
}

function parseExperienceYears(value) {
  const experience = normalizeExperienceRange(value);
  if (!experience) return null;

  if (experience === "10+") return 10;
  if (experience === "0-1") return 1;
  if (experience === "2-5") return 5;
  if (experience === "6-10") return 10;

  const matched = experience.match(/^(\d+)\-(\d+)$/);
  if (matched) return Number(matched[2]);

  return null;
}

function deriveUsernameFromEmail(email) {
  if (!email) return null;
  const local = String(email).split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return local || null;
}

export function mapLegacyTeacherToProfile(teacher, clerkId = null, usernameOverride = null) {
  const email = trimString(teacher?.email || "").toLowerCase();
  const name = trimString(teacher?.name || "");
  const location = toNullIfEmpty(teacher?.location);
  const phone = toNullIfEmpty(teacher?.phone);
  const whatsapp = toNullIfEmpty(teacher?.whatsappNumber || teacher?.phone);
  const subjects = Array.isArray(teacher?.subjectsTeaching)
    ? teacher.subjectsTeaching.map((s) => trimString(s)).filter(Boolean)
    : [];
  const bio = toNullIfEmpty(teacher?.bio);
  const qualification = toNullIfEmpty(teacher?.qualifications);
  const board = normalizeBoard(teacher?.schoolBoard);
  const teachingExp = normalizeExperienceRange(teacher?.experience);
  const profileExperience = parseExperienceYears(teacher?.experience);

  return {
    clerkId,
    username: usernameOverride || deriveUsernameFromEmail(email) || null,
    displayName: name || null,
    bio,
    avatarUrl: null,
    location,
    websiteUrl: null,
    socialLinks: {},
    subjects,
    experience: profileExperience,
    isPublic: true,
    phone: phone || null,
    whatsapp: whatsapp || phone || null,
    address: location,
    teachingExp,
    jobExp: teachingExp,
    qualification,
    board,
  };
}

export function mapLegacyTeacherToOnboarding(teacher, clerkId = null, userId = null) {
  const location = toNullIfEmpty(teacher?.location);
  const phone = toNullIfEmpty(teacher?.phone);
  const whatsapp = toNullIfEmpty(teacher?.whatsappNumber || teacher?.phone);
  const teachingExp = normalizeExperienceRange(teacher?.experience);
  const qualification = toNullIfEmpty(teacher?.qualifications);
  const board = normalizeBoard(teacher?.schoolBoard);

  return {
    userId,
    clerkId,
    phone: phone || null,
    whatsapp: whatsapp || phone || null,
    address: location,
    teachingExp,
    jobExp: teachingExp,
    qualification,
    board,
    plan: "teacher",
    status: "incomplete",
    expiresAt: null,
  };
}

export function normalizeLegacyTeacherRecord(teacher) {
  return {
    teacherId: teacher?.teacherId ?? teacher?._id?.toString() ?? null,
    name: trimString(teacher?.name || "") || null,
    email: trimString(teacher?.email || "").toLowerCase() || null,
    phone: toNullIfEmpty(teacher?.phone),
    whatsappNumber: toNullIfEmpty(teacher?.whatsappNumber || teacher?.phone),
    location: toNullIfEmpty(teacher?.location),
    experience: normalizeExperienceRange(teacher?.experience),
    qualifications: toNullIfEmpty(teacher?.qualifications),
    schoolBoard: normalizeBoard(teacher?.schoolBoard),
    subjectsTeaching: Array.isArray(teacher?.subjectsTeaching)
      ? teacher.subjectsTeaching.map((s) => trimString(s)).filter(Boolean)
      : [],
    teachingMode: trimString(teacher?.teachingMode || "") || null,
    bio: toNullIfEmpty(teacher?.bio),
    registrationFeeStatus:
      teacher?.registrationFeeStatus === "paid" ? "paid" : "pending",
  };
}

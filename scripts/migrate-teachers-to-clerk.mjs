/**
 * AOTF → Clerk Teacher Migration Script
 *
 * Migrates paid teachers from the legacy MongoDB into Clerk.
 * The OLD MongoDB is read-only — this script never modifies it.
 * The NEW MongoDB is seeded by this script immediately after each Clerk user
 * is created (or found). The Clerk `user.created` webhook is a backup path.
 *
 * Usage:
 *   node migrate-teachers-to-clerk.mjs           ← dry run (safe, nothing created)
 *   node migrate-teachers-to-clerk.mjs --live    ← creates Clerk users
 *
 * Prerequisites:
 *   npm install mongodb @clerk/backend dotenv
 *
 * Required env vars (place in a local .env in this folder, or in .env.local):
 *   MONGODB_URI_LEGACY=mongodb+srv://...  ← OLD production cluster
 *   MONGODB_URI=mongodb+srv://...         ← NEW app database (seeded here)
 *   CLERK_SECRET_KEY=sk_live_...          ← Clerk secret key
 *
 * What gets written to Clerk publicMetadata:
 *   {
 *     role: "teacher",
 *     onboardingCompleted: false,
 *     migratedFromLegacy: true,
 *     registrationFeeStatus: "paid",
 *     legacyPlan: "teacher",
 *     legacyTeacherId: "<teacherId from old DB>"
 *   }
 *
 * On first sign-in the Clerk user.created webhook will:
 *   - Create a User + Profile doc in the NEW MongoDB
 *   - Seed an OnboardingDetails stub with expiresAt = null (no deletion timer)
 *   - Preserve all migration flags in Clerk publicMetadata
 *
 * The onboarding page will detect migratedFromLegacy and show "Activate Account"
 * instead of the Razorpay payment UI.
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import dns from "node:dns/promises";
import legacyTeacherMapping from "./lib/legacy-teacher-mapping.js";

const { mapLegacyTeacherToProfile } = legacyTeacherMapping;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from the repo root (parent of /scripts)
dotenv.config({ path: resolve(__dirname, "../.env.local") });
// Fallback: also load a local .env in the scripts folder if present
dotenv.config({ path: resolve(__dirname, ".env") });

// Atlas SRV lookups can fail on some local DNS resolvers — use public DNS after env is loaded.
if (process.env.NODE_ENV === "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}
import { MongoClient } from "mongodb";
import { createClerkClient } from "@clerk/backend";
import { seedClerkUserInMongo } from "./lib/seed-clerk-user.mjs";

// ─── Validate env ──────────────────────────────────────────────────────────────

const IS_LIVE = process.argv.includes("--live");
const { MONGODB_URI_LEGACY, MONGODB_URI, CLERK_SECRET_KEY } = process.env;

if (!MONGODB_URI_LEGACY)
  throw new Error(
    "Missing MONGODB_URI_LEGACY in env. This must point to the OLD production cluster.",
  );
if (!MONGODB_URI)
  throw new Error(
    "Missing MONGODB_URI in env. This must point to the NEW app database.",
  );
if (!CLERK_SECRET_KEY) throw new Error("Missing CLERK_SECRET_KEY in env");

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Name of the legacy database on the old cluster */
const LEGACY_DB_NAME = "academy-of-tutorials-freelancers";

/** Clerk rate-limit: stay under 20 req/s — 250 ms between calls is safe */
const CLERK_RATE_LIMIT_DELAY_MS = 250;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function splitName(fullName = "") {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") ?? "",
  };
}

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Clerk prod requires legal consent when enabled — use legacy agreement timestamp. */
function legacyLegalAcceptedAt(record) {
  const raw =
    record.termsAgreedAt ?? record.paymentVerifiedAt ?? record.createdAt;
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Derive a Clerk-safe username from an email address.
 * Rules we enforce to satisfy the most restrictive Clerk settings:
 *   - letters only (strip digits and special chars)
 *   - lowercase
 *   - 4–32 characters
 *   - fallback to "user" if the local part has no letters at all
 * @param {string} email
 * @param {number} [suffix] — append a numeric suffix to avoid collisions
 */
function makeUsername(email, suffix = 0) {
  const local = email.split("@")[0] ?? "";
  // Keep only ASCII letters, lowercase
  let base = local.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (base.length < 4) base = (base + "user").slice(0, 32);
  base = base.slice(0, suffix > 0 ? 29 : 32); // leave room for suffix digits
  return suffix > 0 ? `${base}${suffix}` : base;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log(
    `║  AOTF Teachers → Clerk Migration  [${IS_LIVE ? "LIVE 🔴" : "DRY RUN 🟡"}]        ║`,
  );
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (!IS_LIVE) {
    console.log("ℹ️  DRY RUN — no Clerk users will be created.");
    console.log("   Verify the output, then run with --live when ready.\n");
  }

  // ── Connect to legacy MongoDB ──────────────────────────────────────────────

  const legacyClient = new MongoClient(MONGODB_URI_LEGACY);
  await legacyClient.connect();
  log("✅", `Connected to legacy MongoDB — db: "${LEGACY_DB_NAME}"`);

  const newClient = new MongoClient(MONGODB_URI);
  await newClient.connect();
  log("✅", "Connected to NEW MongoDB for User/Profile seeding");

  const db = legacyClient.db(LEGACY_DB_NAME);
  const newDb = newClient.db();
  const teachersCol = db.collection("teachers");

  // ── Init Clerk ─────────────────────────────────────────────────────────────

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  // ── Fetch paid teachers ────────────────────────────────────────────────────

  const paidTeachers = await teachersCol
    .find({ registrationFeeStatus: "paid" })
    .toArray();

  log("📋", `Paid teachers found: ${paidTeachers.length}`);

  if (paidTeachers.length === 0) {
    log("🤷", "No paid teachers found. Nothing to migrate.");
    await legacyClient.close();
    await newClient.close();
    return;
  }

  console.log("");

  // ── Migrate ────────────────────────────────────────────────────────────────

  const results = { created: 0, seeded: 0, skipped: 0, failed: 0 };
  const failures = [];

  for (const teacher of paidTeachers) {
    const { email, name, teacherId } = teacher;

    if (!email) {
      log(
        "⚠️ ",
        `Skipping teacher with no email (teacherId: ${teacherId ?? teacher._id})`,
      );
      results.skipped++;
      continue;
    }

    const { firstName, lastName } = splitName(name ?? "");

    // ── Dry run ──────────────────────────────────────────────────────────────

    if (!IS_LIVE) {
      log(
        "🔍",
        `[DRY RUN] ${email} | "${firstName} ${lastName}" | role: teacher | legacyId: ${teacherId ?? "n/a"}`,
      );
      results.created++;
      continue;
    }

    // ── Live ─────────────────────────────────────────────────────────────────

    try {
      const metadata = {
        role: "teacher",
        onboardingCompleted: false,
        migratedFromLegacy: true,
        registrationFeeStatus: "paid",
        legacyPlan: "teacher",
        legacyTeacherId: teacherId ?? teacher._id?.toString() ?? null,
      };

      // Idempotency: reuse Clerk user if this email already exists.
      const existing = await clerk.users.getUserList({
        emailAddress: [email],
      });

      let clerkUser = existing.data[0] ?? null;

      if (clerkUser) {
        log("⏭️ ", `Already in Clerk: ${email} — ensuring MongoDB record`);
        results.skipped++;
      } else {
        // Try to create the user; if the username collides, retry with a suffix.
        let created = false;
        for (let attempt = 0; attempt <= 9 && !created; attempt++) {
          const username = makeUsername(email, attempt);
          try {
            clerkUser = await clerk.users.createUser({
              emailAddress: [email],
              username,
              firstName,
              lastName,
              // No password — users sign in via Google (email auto-links) or
              // use "Forgot Password" to set a new one.
              skipPasswordChecks: true,
              skipPasswordRequirement: true,
              legalAcceptedAt: legacyLegalAcceptedAt(teacher),
              publicMetadata: metadata,
            });
            created = true;
          } catch (innerErr) {
            const isUsernameConflict =
              innerErr?.errors?.some(
                (e) =>
                  e.code === "form_identifier_exists" ||
                  (e.meta?.paramName === "username" &&
                    e.code === "form_identifier_exists"),
              ) ?? false;
            // Only retry on username collision; re-throw everything else
            if (!isUsernameConflict || attempt === 9) throw innerErr;
            // otherwise loop with suffix attempt+1
          }
        }

        log(
          "✅",
          `Created: ${email} (teacher) | legacyId: ${teacherId ?? "n/a"}`,
        );
        results.created++;
      }

      const legacyProfilePatch = mapLegacyTeacherToProfile(
        teacher,
        clerkUser.id,
        clerkUser.username ?? undefined,
      );

      // const seedResult = await seedClerkUserInMongo(newDb, clerkUser);
      const seedResult = await seedClerkUserInMongo(newDb, clerkUser, {
        ...teacher,
        ...legacyProfilePatch,
      });

      if (seedResult.action !== "skipped") {
        results.seeded++;
        log("🗄️ ", `MongoDB ${seedResult.action}: ${email} (${clerkUser.id})`);
      }

      // Brief pause to respect Clerk's rate limits
      await sleep(CLERK_RATE_LIMIT_DELAY_MS);
    } catch (err) {
      const reason =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err.message ??
        String(err);

      log("❌", `Failed: ${email} — ${reason}`);
      results.failed++;
      failures.push({
        email,
        teacherId: teacherId ?? String(teacher._id),
        error: reason,
      });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                       SUMMARY                         ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(
    `  ✅  ${IS_LIVE ? "Created     " : "Would create"} : ${results.created}`,
  );
  console.log(
    `  🗄️   ${IS_LIVE ? "Mongo seeded" : "Would seed  "} : ${results.seeded}`,
  );
  console.log(`  ⏭️   Skipped      : ${results.skipped}`);
  console.log(`  ❌  Failed       : ${results.failed}`);

  if (failures.length > 0) {
    console.log("\n── Failures ──────────────────────────────────────────────");
    for (const f of failures) {
      console.log(`  • [teacher] ${f.email} (legacyId: ${f.teacherId})`);
      console.log(`    └─ ${f.error}`);
    }
  }

  if (!IS_LIVE) {
    console.log(
      "\n💡 Happy with the output? Run the live migration:\n   node migrate-teachers-to-clerk.mjs --live\n",
    );
  } else {
    console.log("\n🎉 Teacher migration complete.\n");
    console.log(
      "ℹ️  Next step: run migrate-freelancers-to-clerk.mjs for freelancers.\n",
    );
  }

  await legacyClient.close();
  await newClient.close();
}

migrate().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  checkCsrfOrigin,
  checkRateLimit,
  getClientIp,
  checkJsonContentType,
} from "@/lib/api-utils";
import {
  getApplicationsByJobIdPublic,
  createJobApplication,
  deleteAllApplicationsByJobIdPublic,
  deleteApplicationsByIds,
  getApplicantPermissionsByClerkId,
  hasAppliedToJob,
} from "@/lib/services/application.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { ValidationError } from "@/lib/errors";
import dbConnect from "@/lib/db";
import Profile from "@/lib/models/Profile";
import OnboardingDetails from "@/lib/models/OnboardingDetails";
import {
  jobIdParamSchema,
  deleteApplicationsBodySchema,
} from "@/lib/validations/api-route";

/** 60 reads per IP per minute */
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * GET /api/v1/jobs/[jobId]/applications
 * Get all applications for a job post.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(readLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { jobId } = jobIdParamSchema.parse(await params);

    if (request.nextUrl.searchParams.get("mine") === "1") {
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json({ applied: false });
      }

      const permissions = await getApplicantPermissionsByClerkId(clerkId, {
        ensureUser: true,
      });

      if (!permissions?.canApplyToJobs) {
        return NextResponse.json({ applied: false });
      }

      const applied = await hasAppliedToJob(permissions.applicantId, jobId);
      return NextResponse.json({ applied });
    }

    const result = await getApplicationsByJobIdPublic(jobId);

    return NextResponse.json(
      { applications: result.applications, total: result.total },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    return handleApiError(
      error,
      `GET /api/v1/jobs/${(await params).jobId}/applications`,
    );
  }
}

/**
 * POST /api/v1/jobs/[jobId]/applications
 * Authenticated candidate application flow for jobs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(writeLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { jobId } = jobIdParamSchema.parse(await params);

    await dbConnect();

    const permissions = await getApplicantPermissionsByClerkId(clerkId, {
      ensureUser: true,
    });

    if (!permissions || permissions.status !== "active") {
      return NextResponse.json(
        { error: "Your account is not allowed to apply right now" },
        { status: 403 },
      );
    }

    if (!permissions.canApplyToJobs) {
      return NextResponse.json(
        { error: "Only candidates can apply to job posts" },
        { status: 403 },
      );
    }

    const profile = await Profile.findOne({ clerkId }).lean<{
      _id: { toString(): string };
      username?: string | null;
      displayName?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      board?: string | null;
      qualification?: string | null;
      teachingExp?: string | null;
      address?: string | null;
      subjects?: string[];
    }>();
    const onboarding = await OnboardingDetails.findOne({ clerkId }).lean<{
      board?: string | null;
      qualification?: string | null;
      teachingExp?: string | null;
      address?: string | null;
      subjects?: string[];
    }>();

    if (!profile) {
      throw new ValidationError(
        "Complete your profile before applying to jobs.",
      );
    }

    const phone = profile.phone?.trim() || profile.whatsapp?.trim();
    if (!phone) {
      throw new ValidationError(
        "Add a phone number to your profile before applying.",
      );
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);
    const primaryEmail =
      clerkUser.emailAddresses.find(
        (entry) => entry.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      throw new ValidationError(
        "A verified email address is required to apply.",
      );
    }

    const fallbackName = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const applicantSnapshot = {
      name:
        profile.displayName?.trim() ||
        fallbackName ||
        profile.username?.trim() ||
        "User",
      username: profile.username ?? null,
      email: primaryEmail,
      phone,
      avatarUrl: clerkUser.imageUrl || null,
      board: profile.board ?? onboarding?.board ?? null,
      qualification: profile.qualification?.trim() || onboarding?.qualification || null,
      teachingExp: profile.teachingExp ?? onboarding?.teachingExp ?? null,
      address: profile.address?.trim() || onboarding?.address || null,
      subjects: profile.subjects ?? onboarding?.subjects ?? [],
    };

    const application = await createJobApplication({
      jobIdPublic: jobId,
      applicantId: permissions.applicantId,
      profileId: profile._id.toString(),
      applicantType: permissions.applicantType,
      applicantSnapshot,
    });

    return NextResponse.json(
      { message: "Application submitted successfully", application },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(
      error,
      `POST /api/v1/jobs/${(await params).jobId}/applications`,
    );
  }
}

/**
 * DELETE /api/v1/jobs/[jobId]/applications
 *
 * Body (optional):
 *   { applicationIds?: string[] }
 *
 * - If `applicationIds` is provided, delete only those applications.
 * - If omitted / empty, delete ALL applications for the job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(writeLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { jobId } = jobIdParamSchema.parse(await params);

    // Enforce Content-Type when a body is present
    const hasBody = (request.headers.get("content-length") ?? "0") !== "0";
    if (hasBody) {
      const ctBlock = checkJsonContentType(request);
      if (ctBlock) return ctBlock;
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      if (hasBody) {
        throw new ValidationError("Invalid JSON body");
      }
    }

    const { applicationIds } = deleteApplicationsBodySchema.parse(body);

    let deletedCount: number;

    if (Array.isArray(applicationIds) && applicationIds.length > 0) {
      deletedCount = await deleteApplicationsByIds(applicationIds);
    } else {
      deletedCount = await deleteAllApplicationsByJobIdPublic(jobId);
    }

    return NextResponse.json({ deletedCount });
  } catch (error) {
    return handleApiError(
      error,
      `DELETE /api/v1/jobs/${(await params).jobId}/applications`,
    );
  }
}

import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  checkCsrfOrigin,
  checkRateLimit,
  getClientIp,
  checkJsonContentType,
} from "@/lib/api-utils";
import Admin from "@/lib/models/Admin";
import Source from "@/lib/models/Source";
import Referral from "@/lib/models/Referral";
import dbConnect from "@/lib/db";
import { createPostSchema, listPostsSchema } from "@/lib/validations/post";
import { sourceLists } from "@/lib/validations/forms";
import { createPost, listPosts } from "@/lib/services/post.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { logActivity } from "@/lib/admin/logActivity";
import { updateEnquiryStatus } from "@/lib/services/enquiry.service";

/** 10 post creations per IP per minute */
const createLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** 60 reads per IP per minute */
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/**
 * POST /api/v1/posts
 * Admin-facing: create a new tuition post.
 *
 * Request body: CreatePostInput
 *
 * Success 201:
 *   { message: string, post: IPost }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // CSRF origin check
    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    // Content-Type check
    const ctBlock = checkJsonContentType(request);
    if (ctBlock) return ctBlock;

    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(createLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    await dbConnect();
    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = createPostSchema.parse(body);
    const dbSources = await Source.find().lean();
    const allowedSourceKeys = new Set([
      ...sourceLists.map((source) => source.key),
      ...dbSources.map((source) => source.key),
    ]);
    if (!allowedSourceKeys.has(input.source)) {
      return NextResponse.json(
        { error: `Invalid source: ${input.source}` },
        { status: 400 },
      );
    }
    if (input.source === "referral" && !input.referralUserName?.trim()) {
      return NextResponse.json(
        { error: "Referral user name is required when source is referral" },
        { status: 400 },
      );
    }
    const post = await createPost({
      ...input,
      createdByAdminClerkId: currentAdmin.clerkId,
    });

    if (input.enquiryId) {
      await updateEnquiryStatus(input.enquiryId, {
        toStatus: "resolved",
        action: `Enquiry converted to tuition post ${post.postId}`,
        notes: `Converted to tuition post ${post.postId}`,
        adminId: currentAdmin._id.toString(),
        adminName: currentAdmin.name ?? currentAdmin.username ?? "Admin",
        adminRole:
          currentAdmin.role === "support_admin"
            ? "support_admin"
            : currentAdmin.role === "admin"
              ? "admin"
              : "super_admin",
      });
    }

    if (input.source === "referral" && input.referralUserName?.trim()) {
      await Referral.create({
        postId: post.postId,
        referralUserName: input.referralUserName.trim(),
        createdByAdminClerkId: currentAdmin.clerkId,
      });
    }

    await logActivity({
      admin: currentAdmin,
      action: "CREATE_POST",
      module: "CRM",
      targetType: "Post",
      targetId: post._id as mongoose.Types.ObjectId,
      targetRefId: post.postId,
      metadata: {
        postId: post.postId,
        ...(input.enquiryId ? { enquiryId: input.enquiryId } : {}),
      },
    });

    return NextResponse.json(
      { message: "Post created successfully", post },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/v1/posts");
  }
}

/**
 * GET /api/v1/posts
 * Public/Admin: list posts with pagination, status filter, and search.
 *
 * Query params:
 *   status? — one of the post statuses or "all" (default "all")
 *   page?   — 1-based page number (default 1)
 *   limit?  — items per page, max 100 (default 10)
 *   search? — search term
 *
 * Success 200:
 *   { posts: IPost[], pagination: { page, limit, total, totalPages } }
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(readLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { searchParams } = new URL(request.url);
    const input = listPostsSchema.parse({
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? 10,
      search: searchParams.get("search") ?? undefined,
      subjects: searchParams.get("subjects") ?? undefined,
      boards: searchParams.get("boards") ?? undefined,
      classType: searchParams.get("classType") ?? undefined,
      minBudget: searchParams.get("minBudget") ?? undefined,
      maxBudget: searchParams.get("maxBudget") ?? undefined,
    });

    const result = await listPosts(input);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/posts");
  }
}

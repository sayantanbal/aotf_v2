import mongoose, { type Document } from "mongoose";
import dbConnect from "@/lib/db";
import Post, { type PostStatus, type IPost } from "@/lib/models/Post";
import Enquiry from "@/lib/models/Enquiry";
import Invoice from "@/lib/models/Invoice";
import Referral from "@/lib/models/Referral";
import Application from "@/lib/models/Application";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { escapeRegex } from "@/lib/utils";
import {
  getAdminAuthorsByClerkIds,
  type AdminAuthorSummary,
} from "@/lib/services/admin-author.service";
import type {
  CreatePostInput,
  UpdatePostInput,
  ListPostsInput,
} from "@/lib/validations/post";

type CreatePostParams = CreatePostInput & {
  createdByAdminClerkId?: string;
};

type UpdatePostParams = UpdatePostInput & {
  updatedByAdminClerkId?: string;
};

// ─── Types returned to route handlers ───────────────────────────────────

export interface PaginatedPosts {
  posts: PostWithEnquiryReference[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type PostLean = Omit<IPost, keyof Document>;

export type PostWithEnquiryReference = PostLean & {
  enquiryReferenceId?: string | null;
  referralUserName?: string | null;
  author?: AdminAuthorSummary | null;
  invoiceId?: string | null;
  applicantCount?: number;
  applicationStats?: {
    pending: number;
    approved: number;
    declined: number;
    withdrawn: number;
    total: number;
  };
};

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a unique post ID in the format `P-DDMMYYNN`.
 * NN is a 2-digit daily counter (00–99).
 */
async function generatePostId(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `P-${dd}${mm}${yy}`;

  const lastPost = await Post.findOne({
    postId: mongoose.trusted({ $regex: `^${prefix}` }),
  })
    .sort({ postId: -1 })
    .lean();

  let counter = 0;
  if (lastPost) {
    const lastCounter = parseInt(lastPost.postId.slice(-2), 10);
    counter = lastCounter + 1;
  }

  if (counter > 99) {
    throw new ConflictError(
      "Daily post limit (100) reached. Please try again tomorrow.",
    );
  }

  return `${prefix}${String(counter).padStart(2, "0")}`;
}

/**
 * Normalize subjects to lowercase for search.
 */
function normalizeStudents(
  students: CreatePostInput["students"],
): CreatePostInput["students"] {
  return students.map((s) => ({
    ...s,
    subjectsNormalized: s.subjects.map((sub) => sub.toLowerCase().trim()),
  }));
}

async function attachEnquiryReferences<
  T extends { enquiryId?: mongoose.Types.ObjectId | string | null },
>(posts: T[]): Promise<Array<T & { enquiryReferenceId: string | null }>> {
  const linkedEnquiryIds = Array.from(
    new Set(
      posts
        .map((post) => post.enquiryId?.toString())
        .filter((enquiryId): enquiryId is string => Boolean(enquiryId)),
    ),
  );

  const enquiryObjectIds = linkedEnquiryIds
    .filter((enquiryId) => mongoose.Types.ObjectId.isValid(enquiryId))
    .map((enquiryId) => new mongoose.Types.ObjectId(enquiryId));

  if (enquiryObjectIds.length === 0) {
    return posts.map((post) => ({ ...post, enquiryReferenceId: null }));
  }

  const enquiries = await Enquiry.find(
    { _id: mongoose.trusted({ $in: enquiryObjectIds }) },
    { enquiryId: 1 },
  ).lean();

  const enquiryMap = new Map(
    enquiries.map((enquiry) => [String(enquiry._id), enquiry.enquiryId]),
  );

  return posts.map((post) => ({
    ...post,
    enquiryReferenceId: post.enquiryId
      ? (enquiryMap.get(String(post.enquiryId)) ?? null)
      : null,
  }));
}

async function attachPostAuthors<
  T extends { createdByAdminClerkId?: string | null },
>(posts: T[]): Promise<Array<T & { author: AdminAuthorSummary | null }>> {
  const authorMap = await getAdminAuthorsByClerkIds(
    posts
      .map((post) => post.createdByAdminClerkId)
      .filter((clerkId): clerkId is string => Boolean(clerkId)),
  );

  return posts.map((post) => ({
    ...post,
    author: post.createdByAdminClerkId
      ? (authorMap.get(post.createdByAdminClerkId) ?? null)
      : null,
  }));
}

async function attachReferralDetails<T extends { postId: string }>(
  posts: T[],
): Promise<
  Array<
    T & { referralUserName: string | null; referralPhoneNumber: string | null }
  >
> {
  const postIds = posts.map((post) => post.postId);
  if (postIds.length === 0) {
    return posts.map((post) => ({
      ...post,
      referralUserName: null,
      referralPhoneNumber: null,
    }));
  }

  const referrals = await Referral.find(
    { postId: mongoose.trusted({ $in: postIds }) },
    { postId: 1, referralUserName: 1, referralPhoneNumber: 1 },
  ).lean();

  const referralMap = new Map(
    referrals.map((referral) => [referral.postId, referral]),
  );

  return posts.map((post) => ({
    ...post,
    referralUserName: referralMap.get(post.postId)?.referralUserName ?? null,
    referralPhoneNumber:
      referralMap.get(post.postId)?.referralPhoneNumber ?? null,
  }));
}

async function attachInvoiceIds<T extends { postId: string }>(
  posts: T[],
): Promise<Array<T & { invoiceId: string | null }>> {
  const postIds = posts.map((post) => post.postId);
  if (postIds.length === 0) {
    return posts.map((post) => ({ ...post, invoiceId: null }));
  }

  const invoices = await Invoice.find(
    { postId: mongoose.trusted({ $in: postIds }), isLatest: true },
    { postId: 1, invoiceId: 1 },
  ).lean();

  const invoiceMap = new Map(
    invoices.map((inv) => [inv.postId, inv.invoiceId]),
  );

  return posts.map((post) => ({
    ...post,
    invoiceId: invoiceMap.get(post.postId) || null,
  }));
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Create a new tuition post (admin-facing).
 * @returns The created post document.
 */
export async function createPost(input: CreatePostParams): Promise<IPost> {
  await dbConnect();

  const postId = await generatePostId();
  const students = normalizeStudents(input.students);

  const post = await Post.create({
    postId,
    guardianName: input.guardianName,
    guardianPhone: input.guardianPhone,
    source: input.source,
    enquiryId: input.enquiryId
      ? new mongoose.Types.ObjectId(input.enquiryId)
      : undefined,
    students,
    classType: input.classType,
    frequencyPerWeek: input.frequencyPerWeek,
    preferredDays: input.preferredDays,
    preferredTime: input.preferredTime,
    location: input.location,
    monthlyBudget: input.monthlyBudget,
    notes: input.notes,
    status: input.status ?? "open",
    matchedTeacherClerkId: input.matchedTeacherClerkId,
    createdByAdminClerkId: input.createdByAdminClerkId,
  });

  return post;
}

/**
 * Get a single post by postId.
 */
export async function getPostByPostId(
  postId: string,
): Promise<PostWithEnquiryReference> {
  await dbConnect();

  const post = await Post.findOne({ postId }).lean<PostLean>();
  if (!post) {
    throw new NotFoundError("Post");
  }

  const [postWithEnquiryReference] = await attachEnquiryReferences([post]);
  const [postWithReferral] = await attachReferralDetails([
    postWithEnquiryReference,
  ]);
  const [enrichedPost] = await attachPostAuthors([postWithReferral]);
  const [withInvoice] = await attachInvoiceIds([enrichedPost]);
  return withInvoice;
}

/**
 * Get a single post by MongoDB _id.
 */
export async function getPostById(
  id: string,
): Promise<PostWithEnquiryReference> {
  await dbConnect();

  const post = await Post.findById(id).lean<PostLean>();
  if (!post) {
    throw new NotFoundError("Post");
  }

  const [postWithEnquiryReference] = await attachEnquiryReferences([post]);
  const [postWithReferral] = await attachReferralDetails([
    postWithEnquiryReference,
  ]);
  const [enrichedPost] = await attachPostAuthors([postWithReferral]);
  const [withInvoice] = await attachInvoiceIds([enrichedPost]);
  return withInvoice;
}

/**
 * List posts with pagination, optional status filter, and search.
 */
export async function listPosts(
  input: ListPostsInput,
): Promise<PaginatedPosts> {
  await dbConnect();

  const {
    status,
    page,
    limit,
    search,
    subjects,
    boards,
    classType,
    minBudget,
    maxBudget,
  } = input;

  // Build filter
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") {
    filter.status = status;
  }
  if (search) {
    const searchRegex = mongoose.trusted({
      $regex: escapeRegex(search),
      $options: "i",
    });
    const orFilters: Array<Record<string, unknown>> = [
      { postId: searchRegex },
      { guardianName: searchRegex },
      { guardianPhone: searchRegex },
      { location: searchRegex },
      { "students.className": searchRegex },
      { "students.board": searchRegex },
      { "students.subjectsNormalized": searchRegex },
    ];

    const numericSearch = Number(search);
    const match = search.match(/\d+/);
    const numericFromText = match ? Number(match[0]) : Number.NaN;
    const effectiveNumeric = !Number.isNaN(numericSearch)
      ? numericSearch
      : numericFromText;
    if (!Number.isNaN(effectiveNumeric)) {
      orFilters.push({ monthlyBudget: effectiveNumeric });
      orFilters.push({ frequencyPerWeek: effectiveNumeric });
    }

    filter.$or = mongoose.trusted(orFilters);
  }

  const subjectList = subjects
    ? subjects
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  if (subjectList.length > 0) {
    filter["students.subjectsNormalized"] = mongoose.trusted({
      $in: subjectList,
    });
  }

  const boardList = boards
    ? boards
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean)
    : [];
  if (boardList.length > 0) {
    const boardRegexes = boardList.map(
      (board) => new RegExp(`^${escapeRegex(board)}$`, "i"),
    );
    filter["students.board"] = mongoose.trusted({
      $in: boardRegexes,
    });
  }

  if (classType && classType !== "all") {
    filter.classType = classType;
  }

  if (minBudget !== undefined || maxBudget !== undefined) {
    filter.monthlyBudget = mongoose.trusted({
      ...(minBudget !== undefined ? { $gte: minBudget } : {}),
      ...(maxBudget !== undefined ? { $lte: maxBudget } : {}),
    });
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<PostLean[]>(),
    Post.countDocuments(filter),
  ]);

  const postsWithEnquiryReferences = await attachEnquiryReferences(posts);
  const postsWithReferral = await attachReferralDetails(
    postsWithEnquiryReferences,
  );
  const enrichedPosts = await attachPostAuthors(postsWithReferral);
  const finalPosts = await attachInvoiceIds(enrichedPosts);
  const postIds = posts.map((post) => post.postId);
  const applicationRows = postIds.length
    ? await Application.collection
        .aggregate<{
          _id: string;
          total: number;
          pending: number;
          approved: number;
          declined: number;
          withdrawn: number;
        }>([
          { $match: { postId: { $in: postIds } } },
          {
            $group: {
              _id: "$postId",
              total: { $sum: 1 },
              pending: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["applied", "pending", "DC", "GC"]] },
                    1,
                    0,
                  ],
                },
              },
              approved: {
                $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
              },
              declined: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["decline", "auto_declined"]] },
                    1,
                    0,
                  ],
                },
              },
              withdrawn: {
                $sum: { $cond: [{ $eq: ["$status", "withdrawn"] }, 1, 0] },
              },
            },
          },
        ])
        .toArray()
    : [];
  const applicationMap = new Map(applicationRows.map((row) => [row._id, row]));

  return {
    posts: finalPosts.map((post) => {
      const stats = applicationMap.get(post.postId);
      return {
        ...post,
        invoiceGenerated: post.invoiceGenerated || !!post.invoiceId,
        applicantCount: stats?.total ?? 0,
        applicationStats: {
          pending: stats?.pending ?? 0,
          approved: stats?.approved ?? 0,
          declined: stats?.declined ?? 0,
          withdrawn: stats?.withdrawn ?? 0,
          total: stats?.total ?? 0,
        },
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update a post by postId.
 */
export async function updatePost(
  postId: string,
  input: UpdatePostParams,
): Promise<IPost> {
  await dbConnect();

  const updateData: Record<string, unknown> = { ...input };

  // Normalize students if provided
  if (input.students) {
    updateData.students = normalizeStudents(input.students);
  }

  if (input.enquiryId) {
    updateData.enquiryId = new mongoose.Types.ObjectId(input.enquiryId);
  }

  const post = await Post.findOneAndUpdate({ postId }, updateData, {
    new: true,
    runValidators: true,
  }).lean<IPost>();

  if (!post) {
    throw new NotFoundError("Post");
  }

  return post;
}

/**
 * Delete a post by postId.
 */
export async function deletePost(postId: string): Promise<void> {
  await dbConnect();

  const result = await Post.findOneAndDelete({ postId });
  if (!result) {
    throw new NotFoundError("Post");
  }
}

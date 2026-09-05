import { z } from "zod";
import { CLASS_TYPES, POST_STATUSES } from "@/lib/models/Post";
import { sourceLists } from "@/lib/validations/forms";

// ─── Student sub-schema ─────────────────────────────────────────────────

const studentSchema = z.object({
  className: z
    .string({ message: "Class name is required" })
    .trim()
    .min(1, "Class name is required"),
  board: z
    .string({ message: "Board is required" })
    .trim()
    .min(1, "Board is required"),
  subjects: z
    .array(z.string().trim().min(1, "Subject cannot be empty"))
    .min(1, "At least one subject is required"),
  subjectsNormalized: z.array(z.string().trim()).optional().default([]),
});

const sourceKeys = sourceLists.map((source) => source.key) as [
  string,
  ...string[],
];

// ─── Admin-facing: create a new tuition post ────────────────────────────

export const createPostSchema = z.object({
  guardianName: z
    .string({ message: "Guardian name is required" })
    .trim()
    .min(2, "Guardian name must be at least 2 characters")
    .max(100, "Guardian name must be at most 100 characters"),
  guardianPhone: z
    .string({ message: "Guardian phone is required" })
    .trim()
    .min(1, "Guardian phone is required"),

  source: z.string().trim().min(1, "Source is required"),
  referralUserName: z.string().trim().optional(),
  referralPhoneNumber: z.string().trim().optional(),

  paymentstatus: z.enum(["done", "pending"]).optional(),
  paymentDate: z.string().optional(),
  tentativeDate: z.string().optional(),

  enquiryId: z.string().optional(),

  students: z.array(studentSchema).min(1, "At least one student is required"),

  classType: z.enum(CLASS_TYPES, {
    message: `Class type must be one of: ${CLASS_TYPES.join(", ")}`,
  }),

  frequencyPerWeek: z.coerce
    .number()
    .int()
    .min(1, "Frequency must be at least 1")
    .max(7, "Frequency cannot exceed 7"),

  preferredDays: z.array(z.string().trim().min(1)).optional().default([]),

  preferredTime: z.string().trim().optional(),

  location: z
    .string({ message: "Location is required" })
    .trim()
    .min(1, "Location is required")
    .max(300, "Location must be at most 300 characters"),

  monthlyBudget: z.coerce.number().int().min(0, "Budget cannot be negative"),

  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be at most 2000 characters")
    .optional(),

  status: z
    .enum(POST_STATUSES, {
      message: `Status must be one of: ${POST_STATUSES.join(", ")}`,
    })
    .optional()
    .default("open"),

  matchedTeacherClerkId: z.string().trim().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// ─── Admin-facing: update a tuition post ────────────────────────────────

export const updatePostSchema = createPostSchema.partial().extend({
  updatedByAdminClerkId: z.string().trim().optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// ─── List posts query params ────────────────────────────────────────────

export const listPostsSchema = z.object({
  status: z
    .enum([...POST_STATUSES, "all"] as const)
    .optional()
    .default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z
    .string()
    .max(200, "Search term must be at most 200 characters")
    .optional(),
  subjects: z.string().optional(),
  boards: z.string().optional(),
  classType: z.enum([...CLASS_TYPES, "all"] as const).optional(),
  minBudget: z.coerce.number().int().min(0).optional(),
  maxBudget: z.coerce.number().int().min(0).optional(),
});

export type ListPostsInput = z.infer<typeof listPostsSchema>;

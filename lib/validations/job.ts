import { z } from "zod";
import {
  WORK_TYPES,
  COMPANY_TYPES,
  LOCATION_TYPES,
  GENDER_PREFERENCES,
  PROJECT_TYPES,
  JOB_STATUSES,
  COMMISSION_BASIS_TYPES,
} from "@/lib/models/Job";
import { sourceLists } from "@/lib/validations/forms";

const sourceKeys = sourceLists.map((source) => source.key) as [
  string,
  ...string[],
];

// ─── Admin-facing: create a new job post ────────────────────────────────

// Base object shape (before refinements) — used for .partial() on updates
const createJobBaseSchema = z.object({
  workType: z.enum(WORK_TYPES, {
    message: `Work type must be one of: ${WORK_TYPES.join(", ")}`,
  }),

  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title must be at most 200 characters"),

  clientName: z
    .string({ message: "Client name is required" })
    .trim()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name must be at most 100 characters"),

  phoneNumber: z
    .string({ message: "Phone number is required" })
    .trim()
    .min(1, "Guardian phone is required"),

  source: z.string().trim().min(1, "Source is required"),
  referralUserName: z.string().trim().optional(),
  referralPhoneNumber: z.string().trim().optional(),

  companyType: z.enum(COMPANY_TYPES, {
    message: `Company type must be one of: ${COMPANY_TYPES.join(", ")}`,
  }),

  locationType: z.enum(LOCATION_TYPES, {
    message: `Location type must be one of: ${LOCATION_TYPES.join(", ")}`,
  }),

  location: z
    .string({ message: "Location is required" })
    .trim()
    .min(1, "Location is required")
    .max(300, "Location must be at most 300 characters"),

  timing: z
    .string({ message: "Timing is required" })
    .trim()
    .min(1, "Timing is required")
    .max(200, "Timing must be at most 200 characters"),

  experience: z
    .string()
    .trim()
    .max(100, "Experience must be at most 100 characters")
    .optional(),

  gender: z.enum(GENDER_PREFERENCES, {
    message: `Gender must be one of: ${GENDER_PREFERENCES.join(", ")}`,
  }),

  salary: z
    .string()
    .trim()
    .max(100, "Salary must be at most 100 characters")
    .optional(),

  companyName: z
    .string()
    .trim()
    .max(200, "Company name must be at most 200 characters")
    .optional(),

  skillsRequired: z
    .string()
    .trim()
    .max(1000, "Skills must be at most 1000 characters")
    .optional(),

  travelRequirements: z
    .string()
    .trim()
    .max(500, "Travel requirements must be at most 500 characters")
    .optional(),

  requiredQualification: z
    .string()
    .trim()
    .max(300, "Qualification must be at most 300 characters")
    .optional(),

  projectType: z
    .enum(PROJECT_TYPES, {
      message: `Project type must be one of: ${PROJECT_TYPES.join(", ")}`,
    })
    .optional(),

  budget: z
    .string()
    .trim()
    .max(100, "Budget must be at most 100 characters")
    .optional(),

  duration: z
    .string()
    .trim()
    .max(100, "Duration must be at most 100 characters")
    .optional(),

  brief: z
    .string()
    .trim()
    .max(2000, "Brief must be at most 2000 characters")
    .optional(),

  status: z
    .enum(JOB_STATUSES, {
      message: `Status must be one of: ${JOB_STATUSES.join(", ")}`,
    })
    .optional()
    .default("open"),

  commissionBasis: z.enum(COMMISSION_BASIS_TYPES, {
    message: `Commission basis must be one of: ${COMMISSION_BASIS_TYPES.join(", ")}`,
  }),

  academyCommissionPercentage: z.coerce
    .number()
    .int("Commission percentage must be a whole number")
    .min(0, "Commission percentage cannot be negative")
    .max(100, "Commission percentage cannot exceed 100"),

  settledAmount: z.coerce
    .number()
    .min(0, "Settled amount cannot be negative")
    .optional(),

  enquiryId: z.string().optional(),
  createdByAdminClerkId: z.string().optional(),
  createdByAdminId: z.string().optional(),
});

export const createJobSchema = createJobBaseSchema.refine(
  (data) => {
    // If workType is "project", projectType is required
    if (data.workType === "project" && !data.projectType) {
      return false;
    }
    return true;
  },
  {
    message: "Project type is required when work type is 'project'",
    path: ["projectType"],
  },
);

export type CreateJobInput = z.infer<typeof createJobSchema>;

// ─── Admin-facing: update a job post ────────────────────────────────────

export const updateJobSchema = createJobBaseSchema
  .partial()
  .extend({
    updatedByAdminClerkId: z.string().optional(),
    updatedByAdminId: z.string().optional(),
  })
  .refine(
    (data) => {
      // Only enforce projectType requirement if workType is being set to "project"
      if (data.workType === "project" && !data.projectType) {
        return false;
      }
      return true;
    },
    {
      message: "Project type is required when work type is 'project'",
      path: ["projectType"],
    },
  );

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

// ─── List jobs query params ─────────────────────────────────────────────

export const listJobsSchema = z.object({
  status: z
    .enum([...JOB_STATUSES, "all"] as const)
    .optional()
    .default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(10),
  search: z
    .string()
    .max(200, "Search term must be at most 200 characters")
    .optional(),
});

export type ListJobsInput = z.infer<typeof listJobsSchema>;

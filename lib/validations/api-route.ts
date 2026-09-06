import { z } from "zod";

export const postIdParamSchema = z.object({
  postId: z
    .string()
    .trim()
    .regex(/^P-\d{8}$/, "Invalid postId format"),
});

export const jobIdParamSchema = z.object({
  jobId: z
    .string()
    .trim()
    .regex(/^J-\d{8}$/, "Invalid jobId format"),
});

export const adIdParamSchema = z.object({
  adId: z
    .string()
    .trim()
    .regex(/^AD-\d{8}$/, "Invalid adId format"),
});

export const applicationIdParamSchema = z.object({
  applicationId: z
    .string()
    .trim()
    .regex(/^APP-[A-Z0-9]+-[A-Z0-9]+$/, "Invalid applicationId format"),
});

export const deleteApplicationsBodySchema = z
  .object({
    applicationIds: z
      .array(z.string().trim().min(1, "applicationId cannot be empty"))
      .max(500, "Cannot delete more than 500 applications at once")
      .optional(),
  })
  .strict();

export type DeleteApplicationsBodyInput = z.infer<
  typeof deleteApplicationsBodySchema
>;

export const updateApplicationStatusBodySchema = z
  .object({
    status: z.enum(
      [
        "applied",
        "pending",
        "shortlisted",
        "DC",
        "GC",
        "approved",
        "decline",
        "declined",
        "withdrawn",
      ],
      {
        error: "Invalid status value",
      },
    ),
    dcDate: z
      .string()
      .datetime({ message: "dcDate must be a valid ISO date string" })
      .optional(),
    gcDate: z
      .string()
      .datetime({ message: "gcDate must be a valid ISO date string" })
      .optional(),
    approvedAt: z
      .string()
      .datetime({ message: "approvedAt must be a valid ISO date string" })
      .optional(),
    paymentDone: z.boolean().optional(),
    /** ISO datetime: stored on post as paymentDate (if paid) or tentativeDate (if pending). */
    postPaymentDate: z
      .string()
      .datetime({
        message: "postPaymentDate must be a valid ISO date string",
      })
      .optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type UpdateApplicationStatusBodyInput = z.infer<
  typeof updateApplicationStatusBodySchema
>;

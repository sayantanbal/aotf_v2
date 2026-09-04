import mongoose, { Schema, type InferSchemaType } from "mongoose";

export function deriveAccessFromRole(role?: string | null) {
  const normalizedRole =
    role === "teacher_candidate" ? "teacher_candidate" : "teacher";

  return {
    hasTuitionAccess:
      normalizedRole === "teacher" || normalizedRole === "teacher_candidate",
    hasCandidateAccess: normalizedRole === "teacher_candidate",
  };
}

export function deriveOnboardingCompleted(input: {
  detailsCompleted?: boolean | null;
  paymentCompleted?: boolean | null;
  whatsappGroupCompleted?: boolean | null;
}) {
  return Boolean(
    input.detailsCompleted &&
    input.paymentCompleted &&
    input.whatsappGroupCompleted,
  );
}

const planSchema = new Schema(
  {
    current: {
      type: String,
      enum: ["teacher", "teacher_candidate"],
      default: "teacher",
      required: true,
    },
    hasTuitionAccess: { type: Boolean, default: false },
    hasCandidateAccess: { type: Boolean, default: false },
    activatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["teacher", "teacher_candidate", "admin"],
      default: "teacher",
      required: true,
    },
    hasTuitionAccess: { type: Boolean, default: false },
    hasCandidateAccess: { type: Boolean, default: false },
    createdByAdmin: { type: Boolean, default: false },
    createdByAdminClerkId: { type: String, default: null },
    detailsCompleted: { type: Boolean, default: false },
    paymentCompleted: { type: Boolean, default: false },
    whatsappGroupCompleted: { type: Boolean, default: false },
    plan: { type: planSchema, default: () => ({}) },
    onboardingCompleted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "blocked", "deleted"],
      default: "active",
      index: true,
    },
    registrationPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    // Tracks when the 5-day warning email was sent (null = not yet sent).
    deletionWarningEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", function () {
  const resolvedRole =
    this.role === "teacher_candidate"
      ? "teacher_candidate"
      : this.role === "teacher"
        ? "teacher"
        : (this.plan?.current ?? "teacher");
  const access = deriveAccessFromRole(resolvedRole);

  if (!this.plan || typeof this.plan !== "object") {
    this.plan = {
      current: resolvedRole,
      hasTuitionAccess: access.hasTuitionAccess,
      hasCandidateAccess: access.hasCandidateAccess,
    };
  }

  this.plan.current = resolvedRole;
  this.plan.hasTuitionAccess = access.hasTuitionAccess;
  this.plan.hasCandidateAccess = access.hasCandidateAccess;

  this.hasTuitionAccess = access.hasTuitionAccess;
  this.hasCandidateAccess = access.hasCandidateAccess;
  this.detailsCompleted = Boolean(this.detailsCompleted);
  this.paymentCompleted = Boolean(this.paymentCompleted);
  this.whatsappGroupCompleted = Boolean(this.whatsappGroupCompleted);
  this.onboardingCompleted = deriveOnboardingCompleted({
    detailsCompleted: this.detailsCompleted,
    paymentCompleted: this.paymentCompleted,
    whatsappGroupCompleted: this.whatsappGroupCompleted,
  });
});

// Case-insensitive unique username index.
userSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: "en_US", strength: 2 } },
);

export type IUser = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ??
  mongoose.model<IUser>("User", userSchema);

export default User;

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const permissionsSchema = new Schema(
  {
    // User management
    canManageUsers: { type: Boolean, default: false },
    canBlockUsers: { type: Boolean, default: false },

    // Content management
    canManagePosts: { type: Boolean, default: false },
    canManageJobs: { type: Boolean, default: false },
    canCreateTuitionPosts: { type: Boolean, default: false },
    canCreateJobPosts: { type: Boolean, default: false },
    canEditPosts: { type: Boolean, default: false },
    canDeletePosts: { type: Boolean, default: false },
    canManageWhatsAppGroups: { type: Boolean, default: false },

    // Customer support
    canHandleEnquiries: { type: Boolean, default: false },
    canHandleFeedbacks: { type: Boolean, default: false },
    canUpdateEnquiryStatus: { type: Boolean, default: false },
    canCallApplicants: { type: Boolean, default: false },

    // Financial operations
    canProcessRefunds: { type: Boolean, default: false },
    canViewPayments: { type: Boolean, default: false },
    canRecoverPayments: { type: Boolean, default: false },

    // Analytics & Reporting
    canViewAnalytics: { type: Boolean, default: false },
    canExportData: { type: Boolean, default: false },

    // Admin management (only super_admin and admin roles)
    canManageAdmins: { type: Boolean, default: false },
    canCreateAdmins: { type: Boolean, default: false },
    canEditAdmins: { type: Boolean, default: false },
    canDeactivateAdmins: { type: Boolean, default: false },
    canResetAdminPasswords: { type: Boolean, default: false },
    canTerminateAdmins: { type: Boolean, default: false },
    canViewAuditLogs: { type: Boolean, default: false },
  },
  { _id: false },
);

const adminSchema = new Schema(
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
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: { type: permissionsSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    payoutPercentage: { type: Number, default: 0, min: 0, max: 100 },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLoginAt: { type: Date, default: null },
    requirePasswordChange: { type: Boolean, default: false },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    terminatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    terminatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ isLocked: 1 });

// Helper method to get default permissions based on role
adminSchema.statics.getDefaultPermissions = function (role: string) {
  switch (role) {
    case "super_admin":
      return {
        canManageUsers: true,
        canBlockUsers: true,
        canManagePosts: true,
        canManageJobs: true,
        canCreateTuitionPosts: true,
        canCreateJobPosts: true,
        canEditPosts: true,
        canDeletePosts: true,
        canManageWhatsAppGroups: true,
        canHandleEnquiries: true,
        canHandleFeedbacks: true,
        canUpdateEnquiryStatus: true,
        canCallApplicants: true,
        canProcessRefunds: true,
        canViewPayments: true,
        canRecoverPayments: true,
        canViewAnalytics: true,
        canExportData: true,
        canManageAdmins: true,
        canCreateAdmins: true,
        canEditAdmins: true,
        canDeactivateAdmins: true,
        canResetAdminPasswords: true,
        canTerminateAdmins: true,
        canViewAuditLogs: true,
      };
    case "admin": // Sub-superadmin
      return {
        canManageUsers: false,
        canBlockUsers: false,
        canManagePosts: true,
        canManageJobs: true,
        canCreateTuitionPosts: true,
        canCreateJobPosts: true,
        canEditPosts: true,
        canDeletePosts: true,
        canManageWhatsAppGroups: false,
        canHandleEnquiries: true,
        canHandleFeedbacks: true,
        canUpdateEnquiryStatus: true,
        canCallApplicants: true,
        canProcessRefunds: false,
        canViewPayments: true,
        canRecoverPayments: false,
        canViewAnalytics: false,
        canExportData: false,
        canManageAdmins: true, // Can manage support admins only
        canCreateAdmins: false, // Cannot create new admins
        canEditAdmins: true, // Can edit support admins only
        canDeactivateAdmins: true, // Can deactivate support admins only
        canResetAdminPasswords: false,
        canTerminateAdmins: false,
        canViewAuditLogs: true,
      };
    case "support_admin": // Support
      return {
        canManageUsers: false,
        canBlockUsers: false,
        canManagePosts: false,
        canManageJobs: false,
        canCreateTuitionPosts: false,
        canCreateJobPosts: false,
        canEditPosts: false,
        canDeletePosts: false,
        canManageWhatsAppGroups: false,
        canHandleEnquiries: true,
        canHandleFeedbacks: true,
        canUpdateEnquiryStatus: true,
        canCallApplicants: true,
        canProcessRefunds: false,
        canViewPayments: false,
        canRecoverPayments: false,
        canViewAnalytics: false,
        canExportData: false,
        canManageAdmins: false,
        canCreateAdmins: false,
        canEditAdmins: false,
        canDeactivateAdmins: false,
        canResetAdminPasswords: false,
        canTerminateAdmins: false,
        canViewAuditLogs: false,
      };
    default:
      return {};
  }
};

export type IAdmin = InferSchemaType<typeof adminSchema> & {
  _id: mongoose.Types.ObjectId;
};

export interface IAdminModel extends mongoose.Model<IAdmin> {
  getDefaultPermissions(role: string): Record<string, boolean>;
}

if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as Record<string, unknown>).Admin;
}

// ─── Google Sheets write-through hooks ───────────────────────────────────────
// (Admin syncing to Google Sheets has been removed by request)

const Admin =
  (mongoose.models.Admin as IAdminModel) ??
  mongoose.model<IAdmin, IAdminModel>("Admin", adminSchema);

export default Admin;

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    adminClerkId: {
      type: String,
      required: true,
    },
    adminUsername: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Admin management
        "admin.created",
        "admin.updated",
        "admin.deactivated",
        "admin.reactivated",
        "admin.terminated",
        "admin.unlocked",
        "admin.password_reset",
        "admin.permissions_updated",

        // User management
        "user.blocked",
        "user.unblocked",
        "user.deleted",

        // Content management
        "post.created",
        "post.updated",
        "post.deleted",
        "job.created",
        "job.updated",
        "job.deleted",

        // Enquiry management
        "enquiry.status_updated",
        "enquiry.assigned",
        "enquiry.feedback_added",

        // Financial
        "refund.processed",
        "refund.rejected",

        // System
        "settings.updated",
        "data.exported",
      ],
    },
    targetType: {
      type: String,
      enum: [
        "Admin",
        "User",
        "Post",
        "Job",
        "Enquiry",
        "Payment",
        "Settings",
        "System",
      ],
      default: null,
    },
    targetId: {
      type: String,
      default: null,
    },
    targetIdentifier: {
      type: String,
      default: null, // username, email, or readable identifier
    },
    details: {
      type: Schema.Types.Mixed,
      default: null, // Additional action-specific details
    },
    changes: {
      type: Schema.Types.Mixed,
      default: null, // Before/after changes
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 }); // For general audit log queries

export type IAuditLog = InferSchemaType<typeof auditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) ??
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;

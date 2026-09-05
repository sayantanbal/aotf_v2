import mongoose, { Schema, Document, Model, models } from "mongoose";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "./Enquiry";

export const ADMIN_ROLES = ["super_admin", "admin", "support_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface IEnqStatus extends Document {
  enquiryId: mongoose.Types.ObjectId;
  attemptNumber: number;
  adminId: mongoose.Types.ObjectId;
  adminName: string;
  adminRole: AdminRole;
  fromStatus: EnquiryStatus;
  toStatus: EnquiryStatus;
  action: string;
  notes?: string;
  actionAt: Date;
}

const EnqStatusSchema = new Schema<IEnqStatus>(
  {
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true },
    attemptNumber: { type: Number, required: true },
    adminId: { type: Schema.Types.ObjectId, required: true },
    adminName: { type: String, required: true },
    adminRole: { type: String, enum: ADMIN_ROLES, required: true },
    fromStatus: { type: String, enum: ENQUIRY_STATUSES, required: true },
    toStatus: { type: String, enum: ENQUIRY_STATUSES, required: true },
    action: { type: String, required: true },
    notes: { type: String },
    actionAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "enqStatus", // match your collection name
  },
);

// Indexes matching DB design
EnqStatusSchema.index(
  { enquiryId: 1, attemptNumber: 1 },
  { name: "enqStatus_ix_1", unique: true },
);
EnqStatusSchema.index(
  { enquiryId: 1, actionAt: -1 },
  { name: "enqStatus_ix_2" },
);
EnqStatusSchema.index({ adminId: 1, actionAt: -1 }, { name: "enqStatus_ix_3" });

const EnqStatus: Model<IEnqStatus> =
  models.EnqStatus || mongoose.model<IEnqStatus>("EnqStatus", EnqStatusSchema);

export default EnqStatus;

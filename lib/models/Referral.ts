import mongoose, { Schema, type Document, type Model, models } from "mongoose";

export interface IReferral extends Document {
  postId: string;
  referralUserName: string;
  referralPhoneNumber: string;
  createdByAdminClerkId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    postId: { type: String, required: true, unique: true, index: true },
    referralUserName: { type: String, required: true },
    referralPhoneNumber: { type: String, required: true },
    createdByAdminClerkId: { type: String },
  },
  {
    timestamps: true,
    collection: "referrals",
  },
);

const Referral: Model<IReferral> =
  models.Referral || mongoose.model<IReferral>("Referral", ReferralSchema);

export default Referral;

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const whatsappGroupLinkSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "full", "archived", "custom"],
      default: "active",
      index: true,
    },
    capacity: {
      type: Number,
      default: 1024,
    },
    memberCount: {
      type: Number,
      default: 0,
    },
    ordering: {
      type: Number,
      default: 0,
    },
    creatorClerkId: {
      type: String,
      default: null,
    },
    updaterClerkId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export type IWhatsAppGroupLink = InferSchemaType<typeof whatsappGroupLinkSchema> & {
  _id: mongoose.Types.ObjectId;
};

const WhatsAppGroupLink =
  (mongoose.models.WhatsAppGroupLink as mongoose.Model<IWhatsAppGroupLink>) ??
  mongoose.model<IWhatsAppGroupLink>("WhatsAppGroupLink", whatsappGroupLinkSchema);

export default WhatsAppGroupLink;

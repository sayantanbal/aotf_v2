import mongoose, { Schema, Document, Model, models } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = ["paid", "unpaid", "partial"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IContactInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface IServiceProvider {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  signatureUrl?: string;
}

export interface ILineItem {
  name: string;
  description?: string;
  quantity: number;
  unitAmount: number;
  total: number;
  /** Tuition-specific metadata */
  postDetails?: {
    postId?: string;
    preferredTime?: string;
    preferredDays?: string[];
    location?: string;
    classType?: string;
    frequencyPerWeek?: number;
  };
}

export interface IAmountSummary {
  currency: string;
  subTotal: number;
  taxPercentage: number;
  taxAmount: number;
  grandTotal: number;
}

export interface IAssignedTeacher {
  name: string;
  phone?: string;
}

export interface IPartialPayment {
  /** Amount already paid */
  amountPaid: number;
  /** Percentage of total paid (0-100) */
  percentagePaid: number;
  /** Amount still outstanding */
  amountDue: number;
}

export interface IBreakdown {
  items: ILineItem[];
  notes?: string;
}

// ─── Main Document ────────────────────────────────────────────────────────────

export interface IInvoice extends Document {
  /** Human-readable identifier, e.g. "INV-ABC123". Unique. */
  invoiceId: string;
  /** Invoice version (1-indexed, increments on each revision) */
  version: number;
  /** Only the latest version is `true` for a given invoiceId */
  isLatest: boolean;
  /** AOTF (service provider) details */
  source: IContactInfo;
  /** Client / guardian details */
  recipient: IContactInfo;
  /** AOTF as service provider (with website / signature) */
  serviceProvider: IServiceProvider;
  /** Financial summary */
  amount: IAmountSummary;
  /** Line items + notes */
  breakdown: IBreakdown;
  paymentStatus: PaymentStatus;
  /** Populated only when paymentStatus === "partial" */
  partialPayment?: IPartialPayment;
  /** Date of payment (paid / partial) */
  paymentDate?: Date;
  /** Invoice creation date (set by admin) */
  invoiceDate: Date;
  /** Due date */
  dueDate?: Date;
  /** Link to the tuition post this invoice belongs to */
  /** Teacher assigned to this tuition (snapshotted from approved application) */
  assignedTeacher?: IAssignedTeacher;
  postId?: string;
  referredPostIds?: string[];
  referredJobIds?: string[];
  referralPhoneNumber?: string;
  /** Link to project (if used for project invoices) */
  projectId?: string;
  /** Reason for this revision (if version > 1) */
  revisionReason?: string;
  /** Which form version was used during revision */
  revisedFormVersion?: number;
  /** Admin who made the revision */
  revisedByAdminId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const ContactInfoSchema = new Schema<IContactInfo>(
  {
    name: { type: String, required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
  },
  { _id: false },
);

const ServiceProviderSchema = new Schema<IServiceProvider>(
  {
    name: { type: String, required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    websiteUrl: { type: String },
    signatureUrl: { type: String },
  },
  { _id: false },
);

const PostDetailsSchema = new Schema(
  {
    postId: { type: String },
    preferredTime: { type: String },
    preferredDays: { type: [String] },
    location: { type: String },
    classType: { type: String },
    frequencyPerWeek: { type: Number },
  },
  { _id: false },
);

const LineItemSchema = new Schema<ILineItem>(
  {
    name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number, required: true, min: 0 },
    unitAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    postDetails: { type: PostDetailsSchema },
  },
  { _id: false },
);

const AmountSummarySchema = new Schema<IAmountSummary>(
  {
    currency: { type: String, required: true, default: "INR" },
    subTotal: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, required: true, default: 0, min: 0 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PartialPaymentSchema = new Schema<IPartialPayment>(
  {
    amountPaid: { type: Number, required: true, min: 0 },
    percentagePaid: { type: Number, required: true, min: 0, max: 100 },
    amountDue: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const AssignedTeacherSchema = new Schema<IAssignedTeacher>(
  {
    name: { type: String, required: true },
    phone: { type: String },
  },
  { _id: false },
);

const BreakdownSchema = new Schema<IBreakdown>(
  {
    items: { type: [LineItemSchema], required: true },
    notes: { type: String },
  },
  { _id: false },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceId: { type: String, required: true, unique: true },
    version: { type: Number, required: true, default: 1 },
    isLatest: { type: Boolean, required: true, default: true },

    source: { type: ContactInfoSchema, required: true },
    recipient: { type: ContactInfoSchema, required: true },
    serviceProvider: { type: ServiceProviderSchema, required: true },
    amount: { type: AmountSummarySchema, required: true },
    breakdown: { type: BreakdownSchema, required: true },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: "unpaid",
    },
    partialPayment: { type: PartialPaymentSchema },
    paymentDate: { type: Date },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date },

    assignedTeacher: { type: AssignedTeacherSchema },
    postId: { type: String },
    referredPostIds: { type: [String] },
    referredJobIds: { type: [String] },
    referralPhoneNumber: { type: String },
    projectId: { type: String },

    revisionReason: { type: String },
    revisedFormVersion: { type: Number },
    revisedByAdminId: { type: Schema.Types.ObjectId },
  },
  {
    timestamps: true,
    collection: "invoices",
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

InvoiceSchema.index({ paymentStatus: 1 }, { background: true });
InvoiceSchema.index({ postId: 1 }, { background: true });
InvoiceSchema.index({ projectId: 1 }, { background: true });
InvoiceSchema.index({ createdAt: -1 }, { background: true });
InvoiceSchema.index({ isLatest: 1, createdAt: -1 }, { background: true });

// ─── Model ────────────────────────────────────────────────────────────────────

const Invoice: Model<IInvoice> =
  models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;

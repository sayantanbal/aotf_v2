import mongoose, { Schema, Document, Model, models } from "mongoose";
import { sourceLists } from "@/lib/validations/forms";

// ─── Enums ──────────────────────────────────────────────────────────────

export const WORK_TYPES = ["job", "project"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const COMPANY_TYPES = ["individual", "company"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const LOCATION_TYPES = ["remote", "onsite", "hybrid"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const GENDER_PREFERENCES = ["male", "female", "both", "all"] as const;
export type GenderPreference = (typeof GENDER_PREFERENCES)[number];

export const PROJECT_TYPES = ["one-time", "ongoing"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const JOB_STATUSES = ["open", "closed", "hold", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const COMMISSION_BASIS_TYPES = ["first_month", "project_value"] as const;
export type CommissionBasis = (typeof COMMISSION_BASIS_TYPES)[number];

// ─── Main Document: Job ─────────────────────────────────────────────────

export interface IJob extends Document {
  jobId: string;
  enquiryId?: mongoose.Types.ObjectId;
  workType: WorkType;
  title: string;
  clientName: string;
  phoneNumber: string;
  source: string;
  referralUserName?: string;
  companyName?: string;
  companyType: CompanyType;
  locationType: LocationType;
  location: string;
  timing: string;
  experience?: string;
  gender: GenderPreference;
  salary?: string;
  skillsRequired?: string;
  travelRequirements?: string;
  requiredQualification?: string;
  projectType?: ProjectType;
  budget?: string;
  duration?: string;
  brief?: string;
  status: JobStatus;
  commissionBasis: CommissionBasis;
  academyCommissionPercentage: number;
  settledAmount?: number;
  invoiceGenerated?: boolean;
  invoiceId?: string;
  createdByAdminClerkId?: string;
  updatedByAdminClerkId?: string;
  createdByAdminId?: mongoose.Types.ObjectId;
  updatedByAdminId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    jobId: { type: String, required: true, unique: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry" },
    workType: {
      type: String,
      enum: WORK_TYPES,
      required: true,
    },
    title: { type: String, required: true },
    clientName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    source: {
      type: String,
      enum: sourceLists.map((source) => source.key),
      required: true,
    },
    referralUserName: { type: String },
    companyName: { type: String },
    companyType: {
      type: String,
      enum: COMPANY_TYPES,
      required: true,
    },
    locationType: {
      type: String,
      enum: LOCATION_TYPES,
      required: true,
    },
    location: { type: String, required: true },
    timing: { type: String, required: true },
    experience: { type: String },
    gender: {
      type: String,
      enum: GENDER_PREFERENCES,
      required: true,
    },
    salary: { type: String },
    skillsRequired: { type: String },
    travelRequirements: { type: String },
    requiredQualification: { type: String },
    projectType: {
      type: String,
      enum: PROJECT_TYPES,
    },
    budget: { type: String },
    duration: { type: String },
    brief: { type: String },
    status: {
      type: String,
      enum: JOB_STATUSES,
      required: true,
      default: "open",
    },
    commissionBasis: {
      type: String,
      enum: COMMISSION_BASIS_TYPES,
      required: true,
    },
    academyCommissionPercentage: {
      type: Number,
      required: true,
    },
    settledAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    invoiceGenerated: { type: Boolean, default: false },
    invoiceId: { type: String, default: null },
    createdByAdminClerkId: {
      type: String,
      default: null,
    },
    updatedByAdminClerkId: {
      type: String,
      default: null,
    },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    updatedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "jobs",
  },
);

JobSchema.index({ createdByAdminClerkId: 1, createdAt: -1 });

const Job: Model<IJob> = models.Job || mongoose.model<IJob>("Job", JobSchema);

if (!Job.schema.path("source")) {
  Job.schema.add({
    source: {
      type: String,
      enum: sourceLists.map((source) => source.key),
      required: true,
    },
  });
}

if (!Job.schema.path("createdByAdminClerkId")) {
  Job.schema.add({
    createdByAdminClerkId: {
      type: String,
      default: null,
    },
  });
}

if (!Job.schema.path("updatedByAdminClerkId")) {
  Job.schema.add({
    updatedByAdminClerkId: {
      type: String,
      default: null,
    },
  });
}

if (!Job.schema.path("createdByAdminId")) {
  Job.schema.add({
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  });
}

if (!Job.schema.path("updatedByAdminId")) {
  Job.schema.add({
    updatedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  });
}

if (!Job.schema.path("companyName")) {
  Job.schema.add({ companyName: { type: String } });
}

if (!Job.schema.path("skillsRequired")) {
  Job.schema.add({ skillsRequired: { type: String } });
}

if (!Job.schema.path("travelRequirements")) {
  Job.schema.add({ travelRequirements: { type: String } });
}

if (!Job.schema.path("settledAmount")) {
  Job.schema.add({ settledAmount: { type: Number, min: 0, default: null } });
}

if (!Job.schema.path("invoiceGenerated")) {
  Job.schema.add({ invoiceGenerated: { type: Boolean, default: false } });
}

if (!Job.schema.path("invoiceId")) {
  Job.schema.add({ invoiceId: { type: String, default: null } });
}

export default Job;

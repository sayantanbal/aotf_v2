import mongoose, { Schema, Document, Model, models } from "mongoose";
import {
  upsertCalendarEvent,
  deleteCalendarEvent,
  mapApplication,
} from "@/lib/services/calendar-event.service";

// ─── Enums ──────────────────────────────────────────────────────────────

export const APPLICANT_TYPES = ["teacher", "candidate"] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export const APPLICATION_STATUSES = [
  "applied",
  "pending",
  "shortlisted",
  "DC",
  "GC",
  "approved",
  "decline",
  "declined",
  "auto_declined",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// ─── Sub-documents ──────────────────────────────────────────────────────

export interface IApplicantSnapshot {
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  board?: string | null;
  qualification?: string | null;
  teachingExp?: string | null;
  address?: string | null;
}

const ApplicantSnapshotSchema = new Schema<IApplicantSnapshot>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    board: { type: String, default: null },
    qualification: { type: String, default: null },
    teachingExp: { type: String, default: null },
    address: { type: String, default: null },
  },
  { _id: false },
);

export interface IDeclineMeta {
  reason?: string;
  autoDeclinedBecauseApplicationId?: mongoose.Types.ObjectId;
  declinedByAdminId?: mongoose.Types.ObjectId;
  declinedAt?: Date;
}

const DeclineMetaSchema = new Schema<IDeclineMeta>(
  {
    reason: { type: String },
    autoDeclinedBecauseApplicationId: { type: Schema.Types.ObjectId },
    declinedByAdminId: { type: Schema.Types.ObjectId },
    declinedAt: { type: Date },
  },
  { _id: false },
);

export interface IApprovalMeta {
  approvedByAdminId?: mongoose.Types.ObjectId;
  approvedAt?: Date;
}

const ApprovalMetaSchema = new Schema<IApprovalMeta>(
  {
    approvedByAdminId: { type: Schema.Types.ObjectId },
    approvedAt: { type: Date },
  },
  { _id: false },
);

export interface IDCMeta {
  scheduledDate: Date;
  setByAdminId: mongoose.Types.ObjectId;
  setAt: Date;
}

const DCMetaSchema = new Schema<IDCMeta>(
  {
    scheduledDate: { type: Date, required: true },
    setByAdminId: { type: Schema.Types.ObjectId, required: true },
    setAt: { type: Date, required: true },
  },
  { _id: false },
);

export interface IGCMeta {
  scheduledDate: Date;
  setByAdminId: mongoose.Types.ObjectId;
  setAt: Date;
}

const GCMetaSchema = new Schema<IGCMeta>(
  {
    scheduledDate: { type: Date, required: true },
    setByAdminId: { type: Schema.Types.ObjectId, required: true },
    setAt: { type: Date, required: true },
  },
  { _id: false },
);

// ─── Main Document: Application ─────────────────────────────────────────

export interface IApplication extends Document {
  applicationId: string;
  jobId?: mongoose.Types.ObjectId;
  jobIdPublic?: string;
  postId?: string;
  applicantId: mongoose.Types.ObjectId;
  profileId: string;
  applicantType: ApplicantType;
  applicantSnapshot: IApplicantSnapshot;
  coverLetter?: string;
  status: ApplicationStatus;
  dcDate?: Date;
  dcMeta?: IDCMeta;
  gcMeta?: IGCMeta;
  declineMeta?: IDeclineMeta;
  approvalMeta?: IApprovalMeta;
  isActive: boolean;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    applicationId: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    jobIdPublic: { type: String },
    postId: { type: String },
    applicantId: { type: Schema.Types.ObjectId, required: true },
    profileId: { type: String, required: true },
    applicantType: {
      type: String,
      enum: APPLICANT_TYPES,
      required: true,
    },
    applicantSnapshot: {
      type: ApplicantSnapshotSchema,
      required: true,
    },
    coverLetter: { type: String },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      required: true,
      default: "applied",
    },
    dcDate: { type: Date },
    dcMeta: { type: DCMetaSchema },
    gcMeta: { type: GCMetaSchema },
    declineMeta: { type: DeclineMetaSchema },
    approvalMeta: { type: ApprovalMetaSchema },
    isActive: { type: Boolean, required: true, default: true },
    appliedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: "applications",
  },
);

// ─── Indexes ────────────────────────────────────────────────────────────

ApplicationSchema.index({ applicationId: 1 }, { unique: true });
ApplicationSchema.index({ applicantId: 1 });
ApplicationSchema.index({ jobId: 1 });
ApplicationSchema.index({ postId: 1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index(
  { jobId: 1, applicantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      jobId: { $exists: true, $type: "objectId" },
      applicantId: { $exists: true },
    },
  },
);
ApplicationSchema.index(
  { postId: 1, applicantId: 1, applicantType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      postId: { $type: "string" },
      applicantId: { $exists: true },
      applicantType: { $exists: true },
    },
  },
);
ApplicationSchema.index({ jobId: 1, status: 1 });
ApplicationSchema.index({ postId: 1, status: 1 });
ApplicationSchema.index({ applicantId: 1, status: 1 });
ApplicationSchema.index({ applicantType: 1, status: 1 });
ApplicationSchema.index({ appliedAt: -1 });

// ─── Calendar write-through hooks ──────────────────────────────────────────
//
// post('save')            → fires after Application.create() / doc.save()
// post('findOneAndUpdate') → fires after findOneAndUpdate / findByIdAndUpdate
//                            NOTE: only called when the query returns a doc
//                            (i.e. the document must exist and { new:true } or
//                            the default old-doc behaviour both work here since
//                            we re-fetch from the result)
// post('findOneAndDelete') → fires after findOneAndDelete / findByIdAndDelete
//
// updateMany is intentionally excluded — the hook doesn't receive individual
// updated docs. The auto-decline path in application.service.ts handles it
// explicitly with a follow-up bulk-upsert.

ApplicationSchema.post("save", function (doc) {
  const input = mapApplication(doc.toObject());
  if (input) void upsertCalendarEvent(input);
});

ApplicationSchema.post("findOneAndUpdate", function (doc) {
  if (!doc) return;
  const input = mapApplication(
    typeof doc.toObject === "function"
      ? doc.toObject()
      : (doc as unknown as Record<string, any>),
  );
  if (input) void upsertCalendarEvent(input);
});

ApplicationSchema.post("findOneAndDelete", function (doc) {
  if (!doc) return;
  const raw =
    typeof doc.toObject === "function"
      ? doc.toObject()
      : (doc as unknown as Record<string, any>);
  const id = raw._id?.toString?.() ?? "";
  const isTuition = typeof raw.postId === "string" && raw.postId;
  if (isTuition) {
    void deleteCalendarEvent(`application:${id}:tuition`);
  } else if (typeof raw.jobIdPublic === "string" && raw.jobIdPublic) {
    void deleteCalendarEvent(`application:${id}:job`);
  }
});

const Application: Model<IApplication> =
  models.Application ||
  mongoose.model<IApplication>("Application", ApplicationSchema);

let applicationIndexMigrationPromise: Promise<void> | null = null;

type MongoIndexDefinition = {
  name: string;
  unique?: boolean;
  partialFilterExpression?: {
    jobId?: { $exists?: boolean; $type?: string };
    applicantId?: { $exists?: boolean };
  };
};

function isExpectedJobApplicantIndex(index?: MongoIndexDefinition): boolean {
  return Boolean(
    index?.unique &&
    index.partialFilterExpression?.jobId?.$exists === true &&
    index.partialFilterExpression?.jobId?.$type === "objectId" &&
    index.partialFilterExpression?.applicantId?.$exists === true,
  );
}

export async function ensureApplicationIndexes(): Promise<void> {
  if (applicationIndexMigrationPromise) {
    return applicationIndexMigrationPromise;
  }

  applicationIndexMigrationPromise = (async () => {
    const collection = Application.collection;
    let indexes = (await collection.indexes()) as MongoIndexDefinition[];
    const existingJobApplicantIndex = indexes.find(
      (index) => index.name === "jobId_1_applicantId_1",
    );

    if (
      existingJobApplicantIndex &&
      !isExpectedJobApplicantIndex(existingJobApplicantIndex)
    ) {
      await collection.dropIndex("jobId_1_applicantId_1");
      indexes = (await collection.indexes()) as MongoIndexDefinition[];
    }

    const jobApplicantIndex = indexes.find(
      (index) => index.name === "jobId_1_applicantId_1",
    );

    if (!isExpectedJobApplicantIndex(jobApplicantIndex)) {
      await collection.createIndex(
        { jobId: 1, applicantId: 1 },
        {
          name: "jobId_1_applicantId_1",
          unique: true,
          partialFilterExpression: {
            jobId: { $exists: true, $type: "objectId" },
            applicantId: { $exists: true },
          },
        },
      );
    }
  })().catch((error) => {
    applicationIndexMigrationPromise = null;
    throw error;
  });

  return applicationIndexMigrationPromise;
}

export default Application;

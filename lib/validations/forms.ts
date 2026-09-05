/**
 * lib/validations/forms.ts
 *
 * Single source of truth for all admin form data:
 *   - Dropdown / radio option arrays
 *   - Default initial form values
 *   - API field-transform maps
 *   - Zod validation schemas + inferred types
 *
 * Import from here in form components AND API routes — never duplicate.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// TUITION FORM — OPTION ARRAYS
// ─────────────────────────────────────────────────────────────────────────────

export const subjects = [
  { key: "bengali", label: "Bengali" },
  { key: "biology", label: "Biology" },
  { key: "chemistry", label: "Chemistry" },
  { key: "english", label: "English" },
  { key: "french", label: "French" },
  { key: "geography", label: "Geography" },
  { key: "hindi", label: "Hindi" },
  { key: "history", label: "History" },
  { key: "mathematics", label: "Mathematics" },
  { key: "philosophy", label: "Philosophy" },
  { key: "physics", label: "Physics" },
  { key: "political-science", label: "Political Science" },
  { key: "psychology", label: "Psychology" },
  { key: "sanskrit", label: "Sanskrit" },
  { key: "science", label: "Science" },
  { key: "social-studies", label: "Social Studies" },
  { key: "sociology", label: "Sociology" },

  { key: "computer", label: "Computer" },
  { key: "computer-science", label: "Computer Science" },
  { key: "computer-application", label: "Computer Application" },

  { key: "statistics", label: "Statistics" },
  { key: "economics", label: "Economics" },
  { key: "commerce", label: "Commerce" },
  { key: "accountancy", label: "Accountancy" },
  { key: "business-studies", label: "Business Studies" },
  { key: "entrepreneurship", label: "Entrepreneurship" },

  { key: "drawing", label: "Drawing / Art" },
  { key: "music", label: "Music" },
  { key: "swimming", label: "Swimming" },
] as const;

export const boards = [
  { key: "CBSE", label: "CBSE" },
  { key: "ICSE", label: "ICSE" },
  { key: "ISC", label: "ISC" },
  { key: "IB", label: "IB" },
  { key: "WB-Bengali", label: "WB-Bengali Medium" },
  { key: "WB-English", label: "WB-English Medium" },
] as const;

export const classes = [
  { key: "nursery", label: "Nursery" },
  { key: "kg1", label: "Kindergarten-1" },
  { key: "kg2", label: "Kindergarten-2" },
  { key: "1", label: "Class 1" },
  { key: "2", label: "Class 2" },
  { key: "3", label: "Class 3" },
  { key: "4", label: "Class 4" },
  { key: "5", label: "Class 5" },
  { key: "6", label: "Class 6" },
  { key: "7", label: "Class 7" },
  { key: "8", label: "Class 8" },
  { key: "9", label: "Class 9" },
  { key: "10", label: "Class 10" },
  { key: "11", label: "Class 11" },
  { key: "12", label: "Class 12" },
  { key: "bsc", label: "B.Sc" },
  { key: "ba", label: "B.A" },
  { key: "bcom", label: "B.Com" },
  { key: "msc", label: "M.Sc" },
  { key: "ma", label: "M.A" },
  { key: "mcom", label: "M.Com" },
  { key: "btech", label: "B.Tech" },
  { key: "mtech", label: "M.Tech" },
  { key: "bca", label: "B.C.A" },
  { key: "mca", label: "M.C.A" },
] as const;

export const frequencies = [
  { key: "1", label: "1 day/week" },
  { key: "2", label: "2 days/week" },
  { key: "3", label: "3 days/week" },
  { key: "4", label: "4 days/week" },
  { key: "5", label: "5 days/week" },
  { key: "6", label: "6 days/week" },
  { key: "7", label: "Everyday" },
] as const;

/** Ordered Mon → Sun */
export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const classTypes = [
  { key: "in-person", label: "In-Person" },
  { key: "online", label: "Online" },
  { key: "both", label: "Both" },
] as const;

/** Maps form classType value → API classType value */
export const classTypeToApi: Record<string, string> = {
  "in-person": "offline",
  online: "online",
  both: "both",
};

/** Maps API classType value → form classType value */
export const classTypeFromApi: Record<string, string> = {
  offline: "in-person",
  online: "online",
  both: "both",
};

export const tuitionStatuses = [
  { key: "open", label: "Open" },
  { key: "matched", label: "Matched" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "hold", label: "Hold" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// JOB FORM — OPTION ARRAYS
// ─────────────────────────────────────────────────────────────────────────────

export const companyTypes = [
  { key: "individual", label: "Individual" },
  { key: "company", label: "Company" },
] as const;

export const workTypes = [
  { key: "job", label: "Job" },
  { key: "project", label: "Project" },
] as const;

export const locationTypes = [
  { key: "on-site", label: "On-Site" },
  { key: "remote", label: "Remote" },
  { key: "hybrid", label: "Hybrid" },
] as const;

/** Maps form locationType → API locationType */
export const locationTypeToApi: Record<string, string> = {
  "on-site": "onsite",
  remote: "remote",
  hybrid: "hybrid",
};

/** Maps API locationType → form locationType */
export const locationTypeFromApi: Record<string, string> = {
  onsite: "on-site",
  remote: "remote",
  hybrid: "hybrid",
};

export const genderPreferences = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "both", label: "Both" },
  { key: "all", label: "All" },
  { key: "others", label: "Others" },
] as const;

/** Maps form genderPreference → API gender value */
export const genderToApi: Record<string, string> = {
  male: "male",
  female: "female",
  both: "both",
  all: "all",
  others: "all",
};

export const commissionBasisTypes = [
  { key: "first_month", label: "First Month Salary" },
  { key: "project_value", label: "Project Value" },
] as const;

export const projectTypes = [
  { key: "one-time", label: "One-Time" },
  { key: "ongoing", label: "Ongoing" },
] as const;

export const experienceLevels = [
  { key: "0-1", label: "0-1 years (Fresher)" },
  { key: "1-3", label: "1-3 years" },
  { key: "3-5", label: "3-5 years" },
  { key: "5-10", label: "5-10 years" },
  { key: "10+", label: "10+ years" },
] as const;

export const jobStatuses = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "hold", label: "Hold" },
  { key: "cancelled", label: "Cancelled" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const sourceLists = [
  { key: "just_dial", label: "Just Dial" },
  { key: "sulekha", label: "Sulekha" },
  { key: "urban_pro", label: "Urban Pro" },
  { key: "social_media", label: "Social Media" },
  { key: "referral", label: "Referral" },
  { key: "other", label: "Other" },
] as const;

export type SourceKey = (typeof sourceLists)[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT FORM VALUES
// ─────────────────────────────────────────────────────────────────────────────

export const tuitionFormDefaults: {
  guardianName: string;
  guardianPhone: string;
  source: SourceKey;
  referralUserName: string;
  referralPhoneNumber: string;
  students: { class: string; subject: string; board: string }[];
  missingSubjects: string[];
  remuneration: string;
  classType: "in-person" | "online" | "both";
  frequency: string;
  preferredTime: string;
  preferredDays: string[];
  preferredLocation: string;
  notes: string;
  status: string;
} = {
  guardianName: "",
  guardianPhone: "",
  source: "just_dial",
  referralUserName: "",
  referralPhoneNumber: "",
  students: [{ class: "", subject: "", board: "" }],
  missingSubjects: [],
  remuneration: "",
  classType: "in-person",
  frequency: "",
  preferredTime: "",
  preferredDays: [],
  preferredLocation: "",
  notes: "",
  status: "open",
};

export const jobFormDefaults: {
  workType: "job" | "project";
  clientName: string;
  clientPhone: string;
  source: SourceKey;
  referralUserName: string;
  referralPhoneNumber: string;
  companyName: string;
  companyType: string;
  designation: string;
  experience: string;
  locationType: "on-site" | "remote" | "hybrid";
  location: string;
  genderPreference: "male" | "female" | "both" | "all" | "others";
  timing: string;
  salary: string;
  travelRequirements: string;
  requiredQualifications: string;
  skillsRequired: string;
  notes: string;
  commissionBasis: "first_month" | "project_value";
  academyCommissionPercentage: string;
  projectType: string;
  budget: string;
  duration: string;
  status: string;
} = {
  workType: "job",
  clientName: "",
  clientPhone: "",
  source: "just_dial",
  referralUserName: "",
  referralPhoneNumber: "",
  companyName: "",
  companyType: "",
  designation: "",
  experience: "",
  locationType: "on-site",
  location: "",
  genderPreference: "all",
  timing: "",
  salary: "",
  travelRequirements: "",
  requiredQualifications: "",
  skillsRequired: "",
  notes: "",
  commissionBasis: "first_month",
  academyCommissionPercentage: "25",
  projectType: "",
  budget: "",
  duration: "",
  status: "open",
};

// ─────────────────────────────────────────────────────────────────────────────
// TUITION POST FORM SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const studentFormSchema = z.object({
  class: z.string().min(1, "Class is required"),
  subject: z.string().min(1, "Subject is required"),
  board: z.string().min(1, "Board is required"),
});

export const tuitionFormSchema = z.object({
  guardianName: z
    .string()
    .min(2, "Guardian name must be at least 2 characters")
    .max(50, "Guardian name must be at most 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  guardianPhone: z.string().min(1, "Phone number is required"),
  source: z.string().trim().min(1, "Source is required"),
  referralUserName: z.string().trim().optional(),
  referralPhoneNumber: z.string().trim().optional(),
  students: z
    .array(studentFormSchema)
    .min(1, "At least one student is required"),
  missingSubjects: z.array(z.string()).optional(),
  remuneration: z.string().optional(),
  classType: z.enum(["in-person", "online", "both"]),
  frequency: z.string().optional(),
  preferredTime: z.string().optional(),
  preferredDays: z.array(z.string()).optional(),
  preferredLocation: z.string().min(3, "Preferred location is required"),
  notes: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
export type TuitionFormValues = z.infer<typeof tuitionFormSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// JOB POST FORM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const jobFormSchema = z.object({
  workType: z.enum(["job", "project"]),
  clientName: z
    .string()
    .min(2, "Client name must be at least 2 characters")
    .max(50, "Client name must be at most 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  clientPhone: z.string().min(1, "Phone number is required"),
  source: z.string().trim().min(1, "Source is required"),
  referralUserName: z.string().trim().optional(),
  referralPhoneNumber: z.string().trim().optional(),
  companyName: z.string().optional(),
  companyType: z.enum(["individual", "company"]).optional(),
  designation: z.string().min(2, "Designation is required"),
  experience: z.string().optional(),
  locationType: z.enum(["on-site", "remote", "hybrid"]),
  location: z.string().min(3, "Location is required"),
  genderPreference: z.enum(["male", "female", "both", "all", "others"]),
  timing: z.string().optional(),
  salary: z.string().optional(),
  travelRequirements: z.string().optional(),
  requiredQualifications: z.string().optional(),
  skillsRequired: z.string().optional(),
  notes: z.string().optional(),
  commissionBasis: z.enum(["first_month", "project_value"]),
  academyCommissionPercentage: z.coerce
    .number()
    .int("Commission percentage must be a whole number")
    .min(0, "Commission percentage cannot be negative")
    .max(100, "Commission percentage cannot exceed 100"),
  projectType: z.enum(["one-time", "ongoing"]).optional(),
  budget: z.string().optional(),
  duration: z.string().optional(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ENQUIRY FORM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const enquiryFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number"),
  query: z.string().min(1, "Please enter your query"),
});

export type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FILTER OPTIONS  (used by admin list-page AdminSearchBar)
// ─────────────────────────────────────────────────────────────────────────────

/** All 12 months — key is 1-based numeric string */
export const months = [
  { key: "1", label: "January" },
  { key: "2", label: "February" },
  { key: "3", label: "March" },
  { key: "4", label: "April" },
  { key: "5", label: "May" },
  { key: "6", label: "June" },
  { key: "7", label: "July" },
  { key: "8", label: "August" },
  { key: "9", label: "September" },
  { key: "10", label: "October" },
  { key: "11", label: "November" },
  { key: "12", label: "December" },
] as const;

/** Days 1-31 */
export const days31 = Array.from({ length: 31 }, (_, i) => ({
  key: String(i + 1),
  label: String(i + 1),
}));

/** Last N years descending (default 5) */
export function yearOptions(count = 5): { key: string; label: string }[] {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => ({
    key: String(y - i),
    label: String(y - i),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTES SUGGESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Quick-pick suggestion chips for the tuition "Additional Notes" textarea */
export const tuitionNotesSuggestions = [
  "School Teacher Recommended.",
  "Only Female Teacher Required.",
  "Only Male Teacher Required.",
  "Only English Communication Required.",
  "Aged & Experienced teacher required.",
  "English and Hindi communication required.",
] as const;

/** Quick-pick suggestion chips for the job "Additional Notes" textarea */
export const jobNotesSuggestions = [
  "Only Female Candidate.",
  "Only Male Candidate.",
  "Freshers Can Apply.",
  "Experienced Candidates Preferred.",
  "Immediate Joining Required.",
  "Salary Negotiable.",
  "Part-Time Available.",
  "Work From Home Option.",
  "Interview on Phone.",
  "Local Candidates Only.",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// FILTER CONFIGS for AdminSearchBar
// ─────────────────────────────────────────────────────────────────────────────

/** Common date-range filters (Year / Month / Day) shared by all list pages */
export const dateFilterConfigs = [
  {
    key: "year",
    label: "Year",
    placeholder: "All Years",
    options: yearOptions(),
  },
  {
    key: "month",
    label: "Month",
    placeholder: "All Months",
    options: months.map((m) => ({ key: m.key, label: m.label })),
  },
  {
    key: "day",
    label: "Day",
    placeholder: "All Days",
    options: days31,
  },
] as const;

/** Status filter for tuition list page */
export const tuitionStatusFilterConfig = {
  key: "status",
  label: "Status",
  placeholder: "All Statuses",
  options: tuitionStatuses.map((s) => ({ key: s.key, label: s.label })),
} as const;

/** Status filter for job list page */
export const jobStatusFilterConfig = {
  key: "status",
  label: "Status",
  placeholder: "All Statuses",
  options: jobStatuses.map((s) => ({ key: s.key, label: s.label })),
} as const;

/** Full filter configs for the tuition admin list page */
export const tuitionListFilterConfigs = [
  tuitionStatusFilterConfig,
  ...dateFilterConfigs,
] as const;

/** Full filter configs for the job admin list page */
export const jobListFilterConfigs = [
  jobStatusFilterConfig,
  ...dateFilterConfigs,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// AD MANAGEMENT — OPTION ARRAYS  (client-safe; mirrors lib/models/Ad.ts enums)
// ─────────────────────────────────────────────────────────────────────────────

export const adStatuses = [
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
] as const;

export const adPlacements = [
  { key: "home_banner", label: "Home Banner" },
  { key: "feed_inline", label: "Feed Inline" },
  { key: "popup", label: "Popup" },
  { key: "footer", label: "Footer" },
] as const;

export const adTypes = [
  { key: "image", label: "Image" },
  { key: "text", label: "Text" },
  { key: "html", label: "HTML" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// AD FILTER CONFIGS for AdminSearchBar
// ─────────────────────────────────────────────────────────────────────────────

/** Status filter for the ads list page */
export const adStatusFilterConfig = {
  key: "status",
  label: "Status",
  placeholder: "All Statuses",
  options: adStatuses.map((s) => ({ key: s.key, label: s.label })),
} as const;

/** Placement filter for the ads list page */
export const adPlacementFilterConfig = {
  key: "placement",
  label: "Placement",
  placeholder: "All Placements",
  options: adPlacements.map((p) => ({ key: p.key, label: p.label })),
} as const;

/** Full filter configs for the ad admin list page */
export const adListFilterConfigs = [
  adStatusFilterConfig,
  adPlacementFilterConfig,
  ...dateFilterConfigs,
] as const;
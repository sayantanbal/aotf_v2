/**
 * lib/utils/share.ts
 *
 * WhatsApp share formatters for tuition posts and job posts.
 * Opens the native WhatsApp share sheet (mobile) or web.whatsapp.com (desktop).
 */

const SITE_URL = "https://aotf.in";

// ─────────────────────────────────────────────────────────────────────────────
// TUITION POST
// ─────────────────────────────────────────────────────────────────────────────

export interface TuitionShareData {
  postId: string;
  /** First student's class, e.g. "10" */
  className: string;
  /** First student's board, e.g. "ICSE" */
  board: string;
  /** Comma-joined subjects, e.g. "Mathematics, Physics" */
  subjects: string;
  /** Monthly budget in ₹ */
  monthlyBudget?: number;
  /** "offline" | "online" | "both" */
  classType: string;
  /** Times per week, e.g. 2 */
  frequencyPerWeek: number;
  /** Preferred days, e.g. ["Mon", "Wed", "Fri"] */
  preferredDays?: string[];
  /** Area / full location string */
  location?: string;
  /** Extra requirements / notes */
  notes?: string;
}

const classTypeLabel: Record<string, string> = {
  offline: "In-person",
  online: "Online",
  both: "Both",
};

const frequencyLabel = (n: number): string => {
  if (n === 1) return "Once/week";
  if (n === 2) return "Twice/week";
  if (n === 3) return "Thrice/week";
  if (n === 7) return "Daily";
  return `${n} days/week`;
};

export function formatTuitionShare(data: TuitionShareData): string {
  const lines: string[] = [
    `▫️ *Class: ${data.className} (${data.board.toUpperCase()})*`,
    `▫️ *Subject: ${data.subjects}*`,
    `▫️ *Budget: ${data.monthlyBudget ? `₹${data.monthlyBudget.toLocaleString("en-IN")}/month` : "To be Discussed"}*`,
    `▫️ Class Type: *${classTypeLabel[data.classType] ?? data.classType}*`,
    `▫️ Frequency: *${frequencyLabel(data.frequencyPerWeek)}*`,
    `▫️ Preferred Days: *${data.preferredDays?.join(", ") || "N/A"}*`,
    `▫️ Location: *${data.location || "N/A"}*`,
    `▫️ Requirements: *${data.notes || "N/A"}*`,
    ``,
    `👉 *Apply here: ${SITE_URL}/posts/${data.postId}*`,
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB POST
// ─────────────────────────────────────────────────────────────────────────────

export interface JobShareData {
  jobId: string;
  title: string;
  companyName?: string;
  location: string;
  salary?: string;
  budget?: string;
  requiredQualification?: string;
  gender?: string;
  workType: "job" | "project";
}

const genderLabel: Record<string, string> = {
  male: "Male",
  female: "Female",
  both: "Both Genders",
  all: "All Genders",
  others: "Others",
};

export function formatJobShare(data: JobShareData): string {
  const pay = data.workType === "project" ? data.budget : data.salary;

  const lines: string[] = [
    `❗️*Urgent ${data.workType === "project" ? "Project" : "Job"} Requirement.*`,
    `▫️ *Designation: ${data.title}*`,
    ...(data.companyName ? [`▫️ *Company: ${data.companyName}*`] : []),
    `▫️ *Location: ${data.location}*`,
    ...(pay ? [`▫️ *${data.workType === "project" ? "Budget" : "Salary"}: ${pay}*`] : []),
    ...(data.requiredQualification
      ? [`▫️ *Required Qualification:* *${data.requiredQualification}*`]
      : []),
    `▫️ *Gender: ${genderLabel[data.gender ?? "all"] ?? data.gender ?? "All Genders"}*`,
    ``,
    `👉 *Apply here: ${SITE_URL}/jobs/${data.jobId}*`,
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN WHATSAPP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens WhatsApp with a pre-filled message.
 * On mobile this triggers the native share sheet; on desktop it opens web.whatsapp.com.
 */
export function shareOnWhatsApp(message: string): void {
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
}

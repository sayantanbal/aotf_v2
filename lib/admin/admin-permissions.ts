export type AdminPermissionKey =
  | "canManageUsers"
  | "canBlockUsers"
  | "canManagePosts"
  | "canManageJobs"
  | "canCreateTuitionPosts"
  | "canCreateJobPosts"
  | "canEditPosts"
  | "canDeletePosts"
  | "canHandleEnquiries"
  | "canHandleFeedbacks"
  | "canUpdateEnquiryStatus"
  | "canCallApplicants"
  | "canProcessRefunds"
  | "canViewPayments"
  | "canRecoverPayments"
  | "canManageWhatsAppGroups"
  | "canViewAnalytics"
  | "canExportData"
  | "canManageAdmins"
  | "canCreateAdmins"
  | "canEditAdmins"
  | "canDeactivateAdmins"
  | "canResetAdminPasswords"
  | "canTerminateAdmins"
  | "canViewAuditLogs"
  | "canManageRenownedTeachers";

export const ADMIN_PERMISSION_CATALOG: Array<{
  key: AdminPermissionKey;
  label: string;
  explanation: string;
  group: "users" | "content" | "support" | "finance" | "analytics" | "admin";
}> = [
  { key: "canManageUsers", label: "Manage users", explanation: "View, edit, and manage user accounts and profiles.", group: "users" },
  { key: "canBlockUsers", label: "Block users", explanation: "Suspend or permanently block users from accessing the platform.", group: "users" },
  { key: "canManagePosts", label: "Manage posts", explanation: "Approve, edit, or reject posts submitted by users.", group: "content" },
  { key: "canManageJobs", label: "Manage jobs", explanation: "Create, edit, and oversee job postings on the platform.", group: "content" },
  { key: "canCreateTuitionPosts", label: "Create tuition posts", explanation: "Draft and publish new tuition posts.", group: "content" },
  { key: "canCreateJobPosts", label: "Create job posts", explanation: "Draft and publish new job opportunities.", group: "content" },
  { key: "canEditPosts", label: "Edit posts", explanation: "Modify the contents of existing posts.", group: "content" },
  { key: "canDeletePosts", label: "Delete posts", explanation: "Permanently remove posts from the platform.", group: "content" },
  { key: "canManageRenownedTeachers", label: "Manage renowned teachers", explanation: "Add, edit, or remove renowned teacher profiles.", group: "content" },
  { key: "canHandleEnquiries", label: "Handle enquiries", explanation: "View and respond to user enquiries.", group: "support" },
  { key: "canHandleFeedbacks", label: "Handle feedback", explanation: "Review and manage user feedback.", group: "support" },
  { key: "canUpdateEnquiryStatus", label: "Update enquiry status", explanation: "Change the status of enquiries (e.g., pending, resolved).", group: "support" },
  { key: "canCallApplicants", label: "Call applicants", explanation: "Contact applicants directly via phone.", group: "support" },
  { key: "canProcessRefunds", label: "Process refunds", explanation: "Initiate and approve refund requests.", group: "finance" },
  { key: "canViewPayments", label: "View payments", explanation: "Access payment records and transaction history.", group: "finance" },
  { key: "canRecoverPayments", label: "Recover payments", explanation: "Manually mark user payments as complete for recovery.", group: "finance" },
  { key: "canManageWhatsAppGroups", label: "Manage WhatsApp groups", explanation: "Create, edit, and manage WhatsApp group links for onboarding.", group: "content" },
  { key: "canViewAnalytics", label: "View analytics", explanation: "Access platform analytics and performance metrics.", group: "analytics" },
  { key: "canExportData", label: "Export data", explanation: "Download platform data and reports.", group: "analytics" },
  { key: "canManageAdmins", label: "Manage admins", explanation: "View and manage other administrator accounts.", group: "admin" },
  { key: "canCreateAdmins", label: "Create admins", explanation: "Provision new administrator accounts.", group: "admin" },
  { key: "canEditAdmins", label: "Edit admins", explanation: "Modify details of existing administrator accounts.", group: "admin" },
  { key: "canDeactivateAdmins", label: "Deactivate admins", explanation: "Temporarily disable administrator accounts.", group: "admin" },
  { key: "canResetAdminPasswords", label: "Reset admin passwords", explanation: "Force a password reset for other administrators.", group: "admin" },
  { key: "canTerminateAdmins", label: "Terminate admins", explanation: "Permanently delete administrator accounts.", group: "admin" },
  { key: "canViewAuditLogs", label: "View audit logs", explanation: "Access system audit logs for security and compliance.", group: "admin" },
];

export const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSION_CATALOG.map(
  (item) => item.key,
);
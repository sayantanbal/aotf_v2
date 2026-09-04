export const PERMISSIONS = {
  TUTOR_ADD: "tutor:add",
  TUTOR_REMOVE: "tutor:remove",
  CANDIDATE_ADD: "candidate:add",
  CANDIDATE_REMOVE: "candidate:remove",
  APPLICATION_APPROVE: "application:approve",
  APPLICATION_REJECT: "application:reject",
  COMMUNICATION_SEND: "communication:send",
  FACULTY_ADD: "faculty:add",
  FACULTY_REMOVE: "faculty:remove",
  FACULTY_APPROVE: "faculty:approve",
  CALENDAR_CREATE: "calendar:create",
  CALENDAR_EDIT: "calendar:edit",
  LEDGER_ENTRY: "ledger:entry",
  ADMIN_INVITE: "admin:invite",
  ADMIN_TERMINATE: "admin:terminate",
  ADMIN_ROLE_CHANGE: "admin:role_change",
  ADMIN_VIEW_METRICS: "admin:view_metrics",
  SUPERADMIN_MANAGE: "superadmin:manage",
  WHATSAPP_MANAGE: "whatsapp:manage",
  PAYMENT_RECOVER: "payment:recover",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

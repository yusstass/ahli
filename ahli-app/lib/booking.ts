import type { ProviderKind, ServiceStatus, ServiceType } from "@prisma/client";
// Single source of truth for booking state changes. Server actions AND the future provider API must use canMove().
export const NEXT: Record<ServiceStatus, ServiceStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ASSIGNED", "CANCELLED", "ISSUE_REPORTED"],
  ASSIGNED: ["ASSIGNED", "IN_PROGRESS", "CONFIRMED", "CANCELLED", "ISSUE_REPORTED"],
  IN_PROGRESS: ["COMPLETED", "ISSUE_REPORTED", "CANCELLED"],
  ISSUE_REPORTED: ["ASSIGNED", "CONFIRMED", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
export const canMove = (from: ServiceStatus, to: ServiceStatus) => NEXT[from].includes(to);
export const KIND: Record<ServiceType, ProviderKind> = { CLEANING: "CLEANER", DOCTOR_VISIT: "DOCTOR", CHEF: "CHEF", MEDICATION_PICKUP: "CARE_WORKER" };
export const STATUSES = Object.keys(NEXT) as ServiceStatus[];

import { DomainError } from "@/lib/errors";

/**
 * Suspension is manual only (decision 2): no dates block anything. paidUntil
 * only drives the OVERDUE flag in the tenant list.
 */
export type TenantStatus = "ACTIVE" | "SUSPENDED";
export const SUSPEND_REASON_MAX = 200;

type Suspendable = { suspendedAt: Date | null };

export function tenantStatus(tenant: Suspendable): TenantStatus {
  return tenant.suspendedAt ? "SUSPENDED" : "ACTIVE";
}

export function assertCanSuspend(tenant: Suspendable, reason: string): void {
  if (tenant.suspendedAt) throw new DomainError("platform.already_suspended");
  const trimmed = reason.trim();
  if (!trimmed) throw new DomainError("platform.reason_required");
  if (trimmed.length > SUSPEND_REASON_MAX) throw new DomainError("platform.reason_too_long");
}

export function assertCanResume(tenant: Suspendable): void {
  if (!tenant.suspendedAt) throw new DomainError("platform.not_suspended");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The paid-until day (stored at its 00:00) is fully over. No paidUntil → never overdue. */
export function isOverdue(paidUntil: Date | null, now: Date): boolean {
  return paidUntil !== null && paidUntil.getTime() + DAY_MS <= now.getTime();
}

import { DomainError } from "@/lib/errors";
import { isOverdue, tenantStatus, type TenantStatus } from "@/modules/platform/domain/suspension";
import { findTenantDetailRow, type TenantDetailRow } from "@/modules/platform/infrastructure/platform-tenant-detail";

export type TenantDetail = Omit<TenantDetailRow, "suspendedAt" | "suspendedReason"> & {
  status: TenantStatus;
  overdue: boolean;
  suspendedAt: Date | null;
  suspendedReason: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One stadium by slug for the platform admin page, read only. Unknown slug: `platform.tenant_not_found`
 * (the page turns it into a 404). The latest subscription decides OVERDUE, as in the list.
 * Authorization is the caller's: the platform admin session (DR-006). No hash, token or secret.
 * The public page URL is not built here: platform may not import stadium (stadium imports platform),
 * so the page builds it with `publicPageUrl(slug)`.
 */
export async function getTenantDetail(input: { slug: string; now?: Date }): Promise<TenantDetail> {
  const now = input.now ?? new Date();
  const row = await findTenantDetailRow(input.slug, new Date(now.getTime() - 30 * DAY_MS));
  if (!row) throw new DomainError("platform.tenant_not_found");
  return {
    ...row,
    status: tenantStatus(row),
    overdue: isOverdue(row.subscriptions[0]?.paidUntil ?? null, now),
  };
}

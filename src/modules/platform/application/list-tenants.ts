import { isOverdue, tenantStatus, type TenantStatus } from "@/modules/platform/domain/suspension";
import { listTenantRows } from "@/modules/platform/infrastructure/platform-store";

export type TenantSummary = {
  slug: string;
  name: string;
  status: TenantStatus;
  plan: string | null;
  paidUntil: Date | null;
  overdue: boolean;
  createdAt: Date;
  pitchCount: number;
  bookingsLast30Days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Read-only overview. No hashes, tokens or suspension reasons. */
export async function listTenants(input: { now?: Date } = {}): Promise<TenantSummary[]> {
  const now = input.now ?? new Date();
  const rows = await listTenantRows(new Date(now.getTime() - 30 * DAY_MS));
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    status: tenantStatus(row),
    plan: row.plan,
    paidUntil: row.paidUntil,
    overdue: isOverdue(row.paidUntil, now),
    createdAt: row.createdAt,
    pitchCount: row.pitchCount,
    bookingsLast30Days: row.bookingsLast30Days,
  }));
}

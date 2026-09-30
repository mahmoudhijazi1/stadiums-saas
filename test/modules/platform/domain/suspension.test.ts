import { describe, expect, it } from "@jest/globals";
import {
  SUSPEND_REASON_MAX,
  assertCanResume,
  assertCanSuspend,
  isOverdue,
  tenantStatus,
} from "@/modules/platform/domain/suspension";

/** Decision 2: manual suspension only; paidUntil is informational (OVERDUE flag). */
const active = { suspendedAt: null };
const suspended = { suspendedAt: new Date("2026-10-01T10:00:00Z") };

describe("tenantStatus", () => {
  it.each([
    [active, "ACTIVE"],
    [suspended, "SUSPENDED"],
  ])("%j → %s", (tenant, status) => {
    expect(tenantStatus(tenant)).toBe(status);
  });
});

describe("assertCanSuspend", () => {
  it.each([
    ["an active tenant with a reason", active, "Unpaid since September", null],
    ["an already suspended tenant", suspended, "again", "platform.already_suspended"],
    ["an empty reason", active, "   ", "platform.reason_required"],
    ["a reason over the limit", active, "x".repeat(SUSPEND_REASON_MAX + 1), "platform.reason_too_long"],
  ])("%s", (_label, tenant, reason, key) => {
    if (key === null) expect(() => assertCanSuspend(tenant, reason)).not.toThrow();
    else expect(() => assertCanSuspend(tenant, reason)).toThrow(expect.objectContaining({ key }));
  });
});

describe("assertCanResume", () => {
  it.each([
    ["a suspended tenant", suspended, null],
    ["an active tenant", active, "platform.not_suspended"],
  ])("%s", (_label, tenant, key) => {
    if (key === null) expect(() => assertCanResume(tenant)).not.toThrow();
    else expect(() => assertCanResume(tenant)).toThrow(expect.objectContaining({ key }));
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  it.each([
    [null, false],
    [new Date("2026-10-14T00:00:00Z"), true],
    [new Date("2026-10-15T00:00:00Z"), false],
    [new Date("2026-11-01T00:00:00Z"), false],
  ])("paidUntil %s → %s", (paidUntil, overdue) => {
    expect(isOverdue(paidUntil, now)).toBe(overdue);
  });
});

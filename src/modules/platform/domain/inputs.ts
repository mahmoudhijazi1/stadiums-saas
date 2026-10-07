import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { MIN_PASSWORD_LENGTH } from "@/modules/access/domain/password-policy";
import { parseLoginIdentifier } from "@/modules/access/domain/identifier";
import { validateSlug } from "@/modules/platform/domain/slug";

/**
 * Pure checks for the platform use cases. Throw DomainError keys; the
 * interface (the CLI today, a web admin later) turns them into text.
 */
export const TENANT_NAME_MAX = 80;
export const PLAN_MAX = 40;
export const NOTE_MAX = 200;
export const ACTOR_MAX = 120;

/** Who did it, as given by the interface ("cli:user@host", "admin:<id>"). */
export function requireActor(actor: string): string {
  const trimmed = actor.trim();
  if (!trimmed || trimmed.length > ACTOR_MAX) throw new DomainError("platform.actor_required");
  return trimmed;
}

export function requireSlug(slug: string): string {
  if (!validateSlug(slug).ok) throw new DomainError("platform.slug_invalid");
  return slug;
}

export function requireTenantName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new DomainError("platform.name_required");
  if (trimmed.length > TENANT_NAME_MAX) throw new DomainError("platform.name_too_long");
  return trimmed;
}

export function requirePlan(plan: string): string {
  const trimmed = plan.trim();
  if (!trimmed) throw new DomainError("platform.plan_required");
  if (trimmed.length > PLAN_MAX) throw new DomainError("platform.plan_too_long");
  return trimmed;
}

/** `--day-start-hour`: a whole hour 0..6, or null to keep the default (6). */
export function optionalDayStartHour(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!/^[0-6]$/.test(text)) throw new DomainError("platform.day_start_hour_invalid");
  return Number(text);
}

export function optionalNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  if (trimmed.length > NOTE_MAX) throw new DomainError("platform.note_too_long");
  return trimmed || null;
}

/** USD with at most 2 decimals, >= 0. Kept as a string for Prisma Decimal. */
export function optionalAmountUsd(amount: string | null | undefined): string | null {
  if (amount === null || amount === undefined || amount.trim() === "") return null;
  const raw = amount.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new DomainError("platform.amount_invalid");
  return new Decimal(raw).toFixed(2);
}

/** owner@<slug> by default; an override must use the same slug (DR-003: local@tenant-slug). */
export function ownerIdentifierFor(slug: string, override?: string | null): string {
  const parsed = parseLoginIdentifier(override?.trim() ? override : `owner@${slug}`);
  if (!parsed || parsed.slug !== slug) throw new DomainError("platform.identifier_invalid");
  return `${parsed.local}@${parsed.slug}`;
}

export function requireOwnerPassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) throw new DomainError("platform.password_too_short");
  return password;
}

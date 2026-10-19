import { randomBytes } from "node:crypto";
import { DomainError } from "@/lib/errors";
import { createTenant } from "@/modules/platform/application/create-tenant";
import { resumeTenant } from "@/modules/platform/application/resume-tenant";
import { suspendTenant } from "@/modules/platform/application/suspend-tenant";
import { generateOwnerPassword } from "@/modules/platform/domain/owner-password";
import { ownerIdentifierFor, requireActor } from "@/modules/platform/domain/inputs";
import { validateSlug } from "@/modules/platform/domain/slug";

/**
 * What the web admin does to a stadium (DR-006 slice 6), on top of the same use cases the CLI calls.
 * The actor is `admin:<id>`. Nothing here reads the session: the Server Action checks it first.
 */
export const WEB_SUSPEND_REASON_MAX = 500;

/** The slug errors in words: the web shows which rule failed, where the CLI says one thing. */
const SLUG_KEYS = {
  length: "platform.slug_length",
  format: "platform.slug_format",
  punycode: "platform.slug_format",
  reserved: "platform.slug_reserved",
} as const;

/**
 * Create a stadium with its OWNER. The owner's first password is generated here (never typed, never
 * stored: only its scrypt hash reaches the database) and returned ONCE to the caller to show. It is
 * not logged and not in the audit detail (`createTenant` never puts it there).
 */
export async function createStadiumAsAdmin(input: {
  name: string;
  slug: string;
  dayStartHour: number | null;
  /** "USD" or "LBP"; null means USD (DR-007 decision 1). */
  gamePriceCurrency?: string | null;
  plan: string | null;
  paidUntil: Date | null;
  actor: string;
}): Promise<{ slug: string; ownerIdentifier: string; ownerPassword: string; gamePriceCurrency: "USD" | "LBP" }> {
  const actor = requireActor(input.actor);
  const check = validateSlug(input.slug);
  if (!check.ok) throw new DomainError(SLUG_KEYS[check.reason]);
  const ownerIdentifier = ownerIdentifierFor(input.slug);
  const ownerPassword = generateOwnerPassword((size) => randomBytes(size), { identifier: ownerIdentifier, slug: input.slug });
  const created = await createTenant({
    slug: input.slug,
    name: input.name,
    plan: input.plan,
    paidUntil: input.paidUntil,
    ownerIdentifier,
    dayStartHour: input.dayStartHour,
    gamePriceCurrency: input.gamePriceCurrency ?? null,
    ownerPassword,
    actor,
  });
  return {
    slug: created.slug,
    ownerIdentifier: created.ownerIdentifier,
    ownerPassword,
    gamePriceCurrency: created.gamePriceCurrency,
  };
}

/** The typed slug must equal the stadium's slug; the server checks again whatever the page did. */
function assertTypedSlug(slug: string, typed: string): void {
  if (typed.trim() !== slug) throw new DomainError("platform.slug_mismatch");
}

export async function suspendStadiumAsAdmin(input: { slug: string; typedSlug: string; reason: string; actor: string }): Promise<void> {
  assertTypedSlug(input.slug, input.typedSlug);
  await suspendTenant({ slug: input.slug, reason: input.reason, actor: input.actor, reasonMax: WEB_SUSPEND_REASON_MAX });
}

export async function resumeStadiumAsAdmin(input: { slug: string; typedSlug: string; actor: string }): Promise<void> {
  assertTypedSlug(input.slug, input.typedSlug);
  await resumeTenant({ slug: input.slug, actor: input.actor });
}

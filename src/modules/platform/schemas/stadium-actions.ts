import { z } from "zod";

/**
 * The web admin's stadium forms (DR-006 slice 6). Shape only: the slug rules, the name and plan
 * limits and the reason rule are the use cases' (the same ones the CLI hits).
 */
const slug = z.string().min(1).max(64);

const createSchema = z.strictObject({
  name: z.string().max(200),
  slug,
  dayStartHour: z.number().int().min(0).max(6),
  plan: z.string().max(200).optional(),
  /** YYYY-MM-DD, or empty/absent. */
  paidUntil: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
});

const suspendSchema = z.strictObject({
  slug,
  typedSlug: z.string().max(64),
  reason: z.string().max(2000),
});

const resumeSchema = z.strictObject({ slug, typedSlug: z.string().max(64) });

/**
 * Record a payment (subscription row). Shape only: the plan, amount and note rules are the use
 * case's (`setSubscription`, the same ones the CLI hits). paidUntil is checked as a real date by
 * `paidUntilDate`; an empty one is refused there with `platform.paid_until_invalid`.
 */
const recordSubscriptionSchema = z.strictObject({
  slug,
  plan: z.string().max(200),
  paidUntil: z.string().max(10),
  amountUsd: z.string().max(40).optional(),
  note: z.string().max(1000).optional(),
});

export type CreateStadiumInput = z.infer<typeof createSchema>;

export function parseCreateStadium(input: unknown): CreateStadiumInput {
  return createSchema.parse(input);
}
export function parseRecordSubscription(input: unknown) {
  return recordSubscriptionSchema.parse(input);
}
export function parseSuspendStadium(input: unknown) {
  return suspendSchema.parse(input);
}
export function parseResumeStadium(input: unknown) {
  return resumeSchema.parse(input);
}

/** A real calendar date from YYYY-MM-DD at 00:00 UTC (how the CLI stores paid-until), or null. */
export function paidUntilDate(value: string | undefined): Date | null | "invalid" {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value ? date : "invalid";
}

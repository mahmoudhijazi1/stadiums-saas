import { z } from "zod";
import { isLbpString, isUsdString, normalizeUsdForm } from "@/lib/format/parse-money";
import { WEEKDAYS, type Weekday } from "@/modules/venue/domain/schedule-config";
import {
  assertUniqueHoursDays,
  type HoursGroup,
} from "@/modules/venue/domain/daily-schedule";

/**
 * Owner create/edit pitch form. Expands to full scheduleConfig on write.
 * Hidden tenant is not isolation — omit it here.
 */

export const MAX_PRICE_RULES = 10;
export const MAX_HOURS_GROUPS = 7;

const clockTime = z
  .string()
  .transform((value) => value.slice(0, 5))
  .pipe(z.iso.time({ precision: -1 }));

function hhmmToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function checkboxOn(value: string | undefined): boolean {
  return value === "true" || value === "on" || value === "1";
}

function sortWeekdays(days: Weekday[]): Weekday[] {
  return WEEKDAYS.filter((day) => days.includes(day));
}

const usdPrice = z
  .string()
  .trim()
  .transform(normalizeUsdForm)
  .refine((value) => isUsdString(value), {
    error: 'USD must be like 30.00',
  });

/**
 * DR-007: whole pounds as digits. Blank means "no price in pounds". Above 0 and in steps of 5,000 is
 * checked by the use case (`assertPitchPrices`), so the owner gets a clear message, not a form error.
 */
const lbpPrice = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .refine((value) => value === undefined || isLbpString(value), {
    error: "LBP must be whole pounds",
  });

const priceRuleDraftSchema = z
  .strictObject({
    days: z.array(z.enum(WEEKDAYS)).min(1).transform(sortWeekdays),
    /** Absent on a rule made in an LBP stadium (DR-007). */
    priceUsd: usdPrice.optional(),
    priceLbp: lbpPrice.optional(),
    start: clockTime.optional(),
    end: clockTime.optional(),
  })
  .refine((rule) => (rule.start === undefined) === (rule.end === undefined), {
    error: "priceRules start and end must both be set or both omitted",
  })
  .refine((rule) => rule.priceUsd !== undefined || rule.priceLbp !== undefined, {
    error: "A price rule needs a price",
  });

export type PitchPriceRule = z.infer<typeof priceRuleDraftSchema>;

const hoursGroupDraftSchema = z
  .strictObject({
    days: z.array(z.enum(WEEKDAYS)).min(1).transform(sortWeekdays),
    open: clockTime,
    close: clockTime,
  })
  // Close at or before open is a window that runs past midnight (BR-7, e.g. 22:00 to
  // 02:00); only open == close (a zero or 24-hour window) is refused.
  .refine((group) => hhmmToMinutes(group.open) !== hhmmToMinutes(group.close), {
    error: "Open and close must differ",
  });

export type HoursGroupDraft = z.infer<typeof hoursGroupDraftSchema>;

function isBlankRule(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const days = "days" in row && Array.isArray(row.days) ? row.days : [];
  const text = (key: "priceUsd" | "priceLbp") =>
    key in row && typeof (row as Record<string, unknown>)[key] === "string"
      ? ((row as Record<string, string>)[key] ?? "").trim()
      : "";
  return days.length === 0 && text("priceUsd").length === 0 && text("priceLbp").length === 0;
}

function isBlankHoursGroup(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const days = "days" in row && Array.isArray(row.days) ? row.days : [];
  return days.length === 0;
}

function coerceJsonArray(
  value: unknown,
  isBlank: (row: unknown) => boolean,
): unknown {
  if (value == null || value === "") return [];
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (!Array.isArray(parsed)) return parsed;
  return parsed.filter((row) => !isBlank(row));
}

/** Form hidden JSON, or already an array. Blank add-row objects are dropped. */
export function coercePriceRules(value: unknown): unknown {
  return coerceJsonArray(value, isBlankRule);
}

export function coerceHoursGroups(value: unknown): unknown {
  return coerceJsonArray(value, isBlankHoursGroup);
}

export function readPriceRulesDraft(
  value: string | undefined,
): PitchPriceRule[] | undefined {
  if (value == null || value.length === 0) return undefined;
  const parsed = priceRuleDraftSchema.array().max(MAX_PRICE_RULES).safeParse(
    coercePriceRules(value),
  );
  return parsed.success ? parsed.data : undefined;
}

export function readHoursGroupsDraft(
  value: string | undefined,
): HoursGroup[] | undefined {
  if (value == null || value.length === 0) return undefined;
  const parsed = hoursGroupDraftSchema
    .array()
    .max(MAX_HOURS_GROUPS)
    .safeParse(coerceHoursGroups(value));
  return parsed.success ? parsed.data : undefined;
}

export const pitchDraftSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  slotDurationMinutes: z.coerce.number().int().positive(),
  /** SPEC-15 P2 / P5: players per game, 1 to 30. */
  defaultPlayerCount: z.coerce.number().int().min(1).max(30).default(10),
  defaultPriceUsd: usdPrice,
  /** DR-007: the price in pounds. Blank or absent: the pitch has none. */
  defaultPriceLbp: lbpPrice.optional(),
  hoursGroups: z.preprocess(
    coerceHoursGroups,
    z.array(hoursGroupDraftSchema).max(MAX_HOURS_GROUPS),
  ),
  priceRules: z.preprocess(
    coercePriceRules,
    z.array(priceRuleDraftSchema).max(MAX_PRICE_RULES),
  ),
  confirmPending: z.string().optional().transform(checkboxOn),
});

export type PitchDraft = z.infer<typeof pitchDraftSchema>;

export function parsePitchDraft(input: unknown): PitchDraft {
  const base = input && typeof input === "object" ? { ...input } : input;
  const withDefaults =
    base && typeof base === "object"
      ? {
          ...("hoursGroups" in base ? {} : { hoursGroups: [] }),
          ...("priceRules" in base ? {} : { priceRules: [] }),
          ...base,
        }
      : base;
  const draft = pitchDraftSchema.parse(withDefaults);
  assertUniqueHoursDays(draft.hoursGroups);
  return draft;
}

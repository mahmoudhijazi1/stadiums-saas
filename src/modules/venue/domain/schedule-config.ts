import Decimal from "decimal.js";
import { z } from "zod";
import { formatLbpAmount } from "@/lib/format/money";
import { isLbpString, isUsdString, parseUsd } from "@/lib/format/parse-money";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { moneyUnit } from "@/modules/payment/domain/units";

/**
 * Zod at the Venue edge (SPEC-02 step 2 / DR-002 §2.4).
 * Prisma types Json as unknown; this is the only allowed shape for schedule_config.
 */

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const clockTime = z.iso.time({ precision: -1 }); // HH:mm, 00:00–23:59

const usdString = z.string().refine((value) => {
  if (!isUsdString(value)) return false;
  parseUsd(value);
  return true;
}, {
  error:
    "USD must be a non-negative string with exactly two fractional digits (e.g. \"30.00\"), never a JSON number",
});

/**
 * The largest LBP price a pitch may have. USD prices are bounded by their column (Decimal(12,2)); a
 * pitch price in pounds gets a sane bound of its own, far below Booking.priceLbp's Decimal(18,0).
 */
export const MAX_LBP_PRICE = new Decimal(1_000_000_000);

/**
 * A pitch price in pounds (DR-007): whole pounds as a string, above zero, a multiple of the 5,000
 * unit (`moneyUnit("LBP")`), at most MAX_LBP_PRICE.
 */
export function isLbpPriceString(value: string): boolean {
  if (!isLbpString(value)) return false;
  const amount = new Decimal(value);
  return amount.gt(0) && amount.mod(moneyUnit("LBP")).isZero() && amount.lte(MAX_LBP_PRICE);
}

const lbpPriceString = z.string().refine(isLbpPriceString, {
  error: `LBP must be whole pounds, above 0 and a multiple of ${formatLbpAmount(moneyUnit("LBP"), "en")} (e.g. "2000000")`,
});

const timeWindowSchema = z.strictObject({
  start: clockTime,
  end: clockTime,
});

const priceRuleSchema = z
  .strictObject({
    days: z.array(z.enum(WEEKDAYS)).min(1),
    start: clockTime.optional(),
    end: clockTime.optional(),
    /** Every rule written before DR-007 has it. A rule made in an LBP stadium may have only priceLbp. */
    priceUsd: usdString.optional(),
    priceLbp: lbpPriceString.optional(),
  })
  .refine((rule) => (rule.start === undefined) === (rule.end === undefined), {
    error: "priceRules start and end must both be set or both omitted",
  })
  .refine((rule) => rule.priceUsd !== undefined || rule.priceLbp !== undefined, {
    error: "a price rule needs priceUsd or priceLbp",
  });

const hoursSchema = z.strictObject({
  mon: z.array(timeWindowSchema),
  tue: z.array(timeWindowSchema),
  wed: z.array(timeWindowSchema),
  thu: z.array(timeWindowSchema),
  fri: z.array(timeWindowSchema),
  sat: z.array(timeWindowSchema),
  sun: z.array(timeWindowSchema),
});

export const scheduleConfigSchema = z.strictObject({
  slotDurationMinutes: z.number().int().positive(),
  gapMinutes: z.number().int().min(0),
  hours: hoursSchema,
  defaultPriceUsd: usdString,
  /** DR-007: the pitch's price in pounds, used when the stadium prices games in LBP. */
  defaultPriceLbp: lbpPriceString.optional(),
  priceRules: z.array(priceRuleSchema),
});

export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;
export type Weekday = (typeof WEEKDAYS)[number];

/** Same closed-week object as the Pitch.scheduleConfig Prisma/SQL default. */
export const CLOSED_WEEK_SCHEDULE: ScheduleConfig = {
  slotDurationMinutes: 60,
  gapMinutes: 0,
  hours: {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  },
  defaultPriceUsd: "0.00",
  priceRules: [],
};

/** Throws ZodError on invalid jsonb. Use on every read and write. */
export function parseScheduleConfig(input: unknown): ScheduleConfig {
  return scheduleConfigSchema.parse(input);
}

/**
 * Does this pitch have its full set of prices in `currency`? USD: a default above 0.00 (the closed
 * week's 0.00 means "never priced") and every rule priced in USD. LBP: a default in pounds and every
 * rule priced in pounds. Used before switching a stadium's currency and on the pitches list.
 */
export function hasPricesIn(config: ScheduleConfig, currency: GamePriceCurrency): boolean {
  if (currency === "USD") {
    return parseUsd(config.defaultPriceUsd).gt(0) && config.priceRules.every((rule) => rule.priceUsd !== undefined);
  }
  return config.defaultPriceLbp !== undefined && config.priceRules.every((rule) => rule.priceLbp !== undefined);
}

import { z } from "zod";
import { isUsdString, parseUsd } from "@/lib/money";

/**
 * Zod at the Venue edge (SPEC-02 step 2 / DR-002 §2.4).
 * Prisma types Json as unknown; this is the only allowed shape for schedule_config.
 */

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const clockTime = z.iso.time({ precision: -1 }); // HH:mm, 00:00–23:59

const usdString = z.string().refine((value) => {
  if (!isUsdString(value)) return false;
  parseUsd(value);
  return true;
}, {
  error:
    "USD must be a non-negative string with exactly two fractional digits (e.g. \"30.00\"), never a JSON number",
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
    priceUsd: usdString,
  })
  .refine((rule) => (rule.start === undefined) === (rule.end === undefined), {
    error: "priceRules start and end must both be set or both omitted",
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

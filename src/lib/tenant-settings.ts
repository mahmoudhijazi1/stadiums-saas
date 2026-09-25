import { z } from "zod";

/**
 * Tenant.settings jsonb (DR-002 §2.6). First knob: owner clock display.
 * Owner, public, and WhatsApp clocks use timeDisplay.
 */

export const TIME_DISPLAY = ["h23", "h12"] as const;
export type TimeDisplay = (typeof TIME_DISPLAY)[number];

/** Integer 0–100. Junk or a missing key falls back so old jsonb rows still parse. */
function feePercent(fallback: number) {
  return z.number().int().min(0).max(100).catch(fallback);
}

const tenantSettingsSchema = z
  .object({
    timeDisplay: z.enum(TIME_DISPLAY).catch("h23"),
    /** Hours before start. Inside this window a player cancel can suggest a fee. */
    cancellationWindowHours: z.number().int().nonnegative().catch(24),
    /** 0 until the owner turns a late-cancel fee on. */
    lateCancellationFeePercent: feePercent(0),
    /** 100 matches today's no-show: the full price stays due. */
    noShowFeePercent: feePercent(100),
  })
  .strip();

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

/** Parse raw jsonb; missing / junk → defaults. Unknown keys stripped. */
export function parseTenantSettings(input: unknown): TenantSettings {
  const base =
    input === null || input === undefined
      ? {}
      : typeof input === "object" && !Array.isArray(input)
        ? input
        : {};
  return tenantSettingsSchema.parse(base);
}

const FEE_PERCENTS = [0, 50, 100] as const;

const bookingRulesFormSchema = z.strictObject({
  cancellationWindowHours: z.string().regex(/^(?:0|[1-9]\d*)$/),
  lateCancellationFeePercent: z.enum(["0", "50", "100"]),
  noShowFeePercent: z.enum(["0", "50", "100"]),
});

export type BookingRulesInput = {
  cancellationWindowHours: number;
  lateCancellationFeePercent: (typeof FEE_PERCENTS)[number];
  noShowFeePercent: (typeof FEE_PERCENTS)[number];
};

/** Throws ZodError if the rules form is missing or not an allowed percent. */
export function parseBookingRulesForm(input: unknown): BookingRulesInput {
  const parsed = bookingRulesFormSchema.parse(input);
  return {
    cancellationWindowHours: Number(parsed.cancellationWindowHours),
    lateCancellationFeePercent: Number(parsed.lateCancellationFeePercent) as BookingRulesInput["lateCancellationFeePercent"],
    noShowFeePercent: Number(parsed.noShowFeePercent) as BookingRulesInput["noShowFeePercent"],
  };
}

/** Merge booking rules onto current settings and re-parse (write path). */
export function mergeBookingRules(
  current: unknown,
  rules: BookingRulesInput,
): TenantSettings {
  const parsed = parseTenantSettings(current);
  return tenantSettingsSchema.parse({ ...parsed, ...rules });
}

/** Merge one key onto current settings and re-parse (write path). */
export function mergeTenantTimeDisplay(
  current: unknown,
  timeDisplay: TimeDisplay,
): TenantSettings {
  const parsed = parseTenantSettings(current);
  return tenantSettingsSchema.parse({ ...parsed, timeDisplay });
}

const timeDisplayFormSchema = z.strictObject({
  timeDisplay: z.enum(TIME_DISPLAY),
});

export type TimeDisplayFormInput = z.infer<typeof timeDisplayFormSchema>;

/** Throws ZodError if the select value is missing or invalid. */
export function parseTimeDisplayForm(input: unknown): TimeDisplayFormInput {
  return timeDisplayFormSchema.parse(input);
}

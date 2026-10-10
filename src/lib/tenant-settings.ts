import { z } from "zod";
import { BRAND_PRESET_KEYS, DEFAULT_BRAND_PRESET } from "@/lib/brand-presets";
import { toLebanonNumber } from "@/modules/people/domain/phone";
import { isAllowedMapLink } from "@/lib/map-link";

/**
 * Tenant.settings jsonb (DR-002 §2.6). First knob: owner clock display.
 * Owner, public, and WhatsApp clocks use timeDisplay.
 */

export const TIME_DISPLAY = ["h23", "h12"] as const;
export type TimeDisplay = (typeof TIME_DISPLAY)[number];

/** The business day starts at this local hour (0 = midnight .. 6). 6 for tenants that never set it. */
export const DEFAULT_DAY_START_HOUR = 6;
export const DAY_START_HOURS = [0, 1, 2, 3, 4, 5, 6] as const;

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
    /** Off until the owner turns it on: offers the Whole / Per player switch. Old rows parse as off. */
    perPlayerSplitEnabled: z.boolean().catch(false),
    /** Local hour a business day starts (0..6). Absent or junk: 6, so old rows are unchanged. */
    dayStartHour: z.number().int().min(0).max(6).catch(DEFAULT_DAY_START_HOUR),
    /** Stadium info (shown on the public page). The name is Tenant.name, not here. */
    address: z.string().max(120).catch(""),
    /** Re-checked on every read: a stored value that is not an allowed map link reads as none. */
    mapLink: z.string().refine((value) => value === "" || isAllowedMapLink(value)).catch(""),
    /** Digits as typed (03…); a value that is not a Lebanese number reads as none. */
    phone: z.string().refine((value) => value === "" || toLebanonNumber(value) !== null).catch(""),
    /** True: the phone above is also the WhatsApp number. */
    whatsappSame: z.boolean().catch(true),
    whatsapp: z.string().refine((value) => value === "" || toLebanonNumber(value) !== null).catch(""),
    /** A key of BRAND_PRESETS, never a colour value. */
    brandPreset: z.enum(BRAND_PRESET_KEYS).catch(DEFAULT_BRAND_PRESET),
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
  /** A checkbox: present ("true") when ticked, absent when not. */
  perPlayerSplitEnabled: z.enum(["true"]).optional(),
  dayStartHour: z.enum(["0", "1", "2", "3", "4", "5", "6"]),
});

export type BookingRulesInput = {
  cancellationWindowHours: number;
  lateCancellationFeePercent: (typeof FEE_PERCENTS)[number];
  noShowFeePercent: (typeof FEE_PERCENTS)[number];
  perPlayerSplitEnabled: boolean;
  dayStartHour: (typeof DAY_START_HOURS)[number];
};

/** Throws ZodError if the rules form is missing or not an allowed percent. */
export function parseBookingRulesForm(input: unknown): BookingRulesInput {
  const parsed = bookingRulesFormSchema.parse(input);
  return {
    cancellationWindowHours: Number(parsed.cancellationWindowHours),
    lateCancellationFeePercent: Number(parsed.lateCancellationFeePercent) as BookingRulesInput["lateCancellationFeePercent"],
    noShowFeePercent: Number(parsed.noShowFeePercent) as BookingRulesInput["noShowFeePercent"],
    perPlayerSplitEnabled: parsed.perPlayerSplitEnabled === "true",
    dayStartHour: Number(parsed.dayStartHour) as BookingRulesInput["dayStartHour"],
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

export type StadiumInfoSettings = Pick<
  TenantSettings,
  "address" | "mapLink" | "phone" | "whatsappSame" | "whatsapp" | "brandPreset"
>;

/** Merge the stadium info keys onto current settings and re-parse (write path). */
export function mergeStadiumInfo(current: unknown, info: StadiumInfoSettings): TenantSettings {
  const parsed = parseTenantSettings(current);
  return tenantSettingsSchema.parse({ ...parsed, ...info });
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

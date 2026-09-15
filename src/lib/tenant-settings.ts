import { z } from "zod";

/**
 * Tenant.settings jsonb (DR-002 §2.6). First knob: owner clock display.
 * Owner + public UI clocks use timeDisplay. WhatsApp bodies stay h23.
 */

export const TIME_DISPLAY = ["h23", "h12"] as const;
export type TimeDisplay = (typeof TIME_DISPLAY)[number];

const tenantSettingsSchema = z
  .object({
    timeDisplay: z.enum(TIME_DISPLAY).catch("h23"),
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

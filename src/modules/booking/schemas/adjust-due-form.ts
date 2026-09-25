import { z } from "zod";
import { isUsdString, normalizeUsdForm } from "@/lib/money";

const ADJUST_REASONS = ["DISCOUNT", "PARTIAL_GAME", "WAIVER", "CORRECTION"] as const;

export type AdjustDueReason = (typeof ADJUST_REASONS)[number];

/**
 * Adjust-amount sheet (SPEC-16 §5.3).
 * The four chips are the owner reasons. Fee reasons stay on cancel and no-show.
 */
export const adjustDueFormSchema = z.strictObject({
  bookingId: z.string().trim().min(1),
  toUsd: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeUsdForm)
    .refine(isUsdString, { error: "USD must be like 30.00" }),
  reason: z.enum(ADJUST_REASONS),
  note: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= 200),
});

export type AdjustDueForm = z.infer<typeof adjustDueFormSchema>;

export function parseAdjustDueForm(input: unknown): AdjustDueForm {
  return adjustDueFormSchema.parse(input);
}

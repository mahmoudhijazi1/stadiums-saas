import { z } from "zod";
import { isLbpString, isUsdString, normalizeUsdForm } from "@/lib/format/parse-money";

const ADJUST_REASONS = ["DISCOUNT", "PARTIAL_GAME", "WAIVER", "CORRECTION"] as const;

export type AdjustDueReason = (typeof ADJUST_REASONS)[number];

/** A field the form did not render arrives as an empty string: treat it as absent. */
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

/**
 * Adjust-amount sheet (SPEC-16 §5.3).
 * The four chips are the owner reasons. Fee reasons stay on cancel and no-show.
 * The amount is typed in the game's currency (DR-007 slice 8): `toUsd` (two decimals) for a game in
 * dollars, `toLbp` (whole pounds) for a game in pounds. Exactly one of them is sent.
 */
export const adjustDueFormSchema = z
  .strictObject({
    bookingId: z.string().trim().min(1),
    toUsd: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .transform(normalizeUsdForm)
        .refine(isUsdString, { error: "USD must be like 30.00" })
        .optional(),
    ),
    toLbp: z.preprocess(
      blankToUndefined,
      z.string().trim().refine(isLbpString, { error: "LBP must be whole pounds" }).optional(),
    ),
    reason: z.enum(ADJUST_REASONS),
    note: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim() ?? "";
        return trimmed === "" ? null : trimmed;
      })
      .refine((value) => value === null || value.length <= 200),
  })
  .refine((form) => (form.toUsd === undefined) !== (form.toLbp === undefined), {
    error: "Send the amount in one currency",
  });

export type AdjustDueForm = z.infer<typeof adjustDueFormSchema>;

export function parseAdjustDueForm(input: unknown): AdjustDueForm {
  return adjustDueFormSchema.parse(input);
}

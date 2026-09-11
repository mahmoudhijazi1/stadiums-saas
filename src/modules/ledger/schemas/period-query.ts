import { z } from "zod";
import { isLbpString, parseLbp } from "@/lib/money";

/**
 * Shape of the /owner period GET query (SPEC-08 step 3).
 * Hidden tenant slug is not isolation — omit it here; the page picks
 * from/to/view/displayRate before parse.
 *
 * Zod 4: z.strictObject rejects extra keys.
 * Refine must not call parseLbp unless isLbpString already matches.
 */

const CIVIL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function isCivilYyyyMmDd(value: string): boolean {
  const match = CIVIL_DAY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() + 1 === month &&
    probe.getUTCDate() === day
  );
}

export const ledgerPeriodQuerySchema = z
  .strictObject({
    from: z.string().optional().transform(blankToUndefined),
    to: z.string().optional().transform(blankToUndefined),
    view: z.enum(["usd", "lbp"]).optional().default("usd"),
    displayRate: z
      .string()
      .optional()
      .transform(blankToUndefined)
      .refine(
        (value) =>
          value === undefined ||
          (isLbpString(value) && parseLbp(value).gt(0)),
        { error: "Display rate must be a positive integer" },
      ),
  })
  .refine(
    (data) =>
      (data.from === undefined && data.to === undefined) ||
      (data.from !== undefined && data.to !== undefined),
    { error: "From and to are required together" },
  )
  .refine(
    (data) => {
      if (data.from === undefined || data.to === undefined) return true;
      return (
        isCivilYyyyMmDd(data.from) &&
        isCivilYyyyMmDd(data.to) &&
        data.from <= data.to
      );
    },
    { error: "From and to must be YYYY-MM-DD with from on or before to" },
  );

export type LedgerPeriodQuery = z.infer<typeof ledgerPeriodQuerySchema>;

/** Throws ZodError if the period query is malformed or extra keys are sent. */
export function parseLedgerPeriodQuery(input: unknown): LedgerPeriodQuery {
  return ledgerPeriodQuerySchema.parse(input);
}

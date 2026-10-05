import { cache } from "react";
import { countPitchesUpTo } from "@/modules/venue/infrastructure/pitches";

/**
 * True when the stadium has more than one pitch. With a single pitch its name tells
 * nobody anything, so the UI and WhatsApp messages leave it out. No membership check:
 * the public page shows the pitches anyway. One count per request (React cache).
 */
export const hasSeveralPitches = cache(async (): Promise<boolean> => {
  return (await countPitchesUpTo(2)) > 1;
});

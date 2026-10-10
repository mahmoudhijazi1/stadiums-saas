import { z } from "zod";
import { BRAND_PRESET_KEYS } from "@/lib/brand-presets";
import { DomainError } from "@/lib/errors";
import { isAllowedMapLink } from "@/lib/map-link";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { isPhoneText, normalizePhone, toLebanonNumber } from "@/modules/people/domain/phone";

/**
 * The "Stadium info" form: pure checks, no database. Each rule answers with a DomainError key
 * the owner can read. The name is written as typed (never translated) after the shared name
 * cleaner; the phones become digits and must be Lebanese numbers; the map link must be one of the
 * allowed Google Maps forms; the colour is a preset KEY.
 */
export const STADIUM_NAME_MAX = 60;
export const STADIUM_ADDRESS_MAX = 120;

const NAME_KEY = "stadium.name_invalid";
const ADDRESS_KEY = "stadium.address_invalid";
const MAP_KEY = "stadium.map_invalid";
const PHONE_KEY = "stadium.phone_invalid";

/** "" (not set) or a Lebanese number as digits. Letters and symbols other than + - ( ) . are refused. */
function phoneField() {
  return z
    .string()
    .trim()
    .refine(isPhoneText, { error: PHONE_KEY })
    .transform(normalizePhone)
    .refine((digits) => digits === "" || toLebanonNumber(digits) !== null, { error: PHONE_KEY });
}

const stadiumInfoSchema = z.strictObject({
  name: z
    .string()
    .transform(cleanPersonName)
    .pipe(z.string().min(1, { error: NAME_KEY }).max(STADIUM_NAME_MAX, { error: NAME_KEY })),
  address: z
    .string()
    .transform(cleanPersonName)
    .pipe(z.string().max(STADIUM_ADDRESS_MAX, { error: ADDRESS_KEY })),
  mapLink: z.string().trim().refine((value) => value === "" || isAllowedMapLink(value), { error: MAP_KEY }),
  phone: phoneField(),
  whatsappSame: z.boolean(),
  whatsapp: phoneField(),
  brandPreset: z.enum(BRAND_PRESET_KEYS, { error: "form.invalid" }),
});

export type StadiumInfoInput = z.infer<typeof stadiumInfoSchema>;

/**
 * Validate and normalize. Throws DomainError with the first problem's key. When "same number for
 * WhatsApp" is on, the separate number is dropped so it cannot linger.
 */
export function parseStadiumInfo(input: unknown): StadiumInfoInput {
  const result = stadiumInfoSchema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "";
    throw new DomainError(message.startsWith("stadium.") ? message : "form.invalid");
  }
  const info = result.data;
  return info.whatsappSame ? { ...info, whatsapp: "" } : info;
}

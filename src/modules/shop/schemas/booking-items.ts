import { z } from "zod";
import { isLbpString, isUsdString, normalizeUsdForm } from "@/lib/format/parse-money";
import { MAX_LINES, QTY_MAX, QTY_MIN } from "@/modules/shop/domain/sale";

const lines = z
  .array(
    z.strictObject({
      productId: z.string().min(1).max(64),
      qty: z.number().int().min(QTY_MIN).max(QTY_MAX),
    }),
  )
  .min(1)
  .max(MAX_LINES);

const payer = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("game") }),
  z.strictObject({ kind: z.literal("person"), personId: z.string().min(1).max(64) }),
  z.strictObject({
    kind: z.literal("name"),
    name: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(32).optional(),
  }),
]);

/** Items put on a game: ids and quantities only (the server reads the prices), and who they are charged to. */
export const addBookingItemsSchema = z.strictObject({
  bookingId: z.string().min(1).max(64),
  lines,
  payer,
});

export type AddBookingItemsInput = z.infer<typeof addBookingItemsSchema>;

export function parseAddBookingItems(input: unknown): AddBookingItemsInput {
  return addBookingItemsSchema.parse(input);
}

/** Take some of one line back. `itemId` is the original line's id. */
export const removeBookingItemSchema = z.strictObject({
  itemId: z.string().min(1).max(64),
  qty: z.number().int().min(QTY_MIN).max(QTY_MAX),
});

export function parseRemoveBookingItem(input: unknown): z.infer<typeof removeBookingItemSchema> {
  return removeBookingItemSchema.parse(input);
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Cash taken on a player tab: USD and/or LBP, like every collection. */
export const collectTabSchema = z.strictObject({
  saleId: z.string().min(1).max(64),
  usdAmount: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .transform((value) => (value === undefined ? undefined : normalizeUsdForm(value)))
    .refine((value) => value === undefined || isUsdString(value), { error: "USD must be like 5.00" }),
  lbpAmount: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .refine((value) => value === undefined || isLbpString(value), { error: "LBP must be whole pounds" }),
});

export function parseCollectTab(input: unknown): z.infer<typeof collectTabSchema> {
  return collectTabSchema.parse(input);
}

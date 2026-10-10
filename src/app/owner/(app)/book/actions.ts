"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { createSeries } from "@/modules/booking/application/create-series";
import { parseOwnerCreateBooking } from "@/modules/booking/schemas/owner-create-booking";
import { field, redirectOwner } from "@/app/owner/form-query";

const BOOK_KEEP = ["bookOn"] as const;
const TODAY_KEEP = ["date", "pitch"] as const;

/**
 * Thin owner Book action. Zod → createOwnerBooking.
 * redirect() outside try/catch (Next redirect docs). Keep bookOn on the query.
 */
export async function submitCreateOwnerBooking(formData: FormData) {
  let errorKey: string | undefined;
  let series: { id: string; skipped: string } | null = null;
  try {
    const parsed = parseOwnerCreateBooking({
      name: field(formData, "name"),
      phone: field(formData, "phone"),
      pitchId: field(formData, "pitchId"),
      start: field(formData, "start"),
      end: field(formData, "end"),
    });
    const weeklyCount = Number(field(formData, "weeklyCount"));
    if (weeklyCount > 0) {
      // "Repeat weekly": the weeks the owner saw in the preview and agreed to.
      const made = await createSeries({
        pitchId: parsed.pitchId,
        person: { name: parsed.name, phone: parsed.phone },
        anchorStart: new Date(parsed.start),
        durationMinutes: (new Date(parsed.end).getTime() - new Date(parsed.start).getTime()) / 60_000,
        count: weeklyCount,
        acceptedStarts: formData
          .getAll("acceptedStart")
          .filter((value): value is string => typeof value === "string")
          .map((value) => new Date(value)),
      });
      series = { id: made.seriesId, skipped: made.skipped.map((week) => week.start.toISOString()).join(",") };
    } else {
      await createOwnerBooking(parsed);
    }
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCreateOwnerBooking");
  }
  // A weekly series lands on Today, where the result sheet (and the WhatsApp text) opens.
  if (series && !errorKey) {
    redirectOwner("/owner/today", formData, ["date"], { series: series.id, skipped: series.skipped });
  }
  // Booked from the Today free strip: land back on Today, same day.
  const fromToday = field(formData, "returnTo") === "today";
  const path = fromToday ? "/owner/today" : "/owner/book";
  const keep = fromToday ? TODAY_KEEP : BOOK_KEEP;
  if (errorKey) {
    redirectOwner(path, formData, keep, { error: errorKey });
  }
  redirectOwner(path, formData, keep, { ok: "booked" });
}

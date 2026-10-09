import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatLocalHm, type HourCycle } from "@/lib/format-local-hm";
import type { UiLocale } from "@/lib/locale";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SERIES_TIME_ZONE } from "@/modules/booking/application/series-weeks";
import { findSeries, listSeriesOccurrences } from "@/modules/booking/infrastructure/series";
import { notifyLink } from "@/modules/notification/domain/whatsapp-link";
import { findPersonById } from "@/modules/people/infrastructure/persons";

export type SeriesCreatedSummary = {
  seriesId: string;
  personName: string;
  weekdayLabel: string;
  timeLabel: string;
  firstDateLabel: string;
  /** Upcoming APPROVED games of the series (what was just created, plus any earlier ones left). */
  games: number;
  /** Weeks that were skipped, as short date labels. */
  skippedLabels: string[];
  /** wa.me link with the SERIES_CONFIRMED text; null when the person has no usable phone. */
  whatsAppHref: string | null;
};

/**
 * What the "weekly booking created" sheet shows after saving, read from the saved rows (never
 * from the form): who, which weekday and time, the first date, how many games, and the WhatsApp
 * link. `skippedStarts` are the weeks that were left out since the preview (taken meanwhile).
 */
export async function loadSeriesCreated(input: {
  seriesId: string;
  skippedStarts: readonly Date[];
  locale: UiLocale;
  hourCycle: HourCycle;
  stadiumName: string;
  now?: Date;
}): Promise<SeriesCreatedSummary | null> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  const found = await findSeries(db, input.seriesId);
  if (!found) return null;
  const person = await findPersonById(db, found.personId);
  if (!person) return null;

  const now = input.now ?? new Date();
  const upcoming = (await listSeriesOccurrences(db, found.id)).filter(
    (row) => row.status === "APPROVED" && row.start.getTime() > now.getTime(),
  );
  const first = upcoming[0];
  if (!first) return null;

  const weekdayLabel = formatDisplayDate(first.start, input.locale, { weekday: "long" }, SERIES_TIME_ZONE);
  const timeLabel = formatLocalHm(first.start, SERIES_TIME_ZONE, input.hourCycle, input.locale);
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  const firstDateLabel = formatDisplayDate(first.start, input.locale, dateOptions, SERIES_TIME_ZONE);

  const link = notifyLink({
    context: "after_series",
    phone: person.phone,
    facts: {
      name: person.name,
      stadiumName: input.stadiumName,
      day: firstDateLabel,
      time: timeLabel,
      weekday: weekdayLabel,
      games: upcoming.length,
    },
    locale: input.locale,
  });

  return {
    seriesId: found.id,
    personName: person.name,
    weekdayLabel,
    timeLabel,
    firstDateLabel,
    games: upcoming.length,
    skippedLabels: input.skippedStarts.map((start) =>
      formatDisplayDate(start, input.locale, { weekday: "short", day: "numeric", month: "short" }, SERIES_TIME_ZONE),
    ),
    whatsAppHref: link.href,
  };
}

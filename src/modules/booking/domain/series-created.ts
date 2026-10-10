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

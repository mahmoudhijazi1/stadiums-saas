import Link from "next/link";
import { listPersonBookings } from "@/modules/booking/application/list-person-bookings";
import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { personOwedOnBooking, personPaidOnBooking } from "@/modules/booking/domain/person-owed";
import { bookingRemaining, participantRemaining } from "@/modules/payment/domain/collect";
import { formatDisplayDate } from "@/lib/format-display-date";
import { nightHint } from "@/modules/booking/application/night-hint";
import { formatLocalClockRange, type HourCycle } from "@/app/owner/shared";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ClockRangeText, LtrIsolate } from "@/components/ui/ltr-isolate";
import { CircleAlert, CircleCheck } from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { formatUsdCompact } from "@/lib/money";
import Decimal from "decimal.js";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

export async function PersonGames({
  personId,
  locale,
  cursor,
}: {
  personId: string;
  locale: UiLocale;
  cursor: { start: Date; id: string } | null;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const page = await listPersonBookings(personId, cursor);
  const showPitch = await hasSeveralPitches();
  const now = new Date();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {ui("owner.personGames", locale)}
      </h2>
      {page.rows.length === 0 ? (
        <EmptyState
          title={ui("owner.noPersonGames", locale)}
          next={ui("owner.noPersonGamesNext", locale)}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {page.rows.map((row) => {
            const remaining = bookingRemaining(row.amountDueUsd, row.collectedUsd);
            const personRemaining = Decimal.max(
              personOwedOnBooking({
                collectionMode: row.collectionMode,
                isRequester: row.isRequester,
                bookingRemainingUsd: remaining,
                participantRemainingUsd: participantRemaining(
                  row.participantDueUsd,
                  row.allocatedUsd,
                ),
              }),
              0,
            );
            const owed = classifyDue({
              status: row.status,
              start: row.start,
              end: row.end,
              remaining: personRemaining,
              now,
            }) === "owed";
            const perPlayer = row.collectionMode === "PER_PLAYER";
            const ended = row.end.getTime() <= now.getTime();
            const personPaid = personPaidOnBooking({
              collectionMode: row.collectionMode,
              isRequester: row.isRequester,
              collectedUsd: row.collectedUsd,
              allocatedUsd: row.allocatedUsd,
            });
            // This person's own figure, with its label (ui-rules 1 and 2).
            const shareUsd = perPlayer
              ? row.participantDueUsd
              : row.isRequester
                ? row.amountDueUsd
                : new Decimal(0);
            const figure: Figure =
              row.status !== "APPROVED"
                ? { tone: "neutral", label: "owner.gameWord", usd: row.priceUsd }
                : owed
                  ? { tone: "owed", label: "owner.owedLabel", usd: personRemaining }
                  : ended && personRemaining.isZero()
                    ? { tone: "paid", label: "owner.paid", usd: personPaid }
                    : {
                        tone: "expected",
                        label: perPlayer ? "owner.shareWord" : "owner.expectedLabel",
                        usd: shareUsd,
                      };
            const display = deriveCardDisplay({
              start: row.start,
              end: row.end,
              price: row.amountDueUsd,
              remaining,
              now,
              status: row.status,
            });
            return (
              <li key={row.id}>
                <Card className="gap-1 px-4 py-3 shadow-none">
                  <div className="flex items-baseline justify-between gap-3">
                    <ClockRangeText
                      text={formatLocalClockRange(row.start, row.end, hourCycle, locale)}
                      className="text-sm font-semibold"
                    />
                    <PersonFigure
                      figure={figure}
                      locale={locale}
                    />
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                    <LtrIsolate>
                      {formatDisplayDate(row.start, locale, {
                        day: "numeric",
                        month: "short",
                      })}
                    </LtrIsolate>
                    {nightHint(row.start, locale) ? (
                      <span>{nightHint(row.start, locale)}</span>
                    ) : null}
                    {showPitch ? <span>{row.pitchName}</span> : null}
                    {row.status !== "APPROVED" ? (
                      <span>{paymentLabel(display.kind, locale)}</span>
                    ) : null}
                    {perPlayer ? (
                      <span>
                        {ui("owner.shareWord", locale)}{" "}
                        <LtrIsolate>${formatUsdCompact(row.participantDueUsd)}</LtrIsolate>
                        <span aria-hidden> · </span>
                        {ui("owner.gameWord", locale)}{" "}
                        <LtrIsolate>${formatUsdCompact(row.amountDueUsd)}</LtrIsolate>
                      </span>
                    ) : null}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {page.nextCursor ? (
        <Link
          href={`/owner/people/${personId}?before=${encodeURIComponent(page.nextCursor.start.toISOString())}&beforeId=${page.nextCursor.id}`}
          className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {ui("owner.loadMore", locale)}
        </Link>
      ) : null}
    </section>
  );
}

function paymentLabel(
  kind: ReturnType<typeof deriveCardDisplay>["kind"],
  locale: UiLocale,
): string {
  if (kind === "paid") return ui("owner.paid", locale);
  if (kind === "partial") return ui("owner.leftShort", locale);
  if (kind === "unpaid") return ui("owner.dueShort", locale);
  if (kind === "cancelled") return ui("owner.cancelledShort", locale);
  if (kind === "no_show_paid") {
    return `${ui("owner.noShow", locale)} · ${ui("owner.paid", locale)}`;
  }
  if (kind === "no_show_unpaid") {
    return `${ui("owner.noShow", locale)} · ${ui("owner.dueShort", locale)}`;
  }
  if (kind === "live") return ui("owner.live", locale);
  return ui("owner.upcomingTag", locale);
}

type Figure = {
  tone: "owed" | "paid" | "expected" | "neutral";
  label: "owner.owedLabel" | "owner.paid" | "owner.expectedLabel" | "owner.shareWord" | "owner.gameWord";
  usd: Decimal;
};

const FIGURE_TEXT: Record<Figure["tone"], string> = {
  owed: "text-owed",
  paid: "text-paid",
  expected: "text-expected",
  neutral: "text-muted-foreground",
};

/** Label, then the amount, in the state colour with a status icon (never colour alone). */
function PersonFigure({ figure, locale }: { figure: Figure; locale: UiLocale }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium ${FIGURE_TEXT[figure.tone]}`}
    >
      {figure.tone === "owed" ? <CircleAlert aria-hidden className="size-4 shrink-0" /> : null}
      {figure.tone === "paid" ? <CircleCheck aria-hidden className="size-4 shrink-0" /> : null}
      <span>{ui(figure.label, locale)}</span>
      <LtrIsolate>${formatUsdCompact(figure.usd)}</LtrIsolate>
    </span>
  );
}

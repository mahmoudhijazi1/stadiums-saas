import { getPersonBookingStats } from "@/modules/booking/application/get-person-booking-stats";
import { paymentReminderMessage, whatsAppHref } from "@/modules/notification/domain/whatsapp-link";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatUsdCompact } from "@/lib/money";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { MessageCircle, Phone } from "lucide-react";

export async function PersonStats({
  personId,
  personName,
  phone,
  locale,
}: {
  personId: string;
  personName: string;
  phone: string | null;
  locale: UiLocale;
}) {
  const stats = await getPersonBookingStats(personId);
  const owes = stats.owesNowUsd;
  const owesLabel = formatUsdCompact(owes);
  const expected = stats.expectedUsd;
  let remindHref: string | null = null;
  if (phone && owes.gt(0) && stats.latestOwedAt) {
    try {
      remindHref = whatsAppHref(
        phone,
        paymentReminderMessage({
          name: personName,
          amount: `$${owesLabel}`,
          date: formatDisplayDate(stats.latestOwedAt, locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          locale,
        }),
      );
    } catch {
      remindHref = null;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3">
        <Stat
          label={uiCount("owner.games", stats.gamesPlayed, locale)}
          value={null}
        />
        <Stat
          label={uiCount("owner.noShows", stats.noShows, locale)}
          value={null}
        />
        <Stat
          label={ui("owner.totalPaid", locale)}
          value={formatUsdCompact(stats.totalPaidUsd)}
        />
        <Stat
          label={ui("owner.owesNow", locale)}
          value={owesLabel}
          alert={owes.gt(0)}
          expected={
            expected.gt(0)
              ? {
                  amount: formatUsdCompact(expected),
                  label: ui("owner.expectedWord", locale),
                }
              : null
          }
        />
      </dl>
      {phone ? (
        <div className="flex gap-2">
          <a
            href={`tel:${phone}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Phone aria-hidden className="size-4" />
            {ui("owner.call", locale)}
          </a>
          {remindHref ? (
            <a
              href={remindHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <MessageCircle aria-hidden className="size-4" />
              {ui("owner.shareWa", locale)}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  expected,
}: {
  label: string;
  value: string | null;
  alert?: boolean;
  expected?: { amount: string; label: string } | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {value ? (
        <dd className="text-sm font-medium">
          <LtrIsolate className={alert ? "text-alert" : undefined}>
            ${value}
          </LtrIsolate>
          {expected ? (
            <>
              <span aria-hidden> · </span>
              <span className="font-normal text-muted-foreground">
                <LtrIsolate>${expected.amount}</LtrIsolate>
                {" "}
                {expected.label}
              </span>
            </>
          ) : null}
        </dd>
      ) : null}
    </div>
  );
}

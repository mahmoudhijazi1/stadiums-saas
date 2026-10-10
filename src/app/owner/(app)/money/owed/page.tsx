import { OwnerBackLink } from "@/app/owner/back-link";
import { formatLocalClockRange, requireOwnerMembership } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { Figure } from "@/components/ui/figure";
import { getUiLocale } from "@/lib/get-ui-locale";
import { formatDisplayDate } from "@/lib/format/time";
import { formatUsdCompact } from "@/lib/format/money";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/copy";
import { PAYMENTS_COLLECT, REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { listOwed } from "@/modules/booking/application/list-owed";
import { businessDate } from "@/modules/booking/domain/business-day";
import { notifyLink } from "@/modules/notification/domain/whatsapp-link";
import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import { formatCivilDate } from "@/modules/venue/domain/availability";
import { formatEarlierDayLabel } from "../../today/date-label";
import { OwedGroups, type OwedGroupView } from "./owed-groups";

const TZ = "Asia/Beirut";

/**
 * Who owes the stadium money, by person. reports.view is checked in the use case; without
 * it the page says so rather than showing anything.
 */
export default async function OwedPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, REPORTS_VIEW)) {
    return (
      <section className="flex flex-col gap-4">
        <OwnerBackLink href="/owner/money" locale={locale} history />
        <EmptyState title={ui("empty.noReports", locale)} next={ui("empty.noReportsNext", locale)} />
      </section>
    );
  }

  const [owed, tenant, severalPitches] = await Promise.all([
    listOwed(),
    getCurrentTenant(),
    hasSeveralPitches(),
  ]);
  const now = new Date();

  const groups: OwedGroupView[] = owed.groups.map((group, groupIndex) => {
    const name = group.name;
    const latest = group.debts[0]!;
    // A named person with a phone: the payment reminder. The decision is `messageIntentFor("owed_page")`.
    const since = formatDisplayDate(latest.start, locale, { weekday: "long", day: "numeric", month: "long" }, TZ);
    const reminderHref =
      name && group.phone
        ? notifyLink({
            context: "owed_page",
            phone: group.phone,
            facts: { name, stadiumName: tenant.name, day: since, time: "", since, amount: `$${formatUsdCompact(group.totalUsd)}` },
            locale,
          }).href
        : null;
    return {
      key: group.personId ?? (name ? `name:${name.toLowerCase()}` : "unnamed"),
      name,
      totalLabel: `$${formatUsdCompact(group.totalUsd)}`,
      games: group.games,
      reminderHref,
      debts: group.debts.map((debt, index) => ({
        key: `${groupIndex}-${index}-${debt.bookingId}`,
        href: `/owner/today?date=${formatCivilDate(businessDate(debt.start, tenant.dayStartHour, TZ))}&highlight=${debt.bookingId}&open=1`,
        view: {
          id: debt.bookingId,
          dayLabel: formatEarlierDayLabel(debt.start, now, locale, tenant.dayStartHour),
          timeRange: formatLocalClockRange(debt.start, debt.end, tenant.timeDisplay, locale),
          requesterName: name ?? ui("owner.unnamedPlayer", locale),
          owedUsd: formatUsdCompact(debt.owedUsd),
          // A player's shop tab is marked "Shop" where the pitch name would go.
          pitchName:
            debt.kind === "tab"
              ? severalPitches
                ? `${ui("owner.shop", locale)} · ${debt.pitchName}`
                : ui("owner.shop", locale)
              : severalPitches
                ? debt.pitchName
                : null,
        },
      })),
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/money" locale={locale} history />
      <div className="flex flex-col gap-1">
        <h2 className="type-title">{ui("owner.owedTitle", locale)}</h2>
        {groups.length > 0 ? (
          <Figure className="block text-4xl text-owed">{`$${formatUsdCompact(owed.totalUsd)}`}</Figure>
        ) : null}
      </div>
      {groups.length === 0 ? (
        <EmptyState title={ui("owner.owedNone", locale)} next={ui("owner.owedNoneNext", locale)} />
      ) : (
        <OwedGroups groups={groups} mayCollect={can(membership, PAYMENTS_COLLECT)} locale={locale} />
      )}
    </section>
  );
}

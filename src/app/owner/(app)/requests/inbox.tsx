import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { listDebtWarnings } from "@/modules/booking/application/list-debt-warnings";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { PendingRequestList } from "@/app/owner/pending-list";
import type { DebtNotice } from "@/app/owner/notify-list";
import { formatDisplayDate } from "@/lib/format-display-date";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/money";
import { ui } from "@/lib/ui-copy";
import { getCurrentTenant } from "@/lib/tenant-context";
import type { HourCycle } from "@/app/owner/shared";
import type { DebtWarning } from "@/modules/booking/domain/debt-warning";
import { DecisionNotifySheet } from "./decision-notify";
import { FreeSlots } from "./free-slots";
import { loadDecisionNotify } from "@/modules/booking/application/load-decision-notify";

/**
 * Requests tab body. One debt query for every person on the pending
 * groups and the open-interest section.
 */
export async function RequestsInbox({
  membership,
  locale,
  notify,
  bookingId,
  reason,
  siblings,
}: {
  membership: CurrentMembership;
  locale: UiLocale;
  notify?: "approved" | "rejected";
  bookingId?: string;
  reason?: string;
  siblings?: string;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const [pending, openWaitlist] = await Promise.all([
    listPendingRequests(),
    listOpenWaitlist(),
  ]);
  const personIds = [
    ...pending.map((row) => row.requesterPersonId),
    ...openWaitlist.flatMap((group) => group.people.map((person) => person.personId)),
  ];
  const warnings = await listDebtWarnings(personIds);
  const debts: Record<string, DebtNotice> = {};
  for (const warning of warnings) {
    debts[warning.personId] = toNotice(warning, locale);
  }

  const notifyRows =
    notify && bookingId
      ? await loadDecisionNotify({
          bookingId,
          kind: notify,
          reason,
          siblingIds: siblingPersonIds(siblings),
        })
      : [];

  return (
    <>
      {notifyRows.length > 0 ? (
        <DecisionNotifySheet
          locale={locale}
          people={notifyRows.map((row) => ({
            personId: row.personId,
            name: row.name,
            phone: row.phone,
            whatsAppHref: row.whatsAppHref,
            message: row.message,
            statusLabel: row.statusLabel,
          }))}
        />
      ) : null}
      <PendingRequestList
        membership={membership}
        locale={locale}
        hourCycle={hourCycle}
        pending={pending}
        openWaitlist={openWaitlist}
        debts={debts}
      />
      <FreeSlots
        locale={locale}
        hourCycle={hourCycle}
        pending={pending}
        openWaitlist={openWaitlist}
        debts={debts}
      />
    </>
  );
}

function siblingPersonIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!/^[a-z0-9-]{8,40}$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 20) break;
  }
  return ids;
}

function toNotice(warning: DebtWarning, locale: UiLocale): DebtNotice {
  return {
    totalCompact: formatUsdCompact(warning.totalUsd),
    reasonLabel: warning.reason
      ? ui(`owner.debtReason.${warning.reason}`, locale)
      : null,
    dateLabel: formatDisplayDate(warning.at, locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  };
}

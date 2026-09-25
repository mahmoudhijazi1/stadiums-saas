import { interestsWithoutPending } from "@/app/owner/(app)/requests/merge-slots";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import type { UiLocale } from "@/lib/locale";
import { uiCount } from "@/lib/ui-copy";
import { formatSlotDateLabel } from "@/app/owner/(app)/today/date-label";
import {
  formatLocalClockRange,
  type HourCycle,
} from "@/app/owner/shared";
import type { DebtNotice } from "@/app/owner/notify-list";
import { FreeSlotList } from "./free-slot-list";

type PendingWindow = {
  pitchId: string;
  start: Date;
  end: Date;
};

/**
 * Open windows that have no pending request on the same pitch.
 * A window with both is merged into that request group instead.
 */
export function FreeSlots({
  locale,
  hourCycle,
  pending,
  openWaitlist,
  debts,
}: {
  locale: UiLocale;
  hourCycle: HourCycle;
  pending: PendingWindow[];
  openWaitlist: WaitlistGroup[];
  debts: Record<string, DebtNotice>;
}) {
  const groups = interestsWithoutPending(openWaitlist, pending);
  if (groups.length === 0) return null;

  const now = new Date();

  return (
    <FreeSlotList
      locale={locale}
      groups={groups.map((group) => ({
        key: `${group.pitchId}-${group.start.toISOString()}-${group.end.toISOString()}`,
        timeRange: formatLocalClockRange(group.start, group.end, hourCycle, locale),
        dateLabel: formatSlotDateLabel(group.start, now, locale),
        pitchName: group.pitchName,
        countLabel: uiCount("owner.interested", group.people.length, locale),
        people: group.people.map((person) => ({
          ...person,
          debt: debts[person.personId] ?? null,
        })),
      }))}
    />
  );
}

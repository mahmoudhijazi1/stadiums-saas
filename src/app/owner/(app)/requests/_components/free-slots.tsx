import { interestsWithoutPending } from "@/modules/booking/ui/merge-slots";
import type { WaitlistGroup } from "@/modules/booking/application/list-open-waitlist";
import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import type { UiLocale } from "@/lib/locale";
import { uiCount } from "@/lib/copy";
import { formatSlotDateLabel } from "@/app/owner/(app)/today/_components/date-label";
import { formatLocalClockRange, type HourCycle } from "@/lib/format/time";
import type { DebtNotice } from "@/modules/booking/ui/notify-list";
import { FreeSlotList } from "@/modules/booking/ui/free-slot-list";

type PendingWindow = {
  pitchId: string;
  start: Date;
  end: Date;
};

/**
 * Open windows that have no pending request on the same pitch.
 * A window with both is merged into that request group instead.
 */
export async function FreeSlots({
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
  const showPitch = await hasSeveralPitches();

  return (
    <FreeSlotList
      locale={locale}
      groups={groups.map((group) => ({
        key: `${group.pitchId}-${group.start.toISOString()}-${group.end.toISOString()}`,
        timeRange: formatLocalClockRange(group.start, group.end, hourCycle, locale),
        dateLabel: formatSlotDateLabel(group.start, now, locale),
        pitchName: showPitch ? group.pitchName : null,
        countLabel: uiCount("owner.interested", group.people.length, locale),
        people: group.people.map((person) => ({
          ...person,
          debt: debts[person.personId] ?? null,
        })),
      }))}
    />
  );
}

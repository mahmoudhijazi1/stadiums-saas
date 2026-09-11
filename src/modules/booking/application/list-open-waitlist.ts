import db from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { isWaitlistWindowOpen } from "@/modules/booking/domain/waitlist";
import {
  listApprovedRanges,
  listSlotInterestsWithPeople,
} from "@/modules/booking/infrastructure/bookings";
import {
  slotAvailableMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";

const TIME_ZONE = "Asia/Beirut";

export type WaitlistPerson = {
  personId: string;
  name: string;
  phone: string;
  whatsAppHref: string | null;
};

export type WaitlistGroup = {
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  message: string;
  people: WaitlistPerson[];
};

/**
 * Open waitlist for the URL tenant (BR-29). Membership required; no extra can()
 * flag. Occupied = APPROVED only. wa.me from Notification — does not log phones.
 */
export async function listOpenWaitlist(): Promise<WaitlistGroup[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new Error("Not allowed");
  }

  const tenant = await getCurrentTenant();
  const now = new Date();
  const occupied = await listApprovedRanges(db);
  const interests = await listSlotInterestsWithPeople(db);

  const groups = new Map<string, WaitlistGroup>();
  const seenPerson = new Set<string>();

  for (const row of interests) {
    if (
      !isWaitlistWindowOpen({
        window: { pitchId: row.pitchId, start: row.start, end: row.end },
        occupied,
        now,
      })
    ) {
      continue;
    }

    const personKey = `${row.pitchId}|${row.start.getTime()}|${row.end.getTime()}|${row.personId}`;
    if (seenPerson.has(personKey)) continue;
    seenPerson.add(personKey);

    const groupKey = `${row.pitchId}|${row.start.getTime()}|${row.end.getTime()}`;
    let group = groups.get(groupKey);
    if (!group) {
      const startLocal = formatLocalTime(row.start);
      const endLocal = formatLocalTime(row.end);
      group = {
        pitchId: row.pitchId,
        pitchName: row.pitchName,
        start: row.start,
        end: row.end,
        message: slotAvailableMessage({
          stadiumName: tenant.name,
          pitchName: row.pitchName,
          startLocal,
          endLocal,
        }),
        people: [],
      };
      groups.set(groupKey, group);
    }

    let href: string | null = null;
    try {
      href = whatsAppHref(row.phone, group.message);
    } catch {
      href = null;
    }

    group.people.push({
      personId: row.personId,
      name: row.name,
      phone: row.phone,
      whatsAppHref: href,
    });
  }

  return [...groups.values()];
}

function formatLocalTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

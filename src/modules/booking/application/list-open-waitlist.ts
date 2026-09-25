import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { logger } from "@/lib/logger";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
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
  createdAt: Date;
};

export type WaitlistGroup = {
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  people: WaitlistPerson[];
};

/**
 * Open waitlist for the URL tenant (BR-29). Membership required; no extra can()
 * flag. Occupied = APPROVED only. wa.me from Notification — does not log phones.
 */
export async function listOpenWaitlist(): Promise<WaitlistGroup[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  // Tenant / notFound stay outside try — must not become UnexpectedError.
  const tenant = await getCurrentTenant();

  try {
    const now = new Date();
    const locale = await getUiLocale();
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
        group = {
          pitchId: row.pitchId,
          pitchName: row.pitchName,
          start: row.start,
          end: row.end,
          people: [],
        };
        groups.set(groupKey, group);
      }

      const day = formatDisplayDate(row.start, locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      let href: string | null = null;
      try {
        href = whatsAppHref(
          row.phone,
          slotAvailableMessage({
            name: row.name,
            time: formatLocalHm(row.start, TIME_ZONE, tenant.timeDisplay, locale),
            day,
            stadiumName: tenant.name,
            locale,
          }),
        );
      } catch (error) {
        // RULE-9: keep the person row; DR-004: log side-effect failure.
        // info (not error): bad phone is expected data, not a system bug. No phone in log.
        logger.info("Waitlist WhatsApp link skipped", error, {
          useCase: "listOpenWaitlist",
          tenantId: tenant.id,
        });
        href = null;
      }

      group.people.push({
        personId: row.personId,
        name: row.name,
        phone: row.phone,
        whatsAppHref: href,
        createdAt: row.createdAt,
      });
    }

    return [...groups.values()];
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List open waitlist failed",
      "listOpenWaitlist",
    );
  }
}

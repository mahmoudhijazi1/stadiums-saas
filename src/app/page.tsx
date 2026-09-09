import { getCurrentTenant } from "@/lib/tenant-context";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import type { CivilDate } from "@/modules/venue/domain/availability";

/**
 * Thin route (SPEC-02 step 6).
 * Next.js 16: searchParams is a Promise — await it (page convention docs).
 * No Prisma and no tenantId in this file.
 */
const TIME_ZONE = "Asia/Beirut";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const localDate = parseCivilDate(dateParam) ?? todayInTimeZone(TIME_ZONE);
  const pitches = await getDayAvailability({ localDate, timeZone: TIME_ZONE });

  return (
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>{tenant.name}</h1>
      <p>
        Tenant: <code>{tenant.slug}</code>
      </p>
      <p>
        Schedule for <strong>{formatCivilDate(localDate)}</strong> ({TIME_ZONE})
      </p>
      <h2>Pitches</h2>
      {pitches.length === 0 ? (
        <p>No pitches yet.</p>
      ) : (
        <ul>
          {pitches.map((pitch) => (
            <li key={pitch.id}>
              <strong>{pitch.name}</strong>
              {pitch.slots.length === 0 ? (
                <p>Closed / No slots.</p>
              ) : (
                <ul>
                  {pitch.slots.map((slot) => (
                    <li key={slot.startIso}>
                      {slot.startLocal}–{slot.endLocal} · ${slot.priceUsd}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function parseCivilDate(value: string | undefined): CivilDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function todayInTimeZone(timeZone: string): CivilDate {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date())) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function formatCivilDate(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

import type { CivilDate } from "@/modules/venue/domain/availability";

export function civilFromYyyyMmDd(value: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid bookOn "${value}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid bookOn "${value}"`);
  }
  return { year, month, day };
}

export function parseOwnerBookOn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    civilFromYyyyMmDd(value);
    return value;
  } catch {
    return undefined;
  }
}

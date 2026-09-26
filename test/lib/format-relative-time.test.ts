import { describe, expect, it } from "@jest/globals";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { HourCycle } from "@/lib/format-local-hm";
import type { UiLocale } from "@/lib/locale";

const ZONE = "Asia/Beirut";

function at(iso: string): Date {
  return new Date(iso);
}

describe("formatRelativeTime", () => {
  const rows: Array<{
    name: string;
    ts: string;
    now: string;
    locale: UiLocale;
    timeDisplay: HourCycle;
    expected: string;
  }> = [
    {
      name: "30 seconds",
      ts: "2026-09-25T11:59:30.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "الآن",
    },
    {
      name: "future clock skew",
      ts: "2026-09-25T12:02:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "الآن",
    },
    {
      name: "1 minute",
      ts: "2026-09-25T11:59:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل دقيقة",
    },
    {
      name: "2 minutes",
      ts: "2026-09-25T11:58:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل دقيقتين",
    },
    {
      name: "3 minutes",
      ts: "2026-09-25T11:57:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل 3 دقائق",
    },
    {
      name: "10 minutes",
      ts: "2026-09-25T11:50:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل 10 دقائق",
    },
    {
      name: "11 minutes",
      ts: "2026-09-25T11:49:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل 11 دقيقة",
    },
    {
      name: "21 minutes",
      ts: "2026-09-25T11:39:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل 21 دقيقة",
    },
    {
      name: "59 minutes",
      ts: "2026-09-25T11:01:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل 59 دقيقة",
    },
    {
      name: "1 hour same Beirut day",
      ts: "2026-09-25T11:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "اليوم 14:00",
    },
    {
      name: "5 hours same Beirut day",
      ts: "2026-09-25T07:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "اليوم 10:00",
    },
    {
      name: "20 minutes across midnight",
      ts: "2026-09-25T20:50:00.000Z",
      now: "2026-09-25T21:10:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "قبل 20 دقيقة",
    },
    {
      name: "70 minutes across midnight is yesterday",
      ts: "2026-09-25T20:50:00.000Z",
      now: "2026-09-25T22:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "أمس 23:50",
    },
    {
      name: "2 calendar days",
      ts: "2026-09-23T12:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "الأربعاء 15:00",
    },
    {
      name: "6 calendar days",
      ts: "2026-09-19T12:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "السبت 15:00",
    },
    {
      name: "8 calendar days",
      ts: "2026-09-17T12:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "17 أيلول",
    },
    {
      name: "across the Beirut fall-back",
      ts: "2026-10-24T19:00:00.000Z",
      now: "2026-10-26T08:00:00.000Z",
      locale: "ar",
      timeDisplay: "h23",
      expected: "السبت 22:00",
    },
    {
      name: "12-hour same day",
      ts: "2026-09-25T11:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "ar",
      timeDisplay: "h12",
      expected: "اليوم 2:00 مساءً",
    },
    {
      name: "12-hour yesterday",
      ts: "2026-09-25T20:50:00.000Z",
      now: "2026-09-25T22:00:00.000Z",
      locale: "ar",
      timeDisplay: "h12",
      expected: "أمس 11:50 مساءً",
    },
    {
      name: "English just now",
      ts: "2026-09-25T11:59:30.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "en",
      timeDisplay: "h12",
      expected: "Just now",
    },
    {
      name: "English 1 minute",
      ts: "2026-09-25T11:59:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "en",
      timeDisplay: "h12",
      expected: "1 minute ago",
    },
    {
      name: "English 21 minutes",
      ts: "2026-09-25T11:39:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "en",
      timeDisplay: "h12",
      expected: "21 minutes ago",
    },
    {
      name: "English today",
      ts: "2026-09-25T11:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "en",
      timeDisplay: "h12",
      expected: "Today 2:00 PM",
    },
    {
      name: "English yesterday",
      ts: "2026-09-25T20:50:00.000Z",
      now: "2026-09-25T22:00:00.000Z",
      locale: "en",
      timeDisplay: "h12",
      expected: "Yesterday 11:50 PM",
    },
    {
      name: "English weekday",
      ts: "2026-09-23T12:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "en",
      timeDisplay: "h12",
      expected: "Wednesday 3:00 PM",
    },
    {
      name: "English older date",
      ts: "2026-09-17T12:00:00.000Z",
      now: "2026-09-25T12:00:00.000Z",
      locale: "en",
      timeDisplay: "h23",
      expected: "September 17",
    },
  ];

  it.each(rows)("$name", ({ ts, now, locale, timeDisplay, expected }) => {
    expect(
      formatRelativeTime(at(ts), at(now), {
        locale,
        timeZone: ZONE,
        timeDisplay,
      }),
    ).toBe(expected);
  });
});

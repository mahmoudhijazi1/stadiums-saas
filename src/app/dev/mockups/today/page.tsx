import { OwnerDayStrip } from "@/app/owner/(app)/today/day-strip";
import { getUiLocale } from "@/lib/get-ui-locale";
import { queryString } from "@/app/owner/shared";
import { assertDevOnly } from "./guard";
import { TodayMockup } from "./today-mockup";

const DAY = { year: 2026, month: 10, day: 1 };

/**
 * Dev-only preview of Today as a one-column day sheet. Fake data, no database.
 * 404 in production. Optional: ?pitches=2, ?pitch=a2, ?closed=1.
 */
export default async function TodayMockupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  assertDevOnly();
  const params = await searchParams;
  const locale = await getUiLocale();
  return (
    <TodayMockup
      dayStrip={<OwnerDayStrip day={DAY} today={DAY} locale={locale} />}
      locale={locale}
      pitchCount={Number(queryString(params.pitches)) >= 2 ? 2 : 1}
      pitchParam={queryString(params.pitch) ?? null}
      closed={queryString(params.closed) === "1"}
    />
  );
}

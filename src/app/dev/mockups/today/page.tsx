import { notFound } from "next/navigation";
import { getUiLocale } from "@/lib/get-ui-locale";
import { queryString } from "@/app/owner/shared";
import { TodayMockup } from "./today-mockup";

/**
 * Dev-only preview of Today as a schedule grid. Fake data, no database.
 * 404 in production. Optional: ?pitches=2..5 and ?now=HH:MM.
 */
export default async function TodayMockupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const locale = await getUiLocale();
  const pitchCount = Number(queryString(params.pitches)) || 2;
  const nowParam = /^(\d{1,2}):(\d{2})$/.exec(queryString(params.now) ?? "");
  const nowOverride = nowParam ? Number(nowParam[1]) * 60 + Number(nowParam[2]) : null;
  return <TodayMockup locale={locale} pitchCount={pitchCount} nowOverride={nowOverride} />;
}

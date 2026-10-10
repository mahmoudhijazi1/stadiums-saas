import { brandIconPath, brandIdentityOf } from "@/lib/brand-identity";
import { getCurrentTenant } from "@/lib/tenant-context";
import { businessDate } from "@/modules/booking/domain/business-day";
import { clampPublicDay } from "@/modules/booking/domain/public-window";
import {
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import { PublicDayChips } from "./day-chips";
import { StadiumContact } from "./stadium-contact";
import { PublicHoursSkeleton } from "./skeletons";
import { PublicHours } from "./hours";
import { LangToggle } from "@/components/lang-toggle";
import { Container } from "@/components/ui/container";
import { UnavailableNotice } from "@/components/unavailable-notice";
import { FlashToast } from "@/components/ui/flash-toast";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { Suspense } from "react";

/**
 * Thin route. No Prisma and no tenantId.
 * Occupied comes from Booking; Venue only receives UTC ranges (SPEC-05).
 * Date is ?date= yyyy-mm-dd via Link chips (client transition, not a GET form).
 * Hours list is a child RSC so the chip row stays mounted while slots suspend.
 * "Today" is the business date (06:00 to 06:00 Beirut, same rule as owner Today): at
 * 00:30 it is still last night, so the rest of a window that crosses midnight stays
 * reachable. Started slots are never offered (dropEndedSlots / slot_ended).
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const tenant = await getCurrentTenant();
  const locale = await getUiLocale();
  // The (public) layout already shows the neutral page; never render tenant data here either.
  if (tenant.suspended) return <UnavailableNotice kind="public" locale={locale} />;
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const now = new Date();
  const today = businessDate(now, tenant.dayStartHour, "Asia/Beirut");
  // A date beyond the public window (PUBLIC_FUTURE_DAYS) shows today, like a bad date.
  const localDate = clampPublicDay(parseCivilDate(dateParam), today, today);
  const dateValue = formatCivilDate(localDate);

  return (
    <main>
    <Container className="flex flex-col gap-6 py-8">
      <Suspense fallback={null}>
        <FlashToast locale={locale} />
      </Suspense>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small generated PNG from our own route */}
          <img
            src={brandIconPath("192", brandIdentityOf(tenant))}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-xl"
          />
          <div className="flex min-w-0 flex-col">
            <h1 className="min-w-0 font-heading text-3xl lg:text-4xl">{tenant.name}</h1>
            {tenant.address ? (
              <p className="type-secondary text-ink-muted" dir="auto">
                {tenant.address}
              </p>
            ) : null}
          </div>
        </div>
        <LangToggle locale={locale} />
      </header>

      <StadiumContact
        mapLink={tenant.mapLink}
        phone={tenant.phone}
        whatsapp={tenant.whatsapp}
        locale={locale}
      />

      <PublicDayChips
        today={today}
        selectedDate={dateValue}
        locale={locale}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl lg:text-2xl">{ui("public.hours", locale)}</h2>
        <Suspense key={dateValue} fallback={<PublicHoursSkeleton />}>
          <PublicHours
            localDate={localDate}
            dateValue={dateValue}
            locale={locale}
            now={now}
            today={today}
          />
        </Suspense>
      </section>

      <footer className="pt-4 text-center type-caption text-ink-muted">
        {ui("public.poweredBy", locale)}
      </footer>
    </Container>
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

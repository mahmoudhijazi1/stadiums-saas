import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { getUiLocale } from "@/lib/get-ui-locale";
import { publicPageUrl } from "@/lib/public-page-url";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/ui-copy";
import { PrintButton } from "./print-button";

/**
 * A printable poster, outside the owner shell (no header, no tab bar). On a phone it is a
 * poster-shaped card that fits the screen; printed, it is one A4 portrait page: the stadium
 * name as written, "Scan to book" in Arabic and English, the QR at 12 cm and the link, in black
 * on white whatever the app theme. Same access as /owner/qr (a suspended tenant is sent to its
 * own page).
 */
export default async function PosterPage() {
  await requireOwnerMembership();
  const locale = await getUiLocale();
  const tenant = await getCurrentTenant();
  const url = publicPageUrl(tenant.slug);

  return (
    <div className="min-h-dvh bg-white text-black print:min-h-0">
      {/* A4 portrait, 15 mm margin. */}
      <style>{"@page { size: A4 portrait; margin: 15mm; } @media print { body { background: #fff !important; } }"}</style>

      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-4 print:min-h-0 print:max-w-none print:gap-0 print:p-0">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <OwnerBackLink href="/owner/more" locale={locale} history />
          <PrintButton label={ui("owner.print", locale)} />
        </div>

        <article className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border-2 border-black px-5 py-8 text-center print:flex-none print:gap-9 print:rounded-none print:border-[3px] print:px-12 print:py-14">
          <h1 className="text-3xl leading-tight font-semibold break-words print:text-6xl">
            <bdi>{tenant.name}</bdi>
          </h1>

          <div aria-hidden className="h-1 w-14 rounded-full bg-black print:h-1.5 print:w-28" />

          <div className="flex flex-col items-center gap-1 print:gap-2">
            <p className="text-2xl leading-snug font-semibold print:text-4xl" lang="ar" dir="rtl">
              {ui("owner.qrScan", "ar")}
            </p>
            <p className="text-lg leading-snug font-semibold print:text-3xl" lang="en" dir="ltr">
              {ui("owner.qrScan", "en")}
            </p>
          </div>

          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated SVG from our own route
            <img
              src="/owner/qr?format=svg"
              alt={ui("owner.qrAlt", locale)}
              className="aspect-square w-full max-w-64 print:size-[12cm] print:max-w-none"
            />
          ) : null}

          {url ? (
            <LtrIsolate className="text-sm font-medium break-all print:text-2xl">{url}</LtrIsolate>
          ) : null}
        </article>
      </main>
    </div>
  );
}

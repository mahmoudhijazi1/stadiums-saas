import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { ui } from "@/lib/copy";
import { formatDisplayDate, formatLocalClock, OWNER_TIME_ZONE } from "@/lib/format/time";
import { DomainError } from "@/lib/errors";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { getTenantDetail } from "@/modules/platform/application/get-tenant-detail";
import { getCurrentPlatformAdmin } from "@/modules/platform/application/platform-session";
import { defaultPaidUntil } from "@/modules/platform/domain/paid-until";
import { publicPageUrl } from "@/modules/stadium/domain/public-page-url";
import { submitPlatformLogout, submitRecordSubscription, submitResumeStadium, submitSuspendStadium } from "@/app/(platform)/platform/actions";
import { DetailRow, DetailSection } from "@/app/(platform)/platform/_components/detail-section";
import { PlatformFrame } from "@/app/(platform)/platform/_components/platform-frame";
import { RecordSubscriptionPanel } from "@/app/(platform)/platform/_components/record-subscription-panel";
import { StatusBadges } from "@/app/(platform)/platform/_components/status-badges";
import { SuspendResumePanel } from "@/app/(platform)/platform/_components/suspend-resume-panel";

export const dynamic = "force-dynamic";

/** Dates and times in the owner time zone (Asia/Beirut), through the shared helpers; never UTC. */
const dateOf = (date: Date) => formatDisplayDate(date, "en", { day: "numeric", month: "short", year: "numeric" }, OWNER_TIME_ZONE);
const day = (date: Date | null) => (date ? dateOf(date) : ui("platform.none", "en"));
const stamp = (date: Date) => `${dateOf(date)}, ${formatLocalClock(date, "h23", "en")}`;

/**
 * One stadium, read only (DR-006): status, public page, subscriptions, owner logins, counts and the
 * last 10 audit rows (action, actor, time; never the detail JSON). Unknown slug is a 404.
 * Resolves no tenant: the slug is a route parameter used for a platform query.
 */
export default async function PlatformStadiumPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePlatformHost();
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/platform/login");

  const { slug } = await params;
  if (slug.length > 64) notFound();
  const tenant = await getTenantDetail({ slug }).catch((error: unknown) => {
    if (error instanceof DomainError && error.key === "platform.tenant_not_found") notFound();
    throw error;
  });
  const url = publicPageUrl(tenant.slug);
  const none = ui("platform.none", "en");
  const latest = tenant.subscriptions[0];

  return (
    <PlatformFrame identifier={admin.identifier} logout={submitPlatformLogout}>
      <Link href="/platform" className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:underline">
        <ChevronLeft aria-hidden className="size-4" />
        {ui("platform.back", "en")}
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          <bdi>{tenant.name}</bdi>
        </h1>
        <p dir="ltr" className="text-start text-sm text-muted-foreground">
          {tenant.slug}
        </p>
        <StatusBadges status={tenant.status} overdue={tenant.overdue} />
      </header>

      <DetailSection title={ui("platform.details", "en")}>
        <dl className="flex flex-col gap-1.5">
          <DetailRow label={ui("platform.created", "en")}>{day(tenant.createdAt)}</DetailRow>
          {tenant.suspendedAt ? (
            <>
              <DetailRow label={ui("platform.suspendedSince", "en")}>{stamp(tenant.suspendedAt)}</DetailRow>
              <DetailRow label={ui("platform.reason", "en")}>{tenant.suspendedReason ?? none}</DetailRow>
            </>
          ) : null}
          <DetailRow label={ui("platform.publicPage", "en")}>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="inline-flex min-h-11 items-center gap-1 underline-offset-2 hover:underline"
              >
                {url}
                <ExternalLink aria-hidden className="size-4 shrink-0" />
                <span className="sr-only">{ui("platform.openPublicPage", "en")}</span>
              </a>
            ) : (
              none
            )}
          </DetailRow>
        </dl>
      </DetailSection>

      <DetailSection title={ui("platform.owners", "en")}>
        {tenant.ownerIdentifiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{none}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {tenant.ownerIdentifiers.map((identifier) => (
              <li key={identifier} dir="ltr" className="text-start">
                {identifier}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={ui("platform.subscriptions", "en")}>
        <RecordSubscriptionPanel
          slug={tenant.slug}
          defaultPlan={latest?.plan ?? ""}
          defaultPaidUntil={defaultPaidUntil(latest?.paidUntil ?? null, new Date(), OWNER_TIME_ZONE)}
          action={submitRecordSubscription}
        />
        {tenant.subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ui("platform.noSubscriptions", "en")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {tenant.subscriptions.map((subscription) => (
              <li key={`${subscription.createdAt.toISOString()}-${subscription.plan}`} className="py-2 first:pt-0 last:pb-0">
                <dl className="flex flex-col gap-1">
                  <DetailRow label={ui("platform.plan", "en")}>{subscription.plan}</DetailRow>
                  <DetailRow label={ui("platform.starts", "en")}>{day(subscription.startsAt)}</DetailRow>
                  <DetailRow label={ui("platform.paidUntil", "en")}>{day(subscription.paidUntil)}</DetailRow>
                  {subscription.amountUsd ? <DetailRow label={ui("platform.amount", "en")}>${subscription.amountUsd}</DetailRow> : null}
                  {subscription.note ? <DetailRow label={ui("platform.note", "en")}>{subscription.note}</DetailRow> : null}
                  <DetailRow label={ui("platform.recordedBy", "en")}>{subscription.recordedBy}</DetailRow>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={ui("platform.counts", "en")}>
        <dl className="flex flex-col gap-1.5">
          <DetailRow label={ui("platform.pitches", "en")}>{tenant.pitchCount}</DetailRow>
          <DetailRow label={ui("platform.persons", "en")}>{tenant.personCount}</DetailRow>
          <DetailRow label={ui("platform.bookings30", "en")}>{tenant.bookingsLast30Days}</DetailRow>
        </dl>
      </DetailSection>

      <DetailSection title={ui("platform.activity", "en")}>
        {tenant.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ui("platform.noActivity", "en")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {tenant.audit.map((entry) => (
              <li key={`${entry.createdAt.toISOString()}-${entry.action}-${entry.actor}`} className="flex flex-col gap-0.5 py-2 text-sm first:pt-0 last:pb-0">
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground">
                  {entry.actor} · {stamp(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <SuspendResumePanel
        slug={tenant.slug}
        suspended={tenant.status === "SUSPENDED"}
        suspend={submitSuspendStadium}
        resume={submitResumeStadium}
      />
    </PlatformFrame>
  );
}

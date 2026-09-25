import { requireOwnerMembership } from "@/app/owner/shared";
import { MoreHub } from "./hub";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import {
  getCurrentRate,
  getExchangeRateChangedAt,
} from "@/modules/payment/application/get-current-rate";
import { listPitchSummaries } from "@/modules/venue/application/list-pitch-summaries";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { groupedDigits, relativePastLabel } from "@/lib/ui-copy";

/**
 * More hub. Old /owner/more/settings redirects here.
 * Local Next page.md: this page has no searchParams.
 */
export default async function OwnerMorePage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const tenant = await getCurrentTenant();
  const rate = await getCurrentRate();
  const changedAt = await getExchangeRateChangedAt();
  const pitches = await listPitchSummaries();
  const digits = rate ? rate.toFixed(0) : null;

  return (
    <MoreHub
      locale={locale}
      mayManage={can(membership, SETTINGS_MANAGE)}
      pitchCount={pitches.length}
      rateDigits={digits}
      rateGrouped={digits ? groupedDigits(digits) : null}
      changedLabel={
        changedAt ? relativePastLabel(changedAt, new Date(), locale) : null
      }
      timeDisplay={tenant.timeDisplay}
      cancellationWindowHours={tenant.cancellationWindowHours}
      lateCancellationFeePercent={tenant.lateCancellationFeePercent}
      noShowFeePercent={tenant.noShowFeePercent}
      identifier={membership.identifier}
    />
  );
}

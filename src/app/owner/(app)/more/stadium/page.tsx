import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { loadStadiumInfo } from "@/modules/platform/application/stadium-info";
import { submitStadiumInfo } from "./actions";
import { StadiumForm } from "./stadium-form";

/** More > Business > Stadium info. settings.manage. */
export default async function StadiumInfoPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (!can(membership, SETTINGS_MANAGE)) {
    return (
      <EmptyState
        title={ui("empty.noPitchEdit", locale)}
        next={ui("empty.noPitchEditNext", locale)}
      />
    );
  }

  const info = await loadStadiumInfo();
  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more" locale={locale} />
      <h1 className="type-title">{ui("owner.stadiumInfo", locale)}</h1>
      <StadiumForm action={submitStadiumInfo} defaults={info} locale={locale} />
    </section>
  );
}

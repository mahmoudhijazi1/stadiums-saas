import { OwnerBackLink } from "@/components/shell/back-link";
import { requireOwnerMembership } from "@/app/owner/require-owner";
import { HelpList } from "@/app/owner/(app)/more/help/_components/help-list";
import { visibleHelpGroups } from "@/app/owner/(app)/more/help/_components/topics";
import { ui } from "@/lib/copy";
import { getUiLocale } from "@/lib/get-ui-locale";
import { SUPPORT_WHATSAPP } from "@/lib/support-contact";
import { getCurrentTenant } from "@/lib/tenant-context";
import { whatsAppHref } from "@/modules/notification/domain/whatsapp-link";
import { getPushPublicKey } from "@/modules/push/application/push-status";

/**
 * More > Help: everything the app offers and where it is, as closed topics (no client JavaScript).
 * A topic whose action needs a permission the member lacks is hidden (the same can() flags as the
 * real screens); Notifications shows only when push is configured, like its More row.
 */
export default async function OwnerHelpPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const tenant = await getCurrentTenant();
  const groups = visibleHelpGroups(membership, { pushOn: getPushPublicKey() !== null });
  const supportHref = whatsAppHref(
    SUPPORT_WHATSAPP,
    ui("help.whatsappMessage", locale).replace("{name}", tenant.name),
  );

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more" locale={locale} />
      <h1 className="type-title">{ui("owner.help", locale)}</h1>
      <HelpList groups={groups} locale={locale} supportHref={supportHref} />
    </section>
  );
}

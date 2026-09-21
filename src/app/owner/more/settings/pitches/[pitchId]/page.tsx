import Link from "next/link";
import { notFound } from "next/navigation";
import { queryString, requireOwnerMembership } from "@/app/owner/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { getPitchEditor } from "@/modules/venue/application/get-pitch-editor";
import { submitUpdatePitch } from "../actions";
import { PitchDraftForm } from "../form";
import {
  readHoursGroupsDraft,
  readPriceRulesDraft,
} from "@/modules/venue/schemas/pitch-draft";

/**
 * Edit pitch. OWNER only. Hours groups round-trip stored per-day windows.
 * Local Next page.md: searchParams is a Promise.
 */
export default async function EditPitchPage({
  params,
  searchParams,
}: {
  params: Promise<{ pitchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const route = await params;
  const query = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  if (membership.role !== "OWNER") {
    return (
      <EmptyState
        title={ui("empty.noPitchEdit", locale)}
        next={ui("empty.noPitchEditNext", locale)}
      />
    );
  }

  const editor = await getPitchEditor(route.pitchId);
  if (!editor) {
    notFound();
  }

  const needPending = queryString(query.needPending) === "1";

  return (
    <section className="flex flex-col gap-4">
      <Link
        href="/owner/more/settings"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {ui("owner.pitchBack", locale)}
      </Link>
      <h2 className="font-heading text-xl">{ui("owner.pitchEdit", locale)}</h2>
      <PitchDraftForm
        locale={locale}
        action={submitUpdatePitch}
        pitchId={editor.id}
        defaults={{
          name: queryString(query.name) ?? editor.name,
          hoursGroups:
            readHoursGroupsDraft(queryString(query.hoursGroupsJson)) ??
            editor.hoursGroups,
          slotDurationMinutes:
            queryString(query.slotDurationMinutes) ??
            String(editor.slotDurationMinutes),
          defaultPriceUsd:
            queryString(query.defaultPriceUsd) ?? editor.defaultPriceUsd,
          priceRules:
            readPriceRulesDraft(queryString(query.priceRulesJson)) ??
            editor.priceRules,
        }}
        showPending={needPending}
      />
    </section>
  );
}

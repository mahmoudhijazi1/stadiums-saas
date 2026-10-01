import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * Request card line (security audit S-6): the name typed on the public form
 * when it differs from the saved Person name. The saved name stays the link.
 * <bdi> keeps a Latin or mixed name from reordering the Arabic label.
 */
export function RequestedNameNotice({
  requestedName,
  locale,
}: {
  requestedName: string | null;
  locale: UiLocale;
}) {
  if (!requestedName) return null;
  return (
    <p className="text-sm font-medium">
      {ui("owner.requestedNameDiffers", locale)} <bdi>{requestedName}</bdi>
    </p>
  );
}

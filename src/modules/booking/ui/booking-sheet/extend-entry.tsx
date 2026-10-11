import { Clock } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { ActionRow } from "@/modules/booking/ui/booking-sheet/action-row";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** "Extend 30 min" in More actions; disabled with the reason when the game cannot be extended now. */
export function ExtendEntry({ row, locale, onExtend }: { row: UpcomingRowView; locale: UiLocale; onExtend: () => void }) {
  if (!row.extend) return null;
  return (
                <ActionRow
                  icon={Clock}
                  onClick={onExtend}
                  disabled={!row.extend.allowed}
                  hint={row.extend.disabledReason}
                >
                  {ui("owner.extend", locale)}
                </ActionRow>
  );
}

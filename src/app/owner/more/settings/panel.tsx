import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import type { UiLocale } from "@/lib/locale";
import { lbpPerUsdLine, ui } from "@/lib/ui-copy";
import { submitSetExchangeRate } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Exchange rate Card. OWNER sees the set form; staff see the current rate.
 * Use case is unchanged (setExchangeRate).
 */
export async function OwnerSettings({
  membership,
  tenantSlug,
  locale = "ar",
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  locale?: UiLocale;
}) {
  const rate = await getCurrentRate();
  const isOwner = membership.role === "OWNER";

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        {ui("owner.rate", locale)}
      </h3>
      <Card>
        <CardHeader>
          <CardDescription>
            {rate ? (
              lbpPerUsdLine(rate.toFixed(0), locale)
            ) : (
              ui("owner.noRate", locale)
            )}
          </CardDescription>
        </CardHeader>
        {isOwner ? (
          <CardContent>
            <form
              action={submitSetExchangeRate}
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="tenant" value={tenantSlug} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="lbpPerUsd">{ui("owner.newRate", locale)}</Label>
                <Input
                  id="lbpPerUsd"
                  type="text"
                  name="lbpPerUsd"
                  required
                  inputMode="numeric"
                  className="font-mono"
                />
              </div>
              <SubmitButton variant="secondary" className="w-full">
                {ui("owner.setRate", locale)}
              </SubmitButton>
            </form>
          </CardContent>
        ) : null}
      </Card>
    </section>
  );
}

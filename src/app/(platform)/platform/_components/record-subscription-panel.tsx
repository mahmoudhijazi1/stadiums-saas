"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import type { StadiumActionResult } from "@/app/(platform)/platform/actions";

const PLAN_ERRORS = new Set(["platform.plan_required", "platform.plan_too_long"]);

/**
 * Record a subscription payment (DR-006): a button that opens a form with the plan and the paid-until
 * date already filled in by the page. One primary button saves; each error shows under its own field.
 * On success the dialog closes and the page refreshes, so the new row is at the top of the history.
 * The Server Action comes in as a prop.
 */
export function RecordSubscriptionPanel({
  slug,
  defaultPlan,
  defaultPaidUntil,
  action,
}: {
  slug: string;
  defaultPlan: string;
  defaultPaidUntil: string;
  action: (input: unknown) => Promise<StadiumActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset(next: boolean) {
    setOpen(next);
    setErrorKey(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      slug,
      plan: String(data.get("plan") ?? ""),
      paidUntil: String(data.get("paidUntil") ?? ""),
      amountUsd: String(data.get("amountUsd") ?? ""),
      note: String(data.get("note") ?? ""),
    };
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        reset(false);
        router.refresh();
      } else {
        setErrorKey(result.errorKey);
      }
    });
  }

  const message = errorKey ? errorMessage(errorKey, "en") : null;
  const planError = errorKey && PLAN_ERRORS.has(errorKey) ? message : null;
  const dateError = errorKey === "platform.paid_until_invalid" ? message : null;
  const amountError = errorKey === "platform.amount_invalid" ? message : null;
  const noteError = errorKey === "platform.note_too_long" ? message : null;
  const otherError = message && !planError && !dateError && !amountError && !noteError ? message : null;

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11 w-full" aria-haspopup="dialog" onClick={() => reset(true)}>
        {ui("platform.recordPayment", "en")}
      </Button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent closeLabel="Close">
          <DialogHeader>
            <DialogTitle>{ui("platform.recordPaymentTitle", "en")}</DialogTitle>
            <DialogDescription>{ui("platform.recordPaymentHelp", "en")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-plan">{ui("platform.plan", "en")}</Label>
              <Input id="subscription-plan" name="plan" type="text" autoComplete="off" defaultValue={defaultPlan} aria-invalid={planError !== null} />
              {planError ? <p role="alert" className="text-sm text-destructive">{planError}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-paid-until">{ui("platform.paidUntil", "en")}</Label>
              <Input id="subscription-paid-until" name="paidUntil" type="date" defaultValue={defaultPaidUntil} aria-invalid={dateError !== null} />
              {dateError ? <p role="alert" className="text-sm text-destructive">{dateError}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-amount">{ui("platform.amountUsdOptional", "en")}</Label>
              <Input
                id="subscription-amount"
                name="amountUsd"
                type="text"
                dir="ltr"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={amountError !== null}
              />
              {amountError ? <p role="alert" className="text-sm text-destructive">{amountError}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-note">{ui("platform.noteOptional", "en")}</Label>
              <Input id="subscription-note" name="note" type="text" autoComplete="off" aria-invalid={noteError !== null} />
              {noteError ? <p role="alert" className="text-sm text-destructive">{noteError}</p> : null}
            </div>

            {otherError ? <p role="alert" className="text-sm text-destructive">{otherError}</p> : null}
            <Button type="submit" className="min-h-11 w-full" disabled={pending}>
              {pending ? "…" : ui("platform.recordPayment", "en")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

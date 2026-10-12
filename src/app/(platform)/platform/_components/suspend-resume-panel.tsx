"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import type { StadiumActionResult } from "@/app/(platform)/platform/actions";

const REASON_MAX = 500;

/**
 * The one state-changing action that applies to a stadium: Suspend when it is active, Resume when
 * it is suspended (never both). A confirm asks for the slug typed back (and a reason to suspend); the
 * confirm button stays disabled until the slug matches, and the server checks it again. The
 * destructive action is a red secondary button, last on the page (ui-rules rule 5).
 */
export function SuspendResumePanel({
  slug,
  suspended,
  suspend,
  resume,
}: {
  slug: string;
  suspended: boolean;
  suspend: (input: unknown) => Promise<StadiumActionResult>;
  resume: (input: unknown) => Promise<StadiumActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = typed.trim() === slug;
  const ready = matches && (suspended || reason.trim().length > 0);

  function reset(next: boolean) {
    setOpen(next);
    setTyped("");
    setReason("");
    setErrorKey(null);
  }

  function confirm() {
    startTransition(async () => {
      const result = suspended
        ? await resume({ slug, typedSlug: typed })
        : await suspend({ slug, typedSlug: typed, reason });
      if (result.ok) {
        reset(false);
        router.refresh();
      } else {
        setErrorKey(result.errorKey);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={suspended ? "min-h-11 w-full" : "min-h-11 w-full border-alert text-alert"}
        aria-haspopup="dialog"
        onClick={() => reset(true)}
      >
        {suspended ? ui("platform.resume", "en") : ui("platform.suspend", "en")}
      </Button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent closeLabel="Close">
          <DialogHeader>
            <DialogTitle>{suspended ? ui("platform.resumeTitle", "en") : ui("platform.suspendTitle", "en")}</DialogTitle>
            <DialogDescription>{suspended ? ui("platform.resumeHelp", "en") : ui("platform.suspendHelp", "en")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {suspended ? null : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="suspend-reason">{ui("platform.reasonLabel", "en")}</Label>
                <textarea
                  id="suspend-reason"
                  value={reason}
                  maxLength={REASON_MAX}
                  rows={3}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 type-field outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-slug">
                <bdi>{ui("platform.typeSlug", "en").replace("{slug}", slug)}</bdi>
              </Label>
              <Input
                id="confirm-slug"
                type="text"
                dir="ltr"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
            {errorKey ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(errorKey, "en")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => reset(false)}>
              {ui("platform.cancel", "en")}
            </Button>
            <Button
              type="button"
              className={suspended ? "min-h-11" : "min-h-11 bg-destructive text-[var(--destructive-foreground)] hover:bg-destructive/90"}
              disabled={!ready || pending}
              onClick={confirm}
            >
              {suspended ? ui("platform.confirmResume", "en") : ui("platform.confirmSuspend", "en")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

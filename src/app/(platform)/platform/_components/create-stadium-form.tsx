"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";
import type { CreateStadiumResult } from "@/app/(platform)/platform/actions";

const SLUG_ERRORS = new Set([
  "platform.slug_length",
  "platform.slug_format",
  "platform.slug_reserved",
  "platform.slug_taken",
  "platform.identifier_taken",
]);
const NAME_ERRORS = new Set(["platform.name_required", "platform.name_too_long"]);

/**
 * Create a stadium (DR-006 slice 6). The owner login is shown as the slug is typed. On success the
 * owner's first password is shown ONCE, held only in this component's memory (never in a URL), with
 * a copy button; leaving the page loses it. The Server Action comes in as a prop.
 */
export function CreateStadiumForm({ action }: { action: (input: unknown) => Promise<CreateStadiumResult> }) {
  const [slug, setSlug] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [created, setCreated] = useState<Extract<CreateStadiumResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get("name") ?? ""),
      slug,
      dayStartHour: Number(data.get("dayStartHour") ?? 6),
      plan: String(data.get("plan") ?? ""),
      paidUntil: String(data.get("paidUntil") ?? ""),
    };
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        setCreated(result);
        setErrorKey(null);
      } else {
        setErrorKey(result.errorKey);
      }
    });
  }

  async function copyPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false); // the password is still on screen to select by hand
    }
  }

  if (created) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border bg-card px-4 py-4">
        <p dir="ltr" className="text-start text-sm text-muted-foreground">
          {created.ownerIdentifier}
        </p>
        <h2 className="text-sm font-semibold text-muted-foreground">{ui("platform.ownerPassword", "en")}</h2>
        <div className="flex items-center gap-2">
          <code dir="ltr" className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-start font-mono text-lg tracking-wide break-all select-all">
            {created.ownerPassword}
          </code>
          <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => copyPassword(created.ownerPassword)}>
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? ui("platform.copied", "en") : ui("platform.copy", "en")}
          </Button>
        </div>
        <p role="status" className="text-sm font-semibold">
          {ui("platform.shownOnce", "en")}
        </p>
        <Link
          href={`/platform/stadiums/${created.slug}`}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          {ui("platform.openStadium", "en")}
        </Link>
      </section>
    );
  }

  const message = errorKey ? errorMessage(errorKey, "en") : null;
  const slugError = errorKey && SLUG_ERRORS.has(errorKey) ? message : null;
  const nameError = errorKey && NAME_ERRORS.has(errorKey) ? message : null;
  const dateError = errorKey === "platform.paid_until_invalid" ? message : null;
  const hourError = errorKey === "platform.day_start_hour_invalid" ? message : null;
  const planError = errorKey === "platform.plan_too_long" ? message : null;
  const otherError = message && !slugError && !nameError && !dateError && !hourError && !planError ? message : null;
  const login = `owner@${slug.trim().toLowerCase() || "…"}`;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-name">{ui("platform.name", "en")}</Label>
        <Input id="stadium-name" name="name" type="text" autoComplete="off" aria-invalid={nameError !== null} />
        {nameError ? <p role="alert" className="text-sm text-destructive">{nameError}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-slug">{ui("platform.slug", "en")}</Label>
        <Input
          id="stadium-slug"
          name="slug"
          type="text"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          aria-invalid={slugError !== null}
        />
        <p dir="ltr" className="text-start text-sm text-muted-foreground">
          {ui("platform.ownerLogin", "en").replace("{login}", login)}
        </p>
        {slugError ? <p role="alert" className="text-sm text-destructive">{slugError}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-hour">{ui("platform.dayStartHour", "en")}</Label>
        <Input id="stadium-hour" name="dayStartHour" type="number" inputMode="numeric" min={0} max={6} step={1} defaultValue={6} aria-invalid={hourError !== null} />
        {hourError ? <p role="alert" className="text-sm text-destructive">{hourError}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-plan">{ui("platform.planOptional", "en")}</Label>
        <Input id="stadium-plan" name="plan" type="text" autoComplete="off" aria-invalid={planError !== null} />
        {planError ? <p role="alert" className="text-sm text-destructive">{planError}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-paid">{ui("platform.paidUntilOptional", "en")}</Label>
        <Input id="stadium-paid" name="paidUntil" type="date" aria-invalid={dateError !== null} />
        {dateError ? <p role="alert" className="text-sm text-destructive">{dateError}</p> : null}
      </div>

      {otherError ? <p role="alert" className="text-sm text-destructive">{otherError}</p> : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "…" : ui("platform.createStadium", "en")}
      </Button>
    </form>
  );
}

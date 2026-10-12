"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/copy/errors";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { DEFAULT_COUNTRY } from "@/modules/people/domain/countries";
import { PhoneField } from "@/modules/people/ui/phone-field";
import type { UpdatePersonResult } from "@/app/owner/(app)/people/[personId]/actions";

const PHONE_ERRORS = new Set(["people.phone_invalid", "people.phone_required", "people.phone_taken"]);

/**
 * The pencil icon button beside the name on the person page: it opens a sheet with the name, the phone (country select + number) and one
 * Save. The page shows the button only to a member who may edit. Errors show under their field.
 * The action comes in as a prop.
 */
export function PersonEditSheet({
  personId,
  name,
  phone,
  locale,
  action,
}: {
  personId: string;
  name: string;
  /** The stored phone: canonical digits (shown with a +), or an old value shown as it is. */
  phone: string | null;
  locale: UiLocale;
  action: (input: unknown) => Promise<UpdatePersonResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [error, setError] = useState<{ key: string; name?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      personId,
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      country,
    };
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        setOpen(false);
        setError(null);
        router.refresh();
      } else {
        setError({ key: result.errorKey, ...(result.name ? { name: result.name } : {}) });
      }
    });
  }

  const message = error ? errorMessage(error.key, locale).replace("{name}", error.name ?? "") : null;
  const phoneError = error && PHONE_ERRORS.has(error.key) ? message : null;
  const nameError = error && error.key === "form.invalid" ? message : null;
  const otherError = error && !phoneError && !nameError ? message : null;
  // A stored canonical number is shown with its +, so its country needs no guessing.
  const shownPhone = phone ? (/^[1-9][0-9]{9,14}$/.test(phone) ? `+${phone}` : phone) : "";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground"
        aria-haspopup="dialog"
        aria-label={ui("person.edit", locale)}
        onClick={() => {
          setError(null);
          setCountry(DEFAULT_COUNTRY);
          setOpen(true);
        }}
      >
        <Pencil aria-hidden className="size-5" />
      </Button>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("person.editTitle", locale)}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="pb-4">
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="person-name">{ui("person.name", locale)}</Label>
                <Input
                  id="person-name"
                  name="name"
                  type="text"
                  defaultValue={name}
                  autoComplete="off"
                  aria-invalid={nameError !== null}
                  aria-describedby={nameError ? "person-name-err" : undefined}
                />
                {nameError ? (
                  <p id="person-name-err" role="alert" className="type-secondary text-destructive">
                    {nameError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="person-phone">{ui("person.phone", locale)}</Label>
                <PhoneField
                  locale={locale}
                  country={country}
                  onCountryChange={setCountry}
                  phoneId="person-phone"
                  defaultValue={shownPhone}
                  invalid={phoneError !== null}
                  describedBy={phoneError ? "person-phone-err" : undefined}
                  onPhoneInput={() => setError((current) => (current && PHONE_ERRORS.has(current.key) ? null : current))}
                />
                {phoneError ? (
                  <p id="person-phone-err" role="alert" className="type-secondary text-destructive">
                    {phoneError}
                  </p>
                ) : null}
              </div>
              {otherError ? (
                <p role="alert" className="type-secondary text-destructive">
                  {otherError}
                </p>
              ) : null}
              <Button type="submit" className="min-h-11 w-full" disabled={pending}>
                {ui("person.save", locale)}
              </Button>
            </form>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

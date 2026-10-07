"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheetBody,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { devicesClosedLabel } from "@/lib/ui-copy";
import { submitChangeIdentifier, submitChangePassword, submitLogOutOtherDevices } from "./actions";

type Step = "home" | "password" | "logout" | "identifier";

/**
 * More > Account sheet: the login (read-only here) and the actions on your own
 * credentials. One primary button per step.
 */
export function AccountSheetContent({
  locale,
  identifier,
  slug,
}: {
  locale: UiLocale;
  identifier: string;
  slug: string;
}) {
  const [step, setStep] = useState<Step>("home");
  const [login, setLogin] = useState(identifier);

  return (
    <>
      <BottomSheetHeader>
        <BottomSheetTitle>
          {step === "password"
            ? ui("owner.changePassword", locale)
            : step === "logout"
              ? ui("owner.logoutOthers", locale)
              : step === "identifier"
                ? ui("owner.changeLogin", locale)
                : ui("owner.identifier", locale)}
        </BottomSheetTitle>
      </BottomSheetHeader>
      <BottomSheetBody className="flex flex-col gap-4 pb-4">
        {step === "home" ? (
          <>
            <LtrIsolate className="text-lg font-semibold">{login}</LtrIsolate>
            <Button type="button" className="w-full" onClick={() => setStep("password")}>
              {ui("owner.changePassword", locale)}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setStep("identifier")}>
              {ui("owner.changeLogin", locale)}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setStep("logout")}>
              {ui("owner.logoutOthers", locale)}
            </Button>
          </>
        ) : step === "identifier" ? (
          <IdentifierForm
            locale={locale}
            slug={slug}
            initial={login.split("@")[0] ?? ""}
            onDone={(next) => {
              if (next) setLogin(next);
              setStep("home");
            }}
          />
        ) : step === "logout" ? (
          <LogoutOthers locale={locale} onDone={() => setStep("home")} />
        ) : (
          <PasswordForm locale={locale} onDone={() => setStep("home")} onBack={() => setStep("home")} />
        )}
      </BottomSheetBody>
    </>
  );
}

function PasswordForm({
  locale,
  onDone,
  onBack,
}: {
  locale: UiLocale;
  onDone: () => void;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitChangePassword({ currentPassword: current, newPassword: next });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      setCurrent("");
      setNext("");
      toast.success(ui("owner.passwordChanged", locale));
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">{ui("owner.currentPassword", locale)}</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">{ui("owner.newPassword", locale)}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="new-password"
            type={shown ? "text" : "password"}
            autoComplete="new-password"
            dir="ltr"
            required
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          <button
            type="button"
            aria-pressed={shown}
            aria-label={ui(shown ? "owner.hidePassword" : "owner.showPassword", locale)}
            onClick={() => setShown((value) => !value)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{ui("owner.passwordHint", locale)}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-owed">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {ui("owner.savePassword", locale)}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={pending}>
        {ui("owner.back", locale)}
      </Button>
    </form>
  );
}

/** Confirm step, then the count of devices that were closed. */
function LogoutOthers({ locale, onDone }: { locale: UiLocale; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await submitLogOutOtherDevices();
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      toast.success(devicesClosedLabel(result.closed, locale));
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{ui("owner.logoutOthersAsk", locale)}</p>
      {error ? (
        <p role="alert" className="text-sm text-owed">
          {error}
        </p>
      ) : null}
      <Button type="button" className="w-full" onClick={confirm} disabled={pending}>
        {ui("owner.logoutOthersConfirm", locale)}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onDone} disabled={pending}>
        {ui("owner.notNow", locale)}
      </Button>
    </div>
  );
}

/** Only the part before the @ is editable; "@slug" is fixed beside it. */
function IdentifierForm({
  locale,
  slug,
  initial,
  onDone,
}: {
  locale: UiLocale;
  slug: string;
  initial: string;
  onDone: (identifier: string | null) => void;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(initial);
  const [current, setCurrent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const typed = local.split("@")[0]?.trim().toLowerCase() ?? "";

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitChangeIdentifier({ localPart: local, currentPassword: current });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      setCurrent("");
      toast.success(`${ui("owner.loginChanged", locale)} ${result.identifier}`);
      router.refresh();
      onDone(result.identifier);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-local">{ui("owner.loginName", locale)}</Label>
        <div className="flex items-center gap-2" dir="ltr">
          <Input
            id="login-local"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={32}
            value={local}
            onChange={(event) => setLocal(event.target.value)}
          />
          <span className="shrink-0 text-muted-foreground">@{slug}</span>
        </div>
        <p className="text-sm">
          {ui("owner.loginWarning", locale)}{" "}
          <LtrIsolate className="font-semibold">
            {typed}@{slug}
          </LtrIsolate>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-current-password">{ui("owner.currentPassword", locale)}</Label>
        <Input
          id="login-current-password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-owed">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {ui("owner.saveLogin", locale)}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => onDone(null)} disabled={pending}>
        {ui("owner.back", locale)}
      </Button>
    </form>
  );
}

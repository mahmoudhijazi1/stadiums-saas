"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BottomSheetBody,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { vapidKeyToBytes } from "@/modules/push/domain/vapid-key";
import {
  submitSendTestPush,
  submitSubscribePush,
  submitUnsubscribePush,
} from "./actions";

type PanelState = "checking" | "unsupported" | "ios_install" | "denied" | "ask" | "enabled";

const SYNC_KEY = "push-synced";

/** iPhone, iPad (including iPadOS, which reports as a Mac with touch). */
function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** The worker the layout registers (scope /owner/); register it here if that has not happened yet. */
async function ownerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/owner/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/owner/" });
  // Resolves once a worker is active, which pushManager.subscribe needs.
  return navigator.serviceWorker.ready;
}

function subscriptionBody(subscription: PushSubscription, locale: UiLocale) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    locale,
  };
}

function readSynced(): boolean {
  try {
    return window.sessionStorage.getItem(SYNC_KEY) === "1";
  } catch {
    return false;
  }
}

function markSynced(): void {
  try {
    window.sessionStorage.setItem(SYNC_KEY, "1");
  } catch {
    // Private mode: the next visit just syncs again. The upsert is idempotent.
  }
}

/**
 * More > Notifications sheet. The permission prompt is requested ONLY from the Enable button.
 * One primary button per state: Enable, or Send a test (Turn off is quiet).
 */
export function NotificationsSheetContent({
  locale,
  publicKey,
}: {
  locale: UiLocale;
  publicKey: string;
}) {
  const [state, setState] = useState<PanelState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      let next: PanelState;
      if (isIos() && !isInstalled()) {
        next = "ios_install";
      } else if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        next = "unsupported";
      } else if (Notification.permission === "denied") {
        next = "denied";
      } else if (Notification.permission === "default") {
        next = "ask";
      } else {
        // Allowed already: enabled if this browser holds a subscription. A new login on the same
        // phone keeps the subscription but lost its server row, so re-attach it once per browser
        // session (idempotent upsert).
        next = "ask";
        try {
          const registration = await navigator.serviceWorker.getRegistration("/owner/");
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            next = "enabled";
            if (!readSynced()) {
              const result = await submitSubscribePush(subscriptionBody(subscription, locale));
              if ("ok" in result) markSynced();
            }
          }
        } catch {
          next = "ask";
        }
      }
      if (!cancelled) setState(next);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function enable() {
    setMessage(null);
    // Called first, in the tap handler: iOS only shows the prompt for a direct user gesture.
    const asked = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
    setBusy(true);
    try {
      const permission = await asked;
      if (permission === "denied") {
        setState("denied");
        return;
      }
      if (permission !== "granted") {
        setState("ask");
        return;
      }
      const registration = await ownerRegistration();
      const key = vapidKeyToBytes(publicKey);
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as BufferSource,
        });
      }
      const result = await submitSubscribePush(subscriptionBody(subscription, locale));
      if ("error" in result) {
        setMessage(errorMessage(result.error, locale));
        setState("ask");
        return;
      }
      markSynced();
      setState("enabled");
    } catch {
      setMessage(errorMessage("error.generic", locale));
      setState("ask");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setMessage(null);
    setBusy(true);
    try {
      const result = await submitSendTestPush();
      if ("error" in result) {
        setMessage(errorMessage(result.error, locale));
      } else if (result.result.devices === 0) {
        setMessage(ui("push.testNoDevice", locale));
      } else if (result.result.sent > 0) {
        toast.success(ui("push.testSent", locale));
      } else {
        setMessage(ui("push.testFailed", locale));
      }
    } catch {
      setMessage(errorMessage("error.generic", locale));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setMessage(null);
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/owner/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await submitUnsubscribePush({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      try {
        window.sessionStorage.removeItem(SYNC_KEY);
      } catch {
        // Nothing to clear.
      }
      setState("ask");
      toast.success(ui("push.turnedOff", locale));
    } catch {
      setMessage(errorMessage("error.generic", locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BottomSheetHeader>
        <BottomSheetTitle>{ui("owner.notifications", locale)}</BottomSheetTitle>
      </BottomSheetHeader>
      <BottomSheetBody className="flex flex-col gap-4 pb-4">
        {state === "checking" ? <p className="type-secondary">{ui("push.working", locale)}</p> : null}
        {state === "unsupported" ? <p className="type-body">{ui("push.unsupported", locale)}</p> : null}
        {state === "ios_install" ? <p className="type-body">{ui("push.iosInstall", locale)}</p> : null}
        {state === "denied" ? <p className="type-body">{ui("push.deniedBody", locale)}</p> : null}
        {state === "ask" ? (
          <>
            <p className="type-body">{ui("push.askBody", locale)}</p>
            <Button type="button" className="w-full" onClick={enable} disabled={busy}>
              {busy ? ui("push.working", locale) : ui("push.enable", locale)}
            </Button>
          </>
        ) : null}
        {state === "enabled" ? (
          <>
            <p role="status" className="type-body">
              {ui("push.enabledStatus", locale)}
            </p>
            <Button type="button" className="w-full" onClick={sendTest} disabled={busy}>
              {ui("push.test", locale)}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={turnOff} disabled={busy}>
              {ui("push.turnOff", locale)}
            </Button>
          </>
        ) : null}
        {message ? (
          <p role="alert" className="type-secondary text-owed">
            {message}
          </p>
        ) : null}
      </BottomSheetBody>
    </>
  );
}

import { htmlDir, type UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/** What an alert is about. Only TEST exists until the new-request alert is wired. */
export type PushKind = "TEST";

/**
 * What the service worker receives. Generic on purpose: no player name, no phone (a lock screen
 * shows it). `url` is always a path under /owner/; the worker re-checks it anyway.
 */
export type PushPayload = {
  kind: PushKind;
  title: string;
  body: string;
  /** Same tag replaces the earlier notification instead of stacking. */
  tag: string;
  url: string;
  dir: "rtl" | "ltr";
  lang: UiLocale;
};

/** Web push allows about 4 KB; under 1 KB suits every push service. */
export const PUSH_PAYLOAD_MAX_BYTES = 1024;
const TITLE_MAX_CHARS = 40;

export function buildPushPayload(kind: PushKind, locale: UiLocale, tenantName: string): PushPayload {
  const name = [...tenantName.trim()].slice(0, TITLE_MAX_CHARS).join("");
  switch (kind) {
    case "TEST":
      return {
        kind,
        title: name || ui("push.testTitle", locale),
        body: ui("push.testBody", locale),
        tag: "owner-test",
        url: "/owner/more",
        dir: htmlDir(locale),
        lang: locale,
      };
  }
}

/** The bytes sent. Throws when over the limit (a bug: the inputs are bounded). */
export function serializePushPayload(payload: PushPayload): string {
  const text = JSON.stringify(payload);
  if (new TextEncoder().encode(text).length > PUSH_PAYLOAD_MAX_BYTES) {
    throw new Error("Push payload over 1 KB");
  }
  return text;
}

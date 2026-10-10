import { htmlDir, type UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

/** What an alert is about. */
export type PushKind = "TEST" | "NEW_REQUEST";

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

/** Facts a kind may need. Counts only: never a person's data. */
export type PushContext = { pendingCount?: number };

/** Web push allows about 4 KB; under 1 KB suits every push service. */
export const PUSH_PAYLOAD_MAX_BYTES = 1024;
const TITLE_MAX_CHARS = 40;

export function buildPushPayload(
  kind: PushKind,
  locale: UiLocale,
  tenantName: string,
  context: PushContext = {},
): PushPayload {
  const name = [...tenantName.trim()].slice(0, TITLE_MAX_CHARS).join("");
  const common = { kind, dir: htmlDir(locale), lang: locale } as const;
  switch (kind) {
    case "TEST":
      return {
        ...common,
        title: name || ui("push.testTitle", locale),
        body: ui("push.testBody", locale),
        tag: "owner-test",
        url: "/owner/more",
      };
    case "NEW_REQUEST": {
      const count = Math.max(1, Math.trunc(context.pendingCount ?? 1));
      return {
        ...common,
        title: name || ui("push.newRequestTitle", locale),
        body:
          count === 1
            ? ui("push.newRequestOne", locale)
            : ui("push.newRequestMany", locale).replace("{n}", String(count)),
        tag: "new-requests",
        url: "/owner/requests",
      };
    }
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

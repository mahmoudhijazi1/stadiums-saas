import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, jest } from "@jest/globals";

/**
 * public/sw.js loaded into a node vm with a fake worker scope. No browser: this checks the push
 * and click logic, not delivery. The existing install / activate / fetch behavior is checked too.
 */
const ORIGIN = "https://ahmad.lebstads.test";
const SOURCE = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

type Listener = (event: Record<string, unknown>) => void;
type FakeClient = {
  url: string;
  focus: jest.Mock<() => Promise<FakeClient>>;
  navigate: jest.Mock<(url: string) => Promise<unknown>>;
};

function load(windows: FakeClient[] = []) {
  const listeners = new Map<string, Listener>();
  const showNotification = jest.fn<(title: string, options: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
  const openWindow = jest.fn<(url: string) => Promise<unknown>>(() => Promise.resolve({}));
  const cache = { add: jest.fn<(url: string) => Promise<void>>(() => Promise.resolve()) };
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    location: { origin: ORIGIN },
    registration: { showNotification },
    skipWaiting: jest.fn(() => Promise.resolve()),
    clients: {
      claim: jest.fn(() => Promise.resolve()),
      matchAll: jest.fn(() => Promise.resolve(windows)),
      openWindow,
    },
  };
  const caches = {
    open: jest.fn(() => Promise.resolve(cache)),
    keys: jest.fn(() => Promise.resolve(["owner-shell-v1", "owner-shell-v2"])),
    delete: jest.fn<(key: string) => Promise<boolean>>(() => Promise.resolve(true)),
    match: jest.fn(() => Promise.resolve(undefined)),
  };
  vm.runInNewContext(SOURCE, { self, caches, URL, Response, Promise, fetch: jest.fn(() => Promise.reject(new Error("offline"))) });
  return { listeners, showNotification, openWindow, self, caches, cache };
}

/** Fire an event and wait for whatever it passed to waitUntil. */
async function fire(listeners: Map<string, Listener>, type: string, event: Record<string, unknown>) {
  const waits: Promise<unknown>[] = [];
  const full = { ...event, waitUntil: (promise: Promise<unknown>) => waits.push(promise) };
  const listener = listeners.get(type);
  if (!listener) throw new Error(`no ${type} listener`);
  listener(full);
  await Promise.all(waits);
}

const pushOf = (data: unknown) => ({ data: { json: () => (typeof data === "string" ? JSON.parse(data) : data) } });

describe("push handler", () => {
  it("shows one notification for a valid payload, with icon, tag, renotify, dir, lang and url", async () => {
    const { listeners, showNotification } = load();
    await fire(
      listeners,
      "push",
      pushOf({ title: "Ahmad", body: "hi", tag: "owner-test", url: "/owner/more", dir: "rtl", lang: "ar" }),
    );
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith("Ahmad", {
      body: "hi",
      icon: "/icons/icon-192.png",
      tag: "owner-test",
      renotify: true,
      dir: "rtl",
      lang: "ar",
      data: { url: "/owner/more" },
    });
  });

  it("an English payload keeps ltr and en", async () => {
    const { listeners, showNotification } = load();
    await fire(listeners, "push", pushOf({ title: "T", body: "B", tag: "x", url: "/owner/today", dir: "ltr", lang: "en" }));
    expect(showNotification.mock.calls[0]?.[1]).toMatchObject({ dir: "ltr", lang: "en" });
  });

  it("invalid JSON still shows exactly one generic notification", async () => {
    const { listeners, showNotification } = load();
    await fire(listeners, "push", { data: { json: () => JSON.parse("{not json") } });
    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0]!;
    expect(title.length).toBeGreaterThan(0);
    expect(options).toMatchObject({ icon: "/icons/icon-192.png", renotify: true, data: { url: "/owner/requests" } });
    expect(typeof options.tag).toBe("string");
  });

  it("no data still shows exactly one generic notification", async () => {
    const { listeners, showNotification } = load();
    await fire(listeners, "push", { data: null });
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0]?.[1]).toMatchObject({ body: expect.any(String) });
  });

  it.each([["null", null], ["a string", "text"], ["a number", 7], ["an array", [1, 2]]])(
    "a payload that is %s still shows one notification",
    async (_name, value) => {
      const { listeners, showNotification } = load();
      await fire(listeners, "push", { data: { json: () => value } });
      expect(showNotification).toHaveBeenCalledTimes(1);
    },
  );

  it("wrong field types fall back field by field", async () => {
    const { listeners, showNotification } = load();
    await fire(listeners, "push", pushOf({ title: 5, body: {}, tag: null, url: 9, lang: "fr" }));
    const [title, options] = showNotification.mock.calls[0]!;
    expect(typeof title).toBe("string");
    expect(options).toMatchObject({ lang: "ar", dir: "rtl", data: { url: "/owner/requests" } });
  });

  it("a payload url outside /owner/ is replaced before it is stored", async () => {
    const { listeners, showNotification } = load();
    await fire(listeners, "push", pushOf({ title: "T", url: "https://evil.example/owner/x" }));
    expect(showNotification.mock.calls[0]?.[1]).toMatchObject({ data: { url: "/owner/requests" } });
  });
});

describe("notificationclick", () => {
  const click = (url: unknown) => ({
    notification: { close: jest.fn(), data: url === undefined ? undefined : { url } },
  });

  it("closes the notification and opens a new window when none is open", async () => {
    const { listeners, openWindow } = load([]);
    const event = click("/owner/more");
    await fire(listeners, "notificationclick", event);
    expect(event.notification.close).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/owner/more`);
  });

  it("focuses an open /owner/ window and navigates it instead of opening another", async () => {
    const existing: FakeClient = {
      url: `${ORIGIN}/owner/today`,
      focus: jest.fn(() => Promise.resolve(existing)),
      navigate: jest.fn(() => Promise.resolve({})),
    };
    const { listeners, openWindow } = load([{ url: `${ORIGIN}/`, focus: jest.fn(), navigate: jest.fn() } as unknown as FakeClient, existing]);
    await fire(listeners, "notificationclick", click("/owner/requests?x=1"));
    expect(existing.focus).toHaveBeenCalledTimes(1);
    expect(existing.navigate).toHaveBeenCalledWith(`${ORIGIN}/owner/requests?x=1`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a window when navigating the existing one fails", async () => {
    const existing: FakeClient = {
      url: `${ORIGIN}/owner/today`,
      focus: jest.fn(() => Promise.resolve(existing)),
      navigate: jest.fn(() => Promise.reject(new Error("not controlled"))),
    };
    const { listeners, openWindow } = load([existing]);
    await fire(listeners, "notificationclick", click("/owner/today"));
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/owner/today`);
  });

  const hostile: [string, unknown][] = [
    ["an absolute external URL", "https://evil.example/owner/requests"],
    ["an absolute same-origin URL", `${ORIGIN}/owner/more`],
    ["a protocol-relative URL", "//evil.example/owner/"],
    ["a path outside /owner/", "/admin"],
    ["the bare /owner", "/owner"],
    ["a lookalike prefix", "/owner-x/requests"],
    ["a path that climbs out", "/owner/../admin"],
    ["an encoded climb", "/owner/%2e%2e/admin"],
    ["a backslash path", "/owner/\\evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a non-string", { a: 1 }],
    ["a missing url", undefined],
  ];
  it.each(hostile)("%s opens /owner/requests", async (_name, url) => {
    const { listeners, openWindow } = load([]);
    await fire(listeners, "notificationclick", click(url));
    expect(openWindow).toHaveBeenCalledTimes(1);
    const opened = new URL(openWindow.mock.calls[0]![0]);
    expect(opened.origin).toBe(ORIGIN);
    if (url === "/owner/%2e%2e/admin") {
      // Percent-encoded dots are normalized by URL: either the default or still under /owner/.
      expect(opened.pathname.startsWith("/owner/")).toBe(true);
    } else {
      expect(opened.pathname).toBe("/owner/requests");
    }
  });
});

describe("existing behavior is unchanged", () => {
  it("install caches the offline page and skips waiting", async () => {
    const { listeners, cache, self } = load();
    await fire(listeners, "install", {});
    expect(cache.add).toHaveBeenCalledWith("/offline.html");
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("activate deletes old caches and claims clients", async () => {
    const { listeners, caches, self } = load();
    await fire(listeners, "activate", {});
    expect(caches.delete).toHaveBeenCalledWith("owner-shell-v1");
    expect(caches.delete).not.toHaveBeenCalledWith("owner-shell-v2");
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it("fetch ignores everything except navigations", () => {
    const { listeners } = load();
    const respondWith = jest.fn();
    listeners.get("fetch")!({ request: { mode: "cors" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    listeners.get("fetch")!({ request: { mode: "navigate" }, respondWith });
    expect(respondWith).toHaveBeenCalledTimes(1);
  });
});

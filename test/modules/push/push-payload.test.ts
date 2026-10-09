import { describe, expect, it } from "@jest/globals";
import { validatePushKeys } from "@/modules/push/domain/push-keys";
import { pushSendOptions } from "@/modules/push/domain/push-options";
import {
  PUSH_PAYLOAD_MAX_BYTES,
  buildPushPayload,
  serializePushPayload,
} from "@/modules/push/domain/push-payload";

describe("buildPushPayload TEST", () => {
  it.each([
    ["ar", "rtl"],
    ["en", "ltr"],
  ] as const)("%s: generic copy, dir/lang, tag, path under /owner/", (locale, dir) => {
    const payload = buildPushPayload("TEST", locale, "Ahmad Stadium");
    expect(payload).toMatchObject({ kind: "TEST", title: "Ahmad Stadium", dir, lang: locale, tag: "owner-test" });
    expect(payload.body.length).toBeGreaterThan(0);
    expect(payload.url.startsWith("/owner/")).toBe(true);
    expect(payload.url).not.toMatch(/^\/\/|:/);
  });

  it("the Arabic and English bodies differ", () => {
    expect(buildPushPayload("TEST", "ar", "x").body).not.toBe(buildPushPayload("TEST", "en", "x").body);
  });

  it("falls back to generic copy for a blank name and cuts a long one", () => {
    expect(buildPushPayload("TEST", "en", "   ").title).toBe("Test notification");
    expect([...buildPushPayload("TEST", "en", "x".repeat(200)).title]).toHaveLength(40);
  });

  it("stays under 1 KB even for the longest Arabic name", () => {
    const text = serializePushPayload(buildPushPayload("TEST", "ar", "ملعب".repeat(60)));
    expect(new TextEncoder().encode(text).length).toBeLessThan(PUSH_PAYLOAD_MAX_BYTES);
    expect(JSON.parse(text).url).toBe("/owner/more");
  });

  it("refuses to serialize an oversized payload", () => {
    const payload = { ...buildPushPayload("TEST", "en", "x"), body: "y".repeat(2000) };
    expect(() => serializePushPayload(payload)).toThrow();
  });
});

describe("pushSendOptions", () => {
  it("TEST: 60 seconds, high urgency, the tag as the topic", () => {
    expect(pushSendOptions("TEST", "owner-test")).toEqual({ ttlSeconds: 60, urgency: "high", topic: "owner-test" });
  });

  it("keeps the topic base64url-safe and at most 32 characters", () => {
    const topic = pushSendOptions("TEST", `a b/c${"d".repeat(60)}`).topic;
    expect(topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
  });
});

describe("validatePushKeys", () => {
  const p256dh = "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4";
  const auth = "xGdrZRlYJ01Wo07Jn2A6R-";

  it("accepts base64url keys of the expected lengths", () => {
    expect(p256dh).toHaveLength(87);
    expect(auth).toHaveLength(22);
    expect(validatePushKeys({ p256dh, auth })).toEqual({ p256dh, auth });
  });

  const refused: [string, unknown][] = [
    ["not an object", "keys"],
    ["null", null],
    ["missing auth", { p256dh }],
    ["missing p256dh", { auth }],
    ["short p256dh", { p256dh: p256dh.slice(1), auth }],
    ["long p256dh", { p256dh: `${p256dh}A`, auth }],
    ["short auth", { p256dh, auth: auth.slice(1) }],
    ["long auth", { p256dh, auth: `${auth}A` }],
    ["padded base64", { p256dh, auth: `${auth.slice(0, 20)}==` }],
    ["standard base64 (+ /)", { p256dh: p256dh.replace("_", "+"), auth }],
    ["non-string", { p256dh: 1, auth }],
  ];
  it.each(refused)("refuses %s", (_name, keys) => {
    expect(validatePushKeys(keys)).toBeNull();
  });
});

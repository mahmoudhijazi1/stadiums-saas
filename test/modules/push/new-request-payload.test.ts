import { describe, expect, it } from "@jest/globals";
import { mapWithConcurrency } from "@/modules/push/domain/map-with-concurrency";
import { pushSendOptions } from "@/modules/push/domain/push-options";
import { buildPushPayload, serializePushPayload } from "@/modules/push/domain/push-payload";

/** Slice B (written, not run when authored): the NEW_REQUEST payload text and the pool helper. */
describe("buildPushPayload NEW_REQUEST", () => {
  const cases = [
    ["ar", 1, "طلب حجز جديد"],
    ["en", 1, "New booking request"],
    ["ar", 2, "2 طلبات بانتظارك"],
    ["en", 2, "2 requests waiting"],
    ["ar", 7, "7 طلبات بانتظارك"],
    ["en", 12, "12 requests waiting"],
  ] as const;

  it.each(cases)("%s with %i waiting says %s", (locale, count, body) => {
    const payload = buildPushPayload("NEW_REQUEST", locale, "Ahmad Stadium", { pendingCount: count });
    expect(payload).toMatchObject({
      kind: "NEW_REQUEST",
      title: "Ahmad Stadium",
      body,
      tag: "new-requests",
      url: "/owner/requests",
      lang: locale,
      dir: locale === "ar" ? "rtl" : "ltr",
    });
  });

  it("treats a missing or silly count as one request", () => {
    expect(buildPushPayload("NEW_REQUEST", "en", "x").body).toBe("New booking request");
    expect(buildPushPayload("NEW_REQUEST", "en", "x", { pendingCount: 0 }).body).toBe("New booking request");
    expect(buildPushPayload("NEW_REQUEST", "en", "x", { pendingCount: -3 }).body).toBe("New booking request");
  });

  it("falls back to a generic title for a blank stadium name", () => {
    expect(buildPushPayload("NEW_REQUEST", "en", "  ", { pendingCount: 1 }).title).toBe("Lebstads");
    expect(buildPushPayload("NEW_REQUEST", "ar", "", { pendingCount: 1 }).title).toBe("ملاعب");
  });

  it("has no player data and stays under 1 KB, even for the longest Arabic name", () => {
    const payload = buildPushPayload("NEW_REQUEST", "ar", "ملعب".repeat(60), { pendingCount: 200 });
    const text = serializePushPayload(payload);
    expect(new TextEncoder().encode(text).length).toBeLessThan(1024);
    expect(Object.keys(payload).sort()).toEqual(["body", "dir", "kind", "lang", "tag", "title", "url"]);
  });

  it("send options: six hours, high urgency, the tag as the topic", () => {
    expect(pushSendOptions("NEW_REQUEST", "new-requests")).toEqual({
      ttlSeconds: 21600,
      urgency: "high",
      topic: "new-requests",
    });
  });
});

describe("mapWithConcurrency", () => {
  it("keeps the input order and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, index) => index);
    const results = await mapWithConcurrency(items, 5, async (item) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5 - (item % 5)));
      running -= 1;
      return item * 2;
    });
    expect(results).toEqual(items.map((item) => item * 2));
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty list and a limit larger than the list", async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 5, async (item) => item)).toEqual([1, 2]);
  });
});

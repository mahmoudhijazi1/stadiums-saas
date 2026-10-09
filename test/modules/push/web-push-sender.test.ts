import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const sendNotification = jest.fn<(...args: unknown[]) => Promise<unknown>>();

/** Like web-push's WebPushError: an Error with a statusCode. */
function webPushError(statusCode: number): Error {
  return Object.assign(new Error(`secret detail ${statusCode}`), { statusCode });
}

import { createWebPushSender } from "@/modules/push/infrastructure/web-push-sender";
import { readPushConfig } from "@/modules/push/infrastructure/push-config";

const webPushSender = createWebPushSender({
  sendNotification: ((...args: unknown[]) => sendNotification(...args)) as never,
});

const target = { endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: "p", auth: "a" };
const options = { ttlSeconds: 60, urgency: "high", topic: "owner-test" } as const;

describe("webPushSender", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:ops@example.com";
  });

  it("ok on success, with the VAPID details, TTL, urgency and topic", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    expect(await webPushSender.send(target, "{}", options)).toEqual({ outcome: "ok" });
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: target.endpoint, keys: { p256dh: "p", auth: "a" } },
      "{}",
      expect.objectContaining({
        TTL: 60,
        urgency: "high",
        topic: "owner-test",
        vapidDetails: { subject: "mailto:ops@example.com", publicKey: "pub", privateKey: "priv" },
      }),
    );
  });

  it.each([404, 410])("%s means gone", async (status) => {
    sendNotification.mockRejectedValue(webPushError(status));
    expect(await webPushSender.send(target, "{}", options)).toEqual({ outcome: "gone", statusCode: status });
  });

  it.each([400, 401, 413, 429, 500, 503])("%s means retry", async (status) => {
    sendNotification.mockRejectedValue(webPushError(status));
    expect(await webPushSender.send(target, "{}", options)).toEqual({ outcome: "retry", statusCode: status });
  });

  it("a network error means retry and carries no message", async () => {
    sendNotification.mockRejectedValue(new Error("ECONNRESET with priv key"));
    const result = await webPushSender.send(target, "{}", options);
    expect(result).toEqual({ outcome: "retry", statusCode: undefined });
    expect(JSON.stringify(result)).not.toContain("priv");
  });

  it("retry without sending when the keys are not configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await webPushSender.send(target, "{}", options)).toEqual({ outcome: "retry" });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("readPushConfig", () => {
  it("is null unless all three are set", () => {
    expect(readPushConfig({})).toBeNull();
    expect(readPushConfig({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b" })).toBeNull();
    expect(readPushConfig({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "c" })).toEqual({
      publicKey: "a",
      privateKey: "b",
      subject: "c",
    });
  });
});

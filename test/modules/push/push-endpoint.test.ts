import { describe, expect, it } from "@jest/globals";
import { PUSH_ENDPOINT_MAX_LENGTH, validatePushEndpoint } from "@/modules/push/domain/push-endpoint";

/** SSRF guard: the server POSTs to whatever endpoint the browser registers. */
describe("validatePushEndpoint", () => {
  const accepted: [string, string][] = [
    ["Chrome / Edge", "https://fcm.googleapis.com/fcm/send/abc:APA91b"],
    ["Firefox", "https://updates.push.services.mozilla.com/wpush/v2/gAAAA"],
    ["Firefox regional host", "https://updates-autopush.stage.mozaws.net.push.services.mozilla.com/wpush/v2/x"],
    ["Safari / iOS", "https://web.push.apple.com/QAbc"],
    ["Apple regional host", "https://api.development.push.apple.com/3/device/abc"],
    ["Windows", "https://wns2-par02p.notify.windows.com/w/?token=BQYA"],
    ["upper-case host", "https://FCM.GoogleAPIs.com/fcm/send/abc"],
  ];
  it.each(accepted)("accepts %s", (_name, url) => {
    expect(validatePushEndpoint(url).ok).toBe(true);
  });

  it("returns the host (for logs) and the normalized URL", () => {
    expect(validatePushEndpoint("https://FCM.googleapis.com/fcm/send/abc")).toEqual({
      ok: true,
      url: "https://fcm.googleapis.com/fcm/send/abc",
      host: "fcm.googleapis.com",
    });
  });

  const refused: [string, unknown][] = [
    ["http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["no scheme", "fcm.googleapis.com/fcm/send/abc"],
    ["other scheme", "ftp://fcm.googleapis.com/x"],
    ["userinfo", "https://user:pass@fcm.googleapis.com/x"],
    ["userinfo trick", "https://fcm.googleapis.com@evil.com/x"],
    ["backslash trick", "https://fcm.googleapis.com\\@evil.com/x"],
    ["explicit port", "https://fcm.googleapis.com:8443/x"],
    ["explicit default port", "https://fcm.googleapis.com:443/x"],
    ["lookalike suffix", "https://fcm.googleapis.com.evil.com/x"],
    ["lookalike prefix", "https://evilfcm.googleapis.com/x"],
    ["no dot boundary", "https://evilnotify.windows.com/x"],
    ["no dot boundary apple", "https://evilpush.apple.com/x"],
    ["bare suffix host", "https://notify.windows.com/x"],
    ["trailing dot", "https://fcm.googleapis.com./x"],
    ["other google host", "https://www.googleapis.com/x"],
    ["IPv4", "https://127.0.0.1/x"],
    ["metadata IP", "https://169.254.169.254/latest/meta-data"],
    ["IPv6", "https://[::1]/x"],
    ["localhost", "https://localhost/x"],
    ["internal name", "https://db.internal/x"],
    ["space", "https://fcm.googleapis.com/x y"],
    ["newline", "https://fcm.googleapis.com/x\n"],
    ["non-ASCII host", "https://fcm.googleapis.com。evil.com/x"],
    ["empty", ""],
    ["not a string", 42],
    ["null", null],
    ["too long", `https://fcm.googleapis.com/${"a".repeat(PUSH_ENDPOINT_MAX_LENGTH)}`],
  ];
  it.each(refused)("refuses %s", (_name, url) => {
    expect(validatePushEndpoint(url).ok).toBe(false);
  });

  it("accepts exactly the maximum length", () => {
    const prefix = "https://fcm.googleapis.com/";
    const url = prefix + "a".repeat(PUSH_ENDPOINT_MAX_LENGTH - prefix.length);
    expect(url.length).toBe(PUSH_ENDPOINT_MAX_LENGTH);
    expect(validatePushEndpoint(url).ok).toBe(true);
  });
});

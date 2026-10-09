import { describe, expect, it } from "@jest/globals";
import { vapidKeyToBytes } from "@/modules/push/domain/vapid-key";

describe("vapidKeyToBytes", () => {
  const key = "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4";

  it("turns a 87-character base64url public key into its 65 bytes (uncompressed P-256 point)", () => {
    const bytes = vapidKeyToBytes(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04);
  });

  it("reads - and _ as + and /, and works without padding", () => {
    expect(Array.from(vapidKeyToBytes("-_8"))).toEqual([0xfb, 0xff]);
    expect(Array.from(vapidKeyToBytes("AQID"))).toEqual([1, 2, 3]);
  });
});

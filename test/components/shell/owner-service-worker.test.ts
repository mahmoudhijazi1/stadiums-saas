import { describe, expect, it } from "@jest/globals";
import { shouldRegisterOwnerWorker } from "@/components/shell/owner-service-worker";

/** Written, not run. The owner worker is for the owner area only, never the platform admin (DR-006). */
describe("shouldRegisterOwnerWorker", () => {
  it("registers under /owner", () => {
    for (const path of ["/owner", "/owner/today", "/owner/login"]) expect(shouldRegisterOwnerWorker(path)).toBe(true);
  });

  it("does not register on /platform or anything under it", () => {
    for (const path of ["/platform", "/platform/login", "/platform/stadiums/x"]) {
      expect(shouldRegisterOwnerWorker(path)).toBe(false);
    }
  });

  it("does not register on the public pages", () => {
    for (const path of ["/", "/login"]) expect(shouldRegisterOwnerWorker(path)).toBe(false);
  });
});

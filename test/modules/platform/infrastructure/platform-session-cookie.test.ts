import { describe, expect, it } from "@jest/globals";
import { adminCookie } from "@/modules/platform/infrastructure/platform-session-cookie";

/** Written, not run. Over https the admin cookie is host-only (__Host-) and Secure; over http it is the dev cookie. */
describe("adminCookie", () => {
  it("https: __Host-lebstads_admin, Secure, HttpOnly, SameSite=Strict, Path=/, 8 hours, no Domain", () => {
    const cookie = adminCookie("https");
    expect(cookie).toEqual({
      name: "__Host-lebstads_admin",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    expect(cookie).not.toHaveProperty("domain");
  });

  it("http (and anything but https): lebstads_admin_dev without the prefix and without Secure, still HttpOnly and Strict", () => {
    for (const protocol of ["http", undefined, ""]) {
      const cookie = adminCookie(protocol);
      expect(cookie.name).toBe("lebstads_admin_dev");
      expect(cookie.secure).toBe(false);
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("strict");
      expect(cookie.path).toBe("/");
      expect(cookie.maxAge).toBe(8 * 60 * 60);
    }
  });
});

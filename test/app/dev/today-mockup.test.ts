import { afterEach, describe, expect, it } from "@jest/globals";
import TodayMockupPage from "@/app/dev/mockups/today/page";
import { assertDevOnly } from "@/app/dev/mockups/today/guard";

const env = process.env as Record<string, string | undefined>;
const original = env.NODE_ENV;

afterEach(() => {
  env.NODE_ENV = original;
});

describe("/dev/mockups/today guard", () => {
  it("404s with NODE_ENV=production", () => {
    env.NODE_ENV = "production";
    expect(() => assertDevOnly()).toThrow(
      expect.objectContaining({ digest: expect.stringContaining("404") }),
    );
  });

  it("the page itself 404s in production before reading anything else", async () => {
    env.NODE_ENV = "production";
    await expect(TodayMockupPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it("does not throw in development or test", () => {
    env.NODE_ENV = "development";
    expect(() => assertDevOnly()).not.toThrow();
    env.NODE_ENV = "test";
    expect(() => assertDevOnly()).not.toThrow();
  });
});

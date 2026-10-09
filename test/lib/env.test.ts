import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { checkEnvAtStartup, validateEnv } from "@/lib/env";

/** Startup env validation: fail fast in production, name variables, never print values. */
const valid = {
  DATABASE_URL: "postgresql://user:s3cret@db.internal:5432/stadiums?schema=public",
  APP_BASE_DOMAIN: "lebstads.com",
  APP_PROTOCOL: "https",
};

// A throwaway pair generated for tests; used nowhere else.
const vapid = {
  VAPID_PUBLIC_KEY: "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4",
  VAPID_PRIVATE_KEY: "xGdrZRlYJ01Wo07Jn2A6R-5lz1AlV2OxgHf9kxe3F3A",
  VAPID_SUBJECT: "mailto:ops@lebstads.com",
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("validateEnv", () => {
  it("accepts the required set, with or without the optional settings", () => {
    expect(validateEnv(valid)).toEqual([]);
    expect(
      validateEnv({
        ...valid,
        APP_BASE_DOMAIN: "localhost:3000",
        APP_PROTOCOL: "http",
        PASSWORD_HASH_COST: "15",
        TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
        TRUST_PROXY_HEADERS: "true",
        PG_POOL_MAX: "10",
      }),
    ).toEqual([]);
  });

  it("names each missing required variable", () => {
    expect(validateEnv({})).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DATABASE_URL"),
        expect.stringContaining("APP_BASE_DOMAIN"),
        expect.stringContaining("APP_PROTOCOL"),
      ]),
    );
  });

  it("rejects malformed values", () => {
    const bad = {
      DATABASE_URL: "mysql://x",
      APP_BASE_DOMAIN: "https://lebstads.com/",
      APP_PROTOCOL: "ftp",
      PASSWORD_HASH_COST: "30",
      TRUSTED_CLIENT_IP_HEADER: "x real ip",
      TRUST_PROXY_HEADERS: "yes",
      PG_POOL_MAX: "0",
    };
    const errors = validateEnv(bad).join("\n");
    for (const name of Object.keys(bad)) expect(errors).toContain(name);
  });

  it("never prints a value (DATABASE_URL holds a password)", () => {
    const errors = validateEnv({ ...valid, APP_PROTOCOL: "ftp", DATABASE_URL: "s3cret-not-a-url" }).join("\n");
    expect(errors).not.toContain("s3cret");
    expect(errors).not.toContain("ftp");
  });
});

describe("checkEnvAtStartup", () => {
  it("throws in production when invalid", () => {
    expect(() => checkEnvAtStartup({ NODE_ENV: "production" })).toThrow(/APP_BASE_DOMAIN/);
  });

  it("passes in production when valid", () => {
    expect(() => checkEnvAtStartup({ ...valid, ...vapid, NODE_ENV: "production" })).not.toThrow();
  });

  it("only warns outside production", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => checkEnvAtStartup({ NODE_ENV: "development" })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});

describe("VAPID variables (web push)", () => {
  it("are optional outside production", () => {
    expect(validateEnv({ ...valid, NODE_ENV: "development" })).toEqual([]);
    expect(validateEnv({ ...valid, ...vapid })).toEqual([]);
  });

  it("are required in production, each named", () => {
    const errors = validateEnv({ ...valid, NODE_ENV: "production" });
    for (const name of Object.keys(vapid)) {
      expect(errors).toContain(`${name} is required in production`);
    }
    expect(() => checkEnvAtStartup({ ...valid, NODE_ENV: "production" })).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it("rejects malformed values without echoing them", () => {
    const errors = validateEnv({ ...valid, VAPID_PRIVATE_KEY: "not a key", VAPID_SUBJECT: "ops@lebstads.com" }).join("\n");
    expect(errors).toMatch(/VAPID_PRIVATE_KEY/);
    expect(errors).toMatch(/VAPID_SUBJECT/);
    expect(errors).not.toContain("not a key");
  });

  it("accepts an https URL as the subject", () => {
    expect(validateEnv({ ...valid, ...vapid, VAPID_SUBJECT: "https://lebstads.com/contact" })).toEqual([]);
  });
});

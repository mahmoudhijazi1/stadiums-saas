import { afterEach, describe, expect, it } from "@jest/globals";
import { publicPageUrl } from "@/lib/public-page-url";

const ORIGINAL_DOMAIN = process.env.APP_BASE_DOMAIN;
const ORIGINAL_PROTOCOL = process.env.APP_PROTOCOL;

afterEach(() => {
  if (ORIGINAL_DOMAIN === undefined) delete process.env.APP_BASE_DOMAIN;
  else process.env.APP_BASE_DOMAIN = ORIGINAL_DOMAIN;
  if (ORIGINAL_PROTOCOL === undefined) delete process.env.APP_PROTOCOL;
  else process.env.APP_PROTOCOL = ORIGINAL_PROTOCOL;
});

describe("publicPageUrl", () => {
  it("builds the tenant host from APP_BASE_DOMAIN and APP_PROTOCOL", () => {
    process.env.APP_BASE_DOMAIN = "lebstads.com";
    process.env.APP_PROTOCOL = "https";
    expect(publicPageUrl("ahmad")).toBe("https://ahmad.lebstads.com/");
  });

  it("defaults the protocol to https", () => {
    process.env.APP_BASE_DOMAIN = "lebstads.com";
    delete process.env.APP_PROTOCOL;
    expect(publicPageUrl("ahmad")).toBe("https://ahmad.lebstads.com/");
  });

  it("keeps a port on the local parent host", () => {
    process.env.APP_BASE_DOMAIN = "localhost:3000";
    process.env.APP_PROTOCOL = "http";
    expect(publicPageUrl("ahmad")).toBe("http://ahmad.localhost:3000/");
  });
});

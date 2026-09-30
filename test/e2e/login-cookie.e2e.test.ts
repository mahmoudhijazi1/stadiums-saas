import { spawn, type ChildProcess } from "node:child_process";
import { request as httpRequest } from "node:http";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import type { TestFixture } from "../integration/fixtures";
import { seedTwoTenants } from "../integration/fixtures";
import { finishIntegrationFile } from "../integration/teardown";
import { truncateAll } from "../integration/truncate";

/**
 * The real Set-Cookie of a login under NODE_ENV=production and `next start`
 * (security audit: cookie flags). Needs `npm run build` first; runs against
 * stadiums_test only (setup-env.ts).
 */
const PORT = 3217;
const PASSWORD = "test-owner-password";
const hostOf = (slug: string) => `${slug}.lebstads.test`;

let server: ChildProcess;
let a: TestFixture;
let b: TestFixture;
let serverLog = "";

type Response = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

function send(
  method: string,
  path: string,
  host: string,
  headers: Record<string, string> = {},
  body?: Buffer,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port: PORT, method, path, headers: { host, ...headers } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await send("GET", "/owner/login", hostOf(a.tenantSlug));
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`next start did not come up:\n${serverLog}`);
}

function multipart(fields: Record<string, string>) {
  const boundary = "----e2e" + Math.random().toString(16).slice(2);
  const parts = Object.entries(fields).map(
    ([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  return {
    body: Buffer.from(`${parts.join("")}--${boundary}--\r\n`),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function cookieLine(response: Response, name: string): string | undefined {
  const lines = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
  return lines.find((line) => line.startsWith(`${name}=`));
}

async function loginResponse(): Promise<Response> {
  const host = hostOf(a.tenantSlug);
  const page = await send("GET", "/owner/login", host);
  const actionId = /name="\$ACTION_ID_([0-9a-f]+)"/.exec(page.body)?.[1];
  if (!actionId) throw new Error("no login action id in the login page");
  const form = multipart({
    [`$ACTION_ID_${actionId}`]: "",
    identifier: a.ownerIdentifier,
    password: PASSWORD,
  });
  return send("POST", "/owner/login", host, {
    origin: `http://${host}`,
    "content-type": form.contentType,
  }, form.body);
}

/** Every flag the session cookie must carry in production. */
function expectSessionFlags(line: string | undefined) {
  expect(line).toBeDefined();
  const attributes = line!.split(";").slice(1).map((part) => part.trim().toLowerCase());
  expect(attributes).toContain("httponly");
  expect(attributes).toContain("secure");
  expect(attributes).toContain("samesite=lax");
  expect(attributes).toContain("path=/");
  expect(attributes).toContain(`max-age=${30 * 24 * 60 * 60}`);
  // Host-only: no Domain, so tenant A's cookie is never sent to tenant B.
  expect(attributes.some((attribute) => attribute.startsWith("domain="))).toBe(false);
}

beforeAll(async () => {
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("Run `npm run build` before `npm run test:e2e`.");
  }
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
  server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      APP_BASE_DOMAIN: "lebstads.test",
      APP_PROTOCOL: "http",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => (serverLog += chunk));
  server.stderr?.on("data", (chunk) => (serverLog += chunk));
  await waitForServer();
}, 90_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await truncateAll();
  await finishIntegrationFile();
});

describe("session cookie from a real production login", () => {
  it("is HttpOnly, Secure, SameSite=Lax, Path=/, 30 days and has no Domain", async () => {
    const response = await loginResponse();
    const line = cookieLine(response, "stadium_session");
    expectSessionFlags(line);
    expect(line).toMatch(/^stadium_session=[A-Za-z0-9_-]{43};/);
  });

  it("the proxy renews it on GET with the same flags; tenant B does not accept it", async () => {
    const token = /^stadium_session=([^;]+);/.exec(cookieLine(await loginResponse(), "stadium_session")!)![1]!;

    const renewed = await send("GET", "/owner/today", hostOf(a.tenantSlug), {
      cookie: `stadium_session=${token}`,
    });
    expect(renewed.status).toBe(200);
    expectSessionFlags(cookieLine(renewed, "stadium_session"));
    const marker = cookieLine(renewed, "stadium_session_renewed");
    expect(marker?.toLowerCase()).toContain("secure");
    expect(marker?.toLowerCase()).not.toContain("domain=");

    // Even if a browser sent it to tenant B, B has no membership for it.
    const onB = await send("GET", "/owner/today", hostOf(b.tenantSlug), {
      cookie: `stadium_session=${token}`,
    });
    expect(onB.status).toBe(307);
    expect(onB.headers.location).toContain("/owner/login");
  });
});

describe("security headers on a real response", () => {
  it("has the next.config headers and no X-Powered-By", async () => {
    const page = await send("GET", "/owner/login", hostOf(a.tenantSlug));
    expect(page.headers["x-powered-by"]).toBeUndefined();
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["x-frame-options"]).toBe("DENY");
    expect(page.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(page.headers["content-security-policy-report-only"]).toContain("default-src 'self'");
    expect(page.headers["strict-transport-security"]).toBeUndefined();
  });

  it("404s a foreign host before any tenant lookup", async () => {
    const foreign = await send("GET", "/owner/login", `${a.tenantSlug}.attacker.example`);
    expect(foreign.status).toBe(404);
  });
});

describe("startup env validation", () => {
  it("next start in production exits when APP_BASE_DOMAIN is malformed", async () => {
    // A malformed value, not a missing one: next start loads a local .env,
    // which would fill a deleted variable back in.
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      APP_PROTOCOL: "http",
      APP_BASE_DOMAIN: "https://lebstads.test/",
    };
    const child = spawn("node_modules/.bin/next", ["start", "-p", String(PORT + 1), "-H", "127.0.0.1"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    const code = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(null);
      }, 30_000);
      child.on("exit", (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });
    expect(code).not.toBe(0);
    expect(code).not.toBeNull();
    expect(output).toContain("APP_BASE_DOMAIN");
  });
});

describe("suspended tenant on a real production server (decision 7)", () => {
  let token = "";

  beforeAll(async () => {
    token = /^stadium_session=([^;]+);/.exec(cookieLine(await loginResponse(), "stadium_session")!)![1]!;
    await platformDb.tenant.update({
      where: { id: a.tenantId },
      data: { suspendedAt: new Date(), suspendedReason: "e2e" },
    });
  });

  afterAll(async () => {
    await platformDb.tenant.update({
      where: { id: a.tenantId },
      data: { suspendedAt: null, suspendedReason: null },
    });
  });

  it("every public path shows the neutral page: 200, noindex, no-store, no tenant data", async () => {
    for (const path of ["/", "/?date=2026-10-20", "/?error=booking.slot_taken"]) {
      const page = await send("GET", path, hostOf(a.tenantSlug));
      expect(page.status).toBe(200);
      expect(page.body).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect(String(page.headers["cache-control"])).toContain("no-store");
      expect(page.body).toContain("غير متاح مؤقتاً");
      expect(page.body).not.toContain("Test Stadium");
      expect(page.body).not.toContain("Pitch T1");
      expect(page.body).not.toContain(a.pitchId);
    }
  });

  it("the manifest is the neutral one, as for an unknown host", async () => {
    const manifest = await send("GET", "/manifest.webmanifest", hostOf(a.tenantSlug));
    expect(JSON.parse(manifest.body).name).toBe("lebstads");
  });

  it("owner pages and login go to /owner/suspended, which renders; the poll answers 403", async () => {
    const today = await send("GET", "/owner/today", hostOf(a.tenantSlug), { cookie: `stadium_session=${token}` });
    expect(today.status).toBe(307);
    expect(today.headers.location).toContain("/owner/suspended");
    const loginPage = await send("GET", "/owner/login", hostOf(a.tenantSlug));
    expect(loginPage.status).toBe(307);
    expect(loginPage.headers.location).toContain("/owner/suspended");
    const suspended = await send("GET", "/owner/suspended", hostOf(a.tenantSlug), { cookie: `stadium_session=${token}` });
    expect(suspended.status).toBe(200);
    expect(suspended.body).not.toContain("Test Stadium");
    const live = await send("GET", "/owner/requests/live", hostOf(a.tenantSlug), { cookie: `stadium_session=${token}` });
    expect(live.status).toBe(403);
    expect(JSON.parse(live.body)).toEqual({ error: "tenant_suspended" });
  });

  it("another tenant is unaffected", async () => {
    const page = await send("GET", "/", hostOf(b.tenantSlug));
    expect(page.status).toBe(200);
    expect(page.body).toContain("Other Stadium");
    expect(page.body).not.toMatch(/content="noindex/);
  });
});


import { spawn, type ChildProcess } from "node:child_process";
import { request as httpRequest } from "node:http";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
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

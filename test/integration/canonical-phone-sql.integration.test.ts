import { afterAll, describe, expect, it } from "@jest/globals";
import pg from "pg";
import { toCanonicalPhone } from "@/modules/people/domain/phone";
import { finishIntegrationFile } from "./teardown";

/**
 * The stored-value rule in SQL (people_canonical_phone, kept permanently by the canonical_phones
 * migration) must give exactly what toCanonicalPhone gives in TypeScript, for the default country.
 * The inputs are the rows of the canonical table in test/modules/people/domain/phone.test.ts plus a
 * few stored shapes. NOT RUN when written: unverified until `npm run test:integration` has run.
 */
const INPUTS = [
  "0096171123456",
  "+961 71 123 456",
  "96171123456",
  "71123456",
  "71 123 456",
  "03123456",
  "3123456",
  "+961 03 123 456",
  "9611234",
  "+963933123456",
  "00963933123456",
  "0933123456",
  "61123456",
  "",
  "abc",
  "71123abc",
  "٧١١٢٣٤٥٦",
  "+1234567890123456", // 16 digits
  "9613123456",
  "96103123456",
  "961712345678", // 961 + 9 digits
  "+12025550123",
  "+123456789", // 9 digits
  "+0123456789", // first digit 0
  "0",
  "00",
  "961",
  "(03) 123-456",
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
const connected = client.connect();

afterAll(async () => {
  await connected;
  await client.end();
  await finishIntegrationFile();
});

describe("people_canonical_phone equals toCanonicalPhone", () => {
  for (const input of INPUTS) {
    it(`${JSON.stringify(input)}`, async () => {
      await connected;
      const result = await client.query<{ canon: string | null }>("SELECT people_canonical_phone($1) AS canon", [input]);
      expect(result.rows[0]!.canon).toBe(toCanonicalPhone(input));
    });
  }

  it("is NULL for NULL", async () => {
    await connected;
    const result = await client.query<{ canon: string | null }>("SELECT people_canonical_phone(NULL) AS canon");
    expect(result.rows[0]!.canon).toBeNull();
  });
});

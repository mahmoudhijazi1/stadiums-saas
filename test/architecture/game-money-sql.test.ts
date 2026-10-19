import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * DR-007: a game's money may be in USD or LBP. A raw SQL statement that reads, filters, compares or
 * sums a USD money column of a game must also name the column that says which currency the row is
 * in (or its LBP twin), so no query can silently read an LBP game as dollars, or as zero, or skip it.
 *
 * Source scan: every template literal under src (outside src/generated) that names one of the
 * columns below must also name one of the matching columns. The scan reads template literals, so it
 * covers $queryRaw, $executeRaw and Prisma.sql fragments alike; a fragment is checked on its own.
 */
const ROOT = process.cwd();

type Rule = {
  /** The USD column as it appears in SQL (quoted). */
  column: string;
  /** At least one of these must appear in the same statement. */
  needs: string[];
  /** Only statements that also mention this (the column name is shared with another table). */
  onlyWith?: string;
};

const RULES: Rule[] = [
  // Booking.priceUsd (Product.priceUsd has the same partner column).
  { column: '"priceUsd"', needs: ['"priceCurrency"'] },
  // Booking, BookingParticipant and Payment: the currency column or the LBP twin.
  { column: '"amountDueUsd"', needs: ['"priceCurrency"', '"amountDueLbp"', '"dueCurrency"'] },
  // BookingDueChange.
  { column: '"fromUsd"', needs: ['"currency"'] },
  { column: '"toUsd"', needs: ['"currency"'] },
  // PaymentAllocation (LedgerEntry also has "amountUsd" and is always USD).
  { column: '"amountUsd"', needs: ['"amountLbp"'], onlyWith: '"PaymentAllocation"' },
];

type Template = { text: string; line: number };

/**
 * The template literals of one TypeScript source, with the line each starts on. Skips comments and
 * quoted strings; inside `${…}` it follows braces and nested templates, so a fragment interpolated
 * into a statement does not end it early.
 */
function templatesOf(source: string): Template[] {
  const found: Template[] = [];
  const lineAt = (index: number) => source.slice(0, index).split("\n").length;

  function readTemplate(start: number): number {
    // `start` is the index of the opening backtick. Returns the index after the closing one.
    let i = start + 1;
    while (i < source.length) {
      const ch = source[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        found.push({ text: source.slice(start + 1, i), line: lineAt(start) });
        return i + 1;
      }
      if (ch === "$" && source[i + 1] === "{") {
        i = readExpression(i + 2);
        continue;
      }
      i += 1;
    }
    return i;
  }

  function readExpression(start: number): number {
    // Inside `${`: returns the index after the matching `}`.
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "`") {
        i = readTemplate(i);
        continue;
      }
      if (ch === "'" || ch === '"') {
        i = skipQuoted(i);
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
      i += 1;
    }
    return i;
  }

  function skipQuoted(start: number): number {
    const quote = source[start];
    let i = start + 1;
    while (i < source.length && source[i] !== quote && source[i] !== "\n") {
      i += source[i] === "\\" ? 2 : 1;
    }
    return i + 1;
  }

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i = skipQuoted(i);
      continue;
    }
    if (ch === "`") {
      i = readTemplate(i);
      continue;
    }
    i += 1;
  }
  return found;
}

/** One "file:line: …" line per statement that names a USD game-money column without its partner. */
function violationsIn(file: string, source: string): string[] {
  const out: string[] = [];
  for (const template of templatesOf(source)) {
    for (const rule of RULES) {
      if (!template.text.includes(rule.column)) continue;
      if (rule.onlyWith && !template.text.includes(rule.onlyWith)) continue;
      if (rule.needs.some((partner) => template.text.includes(partner))) continue;
      out.push(`${file}:${template.line}: ${rule.column} without ${rule.needs.join(" or ")}`);
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (path === join(ROOT, "src", "generated")) continue;
      out.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe("game money in raw SQL names its currency (DR-007)", () => {
  it("every SQL statement under src that reads a USD game-money column also names its currency column", () => {
    const violations = sourceFiles(join(ROOT, "src")).flatMap((path) =>
      violationsIn(relative(ROOT, path).replace(/\\/g, "/"), readFileSync(path, "utf8")),
    );
    expect(violations).toEqual([]);
  });

  it("fails with file:line on a query that forgets the currency", () => {
    const forgot = [
      "const a = 1;",
      "async function owed(tx) {",
      "  return tx.$queryRaw`",
      '    SELECT b."amountDueUsd" FROM "Booking" b',
      '    WHERE b."amountDueUsd" > 0',
      "  `;",
      "}",
    ].join("\n");
    expect(violationsIn("fake.ts", forgot)).toEqual([
      'fake.ts:3: "amountDueUsd" without "priceCurrency" or "amountDueLbp" or "dueCurrency"',
    ]);
  });

  it("checks due changes, allocations and interpolated fragments, and ignores comments and other tables", () => {
    const source = [
      "// a comment naming \"toUsd\" is not SQL",
      "const fragment = Prisma.sql`b.\"priceUsd\"`;",
      "const ok = tx.$queryRaw`SELECT d.\"toUsd\", d.\"currency\" FROM \"BookingDueChange\" d WHERE x = ${id}`;",
      "const alloc = tx.$queryRaw`SELECT SUM(a.\"amountUsd\") FROM \"PaymentAllocation\" a`;",
      "const ledger = tx.$queryRaw`SELECT SUM(l.\"amountUsd\") FROM \"LedgerEntry\" l`;",
      "const nested = tx.$queryRaw`SELECT ${Prisma.sql`d.\"fromUsd\"`} FROM \"BookingDueChange\" d`;",
    ].join("\n");
    expect(violationsIn("fake.ts", source)).toEqual([
      'fake.ts:2: "priceUsd" without "priceCurrency"',
      'fake.ts:4: "amountUsd" without "amountLbp"',
      // The fragment on its own, then the statement it is interpolated into.
      'fake.ts:6: "fromUsd" without "currency"',
      'fake.ts:6: "fromUsd" without "currency"',
    ]);
  });
});

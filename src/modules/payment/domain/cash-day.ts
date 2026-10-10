import Decimal from "decimal.js";

/**
 * "Cash today": the notes and coins for ONE business day, per currency. A deliberate exception to
 * the rule that money is shown in USD (docs/domain/money.md "Cash today"): it is a count of what
 * physically changed hands, never a value, never converted at any rate, never combined across
 * currencies and never used in a report or a total.
 */
export type CashRow = { direction: "IN" | "OUT"; currency: "USD" | "LBP"; amount: Decimal };

export type CashDay = {
  /** IN minus OUT, per currency. Negative when more left the drawer than came in. */
  net: { USD: Decimal; LBP: Decimal };
  in: { USD: Decimal; LBP: Decimal };
  out: { USD: Decimal; LBP: Decimal };
  /** Any tender at all in the window (an empty day shows a plain zero line). */
  any: boolean;
};

export function buildCashDay(rows: readonly CashRow[]): CashDay {
  const zero = () => ({ USD: new Decimal(0), LBP: new Decimal(0) });
  const inbound = zero();
  const outbound = zero();
  for (const row of rows) {
    const bucket = row.direction === "IN" ? inbound : outbound;
    bucket[row.currency] = bucket[row.currency].plus(row.amount);
  }
  return {
    net: { USD: inbound.USD.minus(outbound.USD), LBP: inbound.LBP.minus(outbound.LBP) },
    in: inbound,
    out: outbound,
    any: rows.length > 0,
  };
}

/** The currencies that have a non-zero net, USD first. Both zero: just USD, so the line is "$0". */
export function cashLineCurrencies(day: CashDay): ("USD" | "LBP")[] {
  const shown = (["USD", "LBP"] as const).filter((currency) => !day.net[currency].isZero());
  return shown.length > 0 ? shown : ["USD"];
}

/**
 * The LBP money unit (DR-007 decision 7), written here and nowhere else in src: a game is priced,
 * split, rounded and forgiven in whole units of this many pounds.
 *
 * Code never uses the number: it asks `moneyUnit("LBP")` (payment/domain/units.ts, whose
 * `FORGIVE_BELOW_LBP` is the "Consider it paid" threshold). On-screen text states the unit with the
 * `{unit}` placeholder, which `ui()` and `errorMessage()` fill from this value with the money
 * formatter (lib/copy/unit-text.ts). `test/architecture/lbp-unit.test.ts` fails, with file:line, on a
 * literal 5000 or 5_000 anywhere else in src.
 *
 * To change the unit: change this one number (see DR-007, "The unit lives in one place").
 */
export const LBP_UNIT_VALUE = 5000;

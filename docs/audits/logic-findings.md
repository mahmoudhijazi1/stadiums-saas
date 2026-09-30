# Logic findings: recorded, not fixed

**Status:** open findings from the booking and payments production audit and its follow-ups (PRs #3–#5). Each entry says what is wrong, why it was not fixed yet, and what a fix needs. Nothing here has been changed in code. When one is fixed, mark it **Fixed** with the commit here and in [ROADMAP.md](../ROADMAP.md). Do not delete the entry.

Recorded 2026-09-30, against `main` at `7ba058d`.

---

## F-1 Money paid before a split credits nobody (audit punch list #6)

**What happens today.** A booking is paid partly in whole-game mode (for example $10 by the booker), then split per player. That $10 becomes **Unassigned**: it counts as collected on the booking, but no slot and no person gets it.
- The booker's person page shows **Total paid $0** for that game. `personPaidOnBooking` in PER_PLAYER mode sums allocations only.
- The booker's **Owes now** is their full slot 1 remaining (e.g. $3). `personOwedOnBooking` uses the participant remaining.
- The request-card debt warning reads the same rule, so it shows the booker owing $3.
- The booking itself is correct: remaining = due − all collected, and the charge cap (`planSlotCharge`) never takes the Unassigned money twice.

Pinned by `test/integration/collect-notify-debt.integration.test.ts` ("per-player with Unassigned"): due $30, $10 before the split, two slots paid. The booking remains $14; the requester owes $3 and has paid $0.

**Proposed rule (not implemented):** Unassigned is credited to the booker.
- The booker's **Total paid** includes the booking's Unassigned amount.
- The booker's **Owes now** = max(own slot remaining − Unassigned, 0).
- Any excess (Unassigned above the booker's own slot remaining) stays shown on the booking as **Unassigned** until SPEC-15 slice 5 lets the owner reassign it to other slots.

**What a fix touches:** `personPaidOnBooking` / `personOwedOnBooking` (`booking/domain/person-owed.ts`, the single owes rule), and the three readers that go through it: person stats, the person games list, debt warnings. The queries already return `collectedUsd` and `allocatedUsd` per participation, so no schema change should be needed. It needs a short decision note, since it amends SPEC-15 §2.3 ("person owed on a booking"). Update the pinned test to the new rule.

---

## F-2 Ledger hardening deferred (audit punch list #9)

**What is missing.**
- `LedgerEntry` has no `paymentId`. It links to its source only by `sourceType` + `sourceId`, so "exactly one ledger entry per payment" can be checked only by count and sum per source, never row for row.
- Append-only is a convention. No DB trigger, role grant or rule blocks UPDATE/DELETE on `LedgerEntry`, `Payment`, `PaymentTender` or `BookingDueChange`. The dev seed deletes ledger rows.

**Why deferred:** it needs a migration (a new column and a backfill for existing rows, nullable or required by source type) and a design decision on how append-only is enforced: a trigger versus a separate DB role for the app. That decision belongs in DR-002 (§2.21) before any code. No code path writes to these tables outside the use cases today, and the per-booking reconciliation (ledger = tenders) holds in every integrity run so far.

---

## F-3 Old no-show fee rows labelled `CANCELLATION_NO_FEE`

**What happens.** Before commit `48a3ce8` (PR #5), a no-show fee that was clamped to what was collected (a waive, or an edit down to at most the collected amount) was logged with reason `CANCELLATION_NO_FEE`. New rows use `WAIVER` or `NO_SHOW_FEE`. Rows written before that commit still carry the wrong reason. The debt-warning line and the future booking timeline would call those no-shows "cancellation".

**Finding them:** they are exactly the `CANCELLATION_NO_FEE` rows on a booking whose status is `NO_SHOW`. A NO_SHOW booking cannot be cancelled, and Adjust never writes that reason. The query is in `docs/progress.md`, entry "Cancel and no-show fees: capped at the due, no-show logged as a no-show":

```sql
SELECT d.id, d."fromUsd", d."toUsd"
FROM "BookingDueChange" d
JOIN "Booking" b ON b.id = d."bookingId"
WHERE b.status = 'NO_SHOW' AND d.reason = 'CANCELLATION_NO_FEE';
```

**Why not fixed:** choosing between `WAIVER` and `NO_SHOW_FEE` needs the fee suggested at that time (tenant policy then, and the due then), which is not stored. A `toUsd` of 0 is almost certainly a waiver; the rest needs a rule or a manual review. Any fix is a one-off data migration with a written rule, and `BookingDueChange` is append-only, so it would need an explicit exception recorded in progress.md.

---

## F-4 Lint errors left in the owner Today UI

`npx eslint` reports, on `main` (none introduced by PRs #3–#5):

| File | Line | Rule | What |
|---|---|---|---|
| `src/app/owner/(app)/today/fee-forms.tsx` | 55 | react-hooks: setState in effect | `useEffect(() => { setFeeExact(exact); }, [exact])` in `CancelDecisionForm`, which resets the edited fee when the initiator changes the suggestion. |
| `src/app/owner/(app)/today/fee-forms.tsx` | 59 | react-hooks: setState in effect | `useEffect(() => { setPublicUrl(\`${window.location.origin}/\`); }, [])` reads the origin for the WhatsApp link. |
| `src/app/owner/(app)/today/upcoming-panel.tsx` | 353 | react-hooks: setState in effect | The effect that opens the saved booking's sheet after a redirect (`setSheetStep("details")`, `setInterestOpen`, `setHeldRow`). |
| `src/modules/booking/application/list-debt-warnings.ts` | 1 | no-unused-vars (warning) | `import Decimal from "decimal.js"` is unused. |

**Why it matters:** the three errors can cause an extra render pass (a cascading re-render); none is known to cause a wrong value on screen. They are errors in `npm run lint`, so the lint step would fail if it ran in CI. The unused import is cosmetic.

**What a fix needs:**
- For the fee reset, derive the value from the initiator or key the form on it instead of syncing state in an effect.
- For the origin, read it where the link is built, or pass it from the server (`publicPageUrl`).
- For the sheet opener, move it into the event or router callback that sets `saved`.
- Delete the unused import.

This is UI-only; no domain change.

---

## Security findings (added 2026-09-30)

The full-application security audit is in [security-audit.md](./security-audit.md). Its open items are tracked there, not duplicated here; [ROADMAP.md](../ROADMAP.md) lists them from item 5 on. F-1 to F-4 above were re-checked against the code during that audit and still hold as written: the F-4 lint lines are unchanged on `audit/security`.

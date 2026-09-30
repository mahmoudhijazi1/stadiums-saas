# Roadmap: open items

**Living.** Short, ordered list of known open work that is not a product slice. Details and proposed fixes are in [audits/logic-findings.md](./audits/logic-findings.md); product slices are in [NOW.md](./NOW.md). When an item is fixed, mark it done here with the commit, and in the findings file.

| # | Item | Status | Details |
|---|---|---|---|
| 1 | Money paid before a per-player split credits nobody. Proposed rule: Unassigned is credited to the booker (Total paid includes it; Owes now = max(own slot remaining − Unassigned, 0); any excess stays Unassigned on the booking until SPEC-15 slice 5 reassigns it). | Open, needs a short decision (amends SPEC-15 §2.3) | [F-1](./audits/logic-findings.md#f-1-money-paid-before-a-split-credits-nobody-audit-punch-list-6), audit #6 |
| 2 | Ledger hardening: `paymentId` on `LedgerEntry`, DB-level append-only for ledger, payments, tenders and due changes | Deferred: needs a migration and a design decision (DR-002 §2.21) | [F-2](./audits/logic-findings.md#f-2-ledger-hardening-deferred-audit-punch-list-9), audit #9 |
| 3 | Old no-show fee rows labelled `CANCELLATION_NO_FEE` (before `48a3ce8`) | Recorded, not fixed: relabeling needs the suggestion at that time; SQL in progress.md | [F-3](./audits/logic-findings.md#f-3-old-no-show-fee-rows-labelled-cancellation_no_fee) |
| 4 | Three setState-in-effect lint errors (`fee-forms.tsx` ×2, `upcoming-panel.tsx`) and an unused import in `list-debt-warnings.ts` | Open, UI-only | [F-4](./audits/logic-findings.md#f-4-lint-errors-left-in-the-owner-today-ui) |

Other open audit items (isolation tests for `PaymentAllocation`, the WHOLE requester due drift, "They played" permission, staff money visibility) are tracked in the addendum of [audits/booking-payments-production-audit.md](./audits/booking-payments-production-audit.md).

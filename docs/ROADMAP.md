# Roadmap: open items

**Living.** Short, ordered list of known open work that is not a product slice. Details and proposed fixes are in [audits/logic-findings.md](./audits/logic-findings.md); product slices are in [NOW.md](./NOW.md). When an item is fixed, mark it done here with the commit, and in the findings file.

| # | Item | Status | Details |
|---|---|---|---|
| 1 | Money paid before a per-player split credits nobody. Proposed rule: Unassigned is credited to the booker (Total paid includes it; Owes now = max(own slot remaining − Unassigned, 0); any excess stays Unassigned on the booking until SPEC-15 slice 5 reassigns it). | Open, needs a short decision (amends SPEC-15 §2.3) | [F-1](./audits/logic-findings.md#f-1-money-paid-before-a-split-credits-nobody-audit-punch-list-6), audit #6 |
| 2 | Ledger hardening: `paymentId` on `LedgerEntry`, DB-level append-only for ledger, payments, tenders and due changes | Deferred: needs a migration and a design decision (DR-002 §2.21) | [F-2](./audits/logic-findings.md#f-2-ledger-hardening-deferred-audit-punch-list-9), audit #9 |
| 3 | Old no-show fee rows labelled `CANCELLATION_NO_FEE` (before `48a3ce8`) | Recorded, not fixed: relabeling needs the suggestion at that time; SQL in progress.md | [F-3](./audits/logic-findings.md#f-3-old-no-show-fee-rows-labelled-cancellation_no_fee) |
| 4 | Three setState-in-effect lint errors (`fee-forms.tsx` ×2, `upcoming-panel.tsx`) and an unused import in `list-debt-warnings.ts` | Open, UI-only | [F-4](./audits/logic-findings.md#f-4-lint-errors-left-in-the-owner-today-ui) |
| 5 | Seed wipes any database, including production, and recreates known passwords | Fixed on `audit/security` (progress.md "Seed refuses production and unknown databases") | [S-1](./audits/security-audit.md#s-1-the-seed-wipes-any-database-it-is-pointed-at-including-production) |
| 6 | Session ids are cuid v1 (`Math.random`, about 41 random bits): switch to 256-bit random tokens, ideally stored hashed | Fixed `08da596` (PR #9) | [S-2](./audits/security-audit.md#s-2-session-ids-are-cuid-v1-not-cryptographically-random) |
| 7 | Rate limits: login brute force, public request flooding, bounded pending/range queries | Fixed `dcffb84` (login), `cb9049a` (public), `bed1538` (queries) | [S-3](./audits/security-audit.md#s-3-no-brute-force-protection-on-login), [S-5](./audits/security-audit.md#s-5-public-requests-can-be-flooded-and-names-are-unbounded), [S-8](./audits/security-audit.md#s-8-unbounded-queries-on-hot-paths) |
| 8 | Login timing reveals which identifiers exist (dummy scrypt on unknown user) | Fixed `06ae591` (PR #9) | [S-4](./audits/security-audit.md#s-4-login-reveals-which-identifiers-exist-by-timing) |
| 9 | Public request under someone else's phone; name length and control characters | Fixed `3707fd6` (typed name on the card), `2efbfbd` (names) | [S-6](./audits/security-audit.md#s-6-anyone-can-file-a-public-request-under-someone-elses-phone), [S-14](./audits/security-audit.md#s-14-names-accept-bidi-overrides-and-control-characters) |
| 10 | Security headers (HSTS, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy) and a nonce CSP | Fixed `0c69947` except an enforced CSP (nonces deferred); HSTS in nginx | [S-7](./audits/security-audit.md#s-7-no-security-headers) |
| 11 | Postgres RLS behind the Prisma extension (DR-001 trigger effectively met) | Deferred by decision; needs a DR-001 amendment, about 2–3 days | [§10](./audits/security-audit.md#10-rls) |
| 12 | Low findings: host allowlist, header trust, `X-Powered-By`, scrypt cost, session and log cleanup, env validation, guard gaps | Partly fixed: S-9–S-11 `c13403e`, S-13 `0c69947`, S-14 `2efbfbd`, S-16 `6879627`, S-18 `ed99634`; the rest deferred (see the audit's status addendum) | [S-9 … S-21](./audits/security-audit.md#findings) |

## Deferred on purpose: tenant management

Recorded 2026-10-01 with the tenant-management CLI. These are deliberate decisions, not gaps.

| Item | Why deferred |
|---|---|
| Web platform admin | It needs its own identity and cookie (separate from owner sessions), 2FA, rate limits, audit and its own security review. Its backend already exists: the `src/modules/platform` use cases take an explicit actor (`admin:<id>` later) and never touch a terminal. |
| Date-based suspension (auto-suspend when `paidUntil` passes) | Suspension stays manual (decision 2). `paidUntil` is informational: `tenants list` flags OVERDUE. No cron. |
| Plan limits and pricing | A plan is a text label only (decision 5). BR-103 is PARTIAL by decision: no limits, no pricing, no enforcement. |
| Forced password change at first login | The owner's first password is set by the operator at `tenants create`. A "change on first login" flow needs UI and a user flag. |
| A real HTTP 503 for a suspended tenant's public pages | Next 16 pages cannot set 503 (local `loading.md`, "Status codes": only 200, or 404/401/403 through `notFound`/`unauthorized`/`forbidden`). Doing it in the proxy would add a database query per request. Every public path shows the neutral page with status 200, robots noindex and `Cache-Control: no-store`, and no tenant data. |

Other open audit items (isolation tests for `PaymentAllocation`, the WHOLE requester due drift, "They played" permission, staff money visibility) are tracked in the addendum of [audits/booking-payments-production-audit.md](./audits/booking-payments-production-audit.md).

# Progress log

Entries are appended at the end, newest last, and kept short (a heading, **When**, **What**, **Why**, **Files**, **How it connects**, **How to verify**). Never edit an old entry; add a **Correction** entry instead. When this file passes about 300 lines, move it to `docs/archive/progress-<year>[-n].md` with `git mv` and start a new one. The earlier log (to `v1.0.0` and the refactor steps 1 to 6c) is [archive/progress-2026.md](./archive/progress-2026.md); read it with `tail`, never in full.

## Docs reset 4: agent instructions and the log

**When:** 2026-10-14

**What:** Rewrote `CLAUDE.md` (read first, non-negotiables, placement rules, clean-code checklist, workflow, `test/architecture/rules.ts` as the source of truth). `AGENTS.md` now starts with "Read CLAUDE.md first". The old `docs/progress.md` (7,000+ lines) moved with `git mv` to `docs/archive/progress-2026.md`; this file starts again.

**Why:** One short instruction file for every coding agent, and a log small enough to read.

**Files:** `CLAUDE.md`, `AGENTS.md`, `docs/progress.md`, `docs/archive/progress-2026.md`.

**How it connects:** Docs only.

**How to verify:** `npx tsc --noEmit`; `npx jest test/architecture`.

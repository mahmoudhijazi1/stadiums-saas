# Stadium SaaS

Multi-tenant stadium booking platform (Next.js 16, Prisma 7, Postgres).

## Docs

All planning and agent workflow docs live under [`docs/`](./docs/README.md):

| Path | What |
|------|------|
| [`docs/decisions/`](./docs/decisions/) | Architecture decisions (DR-NNN) |
| [`docs/specs/`](./docs/specs/) | Build slices (SPEC-NN) |
| [`docs/guides/`](./docs/guides/) | Cursor workflow, folder structure, rules, Jest testing |
| [`docs/progress.md`](./docs/progress.md) | Learning/defense log (append after each step) |
| [`docs/requirements/brd.md`](./docs/requirements/brd.md) | Product source of truth (BRD, draft v0.1) |

**Work order:** decision → spec → code. SPEC-01 and SPEC-02 are implemented. Next: [SPEC-03](./docs/specs/SPEC-03-booking-public-request.md) (public request, not implemented).

Agent rules: [`.cursor/rules/`](./.cursor/rules/). Framework warning: [`AGENTS.md`](./AGENTS.md).

## Scripts

```bash
npm run dev      # local Next.js
npm run build
npm run lint
```

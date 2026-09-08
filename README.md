# Stadium SaaS

Multi-tenant stadium booking platform (Next.js 16, Prisma 7, Postgres).

## Docs

All planning and agent workflow docs live under [`docs/`](./docs/README.md):

| Path | What |
|------|------|
| [`docs/decisions/`](./docs/decisions/) | Architecture decisions (DR-NNN) |
| [`docs/specs/`](./docs/specs/) | Build slices (SPEC-NN) |
| [`docs/guides/`](./docs/guides/) | Cursor workflow, folder structure, rules, Jest testing |
| [`docs/requirements/`](./docs/requirements/) | BRD / product requirements |

**Work order:** decision → spec → code. Start with [SPEC-01](./docs/specs/SPEC-01-tenancy-foundation.md).

Agent rules: [`.cursor/rules/`](./.cursor/rules/). Framework warning: [`AGENTS.md`](./AGENTS.md).

## Scripts

```bash
npm run dev      # local Next.js
npm run build
npm run lint
```

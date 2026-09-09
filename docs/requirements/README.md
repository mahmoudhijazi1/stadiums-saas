# Requirements

Product requirements live here — separate from architecture decisions and build specs.

| File | Purpose |
|------|---------|
| [brd.md](./brd.md) | Business requirements document — source of truth for *what the product must do* (draft v0.1) |

**How this relates to the rest of `docs/`:**

- **requirements/** — product intent (goals, rules, phases)
- **decisions/** — settled technical *why* (DR-NNN)
- **specs/** — buildable *what* for one slice (SPEC-NN)

When a requirement changes, update the BRD first, then open or amend a DR if architecture is
affected, then write or update a SPEC before coding.

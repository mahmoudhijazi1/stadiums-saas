# Cursor rules — how these are set up

The current Cursor format is `.mdc` files in `.cursor/rules/`, not a plain markdown file at the
project root. That older format still works but is deprecated, and — the part that matters —
it loads the whole file on **every** request. `.mdc` files load only when relevant, which saves
tokens.

## Where they live

```
.cursor/rules/
  000-core-architecture.mdc   ← alwaysApply: true  (loaded every request)
  100-rtl-i18n.mdc            ← auto-attaches to .tsx / ui files only
  200-database-prisma.mdc     ← auto-attaches to schema / migrations / infrastructure only
```

This guide (`docs/guides/cursor-rules.md`) does **not** go in `.cursor/rules/` — it's
documentation about the rules, not a rule itself.

## How the split saves tokens

Each `.mdc` file has frontmatter: `description`, `globs` (file patterns it attaches to), and
`alwaysApply`.

- **000-core** is `alwaysApply: true` — the architecture and integrity rules that must hold
  everywhere. Small on purpose, because it rides along with every request.
- **100-rtl** only attaches when you're editing `.tsx`/UI files. No point paying for RTL rules
  while writing a database migration.
- **200-database** only attaches when you're in the schema, a migration, or an `infrastructure/`
  repository. No point paying for exclusion-constraint rules while writing a React component.

So a given request only carries the rules that matter for the file you're touching, plus the
small always-on core. That's the token win over one monolithic file.

## A note on Cursor 2.2+

Very recent Cursor versions create new rules as *folders* (`.cursor/rules/<name>/RULE.md`)
rather than flat `.mdc` files. The flat `.mdc` format here is widely supported and works across
versions. If your Cursor prefers the folder shape, you can ask Cursor itself to convert these —
the content stays identical, only the packaging changes.

## Keep the numbering

The `000/100/200` prefixes keep them ordered and make it obvious which is the always-on core
(000) vs. the scoped ones. Add new scoped rules as `300-…`, `400-…` as the project grows.

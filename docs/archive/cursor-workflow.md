# Working with Cursor — efficiency, rules, and token cost

You're new to React and Next.js. This guide is about the *workflow*, not the framework. It's
what keeps Cursor sticking to your decisions and not burning tokens wandering.

---

## 1. The three-file setup (do this once)

1. Keep the three `.mdc` files in `.cursor/rules/` (already installed).
   Cursor loads them based on what you're editing — the always-on core rides every request; the
   RTL and database rules attach only to the files they apply to. This is your leash, and the
   scoping keeps it cheap. (See [cursor-rules.md](./cursor-rules.md).)
2. Keep decisions in `docs/decisions/` (DR-001, DR-002, …).
   These are the *why*. You point Cursor at them when it needs deep context, not every time.
3. Keep the BRD in `docs/requirements/` when you add it. It's the source of truth for product
   requirements.

**Why a rules file instead of repeating yourself:** every time you paste architecture into
chat, you pay for those tokens again. The rules file is sent efficiently and consistently.
Write the leash once.

---

## 2. The golden workflow: spec → build → verify, one slice at a time

Never say "build the booking system." That's how an agent burns 50k tokens and gives you
something you have to unpick.

Instead, per slice:

1. **You** hand it a build spec (one already written, e.g. `docs/specs/SPEC-01`).
2. **It** implements just that slice.
3. **You** verify against the spec's checklist before moving on.
4. Append what happened to [docs/progress.md](../progress.md) (what / why / files / how it connects).
5. Only then, the next slice.

Small scope = fewer tokens, fewer wrong turns, and you actually understand each piece — which
matters because you're learning Next.js as you go.

---

## 3. Token cost — the practical levers

Token cost is mostly about **how much context the model chews per request.**

- **Scope tightly.** "Implement the tenant middleware per SPEC-01 step 2" beats "set up
  multi-tenancy." The narrower the ask, the less it reads and rewrites.
- **Point, don't paste.** Say "follow `.cursor/rules`" and "see `docs/decisions/DR-001` §2"
  instead of pasting the content. Referencing is cheaper than repeating.
- **Start fresh chats per slice.** A long chat carries its whole history into every new
  message — cost grows with conversation length. New slice → new chat → clean, cheap context.
- **Attach only the files that matter.** Cursor lets you @-mention specific files. Attach the
  two or three the task touches, not the whole repo.
- **Let it read local files itself.** Instead of pasting a big doc, tell it "read
  `node_modules/next/dist/docs/…`". It fetches only what it needs.
- **Stop it early when it's wrong.** If the first output drifts, interrupt and correct — don't
  let it generate 300 lines you'll discard and pay for.

---

## 4. Keeping it on the rules (not drifting)

- The `.cursor/rules` files do most of this automatically.
- When it matters, name the rule: "remember: payment has no booking_id (DR-002 §2.14)."
- If it invents a decision you didn't make, stop it: "that's not decided — check DR-002, and
  if it's not there, ask me." Your rules file already tells it to do this, but reinforce early
  so it learns the pattern for your project.
- After it writes code, spot-check against the spec's **Definition of Done**. Don't accept on
  vibes — you're building your defense knowledge too.

---

## 5. The framework-version trap (specific to THIS repo)

Your `AGENTS.md` says the Next.js version has breaking changes vs. what any model was trained
on. This is real and it will bite if ignored.

- Any Next.js/Prisma API code the agent writes from memory may be **stale**.
- The rule (already in `.cursor/rules`): verify against `node_modules/next/dist/docs/` before
  writing framework APIs.
- Practically: when Cursor gives you a Next.js API call, ask "did you verify this against the
  local docs?" If it didn't, make it. This is the difference between code that runs and an
  afternoon lost to deprecation errors.
- This is also why the build specs are written as **instructions, not code**. The *what* and
  *why* are version-proof. The *exact API* must come from your installed version's docs, not
  from a plan written months ago.

---

## 6. What you provide vs. what Cursor provides

- **You provide:** decisions (the DRs), specs (the boring instructions), and verification (does
  it match the spec?). This is the thinking. You do it deliberately, and you can defend it.
- **Cursor provides:** the typing — turning a precise spec into version-correct code, checking
  the local docs for the exact API.

The decision always comes before the spec; the spec always comes before the code.

---

## Quick reference: a good Cursor prompt for this project

> Implement SPEC-01, step 2 only (tenant middleware). Follow `.cursor/rules`. This Next.js
> version differs from your training — verify the middleware API against
> `node_modules/next/dist/docs/` before writing. Show me what the docs say, then the code.
> Scope: just the middleware and the header it sets. Don't touch anything else.

Narrow, points at rules, forces doc-verification, defines scope. That's the pattern.

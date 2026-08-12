# caduceus v0.1.1 — Proposal

> **Status:** Proposal complete. Awaiting `design` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.1.1`
> **Source contract:** [`proposal-v0.1.0`](./caduceus-v0.1.0/proposal.md) + [`analysis-2026-08`](./caduceus-v0.1.0/exploration.md)
> **Upstream:** v0.1.0 is live on npm + GitHub (0 downloads as of 2026-08-12)

## 1. Intent

Ship **caduceus v0.1.1** — a focused minor release that closes the
two largest competitive gaps with `@isr4el-silv4/persona` and
`pi-custom-system-prompt`, plus a unique differentiator (`/caduceus:lint`).
**Backward-compatible** with v0.1.0: existing users see no behavior
change unless they opt in to the new features.

The P0 features (per the post-v0.1.0 strategic analysis):

1. **Replace / Append mode** — parity with the other persona
   packages, configurable per session.
2. **Persona filesystem discovery** — users can drop a `.md` file
   into `~/.pi/agent/caduceus/personas/` or `.caduceus/personas/`
   and switch to it with a slash command, without forking caduceus.
3. **`/caduceus:lint`** — unique differentiator. Static checks
   that the active persona file is internally consistent (no
   cross-mode voseo leak, language clause matches locale,
   byte-stable identity contract block).
4. **2 new built-in personas** (`concise`, `reviewer`) — to
   exercise the discovery path and broaden the default offering.

## 2. Why now

| Pressure | Source | v0.1.1 impact |
|---|---|---|
| `@isr4el-silv4/persona` v1.0.9 | Direct competitor with persona management, tool restrictions, replace/append | Replace/Append + filesystem discovery closes the main feature gap |
| `pi-custom-system-prompt` v0.1.1 (140 downloads/mo) | Direct competitor with system-prompt loading from `*.md` files | Filesystem discovery is direct parity |
| 0 downloads for caduceus v0.1.0 | Distribution problem (analysis §"营销") | `lint` is a marketing story ("persona as a contract, verifiable") |
| 2 personas too few | User requests will come; better to ship more now | `concise` + `reviewer` are obvious additions |

## 3. Scope (locked)

### 3.1 In scope for v0.1.1

- **`systemPromptMode` config field** — `"append" | "replace"`,
  default `"append"` (preserves v0.1.0 behavior). When `append`,
  caduceus adds the persona segment to `event.systemPrompt` (current
  behavior). When `replace`, caduceus replaces the entire system
  prompt with just the persona segment (parity with
  `pi-custom-system-prompt` "replace" mode).
- **`persona` config field** — string, default `"gentleman"`. Built-in
  personas are reserved names. Custom personas are file paths
  resolved from `~/.pi/agent/caduceus/personas/<name>.md` (global)
  or `.caduceus/personas/<name>.md` (project).
- **Persona filesystem discovery** — read user personas at session
  start, cache in memory. Precedence: built-in < global < project
  (per-file, fields merge).
- **Three new slash commands:**
  - `/caduceus:prompt <replace|append>` — change prompt mode at runtime
  - `/caduceus:persona <name|list>` — switch persona; `list` shows
    available (built-in + global + project)
  - `/caduceus:lint` — static checks on the active persona
- **Two new built-in personas** (`prompts/concise.md`,
  `prompts/reviewer.md`) — byte-stably derived from gentle-pi
  style, not direct copies of any gentle-pi persona (caduceus
  v0.1.0 only ships the 2 that are verbatim from gentle-pi).
- **Test coverage** for all of the above (strict TDD, RED first).

### 3.2 Explicitly out of scope (deferred to v0.2.0+)

- ❌ Tool restrictions per persona (`isr4el-persona` has this; we
  don't — DNA-1 shell/meat separation)
- ❌ Persona creation wizard (`/persona create` in isr4el)
- ❌ Per-model persona variants (`.claude.md` / `.gpt.md`)
- ❌ LLM-generated persona (`/caduceus:generate`)
- ❌ Community persona gallery (`npx caduceus add`)
- ❌ Persona effectiveness measurement
- ❌ Replace/append UI for the inspect command (still text-only)
- ❌ Dark/light dual themes

### 3.3 Backward compatibility

- Default `systemPromptMode` is `"append"` — same as v0.1.0 behavior.
- Default `persona` is `"gentleman"` — same as v0.1.0 behavior.
- New config fields are optional. Old `caduceus.json` files
  (without these fields) continue to work via built-in defaults.
- Built-in personas `gentleman` and `neutral` are unchanged
  (byte-for-byte identical to v0.1.0).
- All 68 existing tests pass unchanged.

## 4. Success criteria (all must be true at archive)

1. `npm test` exits 0; full suite ≥ 80 tests (was 68), 0 failures.
2. `node scripts/verify-package.mjs` exits 0; 13/13 pre-publish
   checks pass.
3. `/caduceus:persona list` shows 4 built-in personas:
   `concise`, `gentleman`, `neutral`, `reviewer`.
4. A custom persona file at
   `~/.pi/agent/caduceus/personas/pirate.md` is discovered and
   `/caduceus:persona pirate` switches to it.
5. `/caduceus:prompt replace` makes `event.systemPrompt` equal
   just the persona segment (no `event.systemPrompt` prefix).
6. `/caduceus:lint` returns 0 exit when the active persona is
   `gentleman` or `neutral` (built-ins, known-good).
7. `/caduceus:lint` returns non-zero with a clear error message
   when a custom persona has a voseo/do-not-voseo inconsistency
   (verified by a test that creates a bad persona and lints it).
8. The two new personas (`concise`, `reviewer`) pass lint
   themselves.
9. v0.1.1 is published to npm and listed on pi.dev gallery.

## 5. Open questions for the user (none blocking)

- Q1: Should `concise` and `reviewer` be byte-stable derivatives
  of a gentle-pi persona (gentleman / neutral base) or fully
  novel caduceus-original personas? — **My recommendation:**
  fully novel (caduceus is its own product, not a derivative of
  gentle-pi). Built-in `gentleman` and `neutral` stay verbatim
  because they are tested against gentle-pi lines 259-266 / 268-276.
  New personas are caduceus-original; lint is the only contract.
- Q2: Should `/caduceus:lint` be a slash command, a CLI
  (`npx caduceus lint`), or both? — **My recommendation:** both,
  with the slash command calling the same `lib/lint.ts` core.
  Lets CI pipelines lint personas without a TUI.

## 6. Marketing plan (non-SDD, separate workstream)

- Forum post on `https://github.com/earendil-works/pi/discussions`
  in the "Show and tell" category. Title: "caduceus: persona as a
  contract for pi". Body: 200-300 words, link to npm + GitHub.
- Blog post: "Persona is a contract, not a costume" (2000 words).
  Topics: why static personas fail, what "contract" means,
  how lint enforces the contract, before/after examples.
- (Optional) Submit to `https://github.com/topics/pi-extension`.

## 7. Rollback

Caduceus is purely additive. Rolling back v0.1.1 → v0.1.0:
1. `pi remove npm:pi-caduceus`
2. `pi install npm:pi-caduceus@0.1.0`
3. No data was written outside `~/.pi/agent/caduceus.json` and
   the optional `~/.pi/agent/caduceus/personas/` directory.
   These continue to work in v0.1.0 (v0.1.0 just ignores
   `persona` and `systemPromptMode` fields).

## 8. Next phase

`sdd-design` — write `openspec/changes/caduceus-v0.1.1/design.md`
covering:

- File changes (which `lib/*.ts` files are added/modified, and
  what new ones are created)
- `systemPromptMode` config field + extension entry changes
- Persona filesystem discovery algorithm (path resolution,
  precedence, caching, error handling)
- `/caduceus:lint` algorithm (which checks, what output)
- New persona text design (`concise`, `reviewer`)
- Test file mapping (which new test files, which existing ones
  get new cases)

Design will not introduce new requirements; if a design decision
implies a new requirement, the proposal is updated first.

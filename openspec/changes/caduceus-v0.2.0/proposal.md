# caduceus v0.2.0 — Proposal

> **Status:** Proposal complete. Awaiting `design` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.2.0`
> **Source contracts:** [`proposal-v0.1.1`](./caduceus-v0.1.1/proposal.md),
> [`analysis-2026-08`](./caduceus-v0.1.0/exploration.md)
> **Upstream:** v0.1.1 is live on npm + GitHub

## 1. Intent

Ship **caduceus v0.2.0** — a minor release that broadens the
persona offering from 4 to 10+ built-ins, adds an interactive
persona creation wizard, and adds a side-by-side persona diff
command. The goal is to make caduceus the most useful pi
extension for users who care about voice and persona quality.

Three concrete features:

1. **6 new built-in personas** (teacher, security, debugger,
   socratic, architect, pirate) — bringing the built-in count
   from 4 to 10.
2. **`/caduceus:create` interactive wizard** — a slash command
   that interactively collects (name, style hints, language
   preferences) and generates a properly-formatted persona file
   at the right location. **Comparable to**
   `@isr4el-silv4/persona`'s `/persona create` but template-based
   (no LLM dependency). **Differentiator:** runs lint on the
   generated file before accepting.
3. **`/caduceus:diff <persona-a> <persona-b>`** — render two
   personas with the current mode + locale and show a unified
   diff. Useful for understanding what each persona actually
   does and for choosing between similar ones.

## 2. Why now

| Pressure | Source | v0.2.0 impact |
|---|---|---|
| 4 built-in personas is "good enough" but not "great coverage" | Post-v0.1.1 user testing intuition | 6 more personas cover common dev scenarios |
| `isr4el-persona` has a `/persona create` wizard | Direct competitor | `/caduceus:create` is direct parity (without LLM dependency) |
| Users want to "preview a persona before switching" | Inferred from common UX patterns | `/caduceus:diff` is a cheap differentiator |
| Per-model variants (P2) require empirical research | Speculative, not validated | **Deferred** to v0.3.0 — no data to justify the work yet |
| LLM-generated persona (P2) violates "0 runtime deps" | Architectural constraint | **Replaced** with template-based wizard (no LLM call) |

## 3. Scope (locked)

### 3.1 In scope for v0.2.0

- **6 new built-in persona files** (`prompts/teacher.md`,
  `prompts/security.md`, `prompts/debugger.md`,
  `prompts/socratic.md`, `prompts/architect.md`,
  `prompts/pirate.md`). Each follows the standard 4-block
  structure, contains the `${mode}` placeholder, and passes
  the lint. Each focuses on a specific voice/use case (not
  language — language is the mode's job).
- **`/caduceus:create` interactive wizard** — a multi-step
  slash command that:
  - Step 1: prompts for persona name (validates not already
    in use, validates valid file-system name)
  - Step 2: prompts for a 1-2 sentence description
  - Step 3: prompts for a style hint (concise / verbose /
    friendly / strict / custom)
  - Step 4: confirms location (global vs project)
  - Step 5: generates the persona file from a template + the
    user's inputs
  - Step 6: runs `/caduceus:lint` on the new file
  - Step 7: asks "switch to this persona? [Y/n]" — if Y,
    activates it
- **`/caduceus:diff <persona-a> <persona-b>`** — renders both
  personas with the current mode + locale and prints a unified
  diff. Defaults to comparing the active persona with `gentleman`
  if only one argument is given.
- **Test coverage** for all of the above (strict TDD, RED
  first).
- **Marketing updates**: README "Built-in Personas" table
  extended, CHANGELOG entry for v0.2.0.

### 3.2 Explicitly out of scope (deferred to v0.3.0+)

- ❌ Per-model persona variants (`prompts/gentleman.claude.md`)
  — needs empirical research on whether different models need
  different prompts. Speculative without data.
- ❌ LLM-generated personas (real `/caduceus:generate` with an
  LLM call) — violates "0 runtime deps" and the LLM access path
  from a slash command is not yet designed. Template wizard
  covers 80% of the use case.
- ❌ Community persona gallery (`npx caduceus add <name>`)
  — 0 users; premature.
- ❌ Persona effectiveness measurement (does the model follow
  the persona?) — needs download >100/month to be meaningful.
- ❌ Persona-specific tool restrictions (per DNA-1 shell/meat
  separation).
- ❌ Dark/light dual themes (only one theme, no demand).
- ❌ Web playground for persona preview.

### 3.3 Backward compatibility

- 4 existing built-in personas (`gentleman`, `neutral`,
  `concise`, `reviewer`) are unchanged (byte-for-byte
  identical to v0.1.1).
- Existing config files continue to work — no new fields.
- 6 new personas are added to the built-in set; `listPersonas`
  returns 10 names instead of 4.
- `/caduceus:create` and `/caduceus:diff` are new commands;
  no existing command changes.
- All 116 existing tests pass unchanged.

## 4. Success criteria (all must be true at archive)

1. `npm test` exits 0; full suite ≥ 150 tests (was 116), 0
   failures.
2. `node scripts/verify-package.mjs` exits 0; 14/14
   pre-publish checks pass (was 13; the check count grows
   because we add more test files to the expected list).
3. `listPersonas` returns at least 10 names (4 existing + 6
   new).
4. Each new persona passes `lintPersonaContent` (verified by
   the persona-contract test pattern, R-LINT-1x).
5. `/caduceus:create wizard` produces a file at the expected
   path with the user's inputs interpolated, AND the file
   passes `/caduceus:lint` on first attempt.
6. `/caduceus:create` with a name that already exists shows
   an error and does not overwrite.
7. `/caduceus:diff` produces a unified-diff-formatted output
   for two distinct personas; the output is byte-stable
   across calls with the same inputs.
8. v0.2.0 is published to npm and listed on pi.dev gallery.

## 5. Open questions for the user (none blocking)

- Q1: Persona `pirate` — is a fun "easter egg" persona
  appropriate, or should caduceus stay professional? —
  **My recommendation:** keep pirate. Persona-as-a-feature is
  most useful when it covers the full range of voice
  preferences, including playful ones. A pirate persona
  demonstrates that caduceus is "voice" not "language" — same
  English text, different cadence. Plus, it makes the
  marketing page more shareable.
- Q2: Should `/caduceus:create` be persona-only, or should
  it also offer to set the system prompt mode and the active
  persona? — **My recommendation:** persona-only. The
  `/caduceus:create` command's purpose is "make me a new
  persona". Switching and prompt-mode are separate concerns
  with their own commands (`/caduceus:persona`,
  `/caduceus:prompt`).
- Q3: Should the 6 new personas be grouped by category
  (style vs domain) in the README? — **My recommendation:**
  yes, add a column "Category" to the table (style: pirate,
  socratic; domain: security, debugger, teacher, architect).

## 6. Marketing plan (non-SDD, separate workstream)

- Update the forum post (D-1) to mention the new personas
  and the wizard.
- If the user wants to publish a v0.2.0 announcement blog
  post (D-2), the same Medium template can be reused with
  updated content.
- Optional: add a `/caduceus:diff pirate gentleman` example
  screenshot to the README.

## 7. Rollback

Caduceus is purely additive. Rolling back v0.2.0 → v0.1.1:
1. `pi remove npm:pi-caduceus`
2. `pi install npm:pi-caduceus@0.1.1`
3. The 6 new persona files are loaded only by v0.2.0; v0.1.1
   ignores them.
4. The wizard and diff commands are new; v0.1.1 ignores
   them.

User personas created via `/caduceus:create` in v0.2.0 live
in `~/.pi/agent/caduceus/personas/<name>.md`. v0.1.1 does
not read those files. No data loss — files persist, just
not used by v0.1.1.

## 8. Next phase

`sdd-design` — write
`openspec/changes/caduceus-v0.2.0/design.md` covering:

- The 6 new persona files (full text for each)
- `/caduceus:create` interactive flow (state machine, prompt
  validation, file path resolution, lint integration)
- `/caduceus:diff` algorithm (render + diff library choice)
- New types in `lib/wizard.ts` and `lib/diff.ts`
- Test file mapping
- `sdd-tasks` — 8 implementation tasks in dependency order

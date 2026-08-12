# caduceus v0.3.0 — Brand Independence (MAJOR)

> **Status:** Proposal complete. Awaiting `design` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.3.0`
> **Source contracts:** [`INIT.md`](../../../INIT.md), all prior SDD artifacts
> **Upstream:** v0.2.0 is live on npm + GitHub

## 1. Intent

Ship **caduceus v0.3.0** — a **breaking major release** that
completes caduceus's brand independence. v0.1.0 and v0.1.1
shipped the persona contract as a derivative of `gentle-pi`
(the "el Gentleman" identity block, the voseo/Rioplatense
language clause, two built-in personas copied byte-for-byte
from `gentle-pi/extensions/gentle-ai.ts`). v0.2.0 added 6
caduceus-original personas but kept the gentleman persona
as the default. v0.3.0 removes all gentleman-derived
content: no more "el Gentleman" identity block, no more
voseo/Rioplatense language clauses, no "gentleman"/"neutral"
as mode names or persona names. caduceus is its own product
that **benchmarks** against gentle-pi but does not depend on
it.

This is a **breaking change** for users who have:
- `mode: "gentleman"` or `mode: "neutral"` in their
  `~/.pi/agent/caduceus.json`
- `persona: "gentleman"` or `persona: "neutral"` in their
  config

The migration is automatic: `readConfig` maps the old
mode/persona names to the new ones with a `console.warn` on
first read. After one save, the config is v0.3.0-clean.

## 2. Why now

| Pressure | Source | v0.3.0 impact |
|---|---|---|
| Brand independence (user explicit) | 2026-08 user message | Remove all "el Gentleman" / "voseo" / "Rioplatense" content |
| Future maintainability | The current code is "50% caduceus, 50% gentle-pi mirror"; we need to break the mirror | All built-in personas are caduceus-original |
| Competitive positioning | `@isr4el-silv4/persona` and `pi-custom-system-prompt` are also "persona layer for pi"; caduceus needs its own identity to stand out | Distinct name, distinct default voice |
| Honest marketing | Cannot claim "persona as a contract" while shipping byte-for-byte content from another product | All content is caduceus-original; gentle-pi is referenced only in CHANGELOG and INIT.md as historical context |

## 3. Scope (locked)

### 3.1 In scope for v0.3.0

- **Mode renames**: `gentleman` → `default`, `neutral` →
  `plain`. `auto` unchanged. The internal `PersonaMode` type
  becomes `"default" | "plain" | "auto"`.
- **Persona deletions** (in the default built-in set):
  - `gentleman` (caduceus-original replacement: `default`)
  - `neutral` (caduceus-original replacement: `plain`)
- **All 10 prompt files** (4 new persona + 6 existing) have
  their identity contract block rewritten. The new block is
  caduceus-original — no "el Gentleman" reference. Each
  persona's persona-specific text stays the same.
- **`lib/language-clause.ts`** is **deleted**. The mode
  no longer appends a language clause to the persona prompt.
  The model is expected to detect the user's language
  naturally. `lib/locale-detect.ts` is **kept** (still useful
  for `/caduceus:status` and for the wizard).
- **Lint redesign**:
  - Remove `checkCrossModeLeakGentleman` and
    `checkCrossModeLeakNeutral` (they check for voseo strings)
  - Add `checkConflictingVoiceMarkers`: a heuristic that
    flags personas whose persona block contains words from
    BOTH "concise" and "verbose" marker lists (e.g., a
    persona that says "be brief" and "be thorough" in the
    same paragraph is inconsistent)
- **Config defaults**: `mode: "default"`, `persona: "default"`.
- **`/caduceus:status`**: shows the new mode name and persona
  name. If a v0.2.0 mode/persona is detected, shows the
  migrated name (and warns on the first read).
- **`/caduceus:mode`**: accepts `default | plain | auto`. The
  old names `gentleman | neutral` are still accepted as
  input (with a deprecation warning) for one release.
- **`/caduceus:persona`**: lists 10 caduceus-original
  personas. Old names `gentleman` / `neutral` are still
  accepted as input (with a deprecation warning) for one
  release.
- **`/caduceus:create`**: generates caduceus-original
  personas. The wizard template's identity block is the new
  caduceus-original block.
- **`/caduceus:lint`**: same interface, but the cross-mode
  leak checks are gone; the new conflicting-voice check is
  in.
- **`/caduceus:diff`**: unchanged in interface; the rendered
  output no longer contains a voseo/Rioplatense language
  clause.
- **`extensions/caduceus.ts`**: before_agent_start no longer
  appends a language clause. The persona prompt is loaded,
  `${mode}` is substituted, and that's the final system
  prompt (or appended in `systemPromptMode === "append"`).
- **Backward-compat migration** in `readConfig`:
  - If `mode === "gentleman"`, map to `mode === "default"`
    and warn (once)
  - If `mode === "neutral"`, map to `mode === "plain"` and
    warn
  - If `persona === "gentleman"`, map to `persona === "default"`
    and warn
  - If `persona === "neutral"`, map to `persona === "plain"`
    and warn
- **Documentation updates**:
  - `README.md`: remove all "el Gentleman", "voseo",
    "Rioplatense" references. Update the "Built-in Personas"
    table. Update the "Quick Start" to use `default` mode.
  - `CHANGELOG.md`: v0.3.0 entry documents the breaking
    change with a "Migration" subsection.
  - `INIT.md`: rewrite §2 (Naming Rationale) and §4 (DNA-2)
    to drop "el Gentleman" references. The metaphor "the
    shell" stays.
  - `openspec/AGENTS.md`: remove "el Gentleman" reference
    in the invariants section.
  - All SDD artifacts (init/exploration/proposal/design/
    tasks/specs) — historical record, do NOT rewrite. Add
    a v0.3.0 SDD addendum at the top of `proposal.md` if
    relevant.

### 3.2 Explicitly out of scope (deferred to v0.4.0+)

- ❌ Deleting v0.2.0 personas entirely from git history
  (we keep them as a record; they just don't ship in v0.3.0)
- ❌ Replacing the 8 "caduceus-original" personas (teacher,
  security, etc.) with different content — their content is
  already caduceus-original; only the identity contract
  block changes
- ❌ Changing the package name from `pi-caduceus` (the name
  is already independent; the issue was content, not naming)
- ❌ Per-model variants (P2 from v0.2.0 roadmap; still needs
  empirical research)
- ❌ LLM-generated personas (P2; same constraint as v0.2.0)

### 3.3 Backward compatibility (explicit)

| v0.2.0 | v0.3.0 | Migration |
|---|---|---|
| `mode: "gentleman"` | `mode: "default"` | Auto-mapped with warn |
| `mode: "neutral"` | `mode: "plain"` | Auto-mapped with warn |
| `mode: "auto"` | `mode: "auto"` | Unchanged |
| `persona: "gentleman"` | `persona: "default"` | Auto-mapped with warn |
| `persona: "neutral"` | `persona: "plain"` | Auto-mapped with warn |
| `persona: <any of 8 v0.2.0-original>` | `persona: <same name>` | Unchanged |
| Built-in `gentleman` persona file | **DELETED** | No mapping (file gone) |
| Built-in `neutral` persona file | **DELETED** | No mapping (file gone) |
| Persona files at `~/.pi/agent/caduceus/personas/<name>.md` | Unchanged (user's are theirs) | Unchanged |
| Slash commands | 9 unchanged | All 9 work; deprecation warnings on the 2 with old names |
| CHANGELOG | New v0.3.0 entry | Old entries preserved as historical record |

The `caduceus.json` config is auto-migrated on read. The
`writeGlobalConfigField` is NOT auto-migrated; it writes the
new name. So after one save (e.g., running `/caduceus:mode
plain`), the config is fully v0.3.0-clean.

## 4. Success criteria (all must be true at archive)

1. `npm test` exits 0; full suite ≥ 170 tests (was 165), 0
   failures.
2. `node scripts/verify-package.mjs` exits 0; 14/14
   pre-publish checks pass.
3. **Zero mentions** of "el Gentleman" or "voseo" or
   "Rioplatense" in:
   - `lib/` files (except the migration map in
     `config-store.ts`)
   - `prompts/*.md` files
   - `extensions/caduceus.ts`
   - `README.md`
   - `CHANGELOG.md` (v0.3.0 entry; older entries preserved
     as historical)
   - `INIT.md` (sections §2, §4 only; the rest may keep
     historical references)
   - The verification is automated: a new check in
     `verify-package.mjs` greps for these strings and fails
     if found (excluding the migration map and historical
     sections).
4. `caduceus.json` migration: a v0.2.0 config with
   `mode: "gentleman"` and `persona: "gentleman"` is
   correctly read as `mode: "default"` and
   `persona: "default"` (verified by a test).
5. All 10 built-in personas pass the new lint
   (no `checkCrossModeLeak*` checks; only structural +
   conflicting-voice).
6. `/caduceus:mode gentleman` shows a deprecation warning
   and still works (maps to `default`). Same for
   `gentleman` as a persona name.
7. v0.3.0 is published to npm and listed on pi.dev gallery
   with a fresh "What's new in v0.3.0" badge.

## 5. Open questions for the user (none blocking)

- Q1: Should the new `default` persona be byte-stable with
  any specific reference (e.g., a test that asserts it
  contains a specific marker phrase), or should it be a
  plain caduceus-original persona? — **My recommendation:**
  plain caduceus-original, no byte-stable marker. The
  previous byte-stable invariant (R-PERSONA-007/008 against
  gentle-pi lines) is removed because the gentle-pi mirror
  is gone. The new persona is just a regular 4-block
  persona that the lint keeps consistent.
- Q2: Should the conflicting-voice check be ERROR or
  WARNING? — **My recommendation:** WARNING. A persona that
  has "be concise" and "be thorough" in different parts of
  the same block is inconsistent but not broken. The check
  surfaces the issue without breaking lint. Users can fix
  it manually.
- Q3: For the new `default` and `plain` personas, what
  voice should they have? — **My recommendation:**
  - `default`: senior dev/architect tone (like a
    well-calibrated voice for code review, design
    discussion, and implementation). Direct, technical,
    uses "we" for collaborative work, names tradeoffs
    explicitly.
  - `plain`: minimal, just answers the question. No
    preamble, no postscript, no "great question!" filler.
    Prefer code over prose.

## 6. Marketing plan (non-SDD, separate workstream)

- **Forum post update (D-1)**: rewrite the v0.1.1 post to
  remove "el Gentleman" / "voseo" / "Rioplatense" mentions.
  Position v0.3.0 as "caduceus is now its own product".
- **README intro**: replace the current "Persona Contract
  package for pi. Injects a deterministic, testable,
  line-citable persona prompt segment..." with a more
  brand-distinct intro: "caduceus is the persona layer for
  the pi coding agent. It defines personas as testable
  contracts, ships 10 built-in voices, and lets you lint
  your own. 0 runtime dependencies, 0 postinstall, 0 native
  binaries."

## 7. Rollback

v0.3.0 is a major breaking release. Rolling back to v0.2.0:
1. `pi remove npm:pi-caduceus`
2. `pi install npm:pi-caduceus@0.2.0`
3. Restore `caduceus.json` to use `mode: "gentleman"` (if
   v0.3.0 already auto-migrated it, the v0.2.0 reader still
   accepts the old names)
4. No data is lost: persona files are unchanged, slash
   commands work the same way with the old names

## 8. Next phase

`sdd-design` — write
`openspec/changes/caduceus-v0.3.0/design.md` covering:

- The new identity contract block (the 5 bullets,
  caduceus-original)
- The new `default` and `plain` persona files (full text)
- The 8 other personas' identity block replacement
- The lint redesign (drop cross-mode, add conflicting-voice)
- The backward-compat migration in `readConfig`
- File changes (which files to add, modify, delete)
- Test file mapping

Then `sdd-tasks` — 10 implementation tasks in dependency
order. Estimated total: 600 lines (over 400 budget; will
require `single-pr-default` size-exception or two chained
PRs at the user-level decision boundary).

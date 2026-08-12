# caduceus v0.1.1 — Design

> **Status:** Design complete. Awaiting `tasks` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.1.1`
> **Source contracts:** [`proposal.md`](./proposal.md),
> [`proposal-v0.1.0`](./caduceus-v0.1.0/proposal.md),
> [`design-v0.1.0`](./caduceus-v0.1.0/design.md)
> **Engine:** `@earendil-works/pi-coding-agent` v0.84.1 (unchanged)

## 1. Purpose

Translate the v0.1.1 proposal into a concrete technical design
covering the four features (replace/append mode, persona
filesystem discovery, `/caduceus:lint`, 2 new personas) and the
3 new slash commands.

## 2. Module map (delta from v0.1.0)

```text
caduceus/
├── extensions/caduceus.ts        # MODIFIED — wire 3 new commands + new config
├── lib/
│   ├── persona-contract.ts       # MODIFIED — support custom personas
│   ├── language-clause.ts        # UNCHANGED
│   ├── locale-detect.ts          # UNCHANGED
│   ├── config-store.ts           # MODIFIED — add systemPromptMode, persona fields
│   ├── slash-commands.ts         # MODIFIED — add 3 new commands
│   ├── version.ts                # UNCHANGED
│   ├── errors.ts                 # MODIFIED — add CaduceusLintError
│   │
│   ├── persona-loader.ts         # NEW — filesystem discovery + caching
│   ├── lint.ts                   # NEW — /caduceus:lint core (pure)
│   └── prompt-mode.ts            # NEW — systemPromptMode resolution
│
├── prompts/
│   ├── gentleman.md              # UNCHANGED
│   ├── neutral.md                # UNCHANGED
│   ├── concise.md                # NEW — short-answer persona
│   └── reviewer.md               # NEW — PR review mode
│
├── tests/                        # 6 existing + 2 new
│   ├── persona-contract.test.ts  # UNCHANGED
│   ├── language-clause.test.ts   # UNCHANGED
│   ├── locale-detect.test.ts     # UNCHANGED
│   ├── config-store.test.ts      # MODIFIED — new fields tests
│   ├── slash-commands.test.ts    # MODIFIED — 3 new commands tests
│   ├── extension-entry.test.ts   # UNCHANGED
│   ├── persona-loader.test.ts    # NEW
│   └── lint.test.ts              # NEW
│
└── scripts/verify-package.mjs    # UNCHANGED
```

**New files:** 4 (3 in `lib/`, 2 in `prompts/`, 2 in `tests/`)
**Modified files:** 5 (1 extension, 4 lib, 2 test)

## 3. New types (delta)

```ts
// lib/config-store.ts (additions)
export type SystemPromptMode = "append" | "replace";
export type PersonaName = string;  // "gentleman" | "neutral" | "concise" | "reviewer" | <custom>

export type CaduceusConfig = {
  // ... existing fields ...
  systemPromptMode: SystemPromptMode;  // NEW, default "append"
  persona: PersonaName;                 // NEW, default "gentleman"
};

// lib/persona-loader.ts (new exports)
export type PersonaSource = "built-in" | "global" | "project";
export type LoadedPersona = {
  name: PersonaName;
  content: string;             // file content (loaded at module load)
  source: PersonaSource;
  path: string | null;         // null for built-ins
};

export function loadPersona(
  name: PersonaName,
  cwd: string,
  home?: string,
): LoadedPersona;             // throws CaduceusPersonaNotFoundError

export function listPersonas(
  cwd: string,
  home?: string,
): PersonaName[];             // built-in + global + project names

// lib/lint.ts (new exports)
export type LintIssue = {
  severity: "error" | "warning";
  message: string;
  location?: string;            // e.g. "prompts/gentleman.md:L5"
};
export type LintResult = {
  passed: boolean;
  issues: LintIssue[];
};
export function lintPersonaContent(
  content: string,
  personaName: PersonaName,
): LintResult;                 // pure function

// lib/errors.ts (addition)
export class CaduceusPersonaNotFoundError extends CaduceusError {
  constructor(public readonly name: string) {
    super(`Persona not found: ${name}`, "CADUCEUS_PERSONA_NOT_FOUND");
    this.name = "CaduceusPersonaNotFoundError";
  }
}

export class CaduceusLintError extends CaduceusError {
  constructor(public readonly issues: LintIssue[]) {
    super(`Lint failed: ${issues.length} issue(s)`, "CADUCEUS_LINT_FAILED");
    this.name = "CaduceusLintError";
  }
}
```

## 4. Per-module design

### 4.1 `lib/prompt-mode.ts` (new)

```ts
import type { SystemPromptMode } from "./config-store.ts";

/**
 * Compose the system prompt for the current `event.systemPrompt` and
 * the rendered persona string, according to the configured mode.
 *
 * - "append":  return `${event.systemPrompt}\n\n${persona}`  (v0.1.0 behavior)
 * - "replace": return persona                                (new behavior)
 */
export function composeSystemPrompt(
  base: string,
  persona: string,
  mode: SystemPromptMode,
): string;
```

Pure function. Trivial. No I/O.

### 4.2 `lib/persona-loader.ts` (new)

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BUILT_IN_PERSONAS = new Set(["gentleman", "neutral", "concise", "reviewer"]);

/**
 * Load a persona by name. Throws CaduceusPersonaNotFoundError if the
 * persona is neither built-in nor found at the user paths.
 *
 * Resolution order:
 *   1. Built-in (read from <repo>/prompts/<name>.md)
 *   2. Global (read from ~/.pi/agent/caduceus/personas/<name>.md)
 *   3. Project (read from ./.caduceus/personas/<name>.md)
 */
export function loadPersona(
  name: PersonaName,
  cwd: string,
  home?: string,
): LoadedPersona;

/**
 * List all personas available to the user: built-in + global + project.
 * Project personas with the same name as a global persona shadow it.
 */
export function listPersonas(
  cwd: string,
  home?: string,
): PersonaName[];
```

**Pure-ish:** the function reads files but is otherwise
deterministic. Caching is per-process (caller stores the
`LoadedPersona` in a closure variable, like the v0.1.0
`persona-contract.ts` caches built-in prompts).

For the built-in files, the path is resolved relative to the
module's own location via `import.meta.url`, just like
`persona-contract.ts` already does for `gentleman.md` and
`neutral.md`.

### 4.3 `lib/lint.ts` (new, pure)

```ts
/**
 * Static checks on a persona markdown file. Catches the same
 * invariants that R-PERSONA-* assert at test time, but as a
 * runtime check on any user-provided persona.
 *
 * Checks (each is a small pure function):
 *   1. CROSS_MODE_LEAK_GENTLEMAN: must NOT contain "Do NOT use voseo"
 *      unless the persona is named "neutral"
 *   2. CROSS_MODE_LEAK_NEUTRAL: must NOT contain
 *      "natural Rioplatense Spanish with voseo" unless persona
 *      is "gentleman"
 *   3. VOSE_CONDITIONAL: voseo / no-voseo references must be
 *      inside a "When the user writes Spanish..." conditional.
 *      Heuristic: scan lines for voseo/do-not-voseo; if found
 *      outside a "when ... Spanish" sentence, warn.
 *   4. IDENTITY_BLOCK: must contain "Identity contract:" line
 *   5. PERSONA_BLOCK: must contain "## Persona" section
 *   6. PRINCIPLES_BLOCK: must contain "## Harness principles" section
 *   7. NO_TIMESTAMP: must not contain ISO date or UUID-like hex
 *   8. MODE_PLACEHOLDER: must contain the ${mode} placeholder
 *      (so runtime substitution works)
 */
export function lintPersonaContent(
  content: string,
  personaName: PersonaName,
): LintResult;
```

**Pure function, no I/O.** The CLI command `npx caduceus lint
<file>` (in v0.2.0) wraps this; the slash command reads the
active persona content and calls this.

Severity rules:
- ERROR: invariant violations (1, 2, 4, 5, 6, 7, 8) — lint fails
- WARNING: heuristics (3) — lint still passes with warnings

### 4.4 `lib/config-store.ts` (modified)

Two new fields in `CaduceusConfig`:
- `systemPromptMode: "append" | "replace"` (default `"append"`)
- `persona: string` (default `"gentleman"`)

`DEFAULT_CONFIG` extended:
```ts
export const DEFAULT_CONFIG: CaduceusConfig = {
  mode: "gentleman",
  locale: "auto",
  showStatusBar: false,
  allowProjectOverride: true,
  systemPromptMode: "append",  // NEW
  persona: "gentleman",         // NEW
};
```

All existing tests using `DEFAULT_CONFIG` get the two new fields
automatically (deepEqual still passes because both old and new
configs have the same defaults).

### 4.5 `lib/slash-commands.ts` (modified)

Three new commands registered, three new deps:

```ts
export type CommandDeps = {
  // ... existing ...
  systemPromptMode: SystemPromptMode;     // NEW (read-only — for status display)
  listPersonas: (cwd: string) => PersonaName[];  // NEW
  switchPersona: (name: PersonaName) => Promise<void>;  // NEW
  setSystemPromptMode: (mode: SystemPromptMode) => Promise<void>;  // NEW
  lintActivePersona: () => LintResult;  // NEW
};
```

New commands:

1. `/caduceus:prompt <replace|append>` — validate input, call
   `deps.setSystemPromptMode(value)`, notify confirmation.
2. `/caduceus:persona <name|list>` — if `name === "list"`, call
   `deps.listPersonas(ctx.cwd)` and notify the result. Otherwise
   call `deps.switchPersona(name)`, notify confirmation or error
   if persona not found.
3. `/caduceus:lint` — call `deps.lintActivePersona()`, format
   issues, notify. If passed, say "persona OK". If failed,
   list each issue with severity + message.

### 4.6 `extensions/caduceus.ts` (modified)

Add to the closure state:
```ts
let effective: EffectiveConfig | null = null;
let loadedPersona: LoadedPersona | null = null;  // NEW
let systemPromptMode: SystemPromptMode = "append";  // NEW
```

The `before_agent_start` handler changes from:
```ts
return { systemPrompt: `${event.systemPrompt}\n\n${persona}` };
```
to:
```ts
return {
  systemPrompt: composeSystemPrompt(
    event.systemPrompt,
    persona,
    systemPromptMode,  // "append" or "replace"
  ),
};
```

The `slash-commands` deps add the 4 new functions:
```ts
registerSlashCommands(pi, {
  // ... existing ...
  systemPromptMode: () => systemPromptMode,  // for status
  listPersonas: (cwd) => listPersonas(cwd),
  switchPersona: async (name) => {
    const p = loadPersona(name, ctx.cwd);  // ctx available in closure
    loadedPersona = p;
    // also persist to global config
    await writeGlobalConfigField("persona", name);
  },
  setSystemPromptMode: async (mode) => {
    systemPromptMode = mode;
    await writeGlobalConfigField("systemPromptMode", mode);
  },
  lintActivePersona: () => {
    if (!loadedPersona) return { passed: true, issues: [] };
    return lintPersonaContent(loadedPersona.content, loadedPersona.name);
  },
});
```

The `switchPersona` and `setSystemPromptMode` need `ctx.cwd` which
is only available inside the `session_start` handler. So they
need to be wrapped in a closure that captures `effective.cwd`.

Cleaner: move `cwd` to a closure variable set in `session_start`:

```ts
let cwd: string | null = null;
let loadedPersona: LoadedPersona | null = null;

pi.on("session_start", async (_event, ctx) => {
  cwd = ctx.cwd;
  // ... existing ...
  loadedPersona = loadPersona(effective.config.persona, ctx.cwd);
});
```

This way `loadPersona` and `listPersonas` always have `cwd`
available via closure.

### 4.7 `prompts/concise.md` and `prompts/reviewer.md` (new)

These are caduceus-original, not byte-stable derivatives of
gentle-pi. They MUST be lint-clean (the lint test for these
specific files is a meta-test).

**`concise.md`** (~40 lines):
- Identity: same as gentleman/neutral
- Persona: "Be extremely concise. Answer in 1-3 sentences unless
  the user explicitly asks for detail. Prefer code over prose.
  No preamble, no postscript."
- Harness principles: same as gentleman/neutral

**`reviewer.md`** (~60 lines):
- Identity: same
- Persona: "You are a code reviewer. Be direct, technical, and
  constructive. For every code change, identify bugs, security
  issues, performance problems, and naming/clarity concerns. Use
  the language the user wrote in."
- Harness principles: same

Both have `${mode}` placeholder for runtime substitution.

### 4.8 Slash command summary (v0.1.1)

| Command | Args | Description |
|---|---|---|
| `/caduceus:status` | — | Show effective config (now includes persona, systemPromptMode) |
| `/caduceus:mode` | `<gentleman\|neutral\|auto>` | Persona mode (language awareness) — unchanged |
| `/caduceus:locale` | `<auto\|es-AR\|es-ES\|en\|zh>` | Locale preference — unchanged |
| `/caduceus:prompt` | `<replace\|append>` | **NEW** — how to inject the persona into the system prompt |
| `/caduceus:persona` | `<name\|list>` | **NEW** — switch persona; `list` shows all available |
| `/caduceus:inspect` | — | Show rendered prompt with provenance — unchanged |
| `/caduceus:lint` | — | **NEW** — static checks on the active persona |

Total: 7 slash commands (was 4).

## 5. Data flow on a slash command

```text
user: /caduceus:persona concise
   │
   ▼
pi runtime
   │
   ▼
slash-commands handler (with deps)
   │
   ├── deps.listPersonas(ctx.cwd)  // for "list" arg
   │      │
   │      ▼
   │   lib/persona-loader.ts → ["gentleman", "neutral", "concise", "reviewer", ...]
   │
   ├── deps.switchPersona("concise")
   │      │
   │      ▼
   │   lib/persona-loader.ts → loadPersona("concise", ctx.cwd)
   │      │
   │      ▼
   │   reads prompts/concise.md (built-in path)
   │      │
   │      ▼
   │   returns { name: "concise", content, source: "built-in", path: null }
   │      │
   │      ▼
   │   closure: loadedPersona = result
   │      │
   │      ▼
   │   deps.writeGlobalConfigField("persona", "concise")
   │      │
   │      ▼
   │   caduceus.json updated atomically
   │
   └── ctx.ui.notify("persona set to concise", "info")
```

## 6. Data flow on every LLM call

```text
user input
   │
   ▼
pi runtime
   │
   ▼
emit "before_agent_start"
   │
   ▼
caduceus before_agent_start handler
   │
   ├── effective = readConfig()  // includes persona + systemPromptMode
   ├── personaName = effective.config.persona  // "concise"
   ├── locale = detectLocale(text, env, cfg.locale)
   │
   ├── if loadedPersona?.name === personaName:
   │     // already loaded, use cached
   │   persona = buildPersonaPrompt(loadedPersona.content, mode, locale)
   │ else:
   │   // persona changed (via slash command); reload
   │   loadedPersona = loadPersona(personaName, ctx.cwd)
   │   persona = buildPersonaPrompt(loadedPersona.content, mode, locale)
   │
   └── return {
     systemPrompt: composeSystemPrompt(
       event.systemPrompt,
       persona,
       effective.config.systemPromptMode,  // "append" or "replace"
     ),
   }
        │
        ▼
pi runtime uses updated systemPrompt for the LLM call
```

`buildPersonaPrompt` changes from a hard-coded load of
`prompts/<mode>.md` to accepting content as a parameter, so it
can render any persona. New signature:

```ts
// lib/persona-contract.ts
export function buildPersonaPromptFromContent(
  content: string,            // the .md file content
  mode: PersonaMode,          // "gentleman" | "neutral" | "auto"
  locale: ResolvedLocale,
): string;
```

The old `buildPersonaPrompt(mode, locale)` is kept for backward
compatibility (used by the persona-contract test):

```ts
export function buildPersonaPrompt(
  mode: PersonaMode,
  locale: ResolvedLocale,
): string {
  // Loads gentleman.md or neutral.md, then delegates
  return buildPersonaPromptFromContent(loadBuiltIn(mode), mode, locale);
}
```

## 7. Test strategy

### 7.1 New test files

- `tests/persona-loader.test.ts` — `loadPersona` resolution
  order, error on missing, `listPersonas` enumeration.
- `tests/lint.test.ts` — each lint check individually + 1
  happy-path test (gentleman and neutral pass) + 1 unhappy
  test (a synthetic bad persona with cross-mode voseo leak).

### 7.2 Modified test files

- `tests/config-store.test.ts` — add 4 cases for new
  `systemPromptMode` and `persona` config fields (defaults,
  override, malformed).
- `tests/slash-commands.test.ts` — add 3 commands × 2-3 cases
  each: prompt replace/append, persona switch/list,
  lint pass/fail.
- `tests/extension-entry.test.ts` — add 1 case for the new
  `composeSystemPrompt` integration in `before_agent_start`.

### 7.3 RED-first sequence

Per design-v0.1.0 §"Strict TDD posture" and the `tasks.md`
contract:

```
T-1: tests/persona-loader.test.ts (RED)
T-2: lib/persona-loader.ts + lib/persona-contract.ts refactor (GREEN)
T-3: tests/lint.test.ts (RED)
T-4: lib/lint.ts (GREEN + TRIANGULATE)
T-5: lib/config-store.ts additions (modifications) + tests
T-6: lib/slash-commands.ts additions (3 new commands) + tests
T-7: extensions/caduceus.ts wiring
T-8: lib/prompt-mode.ts + new prompt files (concise, reviewer)
T-9: extension-entry.test.ts new case + final full-suite verify
T-10: bump version, verify-package.mjs, npm publish
```

Each task is one commit. The total test count grows from 68 to
approximately 100 (12 new persona-loader + 10 new lint + 8 new
config + 12 new slash-commands + 1 new extension-entry).

## 8. Backward-compatibility audit

| v0.1.0 behavior | v0.1.1 behavior | Change? |
|---|---|---|
| `caduceus.json` has 4 fields | has 6 fields (adds `systemPromptMode`, `persona`) | **Yes, but additive** — old configs still work, defaults applied |
| `buildPersonaPrompt(mode, locale)` | Same signature + new `buildPersonaPromptFromContent(content, mode, locale)` | **No** — old signature preserved |
| `before_agent_start` returns `${event.systemPrompt}\n\n${persona}` | Same when `systemPromptMode === "append"` (default) | **No** — same output by default |
| `lib/persona-contract.ts` loads 2 prompt files | Loads N prompt files (2 built-in + 2 new + any custom) | **Internal change** — public API unchanged |
| Slash commands: 4 (status, mode, locale, inspect) | 7 (adds prompt, persona, lint) | **Additive** — old commands unchanged |

## 9. Risks (carried from v0.1.0 + new)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 (R-3 v0.1.0) | Custom persona file with `${mode}` placeholder is required for runtime substitution; user may write a persona without it | `lint` check #8 catches it; `/caduceus:persona <name>` checks before activating |
| R-2 (NEW) | User's custom persona has a voseo inconsistency that affects the gentleman/neutral invariants | `lint` reports it; user can fix or fall back to a built-in |
| R-3 (NEW) | `/caduceus:prompt replace` removes the default pi system prompt (tool descriptions, context-file rules). Power users may accidentally disable this | README documents the trade-off clearly; status command shows the mode; `lint` does not enforce this (it's a power-user feature) |
| R-4 (LOW) | Switching persona at runtime requires re-reading the prompt file; the file might change on disk | `loadedPersona` is re-read on every `before_agent_start` if the persona name doesn't match the cached one |

## 10. Next phase

`sdd-tasks` — produce `openspec/changes/caduceus-v0.1.1/tasks.md`
with 10 implementation tasks in dependency order, each with
RED-first test, GREEN impl, verification, and rollback. Estimated
total: ~400 lines added (close to the 400-line review budget but
fits in a single PR for a minor release).

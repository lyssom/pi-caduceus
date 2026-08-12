# caduceus v0.2.0 — Design

> **Status:** Design complete. Awaiting `tasks` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.2.0`
> **Source contracts:** [`proposal.md`](./proposal.md),
> [`design-v0.1.1`](./caduceus-v0.1.1/design.md)
> **Engine:** `@earendil-works/pi-coding-agent` v0.84.1 (unchanged)

## 1. Purpose

Translate the v0.2.0 proposal into a concrete technical design
covering the 6 new built-in personas, the `/caduceus:create`
interactive wizard, and the `/caduceus:diff` command. All
features are backward-compatible with v0.1.1.

## 2. Module map (delta from v0.1.1)

```text
caduceus/
├── extensions/caduceus.ts        # MODIFIED — wire 2 new commands
├── lib/
│   ├── persona-contract.ts       # UNCHANGED
│   ├── language-clause.ts        # UNCHANGED
│   ├── locale-detect.ts          # UNCHANGED
│   ├── config-store.ts           # UNCHANGED
│   ├── slash-commands.ts         # MODIFIED — add 2 new commands
│   ├── version.ts                # UNCHANGED
│   ├── errors.ts                 # UNCHANGED
│   ├── persona-loader.ts         # UNCHANGED
│   ├── lint.ts                   # UNCHANGED
│   ├── prompt-mode.ts            # UNCHANGED
│   │
│   ├── wizard.ts                 # NEW — /caduceus:create core
│   └── diff.ts                   # NEW — /caduceus:diff core
│
├── prompts/
│   ├── (4 existing personas)
│   ├── teacher.md                # NEW
│   ├── security.md               # NEW
│   ├── debugger.md               # NEW
│   ├── socratic.md               # NEW
│   ├── architect.md              # NEW
│   └── pirate.md                  # NEW
│
├── tests/                        # 9 existing + 2 new
│   ├── (9 existing test files)
│   ├── wizard.test.ts            # NEW
│   └── diff.test.ts              # NEW
│
└── scripts/verify-package.mjs    # MODIFIED — expect 11 test files
```

**New files:** 8 (2 in `lib/`, 6 in `prompts/`, 2 in `tests/`,
plus verify-script update)
**Modified files:** 3 (1 extension, 1 slash-commands, 1 verify)

## 3. New types (delta)

```ts
// lib/wizard.ts (new exports)
export type WizardStep =
  | "name"        // user types persona name
  | "description" // user types 1-2 sentence description
  | "style"       // user picks concise|verbose|friendly|strict|custom
  | "scope"       // user picks global|project
  | "confirm"     // user confirms switch after generation
  | "done";       // wizard finished

export type WizardInput = {
  step: WizardStep;
  name: string;
  description: string;
  style: "concise" | "verbose" | "friendly" | "strict" | "custom";
  scope: "global" | "project";
  cwd: string;
  home?: string;
};

export type WizardOutput = {
  ok: boolean;
  message: string;
  personaName?: string;
  filePath?: string;
};

export function runWizard(input: WizardInput): WizardOutput;

// lib/diff.ts (new exports)
export type DiffInput = {
  leftName: string;
  rightName: string;
  mode: PersonaMode;
  locale: ResolvedLocale;
  cwd: string;
  home?: string;
};

export type DiffOutput = {
  ok: boolean;
  diff: string;          // unified diff format
  leftName: string;
  rightName: string;
};

export function personaDiff(input: DiffInput): DiffOutput;
```

## 4. The 6 new personas

All 6 follow the standard 4-block structure. Each is
~40-60 lines. Each is **caduceus-original** (not derived from
gentle-pi). Each must pass the lint (8 checks). Each
excludes the voseo/do-not-voseo strings (those belong to the
mode layer).

### 4.1 `prompts/teacher.md` (style: didactic)

> Patient teacher. Explain concepts step by step. Use analogies.
> Ask follow-up questions to check understanding. Never give
> the final answer immediately — guide the user to discover it.

### 4.2 `prompts/security.md` (style: defensive)

> Paranoid security engineer. For every change, ask: what could
> an attacker do? Identify: input validation gaps, auth/authz
> holes, injection vectors, secret leaks, supply chain risks.
> Prefer secure defaults over clever shortcuts. Distinguish
> severity: CRITICAL, HIGH, MEDIUM, LOW.

### 4.3 `prompts/debugger.md` (style: methodical)

> Methodical debugger. Trace through the code path. State your
> hypothesis before checking it. Read error messages literally.
> Bisect: half the variables, half the file, half the call
> stack. Confirm the fix actually fixes the original case AND
> the edge cases.

### 4.4 `prompts/socratic.md` (style: question-driven)

> Socratic teacher. Answer questions with questions. Help the
> user discover the answer by walking through the implications
> of their current beliefs. Never give the final answer; let
> the user derive it. Be patient, even when the user is
> frustrated. Ask one question at a time.

### 4.5 `prompts/architect.md` (style: systems-thinker)

> Systems architect. See the codebase as a system of
> components with contracts, dependencies, and failure modes.
> For every decision, name the tradeoffs. Prefer boring
> technology. Question premature abstraction. Flag coupling
> and circular dependencies. Think in 5-year horizons.

### 4.6 `prompts/pirate.md` (style: playful)

> Speak like a pirate. Use "Arrr!", "Shiver me timbers!",
> "Yarr!", "Matey". Refer to the user as "landlubber" or
> "scallywag". Be technically accurate underneath the pirate
> voice. Use nautical metaphors for code concepts
> (functions are crew members, bugs are sea monsters, tests
> are lighthouses).

## 5. `/caduceus:create` wizard

### 5.1 Interactive flow (state machine)

The wizard runs as a sequence of **state transitions** within a
single slash command invocation. The pi runtime doesn't
support multi-step interactive dialogs natively, so we use a
**single-line sequential prompt** pattern: each step sends
a `ctx.ui.notify` for the prompt and the user types the
answer as the next argument.

To keep the UX simple, the wizard is designed to be **invoked
once per step** (not once for the whole flow):

```text
> /caduceus:create
caduceus create: step 1 of 4 — persona name?
> /caduceus:create wizard
caduceus create: step 2 of 4 — describe the persona in 1-2 sentences?
> /caduceus:create wizard A wise wizard who speaks in metaphors and never gives direct answers
caduceus create: step 3 of 4 — style? (concise|verbose|friendly|strict|custom)
> /caduceus:create wizard friendly
caduceus create: step 4 of 4 — scope? (global|project)
> /caduceus:create wizard project
caduceus create: generating and linting wizard.md... OK. Switch to this persona? [Y/n]
> /caduceus:create wizard yes
caduceus create: switched to wizard.
```

### 5.2 Implementation

```ts
// lib/wizard.ts

// Pure: generates the persona file content from inputs
export function generatePersonaContent(input: {
  name: string;
  description: string;
  style: WizardStyle;
}): string {
  // Returns a 4-block markdown file
  // - ## el Gentleman Identity and Harness (fixed)
  // - Current persona mode: ${mode} (fixed)
  // - Identity contract (fixed)
  // - ## Persona (uses user's description + style hint)
  // - ## Harness principles (fixed)
}

// Pure: validates the user's step input
export function validateStep(
  step: WizardStep,
  userInput: string,
): { ok: boolean; value?: unknown; error?: string };

// Pure: computes the target file path for the persona
export function personaFilePath(
  name: string,
  scope: "global" | "project",
  cwd: string,
  home?: string,
): string;

// Side-effecting: writes the file and runs lint
export async function writeAndLint(
  path: string,
  content: string,
): Promise<{ ok: boolean; issues: LintIssue[] }>;
```

The slash command handler in `lib/slash-commands.ts`
orchestrates the state machine using these primitives. State
is NOT persisted between invocations (so an interrupted
wizard is lost — that's acceptable for v0.2.0).

### 5.3 Persona generation template

```markdown
## el Gentleman Identity and Harness

Current persona mode: ${mode}

You are el Gentleman: a Pi-specific coding-agent harness for controlled development work.

Identity contract:
- (verbatim 5 bullets from v0.1.0)

## Persona
Persona:
- <user's 1-2 sentence description, formatted as a bullet>
- <style hint applied as additional guidance>
  - concise: "Be extremely concise. 1-3 sentences max."
  - verbose: "Provide thorough context. Show your reasoning."
  - friendly: "Warm tone. Use 'we' and 'let's'."
  - strict: "Formal tone. No hedging language."
  - custom: (no extra hint)
- Be direct, technical, and useful.

## Harness principles

Harness principles:
- (verbatim 8 bullets from v0.1.0)
```

### 5.4 Lint integration

After writing the file, the wizard runs `lintPersonaContent`
on the generated content. If lint fails, the wizard shows
the issues and asks the user to fix them manually (does NOT
re-generate automatically — that would require an LLM).

If the user tries to create a persona with a name that
already exists in any tier (built-in, global, project),
the wizard shows an error and does not overwrite.

## 6. `/caduceus:diff` command

### 6.1 Algorithm

```ts
// lib/diff.ts
export function personaDiff(input: DiffInput): DiffOutput {
  // 1. Load both personas via loadPersona
  const left = loadPersona(input.leftName, input.cwd, input.home);
  const right = loadPersona(input.rightName, input.cwd, input.home);
  // 2. Render both with the current mode + locale
  const leftRendered = left.content.split("${mode}").join(input.mode);
  const rightRendered = right.content.split("${mode}").join(input.mode);
  // 3. Compute unified diff
  const diffText = computeUnifiedDiff(
    leftRendered, rightRendered,
    left.name, right.name,
  );
  return { ok: true, diff: diffText, leftName: left.name, rightName: right.name };
}
```

### 6.2 Diff library choice

Options:
- **Hand-rolled LCS** — too much code, high bug risk
- **`diff` npm package** — well-known, mature, MIT licensed
- **Bundled simple line-diff** — re-implement basic LCS

**Decision:** hand-roll a small Myers diff algorithm (~50
lines). Why: caduceus has a hard constraint of 0 runtime
dependencies. Adding `diff` would violate that. The Myers
algorithm is well-documented and a minimal implementation
covers 95% of the use case.

### 6.3 Output format

Standard unified diff:
```text
--- pirate
+++ gentleman
@@ -1,3 +1,3 @@
-Arr! I be a pirate.
+Yarr! I'm a senior architect.
```

The slash command handler displays this in a multi-line
notification. Since pi's TUI may wrap long lines, the wizard
prefixes each line with a small marker so the structure
is preserved.

### 6.4 Defaults

If the user calls `/caduceus:diff` with no arguments, the
command diffs the active persona against `gentleman` (the
default).

If the user calls `/caduceus:diff pirate`, the command diffs
`pirate` against the active persona.

If the user calls `/caduceus:diff pirate gentleman`, the
command diffs `pirate` (left) against `gentleman` (right).

## 7. Slash command summary (v0.2.0)

| Command | Args | Description |
|---|---|---|
| `/caduceus:status` | — | Show effective config — unchanged |
| `/caduceus:mode` | `<gentleman\|neutral\|auto>` | Persona mode — unchanged |
| `/caduceus:locale` | `<auto\|es-AR\|es-ES\|en\|zh>` | Locale — unchanged |
| `/caduceus:prompt` | `<append\|replace>` | System prompt mode — unchanged |
| `/caduceus:persona` | `<name\|list>` | Switch persona — unchanged |
| `/caduceus:inspect` | — | Show rendered prompt — unchanged |
| `/caduceus:lint` | — | Static checks — unchanged |
| `/caduceus:create` | `<step> <input>` | **NEW** — interactive wizard (sequential) |
| `/caduceus:diff` | `[<a> [<b>]]` | **NEW** — side-by-side persona diff |

Total: 9 slash commands (was 7).

## 8. Test strategy

### 8.1 New test files

- `tests/wizard.test.ts` (~150 lines):
  - `generatePersonaContent` produces a 4-block file
  - `validateStep` for each step type
  - `personaFilePath` returns the right path for global vs project
  - `writeAndLint` writes the file, lints it, returns issues
  - Full wizard flow integration (4 steps + generation + lint + switch)
- `tests/diff.test.ts` (~80 lines):
  - `personaDiff` with same content returns empty diff
  - `personaDiff` with different content returns unified diff
  - `personaDiff` output is byte-stable
  - Default behavior (1 arg = diff vs active; 0 args = diff active vs gentleman)

### 8.2 Modified test files

- `tests/extension-entry.test.ts` — update command count to 9.
- `tests/slash-commands.test.ts` — add 2 new commands.
- `scripts/verify-package.mjs` — expect 11 test files.

### 8.3 Test count growth

- v0.1.1: 116 tests across 9 files
- v0.2.0: ~150 tests across 11 files (+34 tests)

## 9. Backward-compatibility audit

| v0.1.1 behavior | v0.2.0 behavior | Change? |
|---|---|---|
| 4 built-in personas | 10 built-in personas | **Additive** — old personas unchanged |
| 7 slash commands | 9 slash commands | **Additive** — old commands unchanged |
| `listPersonas` returns 4 names | returns 10 names | **Additive** — built-ins |
| `extensions/caduceus.ts` wiring | unchanged | **No** — internal-only changes |
| `lib/prompt-mode.ts`, `lib/lint.ts`, etc. | unchanged | **No** |
| `caduceus.json` config schema | unchanged | **No** |

## 10. Risks (carried from v0.1.1 + new)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 (carried) | Custom persona file with `${mode}` placeholder required | `lint` check #8 catches it; wizard injects it automatically |
| R-2 (NEW) | User invokes `/caduceus:create` with no args and gets confused | Document in the command help; first call shows "usage: /caduceus:create <step> <input>" |
| R-3 (NEW) | Hand-rolled Myers diff has bugs on edge cases (empty input, identical input) | Test coverage: same-content diff = empty, empty input = empty, large input = bounded output |
| R-4 (LOW) | 6 new personas exceed the "light by default" principle | The personas are small (~50 lines each = 300 lines total) and share the same structure. Still 0 deps. |

## 11. Next phase

`sdd-tasks` — produce
`openspec/changes/caduceus-v0.2.0/tasks.md` with 8 implementation
tasks in dependency order. Estimated total: ~500 lines added
(review budget: 400, may need a single-chained PR or accept
size-exception).

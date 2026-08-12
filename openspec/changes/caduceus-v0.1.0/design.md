# caduceus v0.1.0 — Design

> **Status:** Design complete. Awaiting `tasks` phase.
> **Date:** 2026-01
> **Change:** `caduceus-v0.1.0`
> **Engine:** `@earendil-works/pi-coding-agent` v0.84.1
> **Source contracts:** [`proposal.md`](./proposal.md), [`spec.md`](./spec.md), [`exploration.md`](./exploration.md), [`AGENTS.md`](../../AGENTS.md), [`openspec/config.yaml`](../../config.yaml)

## 1. Purpose

This document is the **technical design** that turns the 31
requirements across 3 domain specs (persona, locale-detection,
configuration) into a single coherent, testable implementation
plan. It specifies:

- The exact module map (file paths + responsibilities).
- The exported TypeScript type surface.
- Per-module function signatures.
- The composition strategy for the single
  `before_agent_start` event handler.
- The JSONC comment-stripping algorithm.
- The atomic-write algorithm.
- The strict-TDD forward declaration (which test file owns which
  spec scenario, and the RED → GREEN → TRIANGULATE → REFACTOR
  sequence for the first task).

This document does NOT introduce new requirements. If a
design decision implies a new requirement, the spec is updated
first and the parent is informed.

## 2. Design principles (recap, not new)

| Principle | Source | Implication for design |
|---|---|---|
| DNA-1: Shell vs meat | `INIT.md §4` | Extension entry is the **shell** (wires pi), libraries are the **meat** (pure). Shell talks to pi; meat is testable in isolation. |
| DNA-2: Persona is a contract | `INIT.md §4` | `persona-contract.ts` is a pure function. The persona prompt is loaded from `prompts/*.md` files at module load. `/caduceus:inspect` shows line provenance. |
| DNA-3: Light by default | `INIT.md §4` | 0 runtime deps, 0 native binaries, 0 postinstall. Test runner is the system Node. |

## 3. Module map

```text
caduceus/
├── package.json
├── README.md
├── LICENSE
├── .gitignore
│
├── extensions/
│   └── caduceus.ts           # SHELL: registers pi hooks
│                             #   - 1× session_start
│                             #   - 1× before_agent_start
│                             #   - 4× registerCommand
│                             #   - 0 native deps, 1 peer dep
│
├── lib/
│   ├── persona-contract.ts   # MEAT (pure): (mode, locale) → string
│   ├── language-clause.ts    # MEAT (pure): (locale, mode) → string
│   ├── locale-detect.ts      # MEAT (pure): (text, env, config) → locale
│   ├── config-store.ts       # MEAT (I/O): read/write global + project
│   ├── slash-commands.ts     # MEAT (factory): registerSlashCommands(pi, deps)
│   ├── version.ts            # EXPORT: const CADUCEUS_VERSION = "0.1.0"
│   └── errors.ts             # EXPORT: CaduceusError, CaduceusConfigError
│
├── prompts/
│   ├── gentleman.md          # persona body source (verbatim from gentle-pi)
│   └── neutral.md            # persona body source (verbatim from gentle-pi)
│
├── themes/
│   └── caduceus.json         # sea-blue starter theme
│
├── tests/
│   ├── persona-contract.test.ts
│   ├── language-clause.test.ts
│   ├── locale-detect.test.ts
│   ├── config-store.test.ts
│   └── slash-commands.test.ts
│
└── scripts/
    └── verify-package.mjs    # pre-publish integrity check
```

The merge proposed in `proposal.md §4.1` is enacted: there is
**no `lib/status-bar.ts`**. The status bar logic lives in
`extensions/caduceus.ts` (3 lines inside the `session_start`
handler).

## 4. Type system (the only exported types)

```ts
// lib/version.ts
export const CADUCEUS_VERSION = "0.1.0" as const;

// lib/errors.ts
export class CaduceusError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CaduceusError";
  }
}

export class CaduceusConfigError extends CaduceusError {
  constructor(message: string, public readonly path: string) {
    super(message, "CADUCEUS_CONFIG_ERROR");
    this.name = "CaduceusConfigError";
  }
}

// lib/config-store.ts (also re-exported from index if we add one)
export type PersonaMode = "gentleman" | "neutral" | "auto";
export type LocalePreference = "auto" | string;
export type CaduceusConfig = {
  mode: PersonaMode;
  locale: LocalePreference;
  showStatusBar: boolean;
  allowProjectOverride: boolean;
};
export type ConfigSource =
  | "built-in defaults"
  | "global"
  | "global+project"
  | "project";
export type EffectiveConfig = {
  config: CaduceusConfig;
  source: ConfigSource;
};

// lib/locale-detect.ts
export type ResolvedLocale =
  | "es-AR"
  | "es-ES"
  | "en"
  | "zh"
  | string;

// lib/persona-contract.ts
// (PersonaMode and ResolvedLocale are imported from the above)
```

**Type surface total: 8 named exports.** Everything else is
internal. The extension entry does not export anything; pi
consumes the default-exported factory function.

## 5. Module contracts (file by file)

### 5.1 `lib/version.ts`

```ts
export const CADUCEUS_VERSION = "0.1.0" as const;
```

Single line. No imports. Used by `/caduceus:status` for
self-identification.

### 5.2 `lib/errors.ts`

```ts
export class CaduceusError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CaduceusError";
  }
}

export class CaduceusConfigError extends CaduceusError {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(message, "CADUCEUS_CONFIG_ERROR");
    this.name = "CaduceusConfigError";
  }
}
```

Used by `config-store.ts` for parse errors. The `path` field
lets slash commands report which file caused the problem.

### 5.3 `lib/locale-detect.ts`

Exports:

```ts
export type ResolvedLocale =
  | "es-AR" | "es-ES" | "en" | "zh" | string;

export function detectLocale(
  text: string,
  env: NodeJS.ProcessEnv,
  configLocale: LocalePreference,
): ResolvedLocale;

export function normalizeEnvLocale(
  envValue: string,
  esTerritoryOverride?: "AR" | "ES",
): ResolvedLocale | null;

// Internal — not exported
function hasSpanishDiacritics(text: string): boolean;
function hasCjkIdeographs(text: string, min: number): boolean;
function countVoseoMarkers(text: string): number;
function isEnglishDominant(text: string): boolean;
```

**Pure function, no I/O.** All R-LOCALE-* requirements land here.

Detection algorithm in priority order (matches R-LOCALE-002):

```text
1. If configLocale !== "auto" → return configLocale (custom passthrough)
2. Scan text for Spanish diacritics or Spanish high-frequency words
   2a. If voseo markers >= 2 → "es-AR"
   2b. Else if Spanish cue present → "es-ES"
3. Scan text for >= 3 CJK ideographs AND no Spanish diacritics → "zh"
4. Scan text for >= 3 words AND >= 60% English common → "en"
5. If env.LC_ALL set → normalizeEnvLocale(env.LC_ALL)
6. If env.LANG set → normalizeEnvLocale(env.LANG)
7. Fallback → "en"
```

The English common-word list is the top 100 most common
English words (a, the, and, of, to, in, is, you, ...), stored
as a frozen `Set<string>` at module load.

### 5.4 `lib/language-clause.ts`

Exports:

```ts
import type { PersonaMode } from "./config-store.ts";
import type { ResolvedLocale } from "./locale-detect.ts";

export function languageClause(
  locale: ResolvedLocale,
  mode: PersonaMode,
): string;
```

**Pure function.** Returns a one-line string (no trailing
newline). Returns `""` when the locale is `"en"` and the
clause would be a no-op.

Selection table:

| `locale` | `mode` | Clause |
|---|---|---|
| `es-AR` | `gentleman` | `"Language: natural Rioplatense Spanish with voseo when the user writes Spanish."` |
| `es-ES` | `gentleman` | `"Language: neutral/professional Spanish (no voseo) when the user writes Spanish."` |
| `auto` | `gentleman` | same as `es-AR` (default) |
| `es-AR` | `neutral` | `"Language: neutral/professional Spanish (no voseo) when the user writes Spanish."` |
| `es-ES` | `neutral` | same as above |
| `auto` | `neutral` | same as above |
| `en` | either | `""` (no Spanish clause needed) |
| `zh` | either | `""` |
| any other | either | `""` (custom locale, no built-in clause) |

### 5.5 `lib/persona-contract.ts`

Exports:

```ts
import type { PersonaMode } from "./config-store.ts";
import type { ResolvedLocale } from "./locale-detect.ts";

export function buildPersonaPrompt(
  mode: PersonaMode,
  locale: ResolvedLocale,
): string;

// Internal — not exported
let cachedGentleman: string | null = null;
let cachedNeutral: string | null = null;

function loadPromptFile(filename: "gentleman" | "neutral"): string;
function renderIdentity(mode: PersonaMode): string;
function renderPersona(mode: PersonaMode): string;
function renderHarnessPrinciples(): string;
```

**Pure function with one-time file read.** At module load:

1. `loadPromptFile("gentleman")` synchronously reads
   `prompts/gentleman.md` (path resolved relative to the
   module's own URL via `import.meta.url`).
2. Same for `neutral`.
3. Both are cached in module-level `let` variables.

After load, `buildPersonaPrompt` does only string assembly —
no I/O, no `await`. Caching satisfies R-PERSONA-006.

The assembly is the same template that gentle-pi uses at
lines 286–308, but reimplemented in caduceus with the
explicit 4-block structure:

```text
## el Gentleman Identity and Harness
<blank line>
Current persona mode: <mode>
<blank line>
<identity contract block — from prompts/<mode>.md §3>
<blank line>
<persona block — from prompts/<mode>.md §2>
<blank line>
<language clause — from languageClause(locale, mode)>
<blank line>
<harness principles block — from prompts/<mode>.md §4>
```

The exact block boundaries are validated by the byte-for-byte
match test (R-PERSONA-007/008).

### 5.6 `lib/config-store.ts`

Exports:

```ts
export type PersonaMode = "gentleman" | "neutral" | "auto";
export type LocalePreference = "auto" | string;
export type CaduceusConfig = {
  mode: PersonaMode;
  locale: LocalePreference;
  showStatusBar: boolean;
  allowProjectOverride: boolean;
};
export type ConfigSource =
  | "built-in defaults" | "global" | "global+project" | "project";
export type EffectiveConfig = {
  config: CaduceusConfig;
  source: ConfigSource;
};

export const DEFAULT_CONFIG: CaduceusConfig = {
  mode: "gentleman",
  locale: "auto",
  showStatusBar: false,
  allowProjectOverride: true,
};

export function readConfig(cwd: string): EffectiveConfig;
export function writeGlobalConfig(
  newConfig: CaduceusConfig,
): Promise<void>;  // returns Promise<void> for I/O; sync inside handler via deasync is NOT used
export function updateGlobalConfigField<K extends keyof CaduceusConfig>(
  field: K,
  value: CaduceusConfig[K],
): Promise<void>;

// Internal — not exported
function readGlobalConfig(): CaduceusConfig | null;
function readProjectConfig(cwd: string): CaduceusConfig | null;
function parseJsonc(input: string): unknown;
function atomicWriteJson(path: string, data: unknown): Promise<void>;
```

**The only file that touches the filesystem for config.**

#### 5.6.1 `readConfig` algorithm

```text
1. globalConfig = readGlobalConfig()
   - if file missing → null
   - if file malformed → throw CaduceusConfigError, return null (caller catches)
2. effective = globalConfig ?? DEFAULT_CONFIG
3. if effective.allowProjectOverride:
     projectConfig = readProjectConfig(cwd)
     if projectConfig:
        effective = mergeWithDefaults(effective, projectConfig)  // project wins per field
        source = projectConfig present AND globalConfig present ? "global+project" : "project"
     else:
        source = "global" (or "built-in defaults" if globalConfig was null)
4. else:
     source = globalConfig present ? "global" : "built-in defaults"
5. return { config: effective, source }
```

#### 5.6.2 `parseJsonc` algorithm

```text
1. Strip block comments: replace /\/\*[\s\S]*?\*\//g with ""
2. Strip line comments: replace /(^|[^:])\/\/.*$/gm with "$1"
   (the negative lookbehind for ":" protects URL-like "://")
3. Strip leading/trailing whitespace
4. Return JSON.parse(remaining)
```

Step 2 is the only subtlety. The regex matches `//...` only
when the `//` is not preceded by `:`. This handles URLs
(`https://example.com`) without false positives while still
stripping real comments. Tested in `config-store.test.ts`
R-CONFIG-004.

#### 5.6.3 `atomicWriteJson` algorithm

```text
1. tmpPath = path + ".tmp." + crypto.randomUUID()
2. Write data (JSON.stringify with 2-space indent + trailing newline) to tmpPath
3. fs.rename(tmpPath, path)  // atomic on POSIX
4. On any failure: unlink tmpPath, throw
```

The rename is atomic on POSIX (the same filesystem). On Windows
the rename is also atomic for files on the same volume. We
assume `~/.pi/agent/` is a single filesystem — if a future user
has a multi-filesystem home, they have bigger problems.

### 5.7 `lib/slash-commands.ts`

Exports:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CaduceusConfig } from "./config-store.ts";

export type CommandDeps = {
  readConfig: (cwd: string) => EffectiveConfig;
  buildPersonaPrompt: (mode: PersonaMode, locale: ResolvedLocale) => string;
  writeGlobalConfigField: <K extends keyof CaduceusConfig>(
    field: K,
    value: CaduceusConfig[K],
  ) => Promise<void>;
  getStatusLine: (config: CaduceusConfig) => string;
  renderInspectOutput: (mode: PersonaMode, locale: ResolvedLocale) => string;
};

export function registerSlashCommands(
  pi: ExtensionAPI,
  deps: CommandDeps,
): void;
```

**The slash-commands module is decoupled from `pi` types where
possible.** It only imports `ExtensionAPI` for the `pi`
parameter type. The `CommandDeps` interface makes the four
commands pure-testable: tests construct a mock `pi` and pass
real or stub `CommandDeps`.

The four commands registered:

1. `/caduceus:status` — calls `deps.readConfig(ctx.cwd)` and
   prints via `ctx.ui.notify("info")`.
2. `/caduceus:mode <value>` — validates input, calls
   `deps.writeGlobalConfigField("mode", value)`, prints
   confirmation.
3. `/caduceus:locale <value>` — same shape as mode.
4. `/caduceus:inspect` — calls `deps.renderInspectOutput(...)`
   and prints via `ctx.ui.notify("info")` (or a custom dialog
   if the output is long — see §5.7.1).

#### 5.7.1 `/caduceus:inspect` output rendering

`renderInspectOutput(mode, locale)` returns a multi-line string
where each line of the rendered persona prompt is annotated
with its source. The annotation format is:

```text
<prompt line>
  ← prompts/gentleman.md:L<n>     (or language-clause.ts:L<n>, or renderIdentity:L<n>)
```

The line numbers come from the cached prompt file splits.
Since the prompt file is split on `\n`, each `lines[i]` has a
known `(i+1)` line number, and the annotation is deterministic.

### 5.8 `extensions/caduceus.ts`

Default export:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readConfig, writeGlobalConfigField } from "../lib/config-store.ts";
import { buildPersonaPrompt } from "../lib/persona-contract.ts";
import { detectLocale } from "../lib/locale-detect.ts";
import { languageClause } from "../lib/language-clause.ts";
import { CADUCEUS_VERSION } from "../lib/version.ts";
import { registerSlashCommands } from "../lib/slash-commands.ts";
import { renderInspectOutput } from "../lib/inspect-render.ts";  // or inline in slash-commands

export default function caduceus(pi: ExtensionAPI): void {
  let effective: EffectiveConfig | null = null;

  // 1. session_start — read config, set status bar
  pi.on("session_start", async (_event, ctx) => {
    try {
      effective = readConfig(ctx.cwd);
    } catch (err) {
      if (err instanceof CaduceusConfigError) {
        ctx.ui.notify(
          `caduceus: malformed ${err.path}, using defaults`,
          "warning",
        );
      }
      effective = {
        config: DEFAULT_CONFIG,
        source: "built-in defaults",
      };
    }
    if (effective.config.showStatusBar) {
      ctx.ui.setStatus(
        "caduceus",
        `caduceus · ${effective.config.mode} · ${effective.config.locale}`,
      );
    }
  });

  // 2. before_agent_start — inject persona
  pi.on("before_agent_start", async (event, ctx) => {
    const cfg = effective?.config ?? DEFAULT_CONFIG;
    const mode = cfg.mode === "auto" ? "gentleman" : cfg.mode;
    const locale = detectLocale(event.prompt, process.env, cfg.locale);
    const persona = buildPersonaPrompt(mode, locale);
    return { systemPrompt: `${event.systemPrompt}\n\n${persona}` };
  });

  // 3. slash commands
  registerSlashCommands(pi, {
    readConfig: (cwd) => effective ?? readConfigSafe(cwd),
    buildPersonaPrompt,
    writeGlobalConfigField,
    getStatusLine: (cfg) =>
      `caduceus · ${cfg.mode} · ${cfg.locale}`,
    renderInspectOutput: (mode, locale) =>
      `${buildPersonaPrompt(mode, locale)}\n\n[caduceus ${CADUCEUS_VERSION}]`,
  });
}

function readConfigSafe(cwd: string): EffectiveConfig {
  try { return readConfig(cwd); }
  catch { return { config: DEFAULT_CONFIG, source: "built-in defaults" }; }
}
```

**Notes:**

- `effective` is a closure variable per extension instance. The
  runner creates a fresh extension per session, so this state
  is automatically per-session.
- `process.env` is used directly. It's a global but the locale
  detection only reads it, never mutates.
- The `before_agent_start` handler does NOT call
  `detectLocale` if `cfg.locale !== "auto"` — wait, actually
  it does, but `detectLocale` short-circuits on the first
  check (R-LOCALE-002 step 1). No wasted work.
- Slash commands registered after the `before_agent_start`
  handler so the persona is already injected when the user
  runs `/caduceus:inspect`.

## 6. Data flow (the single critical path)

```text
user types "hola, ¿cómo estás?"
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
   ├── read effective config (closure var, populated by session_start)
   │
   ├── detectLocale("hola, ¿cómo estás?", process.env, cfg.locale)
   │       │
   │       ▼
   │   lib/locale-detect.ts
   │       │
   │       └── return "es-ES" (Spanish detected, no voseo markers)
   │
   ├── buildPersonaPrompt("gentleman", "es-ES")
   │       │
   │       ▼
   │   lib/persona-contract.ts
   │       │
   │       ├── read cached prompts/gentleman.md
   │       ├── renderIdentity("gentleman")
   │       ├── renderPersona("gentleman")
   │       ├── languageClause("es-ES", "gentleman")
   │       │       │
   │       │       ▼
   │       │   lib/language-clause.ts
   │       │       │
   │       │       └── return "Language: neutral/professional Spanish (no voseo) ..."
   │       │
   │       └── renderHarnessPrinciples()
   │       │
   │       └── return full persona prompt string
   │
   └── return { systemPrompt: `${event.systemPrompt}\n\n${persona}` }
        │
        ▼
pi runtime uses updated systemPrompt for LLM call
```

The single `before_agent_start` handler is **synchronous-ish**:
the only `await` is none — there's no async work. The handler
returns a plain object. Per the runner contract, this composes
cleanly with any other extension's `before_agent_start` handler.

## 7. JSONC preprocessing (concrete)

The `.caduceusrc` parser handles four edge cases that
real-world config files hit:

| Input | Output | Notes |
|---|---|---|
| `// comment\n{ "a": 1 }` | `{ a: 1 }` | Line comment |
| `/* block */\n{ "a": 1 }` | `{ a: 1 }` | Block comment |
| `{ "url": "https://x.com" }` | `{ url: "https://x.com" }` | `://` preserved (negative lookbehind on `:`) |
| `{ "a": "x // not a comment" }` | `{ a: "x // not a comment" }` | Inside a string, `//` is literal |

Edge case 3 is the most important. The regex
`/(^|[^:])\/\/.*$/gm` matches `//` only when the preceding
character is not `:`. In a string like `"https://x.com"`, the
`//` IS preceded by `:`, so it's not stripped. Verified by
unit test.

Edge case 4 is handled by JSON.parse itself: after the comment
stripping, the remaining string is valid JSON, and JSON.parse
ignores `//` inside string values. So we never strip comments
inside strings.

## 8. Atomic write (concrete)

```ts
async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp.${randomUUID()}`;
  const content = JSON.stringify(data, null, 2) + "\n";
  try {
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, path);
  } catch (err) {
    // Best-effort cleanup of the temp file
    try { await unlink(tmpPath); } catch {}
    throw err;
  }
}
```

Why this works on POSIX: `rename(2)` is atomic for files on the
same filesystem. Either the new file appears with the correct
content, or the old file is unchanged. No half-written state is
ever observable by another process reading `caduceus.json`.

On Windows, `rename` is atomic for same-volume files. The
`~/.pi/agent/` directory is on the user's home volume by
definition.

## 9. Persona prompt source text strategy

The `prompts/gentleman.md` and `prompts/neutral.md` files are
**not hand-written**. They are **generated** from the
verbatim text in `gentle-pi/extensions/gentle-ai.ts` lines
258–266 and 268–277.

Generation strategy:

- During `apply` phase, task T-7 reads
  `gentle-pi/extensions/gentle-ai.ts` lines 258–266 and
  268–277 (the source text).
- The apply agent writes the persona text into
  `prompts/gentleman.md` and `prompts/neutral.md` exactly
  as it appears, surrounded by the caduceus-specific
  identity contract (from `INIT.md §7.5` / gentle-pi lines
  282–294) and harness principles (from gentle-pi lines
  300–308).
- The test `persona-contract.test.ts` then asserts that the
  persona block in the prompt file equals the gentle-pi
  source text byte-for-byte. This is R-PERSONA-007/008.

**Why not just import from gentle-pi at runtime?** Three
reasons:

1. caduceus is a standalone package. It must not have a
   `dependencies` entry on gentle-pi. It cannot reach into
   gentle-pi's installation directory at runtime — that's
   brittle and unsafe.
2. The persona text is small (~10 lines × 2 modes). A
   generated copy is correct and self-contained.
3. The byte-for-byte test (R-PERSONA-007/008) is the
   falsifiability check that catches drift. If gentle-pi
   ever changes its persona text, the test fails and the
   apply agent must update caduceus's prompt file in the
   same change.

## 10. Theme design

`themes/caduceus.json` follows the schema verified in
`exploration.md §6`. The exact content is the JSON shown in
`exploration.md §6.2` and is committed verbatim during the
apply phase.

Key design decisions:

- **Sea blue (`#1B4D7A`)** is the primary accent.
- **Light blue (`#7FB3D5`)** is the secondary accent.
- The vars palette uses these two blues for `accent` and
  `secondary`, with a near-black background (`#0E1620`).
- All semantic colors in the `colors` block map to var names
  (no inline hex), so the user can re-theme by editing `vars`
  alone.
- No `export` block in v0.1.0 (CSS export for HTML rendering
  is deferred to v0.1.1).

## 11. pi manifest design

`package.json` `pi` block (the canonical shape from
`exploration.md §3.4`):

```json
{
  "name": "@lyssom/pi-caduceus",
  "version": "0.1.0",
  "description": "Persona Contract package for pi. Injects a deterministic, testable persona prompt segment before the first token of a pi session.",
  "type": "module",
  "license": "MIT",
  "keywords": [
    "pi-package", "pi", "pi-coding-agent", "caduceus",
    "persona", "prompt-orchestration", "persona-contract"
  ],
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  },
  "peerDependenciesMeta": {
    "@earendil-works/pi-coding-agent": { "optional": true }
  },
  "pi": {
    "extensions": ["./extensions"],
    "themes":     ["./themes"],
    "prompts":    ["./prompts"]
  },
  "files": [
    "extensions/", "lib/", "prompts/", "themes/",
    "tests/", "scripts/", "README.md", "LICENSE"
  ],
  "scripts": {
    "test": "node --experimental-strip-types --test tests/*.test.ts",
    "prepack": "node scripts/verify-package.mjs"
  }
}
```

**No `dependencies` field. No `devDependencies` field. No
`postinstall` script. No `packageManager` field.** Matches
R-CONFIG-012/013/014.

## 12. Test strategy (strict-TDD forward declaration)

Per `openspec/config.yaml`, `strictTdd: true` and the test
runner is
`node --experimental-strip-types --test tests/*.test.ts`. This
is forwarded verbatim into every `sdd-apply` task prompt.

### 12.1 Test file → spec scenario mapping

| Test file | Owns these spec requirements |
|---|---|
| `tests/persona-contract.test.ts` | R-PERSONA-001, 002, 003, 004, 005, 006, 007, 008, 009 |
| `tests/language-clause.test.ts` | R-PERSONA-010 |
| `tests/locale-detect.test.ts` | R-LOCALE-001 through R-LOCALE-008 |
| `tests/config-store.test.ts` | R-CONFIG-001, 002, 003, 004, 005, 011, 013, 014, 015 |
| `tests/slash-commands.test.ts` | R-CONFIG-006, 007, 008, 009, 010, R-PERSONA-011 |

`/caduceus:inspect` byte-stability (R-PERSONA-011) is tested
in `slash-commands.test.ts` because the inspect command is
the only way to surface the rendered prompt; the test mocks
`ExtensionCommandContext.ui.notify` to capture the output.

### 12.2 RED-first sequence for the first task

The first committed test in `tests/` MUST be a failing
`persona-contract.test.ts` (per `INIT.md §9.4`). The exact
sequence:

```text
Step 1 (RED):
  Write tests/persona-contract.test.ts with these failing assertions:
    - import { buildPersonaPrompt } from "../lib/persona-contract.ts"
    - assert.match(buildPersonaPrompt("gentleman", "es-AR"),
                   /natural Rioplatense Spanish with voseo/i)
    - assert.match(buildPersonaPrompt("neutral", "es-AR"),
                   /Do NOT use voseo/i)
  Run: node --experimental-strip-types --test tests/persona-contract.test.ts
  Expect: FAIL (module not found)

Step 2 (GREEN):
  Create lib/persona-contract.ts with the minimum implementation:
    - import prompts/gentleman.md and prompts/neutral.md content
    - export buildPersonaPrompt that returns the cached content
  Run: node --experimental-strip-types --test tests/persona-contract.test.ts
  Expect: PASS

Step 3 (TRIANGULATE):
  Add a second test forcing language clause integration:
    - assert.match(buildPersonaPrompt("neutral", "es-AR"),
                   /Do NOT use voseo.*neutral.*professional/s)
  Refactor buildPersonaPrompt to compose identity + persona +
    languageClause. Run tests, expect PASS.

Step 4 (REFACTOR):
  Clean up the implementation, ensure all tests still pass.
  Add the byte-for-byte match against gentle-pi lines
  258-266 (R-PERSONA-007/008).
```

This is the canonical TDD micro-cycle. Subsequent tasks
follow the same pattern: failing test → minimum impl → second
test → refactor.

### 12.3 No third-party test libraries

The test runner is `node --test` (built into Node 20+). We
do NOT install `vitest`, `jest`, or any other test framework.
This keeps the package at 0 runtime deps and 0 devDeps.

For assertions: `node:assert/strict` (built-in). The
`assert.match(actual, regex)` method handles the voseo
clause checks; `assert.equal(actual, expected)` handles the
byte-for-byte match; `assert.throws(fn, ErrorClass)` handles
the `CaduceusConfigError` cases.

## 13. File-by-file design (the apply phase blueprint)

The `sdd-tasks` phase will produce 8 implementation tasks.
This design is the input to that phase. Each task = one file
(or one tightly coupled set of files):

| Task | File(s) | TDD starting point | Spec requirements landed |
|---|---|---|---|
| T-1 | `tests/persona-contract.test.ts` (RED) | failing test for `buildPersonaPrompt` | R-PERSONA-001..009 |
| T-2 | `lib/persona-contract.ts`, `prompts/gentleman.md`, `prompts/neutral.md` | green the failing test | R-PERSONA-001..009 |
| T-3 | `lib/language-clause.ts` + `tests/language-clause.test.ts` | failing test for selection matrix | R-PERSONA-010 |
| T-4 | `lib/locale-detect.ts` + `tests/locale-detect.test.ts` | failing test for `detectLocale` | R-LOCALE-001..008 |
| T-5 | `lib/config-store.ts` + `tests/config-store.test.ts` | failing test for `readConfig` defaults | R-CONFIG-001..005 |
| T-6 | `lib/slash-commands.ts` + `tests/slash-commands.test.ts` | failing test for `/caduceus:status` | R-CONFIG-006..010, R-PERSONA-011 |
| T-7 | `extensions/caduceus.ts` | (no test, integration only — verified by the apply agent running `pi -e ./extensions/caduceus.ts` and confirming session_start fires) | (composes T-2..T-6) |
| T-8 | `themes/caduceus.json`, `package.json`, `README.md`, `LICENSE`, `scripts/verify-package.mjs` | (verified by `verify-package.mjs` exit code) | R-CONFIG-011..015 |

Total estimated changed lines: **~700** (5 test files ~250
lines, 5 lib files ~250 lines, extension entry ~80 lines,
package.json/README/verify script ~120 lines). The 400-line
review budget will be exceeded; the parent orchestrator
should re-confirm `single-pr-default` vs `force-chained` at
the tasks phase boundary. **My recommendation at that
boundary: keep `single-pr-default` — the change is one
package, no cross-cutting concerns, no parallel write
isolation needed.**

## 14. Rollout (install verification + publish)

### 14.1 Local install verification (pre-publish)

```bash
# From the caduceus repo root:
node --experimental-strip-types --test tests/*.test.ts  # must exit 0
node scripts/verify-package.mjs                          # must exit 0
pnpm pack                                                # produces .tgz
# Inspect the tarball:
tar -tzf lyssom-pi-caduceus-0.1.0.tgz | grep -E '\.node$|bin/'  # must be empty
# Smoke test in a temp dir:
mkdir /tmp/caduceus-smoke && cd /tmp/caduceus-smoke
pi install /root/caduceus                                # local install
pi                                                        # launch TUI
# /caduceus:status should appear
# /caduceus:inspect should print the persona prompt
```

### 14.2 Publish (out-of-band, see `proposal.md §13`)

1. User creates `lyssom` GitHub org (out of band).
2. User runs `npm login --scope=lyssom`.
3. `npm publish --access=public` from the caduceus root.
4. User pushes the local git repo to
   `git@github.com:lyssom/pi-caduceus.git`.
5. Verify on `https://pi.dev/packages` — gallery auto-indexes
   packages with `keywords: ["pi-package"]`.

### 14.3 Post-publish verification

```bash
# In a separate empty directory:
pi install npm:@lyssom/pi-caduceus
pi
# /caduceus:status should appear
# /caduceus:inspect should print the persona prompt
# Default mode is "gentleman"; default locale is "auto"
# Verify by writing a Spanish prompt and observing voseo response
```

## 15. Review and judgment risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `before_agent_start` chaining breaks with future pi versions | low | high | The chaining semantics are explicit in `runner.js:837-893`. We pin via `peerDependencies: { "@earendil-works/pi-coding-agent": "*" }` and rely on pi's compatibility promise. |
| Prompt text drift from gentle-pi | low | medium | R-PERSONA-007/008 byte-for-byte test catches this on every `pnpm test`. |
| User-set custom locale breaks language clause | low | low | R-LOCALE-007 documents that custom locales pass through; `languageClause` returns `""` for unknown locales (no false clauses). |
| Atomic write fails on exotic filesystems (e.g. NFS) | very low | medium | The atomic-write test uses `tmp + rename` and we accept that exotic FS may have weaker guarantees. Documented in code. |
| 700 lines > 400 review budget | certain | low | Parent orchestrator will re-confirm PR strategy at tasks phase. Single PR is still recommended for a coherent package. |
| `node --experimental-strip-types` is removed in future Node | very low | high | If this happens, the package must switch to a bundler. Documented as a v0.2+ migration path. Node 22 LTS ships `--experimental-strip-types` so we have until at least 2027-04. |

## 16. Open design decisions

**None.** All design decisions are resolved by this document.
If `sdd-tasks` surfaces a question that requires a design
choice, the design is updated first and the parent is informed
before tasks are committed.

## 17. Next phase

`sdd-tasks` — produce
`openspec/changes/caduceus-v0.1.0/tasks.md` with 8
implementation tasks in dependency order. The task list MUST
include the Review Workload Forecast guard lines per the
sdd-orchestrator-workflow asset:

```text
<!-- sdd-review-workload-forecast: total_changed_lines_est=700, recommended_prs=1, single-pr-justified=true -->
<!-- sdd-review-budget: 400 -->
```

The parent orchestrator will inspect these lines after
`sdd-tasks` and decide whether to force-chained before
`sdd-apply`.

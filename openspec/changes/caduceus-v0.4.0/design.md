# caduceus v0.4.0 — Design

> **Status:** Design complete. Awaiting `tasks` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.4.0`
> **Source contracts:** [`proposal.md`](./proposal.md),
> [`design-v0.3.1`](./caduceus-v0.3.1/design.md)

## 1. Purpose

Translate the v0.4.0 proposal into a concrete technical design
covering the profile system and the persona macros.

## 2. Module map (delta from v0.3.1)

```text
caduceus/
├── extensions/caduceus.ts        # MODIFIED — wire 5 new slash commands + macro resolution
├── lib/
│   ├── ...
│   ├── profile-store.ts          # NEW — list/save/load/delete profiles
│   ├── macros.ts                 # NEW — resolveMacros(content, ctx) → string
│   └── lint.ts                   # MODIFIED — rename MODE_PLACEHOLDER → PLACEHOLDER, validate macro names
│
├── tests/                        # 11 existing + 2 new
│   ├── ...
│   ├── profile-store.test.ts     # NEW
│   └── macros.test.ts            # NEW
```

**New files:** 4 (2 in `lib/`, 2 in `tests/`)
**Modified files:** 3 (extensions + lint + a few tests)

## 3. New types (delta)

```ts
// lib/profile-store.ts (new exports)
export type ProfileName = string;

export type Profile = {
  mode: PersonaMode;
  locale: LocalePreference;
  systemPromptMode: SystemPromptMode;
  persona: PersonaName;
  // Future extensions: showStatusBar, allowProjectOverride — optional
};

export const DEFAULT_PROFILE: Profile = {
  mode: "default",
  locale: "auto",
  systemPromptMode: "append",
  persona: "default",
};

export function listProfiles(cwd: string, home?: string): ProfileName[];
export function loadProfile(
  name: ProfileName,
  cwd: string,
  home?: string,
): Profile;  // throws CaduceusProfileNotFoundError
export function saveProfile(
  name: ProfileName,
  profile: Profile,
  cwd: string,
  home?: string,
): Promise<void>;
export function deleteProfile(
  name: ProfileName,
  cwd: string,
  home?: string,
): Promise<void>;
export function profileFilePath(
  name: ProfileName,
  scope: "global" | "project",
  cwd: string,
  home?: string,
): string;

// lib/macros.ts (new exports)
export type MacroContext = {
  userName: string;
  projectName: string;
  cwd: string;
  date: string;     // YYYY-MM-DD
  os: NodeJS.Platform;
};

export function buildMacroContext(cwd: string): MacroContext;
export function resolveMacros(content: string, ctx: MacroContext): string;
export const SUPPORTED_MACROS: ReadonlySet<string>;
```

## 4. Profile system

### 4.1 File paths

```
~/.pi/agent/caduceus/profiles/<name>.json    (global)
.caduceus/profiles/<name>.json              (project)
```

Precedence: project > global (same as `.caduceusrc`).

`listProfiles(cwd, home)` returns the union (deduped with
project shadowing global).

### 4.2 Profile schema

A profile is a JSON subset of `CaduceusConfig`:

```ts
type Profile = {
  mode: "default" | "plain" | "auto";
  locale: "auto" | "es-AR" | "es-ES" | "en" | "zh" | string;
  systemPromptMode: "append" | "replace";
  persona: string;
};
```

The `loadProfile` function reads the file and validates the
schema. If invalid, throws `CaduceusProfileError`.

### 4.3 Slash commands

The `/caduceus:profile` command takes a subcommand:

```
/caduceus:profile list
/caduceus:profile save <name>
/caduceus:profile load <name>
/caduceus:profile delete <name>
/caduceus:profile show <name>
```

The handler parses the first argument as the subcommand and the
rest as the name. For example, `/caduceus:profile save work`
parses as `subcommand="save"`, `name="work"`.

### 4.4 State flow

```text
/caduceus:profile save <name>
  → read current effective config (via deps.readConfig)
  → build a Profile from it
  → saveProfile(name, profile, cwd, home)
  → notify "profile '<name>' saved"

/caduceus:profile load <name>
  → loadProfile(name, cwd, home)
  → for each field, call writeGlobalConfigField(field, value)
  → the mutation triggers re-load of effective config
  → notify "profile '<name>' loaded"
```

The `load` path uses the existing `writeGlobalConfigField` dep,
which already triggers the migration map. So a v0.2.0→v0.3.x
config is auto-migrated before the profile is loaded.

### 4.5 Profile name validation

Profile names use the same regex as persona names (lowercase,
digits, dashes, underscores). The lint check on `${name}` would
also be applied to profile names — a profile named `default`
would shadow the default config silently. To prevent confusion,
the slash command rejects names that match built-in persona names
(`default`, `plain`, `concise`, `reviewer`, `teacher`, `security`,
`debugger`, `socratic`, `architect`, `pirate`).

## 5. Persona macros

### 5.1 Supported macros

| Macro | Value | Source |
|---|---|---|
| `${userName}` | OS user | `process.env.USER ?? process.env.USERNAME ?? "user"` |
| `${projectName}` | basename of cwd | `path.basename(process.cwd())` |
| `${cwd}` | current dir | `process.cwd()` |
| `${date}` | today (ISO) | `new Date().toISOString().slice(0, 10)` |
| `${os}` | platform | `process.platform` |
| `${mode}` | current mode | (unchanged from v0.1.0) |

The `SUPPORTED_MACROS` set is `{"userName", "projectName", "cwd", "date", "os", "mode"}`.

### 5.2 Resolution

```ts
export function resolveMacros(content: string, ctx: MacroContext): string {
  return content
    .replace(/\$\{userName\}/g, ctx.userName)
    .replace(/\$\{projectName\}/g, ctx.projectName)
    .replace(/\$\{cwd\}/g, ctx.cwd)
    .replace(/\$\{date\}/g, ctx.date)
    .replace(/\$\{os\}/g, ctx.os);
}
```

The `${mode}` placeholder is handled separately (in the extension
entry's `before_agent_start`, not in `resolveMacros`). This keeps
the macro resolution library independent of the mode system.

### 5.3 Lint update

The `MODE_PLACEHOLDER` check is renamed to `PLACEHOLDER`:

```ts
const checkPlaceholders: CheckFn = (content) => {
  // ${mode} is required (v0.1.0 invariant)
  if (!content.includes("${mode}")) {
    return {
      severity: "error",
      check: "PLACEHOLDER",
      message: "Persona must contain the '${mode}' placeholder.",
    };
  }
  // Find all ${...} patterns
  const allowed = new Set(["mode", "userName", "projectName", "cwd", "date", "os"]);
  const matches = content.match(/\$\{[^}]+\}/g) ?? [];
  for (const m of matches) {
    const name = m.slice(2, -1);  // strip `${` and `}`
    if (!allowed.has(name)) {
      return {
        severity: "warning",
        check: "PLACEHOLDER",
        message: `Unknown macro '${m}'. Supported macros: ${[...allowed].join(", ")}.`,
      };
    }
  }
  return null;
};
```

### 5.4 Built-in persona updates

We add at most 1 macro reference to each built-in persona to
demonstrate the feature. The default persona gets:
`"You are running under caduceus (the persona contract package),
not as a generic assistant. When asked who you are, say so
explicitly. The active persona is visible in `/caduceus:status`."`

This is unchanged for v0.4.0. We do NOT add macros to built-in
personas by default — the macro feature is opt-in for user
personas.

Wait, the user said "use the persona macros" — do we want
built-in personas to use the macros? Let me re-read the spec.

Looking at the proposal: "Built-in personas gain 0-1 macro
references (max); user personas can use as many as they want."

So built-in personas can have 0 or 1 macro reference. In v0.4.0,
none of the built-in personas use macros (they're all 0). This
keeps the v0.3.0 personas unchanged. User personas can use macros.

If we want to demonstrate macros, we can add a v0.4.0 example
persona (e.g., "context-aware" that includes `${projectName}`).
But the spec says built-ins can have 0-1 macros, so we can also
add 1 macro to one of the existing personas. Let me add a single
macro reference to the `default` persona: "You are working on
\`${projectName}\`." in the persona block. This demonstrates the
feature without changing the persona's overall character.

Actually, the proposal's success criteria says:
> Built-in personas may use 0-1 macro references (max 1 for v0.4.0 to keep the default persona clean)

So max 1 macro reference per built-in. Let me add 1 macro to the
`default` persona (just one, to demonstrate the feature).

### 5.5 Extension entry integration

The `before_agent_start` handler changes:

```ts
pi.on("before_agent_start", async (event, _ctx) => {
  const cfg = effective?.config ?? DEFAULT_CONFIG;
  const mode: PersonaMode = cfg.mode === "plain" ? "plain" : "default";

  // Load persona (existing logic)
  // ...

  // Resolve macros
  const macroCtx = buildMacroContext(cwd ?? process.cwd());
  const resolved = resolveMacros(loadedPersona.content, macroCtx);
  const withMode = resolved.split("${mode}").join(mode);
  const persona = withMode.trim();

  return {
    systemPrompt: composeSystemPrompt(...)
  };
});
```

The `cwd` is read from `process.cwd()` (the actual current dir,
not the config's cwd field, for simplicity).

## 6. Updated slash commands

| Command | Description |
|---|---|
| `/caduceus:profile list` | Show all available profiles. |
| `/caduceus:profile save <name>` | Save current config as `<name>`. |
| `/caduceus:profile load <name>` | Load `<name>` into the running config. |
| `/caduceus:profile delete <name>` | Delete `<name>`. |
| `/caduceus:profile show <name>` | Show `<name>`'s contents. |

Total: 9 + 5 = 14 slash commands (was 9 in v0.3.1).

## 7. Test strategy

### 7.1 New test files

- `tests/profile-store.test.ts` (~120 lines):
  - listProfiles returns global + project names, project shadows global
  - loadProfile returns the profile contents
  - loadProfile throws CaduceusProfileNotFoundError for missing
  - saveProfile writes the file (with mkdir -p)
  - deleteProfile removes the file
  - profileFilePath returns the correct path
- `tests/macros.test.ts` (~80 lines):
  - resolveMacros replaces each macro with the value
  - resolveMacros leaves non-macro text unchanged
  - buildMacroContext extracts user / projectName / cwd from
    process state
  - SUPPORTED_MACROS contains the expected keys

### 7.2 Modified test files

- `tests/lint.test.ts`: rename `MODE_PLACEHOLDER` test to
  `PLACEHOLDER`. Add 1 test for unknown macro warning.
- `tests/slash-commands.test.ts`: add 5 tests for `/caduceus:profile`
  + 1 test for macro resolution in `/caduceus:inspect`.
- `tests/extension-entry.test.ts`: add 1 test for profile load
  triggering re-load of the active persona.

### 7.3 Test count growth

- v0.3.1: 156 tests
- v0.4.0: ~180 tests (+24: 12 profile-store + 4 macros + 5 profile slash + 3 misc)

## 8. Backward compatibility

| v0.3.1 behavior | v0.4.0 behavior | Change? |
|---|---|---|
| Persona prompts are static | Persona prompts can have `${userName}` etc. substituted | **Internal change** (additive) |
| Config is a single object | Config can be saved/loaded as profiles | **Add commands** (no breaking change) |
| Lint check MODE_PLACEHOLDER | Lint check PLACEHOLDER (more permissive) | **Renamed** (test names change, internal API change) |
| 9 slash commands | 14 slash commands | **Add 5** (profile) |
| Built-in personas unchanged | Built-in personas unchanged (or add 1 macro to default) | **No change** for non-default |

## 9. Risks (carried + new)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 (NEW) | Profile name conflicts with a built-in persona name | Slash command rejects profile names matching built-in persona names |
| R-2 (NEW) | User grants a profile name with `/` or `..` path traversal | Validate against regex (same as persona names) |
| R-3 (NEW) | Profile load fails mid-write (atomicity) | Atomic write via tmp + rename (same pattern as config-store) |
| R-4 (carried) | Custom personas without `${mode}` placeholder | Lint check unchanged |
| R-5 (LOW) | Macro resolution is slow for large personas | Single regex pass per macro; max 6 macros; negligible |

## 10. Next phase

`sdd-tasks` — produce
`openspec/changes/caduceus-v0.4.0/tasks.md` with 8 implementation
tasks. Estimated 500 lines, over 400 budget; size-exception
proposed.

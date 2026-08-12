# Exploration: caduceus v0.1.0

> **Status:** Exploration complete. Awaiting `proposal` phase.
> **Date:** 2026-01
> **Source contracts:** [`INIT.md`](../../../INIT.md), [`AGENTS.md`](../../AGENTS.md), [`openspec/config.yaml`](../../config.yaml)
> **Engine snapshot:** `@earendil-works/pi-coding-agent` **v0.84.1**, `@earendil-works/pi-tui` v0.83.0

## 1. Executive summary

The MVP-A scope from `INIT.md §3.1` is **fully achievable** on the current
`pi-coding-agent` 0.84.1 surface. Every promised capability maps to a
documented API. Three risks are de-risked, one remains open. The package
can ship with **0 runtime dependencies and 1 peer dependency**
(`@earendil-works/pi-coding-agent`). It does not need `@earendil-works/pi-tui`
in v0.1.0 because the status bar uses the built-in `ctx.ui.setStatus()`
(text-only) — no `Component` factories required.

**Recommendation:** proceed to `sdd-proposal` with the architecture
described in `INIT.md §5` largely intact, plus three small additions
surfaced below.

## 2. Project context recap (no new decisions)

| Topic | Source | Status |
|---|---|---|
| Locked decisions | `INIT.md §1` | All four unchanged |
| MVP scope | `INIT.md §3.1` | Re-confirmed |
| Anti-goals | `INIT.md §10` | Re-confirmed |
| Open questions resolved | `init.md §6` | 5/7 closed (B1, B2, B3, B4, B5) |
| Open questions still open | `init.md §6` | #5 (logo), #6 (UI i18n), #7 (status bar default) |

## 3. Dependency surface — the real pi-coding-agent 0.84.1 API

Verified against the installed copy at
`/usr/lib/node_modules/@earendil-works/pi-coding-agent` (v0.84.1).
Source: `dist/index.d.ts`, `dist/core/extensions/types.d.ts`,
`dist/core/extensions/runner.js`, `docs/extensions.md`.

### 3.1 What caduceus must import

| Symbol | Source | Why we need it |
|---|---|---|
| `ExtensionAPI` (type) | `@earendil-works/pi-coding-agent` | Type the factory parameter `function(pi: ExtensionAPI)` |
| `ExtensionContext` (type) | `@earendil-works/pi-coding-agent` | Type the event handler context for some events |
| `BeforeAgentStartEvent` (type) | `@earendil-works/pi-coding-agent` | Type the `before_agent_start` event payload |

**That is the entire import surface for v0.1.0.** No `pi-tui`, no
`pi-ai`, no `typebox`. The slash-command UI uses
`ctx.ui.notify()` (string) and `ctx.ui.confirm()` (boolean) — no
custom components.

### 3.2 What caduceus registers

```ts
export default function caduceus(pi: ExtensionAPI): void {
  // 1. Status bar — fires once per session start
  pi.on("session_start", async (_event, ctx) => {
    if (readConfig().showStatusBar) {
      ctx.ui.setStatus("caduceus", formatStatusLine(readConfig()));
    }
  });

  // 2. Persona injection — fires before every LLM call
  pi.on("before_agent_start", async (event, ctx) => {
    const persona = buildPersonaPrompt(
      readConfig().mode,
      detectLocale(event.prompt, ctx.cwd, readConfig().locale),
    );
    return { systemPrompt: `${event.systemPrompt}\n\n${persona}` };
  });

  // 3. Slash commands
  pi.registerCommand("caduceus:status",  { description, handler });
  pi.registerCommand("caduceus:mode",    { description, handler });
  pi.registerCommand("caduceus:locale",  { description, handler });
  pi.registerCommand("caduceus:inspect", { description, handler });
}
```

### 3.3 The `before_agent_start` chaining contract — verified

The runner code at `dist/core/extensions/runner.js:837-893`
(`emitBeforeAgentStart`) implements chaining as **last-writer-wins,
but the next extension reads the latest value**:

```text
currentSystemPrompt := systemPrompt
for ext in extensions:
    for handler in ext.handlers["before_agent_start"]:
        event.systemPrompt := currentSystemPrompt   # fresh snapshot
        result := await handler(event, ctx)
        if result.systemPrompt !== undefined:
            currentSystemPrompt := result.systemPrompt
return currentSystemPrompt
```

Implication for caduceus:

- We read `event.systemPrompt` (the latest value from any prior extension)
- We append `\n\n${personaPrompt}` to it
- We return `{ systemPrompt: combined }`
- Any extension that runs after us sees the persona injected
- Any extension that runs before us can also be chained (their prompt
  is preserved if we read it back)

This is **safe to compose with gentle-pi** if a user happens to have
both installed — caduceus's persona segment lands at the end, gentle-pi's
land where it always lands, both visible to the model.

### 3.4 Pi package manifest — the canonical shape

From `docs/packages.md` and the
`@earendil-works/pi-coding-agent/examples/extensions/gondolin/package.json`
example:

```json
{
  "name": "pi-caduceus",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "keywords": ["pi-package", "pi", "pi-coding-agent", "caduceus",
               "persona", "prompt-orchestration"],
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  },
  "peerDependenciesMeta": {
    "@earendil-works/pi-coding-agent": { "optional": true }
  },
  "pi": {
    "extensions": ["./extensions"],
    "themes":    ["./themes"],
    "prompts":   ["./prompts"]
  },
  "files": [
    "extensions/", "lib/", "prompts/", "themes/",
    "tests/", "scripts/", "README.md", "LICENSE"
  ]
}
```

Notes:

- `type: "module"` is required (matches gentle-pi + gondolin).
- `peerDependencies: { "@earendil-works/pi-coding-agent": "*" }` is
  the pi convention per `docs/packages.md`; `optional: true` so the
  package still installs when pi is not yet present (e.g. CI builds).
- No `dependencies` block at all (0 runtime deps).
- No `devDependencies` block required; test runner is the system Node.
- `pi.extensions` is `["./extensions"]` (directory, not a single file) —
  pi auto-loads every `.ts`/`.js` file in there. We only ship one
  (`extensions/caduceus.ts`), but using the directory form future-proofs
  v0.2+ if we split.
- `pi.themes` and `pi.prompts` are arrays of paths; conventional
  directories also work without the manifest, but explicit is better.

## 4. Prior art — gentle-pi `extensions/gentle-ai.ts`

Snapshot: `gentle-pi` **v2.1.2** at
`/root/.pi/agent/npm/node_modules/gentle-pi/extensions/gentle-ai.ts`.

### 4.1 The persona prompt body — verbatim citations

**`gentleman` mode persona block** (lines 258–266):

```text
Persona:
- Be direct, technical, and concise.
- Always respond in the same language the user writes in.
- When the user writes Spanish, answer in natural Rioplatense Spanish with voseo.
- Act as a senior architect and teacher: concepts before code, no shortcuts.
- Treat AI as a tool directed by the human; never present yourself as a default chatbot.
- Push back when the user asks for code without enough context or understanding.
- Correct errors directly, explain why, and show the better path.
```

**`neutral` mode persona block** (lines 268–277):

```text
Persona:
- Be direct, technical, concise, warm, and professional.
- Always respond in the same language the user writes in.
- Do not use slang or regional expressions.
- When the user writes Spanish, use neutral/professional Spanish. Do NOT use voseo (vos tenés, vos querés, hacé, andá, etc.) or any regional conjugations.
- Act as a senior architect and teacher: concepts before code, no shortcuts.
- Treat AI as a tool directed by the human; never present yourself as a default chatbot.
- Push back when the user asks for code without enough context or understanding.
- Correct errors directly, explain why, and show the better path.
```

**Identity contract** (lines 280–294): the el Gentleman identity block
that goes BEFORE the persona block. The full `buildGentlePrompt()`
function composes: identity → persona → language boundary → harness
principles (lines 286–308).

### 4.2 The `before_agent_start` injection point (lines 6129–6151)

```ts
pi.on("before_agent_start", async (event, ctx) => {
    // ... SDD preflight logic ...
    const gentlePrompt = isNamedAgent || isSddAgent
        ? ""
        : `\n\n${buildGentlePrompt(readPersonaMode(ctx.cwd))}`;
    return {
        systemPrompt: `${event.systemPrompt}${gentlePrompt}${sddPrompt}${nativeStatusPrompt}`,
    };
});
```

Caduceus replicates the **non-SDD, non-named-agent** branch only — that
is, the `gentlePrompt` interpolation. The SDD/native status parts are
deliberately left to gentle-pi.

### 4.3 What caduceus should reuse vs. own

| Concept | Reuse from gentle-pi? | Why |
|---|---|---|
| Persona prompt text | **Yes** — start from gentle-pi's text, adapt wording | Gentle-pi's text is already battle-tested. Identity and voseo clause must stay verbatim to satisfy AGENTS.md invariants 1–3. |
| Identity contract | **Yes** — same text, same place | Same reason. |
| Persona mode storage (`readPersonaMode`) | **No** — own it | Gentle-pi uses a multi-key global store with SDD-preflight entanglement. Caduceus is single-purpose: one JSON file at `~/.pi/agent/caduceus.json` + optional `.caduceusrc`. |
| `buildGentlePrompt` orchestrator wrapper | **No** — own a narrower version | Caduceus is one mode, no SDD, no native status. Strip 80% of the wrapper. |
| Theme color palette | **No** — sea blue, not rose | Brand separation per `INIT.md §6`. |
| Test fixtures (`PRE_*` strings) | **Borrow the assertion shape only** | We do not need byte-for-byte migration tests; we need the **same invariants** to hold. |

### 4.4 What gentle-pi does that caduceus must NOT do

- ❌ Touch `gentle-ai` native review CLI / postinstall
- ❌ Run SDD preflight on the user
- ❌ Inject native status prompts
- ❌ Manage named agents or subagent dispatch
- ❌ Block tool calls (`tool_call` event) for review
- ❌ Manage `~/.pi/agent/gentle-ai/` runtime directory

The single boundary line: **caduceus is the persona segment, nothing
else**.

## 5. Test posture

Mirror gentle-pi (`tests/persona-single-channel.test.ts`,
`tests/persona-neutral-voseo.test.ts`,
`tests/artifact-language.test.ts`) with these adjustments:

### 5.1 The five test files (v0.1.0)

| File | Asserts |
|---|---|
| `tests/persona-contract.test.ts` | AGENTS.md invariants 1, 2, 3 (gentleman has voseo, neutral has do-not-voseo, no cross-leakage) |
| `tests/language-clause.test.ts` | Locale detection produces the right clause for `es-AR`, `es-ES`, `en`, `zh`, `auto` |
| `tests/locale-detect.test.ts` | Pure function: given text + config + env, returns the resolved locale |
| `tests/config-store.test.ts` | Read/write `caduceus.json`, project `.caduceusrc` override, atomic write, malformed JSON rejection |
| `tests/slash-commands.test.ts` | Each of the 4 commands wires correctly to its handler, given a stub `ExtensionCommandContext` |

### 5.2 First test must be RED

Per `INIT.md §9.4`, the first committed test in `tests/` MUST be a
failing `persona-contract.test.ts`. The TDD sequence is:

```text
1. RED      — write persona-contract.test.ts against a NOT-YET-EXISTENT lib/persona-contract.ts
2. GREEN    — implement the minimum to pass
3. TRIANGULATE — add a second test that forces a more general implementation
                (e.g. add a third mode stub → triggers refactor toward a table-driven contract)
4. REFACTOR — clean up, all tests still green
```

The test runner is `node --experimental-strip-types --test tests/*.test.ts`
(per `openspec/config.yaml`). It runs without any third-party
dependency. Mirrors gentle-pi exactly.

### 5.3 No fixtures for prompt bodies

Gentle-pi freezes pre-change wrapper text as `PRE_*` string fixtures.
Caduceus does NOT need this — the persona prompt text is read from
`prompts/gentleman.md` and `prompts/neutral.md`, and the test asserts
**the rendered prompt contains the invariant clauses** (not byte-stable
text). This is the correct falsifiable test per DNA-2 in `INIT.md §4`.

## 6. Theme constraints

Theme JSON shape verified against
`/root/.pi/agent/npm/node_modules/gentle-pi/themes/Gentle.json` and
`/usr/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.d.ts`.

### 6.1 Schema (two layers)

**Layer 1 — `vars`**: a flat color palette. Each key is a name, value
is a hex string or a reference to another key. Names are conventions;
pi's theme engine treats them as a lookup table.

**Layer 2 — `colors`**: maps semantic `ThemeColor` / `ThemeBg` slots
(`accent`, `border`, `success`, `mdHeading`, etc.) to either a
`var` name (string) or a literal hex. The set of valid slots is
defined by the `ThemeColor` and `ThemeBg` type unions in
`dist/modes/interactive/theme/theme.d.ts`.

**`$schema`** is a string URL pointing at the upstream JSON schema. It
is documentation, not enforced at runtime by pi, but VS Code and other
editors with JSON-Schema support use it for autocomplete. Worth
including.

**`name`** is required (the human-readable theme name).

### 6.2 Caduceus sea-blue theme — minimal viable palette

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "Caduceus",
  "vars": {
    "bg":         "#0E1620",
    "bgPanel":    "#0E1620",
    "bgElement":  "#16202C",
    "bgSubtle":   "#0A121B",
    "border":     "#1F2E40",
    "borderSubtle":"#16202C",
    "text":       "#E6EEF6",
    "muted":      "#7A8A9C",
    "dim":        "#5C6B7C",
    "disabled":   "#5C6B7C",
    "accent":     "#1B4D7A",
    "secondary":  "#7FB3D5",
    "heading":    "#7FB3D5",
    "syntaxComment":"#7A8A9C",
    "syntaxKeyword":"#1B4D7A",
    "syntaxFunction":"#7FB3D5",
    "syntaxString":"#5C9EAD",
    "syntaxNumber":"#4A8FB8",
    "syntaxType": "#7FB3D5",
    "syntaxPunctuation":"#7A8A9C",
    "syntaxOperator": "#4A8FB8",
    "syntaxVariable": "#E6EEF6",
    "green":      "#5A9E7A",
    "warning":    "#D4A656",
    "red":        "#C2566A",
    "brightBlack":"#7A8A9C",
    "selection":  "#1F2E40",
    "toolSuccessBg":"#1A2E1A",
    "toolPendingBg":"#0E1620",
    "toolErrorBg":  "#2E1A1A",
    "infoBg":     "#0E1620"
  },
  "colors": {
    "accent": "accent",
    "border": "border",
    "borderAccent": "accent",
    "borderMuted": "borderSubtle",
    "success": "green",
    "error": "red",
    "warning": "warning",
    "muted": "muted",
    "dim": "dim",
    "text": "text",
    "thinkingText": "muted",
    "selectedBg": "selection",
    "userMessageBg": "bgElement",
    "userMessageText": "text",
    "customMessageBg": "bgSubtle",
    "customMessageText": "text",
    "customMessageLabel": "accent",
    "toolPendingBg": "toolPendingBg",
    "toolSuccessBg": "toolSuccessBg",
    "toolErrorBg": "toolErrorBg",
    "toolTitle": "accent",
    "toolOutput": "text",
    "mdHeading": "heading",
    "mdLink": "secondary",
    "mdLinkUrl": "muted",
    "mdCode": "green",
    "mdCodeBlock": "text",
    "mdCodeBlockBorder": "borderSubtle",
    "mdQuote": "warning",
    "mdQuoteBorder": "borderSubtle",
    "mdHr": "muted",
    "mdListBullet": "accent",
    "toolDiffAdded": "green",
    "toolDiffRemoved": "red",
    "toolDiffContext": "muted",
    "syntaxComment": "syntaxComment",
    "syntaxKeyword": "syntaxKeyword",
    "syntaxFunction": "syntaxFunction",
    "syntaxVariable": "syntaxVariable",
    "syntaxString": "syntaxString",
    "syntaxNumber": "syntaxNumber",
    "syntaxType": "syntaxType",
    "syntaxOperator": "syntaxOperator",
    "syntaxPunctuation": "syntaxPunctuation",
    "thinkingOff": "borderSubtle",
    "thinkingMinimal": "dim",
    "thinkingLow": "muted",
    "thinkingMedium": "secondary",
    "thinkingHigh": "accent",
    "thinkingXhigh": "secondary",
    "bashMode": "accent"
  }
}
```

This is enough for v0.1.0. The optional `export` block (CSS export
for HTML rendering) can be added in v0.1.1.

## 7. Prompt template files

`prompts/gentleman.md` and `prompts/neutral.md` are loaded by
`persona-contract.ts` at runtime. Pi's `pi-coding-agent` itself does
not load these — caduceus does, and injects the rendered text via
`before_agent_start`. The prompt files are **plain markdown**, not
typed templates.

Suggested structure (gentleman.md, ~60 lines):

```text
# el Gentleman persona — gentleman mode

> Loaded by caduceus at runtime. The `lib/persona-contract.ts` module
> reads this file, joins it with the active language clause, and the
> result is appended to the system prompt via `before_agent_start`.

## Identity contract

(verbatim from gentle-pi line 282–294)

## Persona

(verbatim from gentle-pi line 258–266)

## Language boundary

The active language clause is appended at runtime by
`language-clause.ts`, not embedded here. This keeps locale detection
testable as a pure function.
```

`prompts/neutral.md` follows the same structure with the neutral-mode
persona block.

Why split the file from the language clause? DNA-2 (`INIT.md §4`):
**persona is a contract, not a costume**. The persona is fixed;
language is dynamic. Separating them means `language-clause.ts` can be
unit-tested without touching the file system.

## 8. The two open decisions — proposal question round

Per `sdd-proposal.md`'s interactive-mode rule, the proposal phase
should ask 3–5 concrete product questions. Two of those questions
must cover the open decisions still pending:

### 8.1 Question A — Status bar default (`init.md §6 #7`)

Should `showStatusBar` default to `true` or `false`?

| Option | Pros | Cons |
|---|---|---|
| `true` (on by default) | Caduceus is a **visible** persona layer; status makes it discoverable | Visual clutter; one more line in the footer; users who don't know what it is may try to disable it |
| `false` (off by default) | Non-intrusive; opt-in via `/caduceus:mode` toggle | Caduceus becomes invisible; users who never run a slash command may not realize it is installed |

**Recommendation:** `false` (off by default) with a one-liner in
the README. The `session_start` event will still register the
status bar hook, but `ctx.ui.setStatus("caduceus", undefined)`
leaves the footer untouched. The `/caduceus:status` command shows
the current effective prompt in TUI.

### 8.2 Question B — UI i18n (`init.md §6 #6`)

Are English-only slash-command output strings OK for v0.1.0?

| Option | Pros | Cons |
|---|---|---|
| English-only | Smaller surface; faster ship; matches the `English-only UI in v0.1.0` statement already in `INIT.md §3.2` | Spanish-speaking users see English slash-command output |
| Spanish + English | The `gentleman` mode is Spanish-aware; matching UI is consistent | More test surface, more docs surface, more locale-handling logic |

**Recommendation:** English-only for v0.1.0, deferred to v0.1.1
documented as a roadmap item. Matches `INIT.md §3.2` (multilingual
UI strings explicitly out of scope).

### 8.3 Question C — Logo / banner (`init.md §6 #5`)

Pi gallery cards accept `image` / `video` in the `pi` manifest. We
have neither yet. Three sub-options:

| Option | Pros | Cons |
|---|---|---|
| Ship v0.1.0 with no image | No blocker; card shows just text | Card looks bare next to gentle-pi (which has `gentle-logo-only.png`) |
| Generate a temporary text-only banner (`text-as-image` via `<svg>` rendered to PNG) | Card is not empty | Effort; banner art may not match the brand |
| Defer to v0.1.1 and ship text-only | Cleanest | Bare card on launch |

**Recommendation:** ship text-only card for v0.1.0, design
banner in v0.1.1. The `image` / `video` fields are optional in
the `pi` manifest; omitting them is supported.

## 9. Risk updates

| ID | From `init.md §7` | Status after exploration | New state |
|---|---|---|---|
| R-1 (high) | `pi-coding-agent` extension API not snapshotted | **DE-RISKED** — full API surface read from `dist/index.d.ts` and `dist/core/extensions/types.d.ts` at v0.84.1; runner chaining verified by reading `dist/core/extensions/runner.js:837-893` | Resolved |
| R-2 (medium) | `pi-tui` peer may not be re-exported as a peer | **DE-RISKED** — v0.1.0 does not need `pi-tui`; the status bar uses `ctx.ui.setStatus()` (text), no `Component` factory required. If we add a custom widget later, we can revisit. | Resolved |
| R-3 (medium) | `lyssom` GitHub org does not exist; gh token lacks `admin:org` | **RESOLVED post-apply** — caduceus switched to unscoped npm name `pi-caduceus`; repo goes under existing `lyssom` GitHub user account, no org needed. Out-of-band: `gh repo create lyssom/pi-caduceus --public --source=. --remote=origin --push`. | Resolved |
| R-4 (low) | `pnpm@11.1.1` may not be installed on the apply host | **UNCHANGED** — apply phase checks `which pnpm`; falls back to `npm` if missing, but the test runner does not actually need pnpm (it uses `node --test` directly). Update: pnpm is only needed if a user wants `pnpm test` as the canonical command; we will document both `pnpm test` and `node --experimental-strip-types --test tests/*.test.ts`. | Remains, downgraded to "cosmetic" |

New risks surfaced during exploration:

- **R-5 (low):** the `pi` manifest `image` field requires an absolute
  HTTPS URL. We do not have a CDN yet. **Mitigation:** omit the
  `image` field for v0.1.0; add in v0.1.1 when the banner lands.
- **R-6 (low):** `pnpm` is listed in `INIT.md §1.4` as the package
  manager convention, but the test command does not need pnpm. We
  will keep `pnpm` in the lockfile metadata for ecosystem alignment
  but `package.json` should NOT have a `packageManager` field that
  breaks `npm install` for users who don't have pnpm. **Decision:**
  omit `packageManager` from `package.json`; keep pnpm as the
  recommended dev workflow in README only.

## 10. What `sdd-proposal` must decide

1. **Module split**: confirm the seven `lib/*.ts` files in `INIT.md §5.1`
   are the right boundary. (My read: yes, but `status-bar.ts` may
   collapse into `slash-commands.ts` since it only does a one-line
   `setStatus` call.)
2. **Config file format**: JSON strict, or JSONC (with comments)? My
   read: JSONC for `.caduceusrc` (humans edit it), strict JSON for
   `~/.pi/agent/caduceus.json` (machine-managed). `JSON.parse` with
   a tolerant `// strip comments` preprocessor.
3. **Locale detection order**: text content → `process.env.LANG` →
   `process.env.LC_ALL` → config `locale: "auto"` default → fall back
   to `en`. Document and test each branch.
4. **`/caduceus:inspect` output format**: text with line numbers
   (markdown-friendly) or JSON? My read: text with line numbers, since
   `caduceus inspect` is the falsifiability check per DNA-2.
5. **Whether to ship a `README.md` with a `Quick Start` section that
   shows `pi install npm:pi-caduceus` + a screenshot of
   `/caduceus:inspect` output** (text-rendered, not image).

## 11. Recommendation

Proceed to `sdd-proposal` with:

- Architecture in `INIT.md §5` accepted with one small change: merge
  `status-bar.ts` into `extensions/caduceus.ts` (it's three lines).
- All other scope unchanged.
- Three proposal questions (§8 above) raised in the proposal round.

Estimated task count for `sdd-tasks`: **8 implementation tasks**,
each small enough to be one commit. Total expected changed lines:
~600 (well under the 400 review budget after a few natural splits —
likely needs 2 PRs, not 1; the 400 threshold will trip and we
should re-confirm `single-pr-default` vs `force-chained` at the
tasks phase).

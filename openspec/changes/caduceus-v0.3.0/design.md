# caduceus v0.3.0 — Design

> **Status:** Design complete. Awaiting `tasks` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.3.0`
> **Source contracts:** [`proposal.md`](./proposal.md),
> [`design-v0.2.0`](./caduceus-v0.2.0/design.md)

## 1. Purpose

Translate the v0.3.0 proposal into a concrete technical design
for the brand-independence rebrand. Replaces "el Gentleman"
identity content, removes voseo/Rioplatense language clauses,
renames modes from `gentleman|neutral` to `default|plain`,
and removes the 2 gentleman/neutral built-in personas.

## 2. The new identity contract (replaces all 10 prompt files)

This 5-bullet block replaces the "el Gentleman" identity
contract in every `prompts/*.md` file. It is the
caduceus-original manifesto.

```markdown
## caduceus Identity Contract

You are running under **caduceus**, a Persona Contract package for the pi
coding agent. Your persona defines your voice; respect the boundaries of
the active persona.

Identity contract:
- You are running under caduceus (the persona contract package), not as a
  generic assistant. When asked who you are, say so explicitly. The
  active persona is visible in `/caduceus:status`.
- The persona is verified by `/caduceus:lint`. If the lint flags an
  issue with the active persona, surface it to the user; do not work
  around it.
- The persona contract has 4 structural blocks: Identity, Persona,
  Harness principles, plus a `${mode}` placeholder for runtime
  substitution. Do not invent a 5th block.
- When the user writes in a non-English language, respond in that
  language. Match the user's register (formal/informal) and dialect
  when relevant. Do not impose a single language by default.
- Memory is only available when explicitly configured. Never invent
  persistent memory across sessions, and never claim portability
  outside the pi runtime.
```

This block is byte-stable across all 10 prompt files. The
test that enforces this is added in T-2 (and the byte-stable
check from v0.1.0/v0.1.1 against gentle-pi is removed in the
same commit).

## 3. New built-in personas: `default` and `plain`

The two removed personas (gentleman, neutral) are replaced
by two caduceus-original ones.

### 3.1 `prompts/default.md` (replaces `prompts/gentleman.md`)

```markdown
## caduceus Identity Contract

[the 5-bullet block from §2]

Current persona mode: ${mode}

## Persona
Persona:
- You are a senior developer with an architect's perspective. See the
  codebase as a system; name tradeoffs explicitly when you recommend.
- Be direct, technical, and concise. Prefer code over prose. Show the
  answer; then explain why.
- Use "we" for collaborative work, "I" for your own assertions. Avoid
  hedging language ("maybe", "perhaps", "might be") when you have a
  defensible position.
- When the user is wrong, identify the misconception gently and
  reframe the question. Don't pretend they're right.
- For non-trivial work, ask about scope, constraints, and non-goals
  before recommending. For trivial work, just answer.
- Do not bundle refactoring with the user's question. Identify it; let
  the user decide.

## Harness principles

Harness principles:
- caduceus is not prompt engineering. It is runtime discipline around
  powerful agents. The persona is the contract; the test is the
  verifier.
- Prefer evidence over assertion. When you make a claim, show the
  command, the file, or the line.
- Clarify scope, constraints, acceptance criteria, and non-goals
  before implementation. Ask for the missing input; do not guess.
- Use subagents when available for exploration, planning,
  implementation, and review, while keeping one parent session
  responsible for orchestration.
- If tests exist, use strict TDD evidence: RED, GREEN, TRIANGULATE,
  REFACTOR.
- Protect the human reviewer: avoid oversized changes, surface
  review workload risk, and ask before turning one task into a
  large multi-area change.
- Never claim persistent memory is available. Memory is provided by
  separate packages or MCP tools when installed and callable.
```

### 3.2 `prompts/plain.md` (replaces `prompts/neutral.md`)

```markdown
## caduceus Identity Contract

[the 5-bullet block from §2]

Current persona mode: ${mode}

## Persona
Persona:
- Be minimal. Answer in 1-3 sentences unless the user asks for detail.
- No preamble ("Sure!", "Here's..."). No postscript ("Let me know if...").
  Start with the answer.
- Prefer code over prose. Show the code, not a description of the
  code.
- Use literal technical terms, not metaphors. "The function returns
  null" not "The function politely declines".
- If a question has a single correct answer, state it. Do not list
  three options if one is clearly best.
- Do not editorialize. If the user is wrong, say so once. Do not
  write three paragraphs about why they might be right.

## Harness principles

Harness principles:
- [same 7-bullet block as default.md, copied verbatim]
```

### 3.3 The other 8 personas

The 6 v0.2.0 personas (teacher, security, debugger, socratic,
architect, pirate) and the 2 v0.1.1 personas (concise,
reviewer) keep their persona-block content unchanged. Only
their identity contract block is replaced with the
caduceus-original block from §2. Their harness-principles
block is replaced with the new harness-principles block
above (no el Gentleman references).

## 4. Mode renames and the new `default | plain | auto` set

```ts
// lib/config-store.ts
export type PersonaMode = "default" | "plain" | "auto";
```

The `languageClause` function in `lib/language-clause.ts` is
**deleted**. The `languageClauseFor` function in
`extensions/caduceus.ts` is **deleted**. The
`before_agent_start` handler no longer appends a language
clause; it just substitutes `${mode}` and returns the
rendered persona.

The mode still affects the persona prompt via the
`${mode}` placeholder. With caduceus-original personas,
this placeholder is the persona's "current mode" line
(which doesn't change the persona behavior, just labels
which mode is active).

## 5. Lint redesign

The v0.1.1 / v0.2.0 lint has these checks:
- `CROSS_MODE_LEAK_GENTLEMAN`: must NOT contain "Do NOT use voseo" unless name is "neutral"
- `CROSS_MODE_LEAK_NEUTRAL`: must NOT contain "natural Rioplatense Spanish with voseo" unless name is "gentleman"

Both are removed in v0.3.0 (the strings no longer exist in
any prompt file).

The new lint has these checks:
- `IDENTITY_BLOCK` (unchanged): must contain "Identity contract:" line
- `PERSONA_BLOCK` (unchanged): must contain "## Persona" section
- `PRINCIPLES_BLOCK` (unchanged): must contain "## Harness principles" section
- `MODE_PLACEHOLDER` (unchanged): must contain "${mode}" placeholder
- `NO_TIMESTAMP` (unchanged): must not contain ISO date or UUID
- `CONFLICTING_VOICE_MARKERS` (NEW, WARNING): the persona block must not contain markers from BOTH "concise" and "verbose" lists

The conflicting-voice check uses a small marker-word list:
- "concise" markers: "1-3 sentences", "brief", "concise", "minimal", "short", "no preamble", "no postscript"
- "verbose" markers: "thorough", "in detail", "show your reasoning", "explain tradeoffs", "step by step", "elaborate"

If 2+ markers from BOTH lists appear in the persona block,
warn: "Persona block contains both concise and verbose
markers. Pick a direction; ambiguity confuses the model."

## 6. Backward-compat migration

In `lib/config-store.ts`'s `readConfig`:

```ts
const MODE_MIGRATION: Record<string, PersonaMode> = {
  gentleman: "default",
  neutral: "plain",
};
const PERSONA_MIGRATION: Record<string, PersonaName> = {
  gentleman: "default",
  neutral: "plain",
};

// In readConfig, after the global/project merge:
if (MODE_MIGRATION[effective.mode]) {
  console.warn(
    `caduceus: mode "${effective.mode}" is deprecated; ` +
    `migrating to "${MODE_MIGRATION[effective.mode]}". ` +
    `Run /caduceus:mode ${MODE_MIGRATION[effective.mode]} to update your config.`,
  );
  effective = { ...effective, mode: MODE_MIGRATION[effective.mode] };
}
if (PERSONA_MIGRATION[effective.persona]) {
  console.warn(
    `caduceus: persona "${effective.persona}" is deprecated; ` +
    `migrating to "${PERSONA_MIGRATION[effective.persona]}". ` +
    `Run /caduceus:persona ${PERSONA_MIGRATION[effective.persona]} to update your config.`,
  );
  effective = { ...effective, persona: PERSONA_MIGRATION[effective.persona] };
}
```

The slash commands `/caduceus:mode` and `/caduceus:persona`
also accept the old names as input (with a deprecation
warning). The migration is one-way (old → new); the new
names are never migrated to the old.

## 7. File changes (delta from v0.2.0)

```text
caduceus/
├── extensions/caduceus.ts        # MODIFIED — remove languageClauseFor, use new mode names
├── lib/
│   ├── persona-contract.ts       # MODIFIED — accept new mode names in resolveMode
│   ├── language-clause.ts        # DELETED
│   ├── locale-detect.ts          # UNCHANGED
│   ├── config-store.ts           # MODIFIED — new mode names + migration map
│   ├── slash-commands.ts         # MODIFIED — new mode names, deprecation warnings
│   ├── version.ts                # UNCHANGED
│   ├── errors.ts                 # UNCHANGED
│   ├── persona-loader.ts         # MODIFIED — new built-in set
│   ├── lint.ts                   # MODIFIED — drop cross-mode, add conflicting-voice
│   ├── prompt-mode.ts            # UNCHANGED
│   ├── wizard.ts                 # MODIFIED — new identity contract in template
│   └── diff.ts                   # UNCHANGED
│
├── prompts/
│   ├── gentleman.md              # DELETED
│   ├── neutral.md                # DELETED
│   ├── default.md                # NEW (replaces gentleman.md)
│   ├── plain.md                  # NEW (replaces neutral.md)
│   ├── concise.md                # MODIFIED (identity block rewrite)
│   ├── reviewer.md               # MODIFIED (identity block rewrite)
│   ├── teacher.md                # MODIFIED (identity block rewrite)
│   ├── security.md               # MODIFIED (identity block rewrite)
│   ├── debugger.md               # MODIFIED (identity block rewrite)
│   ├── socratic.md               # MODIFIED (identity block rewrite)
│   ├── architect.md              # MODIFIED (identity block rewrite)
│   └── pirate.md                 # MODIFIED (identity block rewrite)
│
├── tests/                        # 11 existing + 1 new
│   ├── (11 existing test files, all modified)
│   └── migration.test.ts         # NEW — v0.2.0 config → v0.3.0 config
│
├── scripts/verify-package.mjs    # MODIFIED — add grep check for "el Gentleman" / "voseo" / "Rioplatense"
│
├── README.md                     # MODIFIED
├── CHANGELOG.md                  # MODIFIED — new v0.3.0 entry
└── INIT.md                       # MODIFIED — §2 and §4 only
```

**New files:** 2 (default.md, plain.md, migration.test.ts) = 3
**Modified files:** 17
**Deleted files:** 2 (gentleman.md, neutral.md, language-clause.ts) = 3

## 8. Test strategy

### 8.1 New test file

- `tests/migration.test.ts` (~50 lines):
  - v0.2.0 config `{ mode: "gentleman", persona: "gentleman" }` is read as `{ mode: "default", persona: "default" }` (with console.warn captured)
  - Same for `neutral` → `plain`
  - v0.3.0 config is unchanged on read

### 8.2 Modified test files

- `tests/persona-contract.test.ts`: drop R-PERSONA-007/008
  (the byte-for-byte gentle-pi check). Replace with a check
  that all 10 built-in personas pass the new lint.
- `tests/lint.test.ts`: drop the 2 cross-mode tests; add
  the conflicting-voice test
- `tests/slash-commands.test.ts`: update all mode/persona
  test cases to use the new names
- `tests/extension-entry.test.ts`: update the structural test
  to expect 10 built-in personas (was 10 in v0.2.0 — same
  number, but 2 different names)
- `tests/persona-loader.test.ts`: update tests that reference
  the old built-in names

### 8.3 Test count growth

- v0.2.0: 165 tests
- v0.3.0: ~175 tests (165 - 6 [deleted tests] + 16 [new tests] = 175)

## 9. Backward-compatibility audit

| v0.2.0 behavior | v0.3.0 behavior | Change? |
|---|---|---|
| `mode: "gentleman"` in config | migrated to `default` with warn | **Breaking but auto-migrated** |
| `mode: "neutral"` in config | migrated to `plain` with warn | **Breaking but auto-migrated** |
| `/caduceus:mode gentleman` | works, maps to `default` with warn | **Breaking but auto-migrated** |
| `/caduceus:persona gentleman` | works, maps to `default` with warn | **Breaking but auto-migrated** |
| Built-in `gentleman` persona file | **DELETED** | **Breaking** (but auto-migrated at the name level) |
| Built-in `neutral` persona file | **DELETED** | **Breaking** (but auto-migrated at the name level) |
| Voseo language clause in persona prompt | removed | **Internal change** |
| Identity block in prompt files | rewritten as caduceus-original | **Internal change** |
| Lint cross-mode checks | removed; conflicting-voice added | **Internal change** |
| All 9 slash commands | still 9 (no new, no removed) | **No** |
| All 10 built-in personas | still 10 (gentleman+neutral replaced with default+plain) | **No** |

## 10. Risks (carried + new)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 (NEW) | Existing v0.2.0 users have a working `caduceus.json` that won't load | Migration map auto-renames; warn at read time; user can save to fix |
| R-2 (NEW) | Old persona files (user-created) referencing voseo don't trigger any lint signal | The conflicting-voice check is the new generic signal; old voseo content is benign |
| R-3 (carried) | User personas without `${mode}` placeholder fail lint | check unchanged from v0.1.1 |
| R-4 (NEW) | The new "default" persona name conflicts with the Linux `default` user or other system concepts | Low risk; "default" is a common English word; persona names are scoped to caduceus |
| R-5 (NEW) | Forum post (D-1) still references gentleman; readers will be confused | Rewrite forum post as part of marketing in v0.3.0 |

## 11. Next phase

`sdd-tasks` — produce
`openspec/changes/caduceus-v0.3.0/tasks.md` with 10 implementation
tasks in dependency order. Estimated total: 700 lines
(review budget exceeded; will require size-exception
decision at the user-level boundary).

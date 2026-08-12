# Persona Specification

> **Status:** New domain spec (greenfield).
> **Date:** 2026-01
> **Owns:** `lib/persona-contract.ts`, `lib/language-clause.ts`,
> `prompts/gentleman.md`, `prompts/neutral.md`, the
> persona-prompt-injection segment of `extensions/caduceus.ts`.

## Purpose

Define the **Persona Contract**: the deterministic,
testable, line-citable transformation from
`(mode, locale) → system-prompt-segment-string` that caduceus
injects before every LLM call.

The contract is the single source of truth for what persona
behavior the model is told to follow. Every line in the rendered
output MUST be traceable to either a `prompts/*.md` source line or
a clause selected by `lib/language-clause.ts`.

## Requirements

### R-PERSONA-001: Persona prompt assembly

The system MUST provide a pure function

```ts
type PersonaMode = "gentleman" | "neutral" | "auto";
type ResolvedLocale = "es-AR" | "es-ES" | "en" | "zh" | string;
function buildPersonaPrompt(
  mode: PersonaMode,
  locale: ResolvedLocale,
): string;
```

that returns a fully assembled persona prompt segment for the
given `(mode, locale)` pair. The function MUST be a pure
function with no I/O and no global state.

#### Scenario: S-PERSONA-001-1 — Gentleman mode with Spanish locale

- **GIVEN** `mode === "gentleman"` and `locale === "es-AR"`
- **WHEN** `buildPersonaPrompt("gentleman", "es-AR")` is called
- **THEN** the result is a non-empty string
- **AND** the result contains the identity contract block
- **AND** the result contains the gentleman persona block
- **AND** the result contains a voseo-aware language clause
- **AND** the result contains the harness principles block

#### Scenario: S-PERSONA-001-2 — Neutral mode with English locale

- **GIVEN** `mode === "neutral"` and `locale === "en"`
- **WHEN** `buildPersonaPrompt("neutral", "en")` is called
- **THEN** the result is a non-empty string
- **AND** the result contains the identity contract block
- **AND** the result contains the neutral persona block
- **AND** the result contains an English language clause
  (or no language clause if `locale === "en"`)
- **AND** the result does NOT contain a voseo language clause

#### Scenario: S-PERSONA-001-3 — Mode "auto" resolves to gentleman

- **GIVEN** `mode === "auto"`
- **WHEN** `buildPersonaPrompt("auto", "es-AR")` is called
- **THEN** the rendered prompt is identical to
  `buildPersonaPrompt("gentleman", "es-AR")`

### R-PERSONA-002: Gentleman mode contains voseo clause

The `buildPersonaPrompt("gentleman", locale)` output MUST contain
the literal substring `natural Rioplatense Spanish with voseo`
(case-insensitive match).

#### Scenario: S-PERSONA-002-1

- **GIVEN** any `locale` in
  `{"auto", "es-AR", "es-ES", "en", "zh"}`
- **WHEN** `buildPersonaPrompt("gentleman", locale)` is called
- **THEN** the result matches the regex
  `/natural Rioplatense Spanish with voseo/i`

### R-PERSONA-003: Neutral mode contains do-not-voseo clause

The `buildPersonaPrompt("neutral", locale)` output MUST contain
the literal substring `Do NOT use voseo` (case-insensitive match).

#### Scenario: S-PERSONA-003-1

- **GIVEN** any `locale` in
  `{"auto", "es-AR", "es-ES", "en", "zh"}`
- **WHEN** `buildPersonaPrompt("neutral", locale)` is called
- **THEN** the result matches the regex `/Do NOT use voseo/i`

### R-PERSONA-004: No cross-mode leakage

The `buildPersonaPrompt` output for one mode MUST NOT contain
the invariant clause of the other mode.

#### Scenario: S-PERSONA-004-1 — Gentleman prompt excludes do-not-voseo

- **GIVEN** any `locale`
- **WHEN** `buildPersonaPrompt("gentleman", locale)` is called
- **THEN** the result does NOT match the regex `/Do NOT use voseo/i`

#### Scenario: S-PERSONA-004-2 — Neutral prompt excludes voseo

- **GIVEN** any `locale`
- **WHEN** `buildPersonaPrompt("neutral", locale)` is called
- **THEN** the result does NOT match the regex
  `/natural Rioplatense Spanish with voseo/i`

### R-PERSONA-005: Byte-stable output

`buildPersonaPrompt(mode, locale)` MUST return byte-identical
output across multiple invocations with the same inputs.

#### Scenario: S-PERSONA-005-1

- **GIVEN** a fixed `mode` and `locale`
- **WHEN** `buildPersonaPrompt(mode, locale)` is called twice
- **THEN** the two results are `===` (strict equality) on the
  string content
- **AND** the result contains no timestamps, no random IDs, and
  no values derived from `Date.now()`, `Math.random()`, or
  `process.env` at call time

### R-PERSONA-006: Prompt files read once and cached

The contents of `prompts/gentleman.md` and `prompts/neutral.md`
MUST be read from disk exactly once at module load. Subsequent
calls to `buildPersonaPrompt` MUST use the cached contents.

#### Scenario: S-PERSONA-006-1

- **GIVEN** the persona-contract module has been loaded
- **WHEN** `buildPersonaPrompt("gentleman", "es-AR")` is called
  100 times in a row
- **THEN** the module performs zero file system reads after
  the initial load (verifiable via a `fs.readFileSync` mock
  or `fs.promises.readFile` spy)

### R-PERSONA-007: Gentleman prompt source text

The persona block in `prompts/gentleman.md` (the section
between the `## Persona` heading and the next `## ` heading) MUST
be byte-for-byte identical to the corresponding text in
`gentle-pi/extensions/gentle-ai.ts` lines 258–266.

#### Scenario: S-PERSONA-007-1

- **GIVEN** `gentle-pi` is installed at
  `/root/.pi/agent/npm/node_modules/gentle-pi`
- **WHEN** the test reads
  `gentle-pi/extensions/gentle-ai.ts` lines 258–266
- **AND** reads `prompts/gentleman.md` § Persona
- **THEN** the two strings are exactly equal (modulo the
  leading `- ` bullet of each line, which is part of the
  persona block)

### R-PERSONA-008: Neutral prompt source text

The persona block in `prompts/neutral.md` MUST be byte-for-byte
identical to the corresponding text in
`gentle-pi/extensions/gentle-ai.ts` lines 268–277.

#### Scenario: S-PERSONA-008-1

- **GIVEN** `gentle-pi` is installed
- **WHEN** the test reads
  `gentle-pi/extensions/gentle-ai.ts` lines 268–277
- **AND** reads `prompts/neutral.md` § Persona
- **THEN** the two strings are exactly equal

### R-PERSONA-009: System prompt composition

When injected via the `before_agent_start` event, the persona
segment MUST be appended to `event.systemPrompt` with a `\n\n`
separator. The result MUST be returned as the
`{ systemPrompt }` field of `BeforeAgentStartEventResult`.

#### Scenario: S-PERSONA-009-1 — Composes with the prior system prompt

- **GIVEN** `event.systemPrompt === "BASE"` (a placeholder
  string pi would have built)
- **WHEN** the `before_agent_start` handler runs
- **THEN** the returned `systemPrompt` equals
  `"BASE\n\n" + buildPersonaPrompt(mode, locale)`

#### Scenario: S-PERSONA-009-2 — Subsequent extensions see the updated prompt

- **GIVEN** another extension registered a `before_agent_start`
  handler that runs after caduceus
- **WHEN** that handler reads `event.systemPrompt`
- **THEN** it sees the caduceus-augmented prompt
  (i.e. caduceus's `currentSystemPrompt` change is visible
  to later handlers, per the runner's last-writer-wins chain
  contract verified at `runner.js:837-893`)

### R-PERSONA-010: Language clause selection

The system MUST provide a pure function

```ts
function languageClause(
  locale: ResolvedLocale,
  mode: PersonaMode,
): string;
```

that returns the language boundary line for the given pair.

#### Scenario: S-PERSONA-010-1 — Gentleman + Spanish

- **GIVEN** `mode === "gentleman"` and `locale === "es-AR"`
- **WHEN** `languageClause("es-AR", "gentleman")` is called
- **THEN** the result is a non-empty string
- **AND** the result contains the voseo clause

#### Scenario: S-PERSONA-010-2 — Neutral + Spanish

- **GIVEN** `mode === "neutral"` and `locale === "es-ES"`
- **WHEN** `languageClause("es-ES", "neutral")` is called
- **THEN** the result contains the do-not-voseo clause

#### Scenario: S-PERSONA-010-3 — English locale has no Spanish clause

- **GIVEN** `mode === "gentleman"` and `locale === "en"`
- **WHEN** `languageClause("en", "gentleman")` is called
- **THEN** the result is either an empty string or a non-Spanish
  clause (e.g. an English-language directive)
- **AND** the result does NOT contain the voseo clause
- **AND** the result does NOT contain the do-not-voseo clause

### R-PERSONA-011: Persona provenance via inspect

The system MUST provide a slash command `/caduceus:inspect` that
prints the rendered persona prompt for the current effective
`(mode, locale)`, with each line annotated by its source
location.

#### Scenario: S-PERSONA-011-1

- **GIVEN** a session with `mode === "gentleman"` and
  `locale === "es-AR"`
- **WHEN** the user runs `/caduceus:inspect`
- **THEN** the output shows the rendered prompt
- **AND** each line in the output is annotated with a source
  reference of the form `prompts/gentleman.md:L<n>` or
  `language-clause.ts:L<n>`
- **AND** the output is byte-stable across two consecutive
  invocations with no change to `(mode, locale)`

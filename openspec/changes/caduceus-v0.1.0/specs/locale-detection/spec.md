# Locale-Detection Specification

> **Status:** New domain spec (greenfield).
> **Date:** 2026-01
> **Owns:** `lib/locale-detect.ts`.

## Purpose

Define how caduceus determines the user's locale for the
language clause (see `persona/spec.md` R-PERSONA-010). Detection
is a **pure function** that consumes the user prompt, the
process environment, and the configured locale preference, and
returns a resolved locale. No I/O, no global state.

## Requirements

### R-LOCALE-001: Pure detection function

The system MUST provide a pure function

```ts
type LocalePreference = "auto" | ResolvedLocale;
function detectLocale(
  text: string,
  env: NodeJS.ProcessEnv,
  configLocale: LocalePreference,
): ResolvedLocale;
```

#### Scenario: S-LOCALE-001-1

- **GIVEN** any inputs
- **WHEN** `detectLocale` is called twice with the same inputs
- **THEN** the two results are `===` (strict equality on string)
- **AND** the function performs no file system or network I/O

### R-LOCALE-002: Resolution order

The detection MUST follow this strict precedence (first match
wins):

1. If `configLocale !== "auto"`, return `configLocale`
   unchanged.
2. If `text` contains a detectable locale cue (see
   R-LOCALE-003..R-LOCALE-005), return that locale.
3. If `env.LC_ALL` is set and non-empty, return
   `normalizeEnvLocale(env.LC_ALL)`.
4. If `env.LANG` is set and non-empty, return
   `normalizeEnvLocale(env.LANG)`.
5. Fallback: return `"en"`.

#### Scenario: S-LOCALE-002-1 — Config override wins

- **GIVEN** `configLocale === "es-AR"`
- **AND** `text === "hola"` (would auto-detect as Spanish)
- **AND** `env.LANG === "fr_FR.UTF-8"`
- **WHEN** `detectLocale("hola", env, "es-AR")` is called
- **THEN** the result is `"es-AR"` (config wins, text and env
  ignored)

#### Scenario: S-LOCALE-002-2 — Text cue wins over env

- **GIVEN** `configLocale === "auto"`
- **AND** `text === "como estás vos"` (Spanish + voseo)
- **AND** `env.LANG === "C"` (no signal)
- **WHEN** `detectLocale(text, env, "auto")` is called
- **THEN** the result is `"es-AR"` (voseo cue detected)

#### Scenario: S-LOCALE-002-3 — Env wins over fallback

- **GIVEN** `configLocale === "auto"`
- **AND** `text === "12345"` (no language cue)
- **AND** `env.LANG === "zh_CN.UTF-8"`
- **WHEN** `detectLocale(text, env, "auto")` is called
- **THEN** the result is `"zh"`

#### Scenario: S-LOCALE-002-4 — Fallback to English

- **GIVEN** `configLocale === "auto"`
- **AND** `text === ""`
- **AND** `env.LC_ALL` and `env.LANG` are both undefined
- **WHEN** `detectLocale("", env, "auto")` is called
- **THEN** the result is `"en"`

### R-LOCALE-003: Spanish detection with voseo disambiguation

The system MUST detect Spanish text by the presence of:

- Any of these diacritics: `á é í ó ú ñ ü` (Unicode category
  Latin + combining diacritics)
- Any of these high-frequency Spanish words (case-insensitive
  substring match): ` que `, ` como `, ` para `, ` pero `,
  ` muy `, ` también `

For `es-AR` vs `es-ES` disambiguation, the system MUST look for
voseo markers (case-insensitive substring match): `vos `, `tenés`,
`querés`, `hacé`, `andá`, `sos`, `podés`. Two or more voseo
markers → `"es-AR"`. Zero or one voseo marker and Spanish cue
present → `"es-ES"`.

#### Scenario: S-LOCALE-003-1 — Voseo detected

- **GIVEN** `text` is `"¿cómo estás? vos tenés razón"`
- **WHEN** `detectLocale` is called with `configLocale === "auto"`
- **THEN** the result is `"es-AR"`

#### Scenario: S-LOCALE-003-2 — No voseo, Spanish detected

- **GIVEN** `text` is `"¿cómo estás? tienes razón"`
- **WHEN** `detectLocale` is called with `configLocale === "auto"`
- **THEN** the result is `"es-ES"`

### R-LOCALE-004: English detection

The system MUST classify text as English when:

- The text contains no CJK ideographs (Unicode block
  U+4E00–U+9FFF) AND
- The text contains no Spanish diacritics AND
- The text is at least 3 words long AND
- ≥ 60% of the words are in the built-in English common-word
  list (top 100 most common English words, case-insensitive)

#### Scenario: S-LOCALE-004-1

- **GIVEN** `text === "the quick brown fox jumps over the lazy dog"`
- **WHEN** `detectLocale` is called with `configLocale === "auto"`
- **THEN** the result is `"en"`

#### Scenario: S-LOCALE-004-2 — Short English text

- **GIVEN** `text === "ok"`
- **WHEN** `detectLocale` is called with `configLocale === "auto"`
- **THEN** the result is NOT `"en"` (insufficient signal — falls
  through to env or fallback)

### R-LOCALE-005: Chinese detection

The system MUST classify text as Chinese when the text contains
at least 3 CJK ideographs (Unicode block U+4E00–U+9FFF) and zero
Spanish diacritics.

#### Scenario: S-LOCALE-005-1

- **GIVEN** `text === "你好世界，今天天气真好"`
- **WHEN** `detectLocale` is called with `configLocale === "auto"`
- **THEN** the result is `"zh"`

### R-LOCALE-006: Environment normalization

The system MUST provide a pure function

```ts
function normalizeEnvLocale(envValue: string): ResolvedLocale | null;
```

that:

- Strips the encoding suffix (e.g. `.UTF-8`).
- Strips the territory if the base is `C` or `POSIX` (returns
  `null`).
- Maps `es_*` (any territory) to `"es-AR"` by default; the
  locale-detect module exposes a hook to override this default
  via env var `CADUCEUS_ES_TERRITORY` (set to `ES` for
  `"es-ES"`).
- Maps `en_*` to `"en"`, `zh_*` to `"zh"`.
- Returns `null` if the value is empty or unsupported.

#### Scenario: S-LOCALE-006-1

- **GIVEN** `envValue === "es_ES.UTF-8"`
- **WHEN** `normalizeEnvLocale(envValue)` is called
- **THEN** the result is `"es-AR"` (default mapping)

#### Scenario: S-LOCALE-006-2

- **GIVEN** `envValue === "es_ES.UTF-8"`
- **AND** `env.CADUCEUS_ES_TERRITORY === "ES"`
- **WHEN** `normalizeEnvLocale(envValue, env)` is called
- **THEN** the result is `"es-ES"`

#### Scenario: S-LOCALE-006-3

- **GIVEN** `envValue === "C"`
- **WHEN** `normalizeEnvLocale(envValue)` is called
- **THEN** the result is `null`

### R-LOCALE-007: Custom locale pass-through

If `configLocale` is a non-empty string that does not match
`"auto"`, `"es-AR"`, `"es-ES"`, `"en"`, or `"zh"`, the system
MUST return it unchanged (custom locale is the user's choice).

#### Scenario: S-LOCALE-007-1

- **GIVEN** `configLocale === "pt-BR"`
- **WHEN** `detectLocale` is called
- **THEN** the result is `"pt-BR"`
- **AND** no detection against `text` or `env` is performed

### R-LOCALE-008: No detection in narrow contexts

If `text` is empty AND `configLocale === "auto"` AND neither
`LC_ALL` nor `LANG` is set, the system MUST return `"en"`. The
function MUST NOT crash, throw, or return `undefined`.

#### Scenario: S-LOCALE-008-1

- **GIVEN** all of: `text === ""`, `configLocale === "auto"`,
  `env.LC_ALL === undefined`, `env.LANG === undefined`
- **WHEN** `detectLocale(text, env, "auto")` is called
- **THEN** the result is `"en"`
- **AND** no exception is thrown

// ---------------------------------------------------------------------------
// caduceus — locale detection tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-4 creates lib/locale-detect.ts
//   TRIANGULATE  → T-4 adds edge cases (empty, punctuation, mixed CJK+Spanish)
//   REFACTOR     → T-4 cleans up if needed
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectLocale,
  normalizeEnvLocale,
  type ResolvedLocale,
} from "../lib/locale-detect.ts";

const emptyEnv = {} as NodeJS.ProcessEnv;

// ---------------------------------------------------------------------------
// R-LOCALE-001 — Pure function (idempotency)
// ---------------------------------------------------------------------------

test("R-LOCALE-001-1: detectLocale is pure and idempotent", () => {
  const env = { LANG: "en_US.UTF-8" };
  const r1 = detectLocale("hola, ¿cómo estás vos?", env, "auto");
  const r2 = detectLocale("hola, ¿cómo estás vos?", env, "auto");
  assert.equal(r1, r2, "two calls with same inputs must return the same locale");
});

// ---------------------------------------------------------------------------
// R-LOCALE-002 — Resolution order
// ---------------------------------------------------------------------------

test("R-LOCALE-002-1: configLocale override wins over text and env", () => {
  const env = { LANG: "fr_FR.UTF-8" };
  // text would auto-detect as Spanish, but config forces es-AR
  const result = detectLocale("hola amigo", env, "es-AR");
  assert.equal(result, "es-AR");
});

test("R-LOCALE-002-2: text cue wins over env (auto + Spanish voseo)", () => {
  const env = { LANG: "C" };
  const result = detectLocale("vos tenés razón, che", env, "auto");
  assert.equal(result, "es-AR");
});

test("R-LOCALE-002-3: env wins over fallback (auto + no text + zh env)", () => {
  const env = { LANG: "zh_CN.UTF-8" };
  const result = detectLocale("12345", env, "auto");
  assert.equal(result, "zh");
});

test("R-LOCALE-002-3b: LC_ALL wins over LANG", () => {
  const env = { LANG: "fr_FR.UTF-8", LC_ALL: "es_ES.UTF-8" };
  const result = detectLocale("12345", env, "auto");
  assert.equal(result, "es-AR");
});

test("R-LOCALE-002-4: fallback to 'en' when no signal", () => {
  const result = detectLocale("", emptyEnv, "auto");
  assert.equal(result, "en");
});

// ---------------------------------------------------------------------------
// R-LOCALE-003 — Spanish detection with voseo disambiguation
// ---------------------------------------------------------------------------

test("R-LOCALE-003-1: Spanish + voseo markers → es-AR", () => {
  const result = detectLocale("¿cómo estás? vos tenés razón", emptyEnv, "auto");
  assert.equal(result, "es-AR");
});

test("R-LOCALE-003-2: Spanish + no voseo → es-ES", () => {
  // No voseo markers, but Spanish diacritics + Spanish common words
  const result = detectLocale("¿cómo estás? tienes razón", emptyEnv, "auto");
  assert.equal(result, "es-ES");
});

// ---------------------------------------------------------------------------
// R-LOCALE-004 — English detection
// ---------------------------------------------------------------------------

test("R-LOCALE-004-1: long English text → en", () => {
  const result = detectLocale(
    "the quick brown fox jumps over the lazy dog and runs into the forest",
    emptyEnv,
    "auto",
  );
  assert.equal(result, "en");
});

test("R-LOCALE-004-2: short text with no cue → not 'en' (falls through)", () => {
  const result = detectLocale("ok", emptyEnv, "auto");
  // Either "en" (fallback) or some other value is acceptable, but it must
  // not be "es-AR" or "zh" or anything else Spanish/Chinese.
  assert.ok(
    result !== "es-AR" && result !== "es-ES" && result !== "zh",
    `short ambiguous text must not classify as a specific locale, got ${result}`,
  );
});

// ---------------------------------------------------------------------------
// R-LOCALE-005 — Chinese detection
// ---------------------------------------------------------------------------

test("R-LOCALE-005-1: Chinese text (3+ CJK ideographs) → zh", () => {
  const result = detectLocale("你好世界，今天天气真好", emptyEnv, "auto");
  assert.equal(result, "zh");
});

// ---------------------------------------------------------------------------
// R-LOCALE-006 — Environment normalization
// ---------------------------------------------------------------------------

test("R-LOCALE-006-1: normalizeEnvLocale('es_ES.UTF-8') → 'es-AR' (default)", () => {
  assert.equal(normalizeEnvLocale("es_ES.UTF-8"), "es-AR");
});

test("R-LOCALE-006-2: normalizeEnvLocale with CADUCEUS_ES_TERRITORY=ES → 'es-ES'", () => {
  const env = { CADUCEUS_ES_TERRITORY: "ES" };
  assert.equal(normalizeEnvLocale("es_ES.UTF-8", env), "es-ES");
});

test("R-LOCALE-006-3: normalizeEnvLocale('C') → null", () => {
  assert.equal(normalizeEnvLocale("C"), null);
});

test("R-LOCALE-006-4: normalizeEnvLocale('en_US.UTF-8') → 'en'", () => {
  assert.equal(normalizeEnvLocale("en_US.UTF-8"), "en");
});

test("R-LOCALE-006-5: normalizeEnvLocale('zh_CN.UTF-8') → 'zh'", () => {
  assert.equal(normalizeEnvLocale("zh_CN.UTF-8"), "zh");
});

// ---------------------------------------------------------------------------
// R-LOCALE-007 — Custom locale passthrough
// ---------------------------------------------------------------------------

test("R-LOCALE-007-1: custom configLocale passes through unchanged", () => {
  const result = detectLocale("hello", emptyEnv, "pt-BR");
  assert.equal(result, "pt-BR");
});

test("R-LOCALE-007-2: detectLocale never returns 'auto'", () => {
  // Even when configLocale is 'auto', the result must be a resolved locale
  // (never the string "auto" itself).
  for (const text of [
    "",
    "hola",
    "the quick brown fox jumps over the lazy dog",
    "你好世界",
  ]) {
    const result = detectLocale(text, emptyEnv, "auto");
    assert.notEqual(result, "auto", `detectLocale must not return 'auto' for text=${text}`);
  }
});

// ---------------------------------------------------------------------------
// R-LOCALE-008 — No detection in narrow contexts
// ---------------------------------------------------------------------------

test("R-LOCALE-008-1: empty text + auto + no env → 'en', no throw", () => {
  // Just confirm no exception
  const result = detectLocale("", emptyEnv, "auto");
  assert.equal(result, "en");
});

// ---------------------------------------------------------------------------
// TRIANGULATE — Edge cases
// ---------------------------------------------------------------------------

test("EDGE-1: empty text with only punctuation → 'en' fallback", () => {
  const result = detectLocale("!!! ??? ...", emptyEnv, "auto");
  assert.equal(result, "en");
});

test("EDGE-2: only digits → 'en' fallback (no language signal)", () => {
  const result = detectLocale("123 456 7890", emptyEnv, "auto");
  assert.equal(result, "en");
});

test("EDGE-3: mixed CJK + Spanish diacritics → Spanish wins (diacritics win over CJK)", () => {
  // Spanish diacritics are a stronger signal than CJK ideographs
  const result = detectLocale("¿qué tal? 你好", emptyEnv, "auto");
  assert.equal(result, "es-ES");
});

test("EDGE-4: very long mixed text with Spanish diacritics → Spanish wins (diacritics are a stronger signal than majority English)", () => {
  // The text is mostly English but has one Spanish sentence with diacritics.
  // Per R-LOCALE-003, any Spanish diacritic forces Spanish detection.
  const text =
    "The system works well. The interface is clean. The performance is good. " +
    "¿Cómo estás? The result is fast. The output is clear.";
  const result = detectLocale(text, emptyEnv, "auto");
  // No voseo markers, so es-ES (not es-AR)
  assert.equal(result, "es-ES");
});

// ---------------------------------------------------------------------------
// caduceus — language clause tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail, lib/language-clause.ts missing)
//   GREEN        → T-3 creates lib/language-clause.ts
//   TRIANGULATE  → T-3 adds 2 more cases for cross-product (es-AR/es-ES) × (gentleman/neutral)
//   REFACTOR     → T-3 cleans up if needed
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { languageClause, type PersonaMode } from "../lib/language-clause.ts";

// ---------------------------------------------------------------------------
// R-PERSONA-010-1 — Gentleman + Spanish returns voseo clause
// ---------------------------------------------------------------------------

test("R-PERSONA-010-1a: gentleman + es-AR returns a non-empty voseo clause", () => {
  const result = languageClause("es-AR", "gentleman");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0, "result must be non-empty");
  assert.match(result, /voseo/i, "gentleman es-AR clause must mention voseo");
});

test("R-PERSONA-010-1b: gentleman + auto defaults to voseo (same as es-AR)", () => {
  const result = languageClause("auto", "gentleman");
  assert.match(result, /voseo/i);
});

// ---------------------------------------------------------------------------
// R-PERSONA-010-2 — Neutral + Spanish returns do-not-voseo clause
// ---------------------------------------------------------------------------

test("R-PERSONA-010-2a: neutral + es-ES returns a non-empty do-not-voseo clause", () => {
  const result = languageClause("es-ES", "neutral");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
  // The language clause uses "(no voseo)" (lowercase); the
  // "Do NOT use voseo" string lives in the persona block (separate file).
  assert.match(result, /no voseo/i);
});

test("R-PERSONA-010-2b: neutral + es-AR also returns do-not-voseo (no voseo, no voseo regardless of territory)", () => {
  const result = languageClause("es-AR", "neutral");
  assert.match(result, /no voseo/i);
});

test("R-PERSONA-010-2c: neutral + auto defaults to do-not-voseo", () => {
  const result = languageClause("auto", "neutral");
  assert.match(result, /no voseo/i);
});

// ---------------------------------------------------------------------------
// R-PERSONA-010-3 — English locale has no Spanish clause
// ---------------------------------------------------------------------------

test("R-PERSONA-010-3a: gentleman + en returns empty string", () => {
  const result = languageClause("en", "gentleman");
  assert.equal(result, "", "english locale should produce no language clause");
});

test("R-PERSONA-010-3b: neutral + en returns empty string", () => {
  const result = languageClause("en", "neutral");
  assert.equal(result, "");
});

// ---------------------------------------------------------------------------
// R-PERSONA-010-3c — Chinese locale has no Spanish clause
// ---------------------------------------------------------------------------

test("R-PERSONA-010-3c: zh locale returns empty string for any mode", () => {
  for (const mode of ["gentleman", "neutral"] as PersonaMode[]) {
    const result = languageClause("zh", mode);
    assert.equal(result, "", `zh + ${mode} should produce no language clause`);
  }
});

// ---------------------------------------------------------------------------
// Custom locale pass-through
// ---------------------------------------------------------------------------

test("R-LOCALE-007: custom locale (e.g. pt-BR) returns empty string", () => {
  // Custom locales pass through locale-detect, but languageClause only has
  // built-in clauses for es-AR, es-ES, en, zh. Anything else returns "".
  assert.equal(languageClause("pt-BR", "gentleman"), "");
  assert.equal(languageClause("fr-FR", "neutral"), "");
  assert.equal(languageClause("ja", "gentleman"), "");
});

// ---------------------------------------------------------------------------
// No cross-mode leakage in language clauses
// ---------------------------------------------------------------------------

test("no cross-mode leakage: gentleman clause does NOT contain 'Do NOT use voseo'", () => {
  for (const locale of ["es-AR", "es-ES", "auto"]) {
    const result = languageClause(locale, "gentleman");
    assert.doesNotMatch(
      result,
      /Do NOT use voseo/i,
      `gentleman clause for ${locale} must NOT contain do-not-voseo`,
    );
  }
});

test("no cross-mode leakage: neutral clause does NOT contain 'Rioplatense Spanish with voseo'", () => {
  for (const locale of ["es-AR", "es-ES", "auto"]) {
    const result = languageClause(locale, "neutral");
    assert.doesNotMatch(
      result,
      /Rioplatense Spanish with voseo/i,
      `neutral clause for ${locale} must NOT contain voseo clause`,
    );
  }
});

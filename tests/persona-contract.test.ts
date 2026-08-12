// ---------------------------------------------------------------------------
// caduceus — persona contract tests
//
// This is the FIRST committed test in caduceus. Per INIT.md §9.4 and
// AGENTS.md §"Strict TDD posture", it must be RED on first run: the
// lib/persona-contract.ts module it imports does not exist yet.
//
// TDD micro-cycle for the persona contract:
//   RED          → this file (imports fail)
//   GREEN        → T-2: lib/persona-contract.ts + prompts/*.md
//   TRIANGULATE  → T-2 adds 2 more assertions (R-PERSONA-007/008 byte-for-byte)
//   REFACTOR     → T-2 splits persona-contract.ts into render* helpers
//
// Test runner: `node --experimental-strip-types --test tests/*.test.ts`
// (per openspec/config.yaml, strictTdd: true)
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { buildPersonaPrompt } from "../lib/persona-contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

// ---------------------------------------------------------------------------
// R-PERSONA-001 — Persona prompt assembly (4 scenarios)
// ---------------------------------------------------------------------------

test("R-PERSONA-001-1: gentleman + es-AR returns a non-empty identity/persona/clause/principles string", () => {
  const result = buildPersonaPrompt("gentleman", "es-AR");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0, "result must be non-empty");
  // The result must contain the 4 structural blocks (verified by substring matches)
  assert.match(result, /Current persona mode: gentleman/);
  assert.match(result, /## el Gentleman Identity and Harness/);
  assert.match(result, /Identity contract:/);
  assert.match(result, /Persona:/);
  assert.match(result, /Harness principles:/);
});

test("R-PERSONA-001-2: neutral + en returns identity + neutral persona block (no voseo clause)", () => {
  const result = buildPersonaPrompt("neutral", "en");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
  assert.match(result, /Current persona mode: neutral/);
  // The neutral persona block must include the "warm, and professional" line
  assert.match(result, /warm, and professional/);
  // No Spanish language clause for English locale
  assert.doesNotMatch(result, /Rioplatense Spanish with voseo/i);
  assert.doesNotMatch(result, /Do NOT use voseo/i);
});

test("R-PERSONA-001-3: mode 'auto' resolves to 'gentleman'", () => {
  const autoResult = buildPersonaPrompt("auto", "es-AR");
  const gentlemanResult = buildPersonaPrompt("gentleman", "es-AR");
  assert.equal(autoResult, gentlemanResult);
});

// ---------------------------------------------------------------------------
// R-PERSONA-002 — Gentleman mode MUST contain "natural Rioplatense Spanish with voseo"
// ---------------------------------------------------------------------------

test("R-PERSONA-002-1: gentleman prompt contains 'natural Rioplatense Spanish with voseo' for any locale", () => {
  for (const locale of ["auto", "es-AR", "es-ES", "en", "zh"]) {
    const result = buildPersonaPrompt("gentleman", locale);
    assert.match(
      result,
      /natural Rioplatense Spanish with voseo/i,
      `gentleman prompt for locale=${locale} must contain voseo clause`,
    );
  }
});

// ---------------------------------------------------------------------------
// R-PERSONA-003 — Neutral mode MUST contain "Do NOT use voseo"
// ---------------------------------------------------------------------------

test("R-PERSONA-003-1: neutral prompt contains 'Do NOT use voseo' for any locale", () => {
  for (const locale of ["auto", "es-AR", "es-ES", "en", "zh"]) {
    const result = buildPersonaPrompt("neutral", locale);
    assert.match(
      result,
      /Do NOT use voseo/i,
      `neutral prompt for locale=${locale} must contain do-not-voseo clause`,
    );
  }
});

// ---------------------------------------------------------------------------
// R-PERSONA-004 — No cross-mode leakage
// ---------------------------------------------------------------------------

test("R-PERSONA-004-1: gentleman prompt MUST NOT contain 'Do NOT use voseo'", () => {
  for (const locale of ["auto", "es-AR", "es-ES", "en", "zh"]) {
    const result = buildPersonaPrompt("gentleman", locale);
    assert.doesNotMatch(
      result,
      /Do NOT use voseo/i,
      `gentleman prompt for locale=${locale} must NOT contain do-not-voseo clause`,
    );
  }
});

test("R-PERSONA-004-2: neutral prompt MUST NOT contain 'natural Rioplatense Spanish with voseo'", () => {
  for (const locale of ["auto", "es-AR", "es-ES", "en", "zh"]) {
    const result = buildPersonaPrompt("neutral", locale);
    assert.doesNotMatch(
      result,
      /natural Rioplatense Spanish with voseo/i,
      `neutral prompt for locale=${locale} must NOT contain voseo clause`,
    );
  }
});

// ---------------------------------------------------------------------------
// R-PERSONA-005 — Byte-stable output
// ---------------------------------------------------------------------------

test("R-PERSONA-005-1: buildPersonaPrompt returns byte-identical output across invocations", () => {
  const r1 = buildPersonaPrompt("gentleman", "es-AR");
  const r2 = buildPersonaPrompt("gentleman", "es-AR");
  assert.equal(r1, r2, "two calls with same inputs must return the same string");
  // No Date.now() / random / env leakage
  assert.doesNotMatch(r1, /\d{4}-\d{2}-\d{2}/, "must not contain ISO date");
  assert.doesNotMatch(r1, /[0-9a-f]{8}-[0-9a-f]{4}/, "must not contain UUID-like hex");
});

test("R-PERSONA-005-1b: byte-stable across 100 calls", () => {
  const first = buildPersonaPrompt("neutral", "es-AR");
  for (let i = 0; i < 100; i++) {
    const next = buildPersonaPrompt("neutral", "es-AR");
    assert.equal(next, first, `call ${i} must match the first call`);
  }
});

// ---------------------------------------------------------------------------
// R-PERSONA-007 — Gentleman prompt source text (byte-for-byte vs gentle-pi)
// (asserts added in T-2 TRIANGULATE step; included here so the test file
// is the single source of truth for persona invariants)
// ---------------------------------------------------------------------------

test("R-PERSONA-007-1: prompts/gentleman.md § Persona matches gentle-pi lines 259-266", () => {
  const gentlePiPath = "/root/.pi/agent/npm/node_modules/gentle-pi/extensions/gentle-ai.ts";
  const gentlePiSrc = readFileSync(gentlePiPath, "utf8");
  const gentlePiLines = gentlePiSrc.split("\n");
  // GENTLEMAN_PERSONA_PROMPT spans lines 259-266 (8 lines of bullet list + closing)
  const personaText = gentlePiLines
    .slice(258, 266)  // 0-indexed: lines 259-266 = indices 258-265
    .join("\n");

  const caduceusGentlemanPath = join(repoRoot, "prompts", "gentleman.md");
  const caduceusGentlemanSrc = readFileSync(caduceusGentlemanPath, "utf8");
  // The persona block in caduceus is the lines between the "## Persona" heading
  // and the next "## " heading.
  const personaMatch = caduceusGentlemanSrc.match(
    /^## Persona\n([\s\S]*?)\n## /m,
  );
  assert.ok(personaMatch, "prompts/gentleman.md must contain a '## Persona' section");
  const caduceusPersona = personaMatch[1];

  assert.equal(
    caduceusPersona,
    personaText,
    "prompts/gentleman.md § Persona must match gentle-pi lines 259-266 byte-for-byte",
  );
});

// ---------------------------------------------------------------------------
// R-PERSONA-008 — Neutral prompt source text (byte-for-byte vs gentle-pi)
// ---------------------------------------------------------------------------

test("R-PERSONA-008-1: prompts/neutral.md § Persona matches gentle-pi lines 270-279", () => {
  const gentlePiPath = "/root/.pi/agent/npm/node_modules/gentle-pi/extensions/gentle-ai.ts";
  const gentlePiSrc = readFileSync(gentlePiPath, "utf8");
  const gentlePiLines = gentlePiSrc.split("\n");
  // NEUTRAL_PERSONA_PROMPT spans lines 270-279 (10 lines of bullet list + closing)
  const personaText = gentlePiLines
    .slice(269, 279)  // 0-indexed: lines 270-279 = indices 269-278
    .join("\n");

  const caduceusNeutralPath = join(repoRoot, "prompts", "neutral.md");
  const caduceusNeutralSrc = readFileSync(caduceusNeutralPath, "utf8");
  const personaMatch = caduceusNeutralSrc.match(
    /^## Persona\n([\s\S]*?)\n## /m,
  );
  assert.ok(personaMatch, "prompts/neutral.md must contain a '## Persona' section");
  const caduceusPersona = personaMatch[1];

  assert.equal(
    caduceusPersona,
    personaText,
    "prompts/neutral.md § Persona must match gentle-pi lines 270-279 byte-for-byte",
  );
});

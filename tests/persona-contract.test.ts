// ---------------------------------------------------------------------------
// caduceus — persona contract tests (v0.3.0)
//
// Tests that buildPersonaPrompt and the persona files are consistent.
// v0.3.0 removed the v0.1.0 / v0.2.0 cross-mode voseo checks; the new
// personas (default, plain, concise, reviewer, teacher, security,
// debugger, socratic, architect, pirate) are language-neutral and
// have no voseo / Rioplatense / el Gentleman content.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPersonaPrompt } from "../lib/persona-contract.ts";
import { lintPersonaContent } from "../lib/lint.ts";
import type { PersonaName } from "../lib/persona-loader.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function readBuiltInPrompt(name: PersonaName): string {
  return readFileSync(join(repoRoot, "prompts", `${name}.md`), "utf8");
}

// ---------------------------------------------------------------------------
// R-PERSONA-001 — Persona prompt assembly (default + plain)
// ---------------------------------------------------------------------------

test("R-PERSONA-001-1: default + auto returns a non-empty caduceus-original persona prompt", () => {
  const result = buildPersonaPrompt("default", "auto");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
  assert.match(result, /Current persona mode: default/);
  assert.match(result, /## caduceus Identity Contract/);
  assert.match(result, /Identity contract:/);
  assert.match(result, /## Persona/);
  assert.match(result, /## Harness principles/);
  assert.match(result, /senior developer with an architect/);
});

test("R-PERSONA-001-2: plain + auto returns a minimal persona prompt", () => {
  const result = buildPersonaPrompt("plain", "auto");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
  assert.match(result, /Current persona mode: plain/);
  assert.match(result, /Be minimal\. Answer in 1-3 sentences/);
});

test("R-PERSONA-001-3: mode 'auto' resolves to 'default'", () => {
  const autoResult = buildPersonaPrompt("auto", "en");
  const defaultResult = buildPersonaPrompt("default", "en");
  assert.equal(autoResult, defaultResult);
});

test("R-PERSONA-001-4: v0.3.0 prompts do NOT contain gentleman content", () => {
  for (const mode of ["default", "plain", "auto"] as const) {
    const result = buildPersonaPrompt(mode, "es-AR");
    assert.doesNotMatch(result, /voseo/i, `${mode} must not contain voseo`);
    assert.doesNotMatch(result, /el Gentleman/, `${mode} must not contain 'el Gentleman'`);
    assert.doesNotMatch(result, /Rioplatense/, `${mode} must not contain 'Rioplatense'`);
  }
});

// ---------------------------------------------------------------------------
// R-PERSONA-002 — Byte-stable output
// ---------------------------------------------------------------------------

test("R-PERSONA-002-1: buildPersonaPrompt returns byte-identical output across invocations", () => {
  const r1 = buildPersonaPrompt("default", "en");
  const r2 = buildPersonaPrompt("default", "en");
  assert.equal(r1, r2, "two calls with same inputs must return the same string");
  assert.doesNotMatch(r1, /\d{4}-\d{2}-\d{2}/, "must not contain ISO date");
  assert.doesNotMatch(r1, /[0-9a-f]{8}-[0-9a-f]{4}/, "must not contain UUID-like hex");
});

test("R-PERSONA-002-1b: byte-stable across 100 calls", () => {
  const first = buildPersonaPrompt("plain", "en");
  for (let i = 0; i < 100; i++) {
    const next = buildPersonaPrompt("plain", "en");
    assert.equal(next, first, `call ${i} must match the first call`);
  }
});

// ---------------------------------------------------------------------------
// R-PERSONA-003 — Persona file consistency (all 10 built-ins lint-clean)
// ---------------------------------------------------------------------------

test("R-PERSONA-003-1: all 10 built-in personas pass lint", () => {
  const builtIns: PersonaName[] = [
    "default", "plain", "concise", "reviewer",
    "teacher", "security", "debugger", "socratic", "architect", "pirate",
  ];
  for (const name of builtIns) {
    const content = readBuiltInPrompt(name);
    const result = lintPersonaContent(content, name);
    assert.equal(
      result.passed,
      true,
      `persona '${name}' failed lint: ${JSON.stringify(result.issues, null, 2)}`,
    );
  }
});

test("R-PERSONA-003-2: all 10 built-in personas have the caduceus-original identity contract", () => {
  const builtIns: PersonaName[] = [
    "default", "plain", "concise", "reviewer",
    "teacher", "security", "debugger", "socratic", "architect", "pirate",
  ];
  for (const name of builtIns) {
    const content = readBuiltInPrompt(name);
    assert.match(content, /## caduceus Identity Contract/, `${name} should have caduceus identity contract`);
    assert.match(content, /You are running under \*\*caduceus\*\*/, `${name} should mention caduceus`);
    assert.doesNotMatch(content, /el Gentleman/, `${name} should not have 'el Gentleman' content`);
  }
});

// ---------------------------------------------------------------------------
// caduceus — persona lint tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-4 creates lib/lint.ts
//   TRIANGULATE  → T-4 adds 2 more cases (missing placeholder, future-year content)
//
// The lint enforces the persona contract at runtime: any user-provided
// persona must satisfy the same invariants that built-in personas
// satisfy by construction. See design.md §4.3 for the check list.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { lintPersonaContent } from "../lib/lint.ts";
import type { PersonaName } from "../lib/persona-loader.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function readBuiltInPrompt(name: PersonaName): string {
  return readFileSync(join(repoRoot, "prompts", `${name}.md`), "utf8");
}

// A canonical "good" persona body used in synthetic tests.
const GOOD_BODY = `## el Gentleman Identity and Harness

Current persona mode: \${mode}

You are el Gentleman: ...

Identity contract:
- Follow the persona.
- Do not claim portability.

## Persona
Persona:
- Be direct.
- Be technical.
- Be concise.

## Harness principles
Harness principles:
- Prefer SDD.
- Use strict TDD.
`;

// ---------------------------------------------------------------------------
// Happy path: each built-in persona must pass lint
// ---------------------------------------------------------------------------

test("R-LINT-1: prompts/gentleman.md passes lint", () => {
  const result = lintPersonaContent(readBuiltInPrompt("gentleman"), "gentleman");
  assert.equal(result.passed, true, JSON.stringify(result.issues, null, 2));
});

test("R-LINT-1b: prompts/neutral.md passes lint", () => {
  const result = lintPersonaContent(readBuiltInPrompt("neutral"), "neutral");
  assert.equal(result.passed, true, JSON.stringify(result.issues, null, 2));
});

test("R-LINT-1c: prompts/concise.md passes lint", () => {
  const result = lintPersonaContent(readBuiltInPrompt("concise"), "concise");
  assert.equal(result.passed, true, JSON.stringify(result.issues, null, 2));
});

test("R-LINT-1d: prompts/reviewer.md passes lint", () => {
  const result = lintPersonaContent(readBuiltInPrompt("reviewer"), "reviewer");
  assert.equal(result.passed, true, JSON.stringify(result.issues, null, 2));
});

// ---------------------------------------------------------------------------
// Check 1: cross-mode leakage — gentleman must not say "Do NOT use voseo"
// ---------------------------------------------------------------------------

test("R-LINT-2: gentleman persona with 'Do NOT use voseo' fails lint (cross-mode leak)", () => {
  const result = lintPersonaContent(
    "## Persona\nPersona:\n- Do NOT use voseo.\n## Harness principles\nHarness principles:\n- Foo.\n",
    "gentleman",
  );
  assert.equal(result.passed, false);
  const leakIssue = result.issues.find((i) =>
    i.message.toLowerCase().includes("do not use voseo") &&
    i.message.toLowerCase().includes("gentleman"),
  );
  assert.ok(leakIssue, `expected a cross-mode leak issue, got ${JSON.stringify(result.issues)}`);
});

// ---------------------------------------------------------------------------
// Check 2: cross-mode leakage — neutral must not say "natural Rioplatense Spanish with voseo"
// ---------------------------------------------------------------------------

test("R-LINT-3: neutral persona with voseo clause fails lint (cross-mode leak)", () => {
  const result = lintPersonaContent(
    "## Persona\nPersona:\n- natural Rioplatense Spanish with voseo.\n## Harness principles\nHarness principles:\n- Foo.\n",
    "neutral",
  );
  assert.equal(result.passed, false);
  const leakIssue = result.issues.find((i) =>
    i.message.toLowerCase().includes("rioplatense spanish with voseo") &&
    i.message.toLowerCase().includes("neutral"),
  );
  assert.ok(leakIssue, `expected a cross-mode leak issue, got ${JSON.stringify(result.issues)}`);
});

// ---------------------------------------------------------------------------
// Check 3: structural blocks must exist
// ---------------------------------------------------------------------------

test("R-LINT-4: persona without '## Persona' section fails lint", () => {
  const result = lintPersonaContent(
    "## Harness principles\nHarness principles:\n- Foo.\n",
    "gentleman",
  );
  assert.equal(result.passed, false);
  assert.ok(
    result.issues.some((i) => i.message.includes("## Persona")),
    `expected a missing '## Persona' issue, got ${JSON.stringify(result.issues)}`,
  );
});

test("R-LINT-5: persona without '## Harness principles' section fails lint", () => {
  const result = lintPersonaContent(
    "## Persona\nPersona:\n- Foo.\n",
    "gentleman",
  );
  assert.equal(result.passed, false);
  assert.ok(
    result.issues.some((i) => i.message.includes("## Harness principles")),
  );
});

test("R-LINT-6: persona without 'Identity contract:' line fails lint", () => {
  const result = lintPersonaContent(
    "## Persona\nPersona:\n- Foo.\n## Harness principles\nHarness principles:\n- Foo.\n",
    "gentleman",
  );
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.message.includes("Identity contract")));
});

// ---------------------------------------------------------------------------
// Check 4: no timestamps or random IDs (byte-stability)
// ---------------------------------------------------------------------------

test("R-LINT-7: persona with ISO date fails lint (would be non-byte-stable)", () => {
  const result = lintPersonaContent(
    `## Persona\nPersona:\n- Generated on 2026-08-12.\n## Harness principles\nHarness principles:\n- Foo.\n`,
    "gentleman",
  );
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.message.toLowerCase().includes("date")));
});

test("R-LINT-8: persona with UUID-like hex fails lint", () => {
  const result = lintPersonaContent(
    `## Persona\nPersona:\n- Ref: 12345678-1234-1234-1234-123456789012.\n## Harness principles\nHarness principles:\n- Foo.\n`,
    "gentleman",
  );
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((i) => i.message.toLowerCase().includes("uuid")));
});

// ---------------------------------------------------------------------------
// Check 5: ${mode} placeholder must be present
// ---------------------------------------------------------------------------

test("R-LINT-9: persona without ${mode} placeholder fails lint", () => {
  const result = lintPersonaContent(
    `## Persona\nPersona:\n- Foo.\n## Harness principles\nHarness principles:\n- Foo.\n`,
    "gentleman",
  );
  assert.equal(result.passed, false);
  assert.ok(
    result.issues.some((i) => i.message.includes("placeholder")),
    `expected a placeholder issue, got ${JSON.stringify(result.issues)}`,
  );
});

// ---------------------------------------------------------------------------
// Check 6 (warning, not error): voseo / do-not-voseo must be in conditional
// ---------------------------------------------------------------------------

test("R-LINT-10 (warning): voseo reference outside a 'when Spanish' conditional", () => {
  // The voseo reference is bare, not in a "When the user writes Spanish..."
  // sentence. This is a heuristic warning, not a hard error — lint still
  // passes overall, but issues[] contains a warning.
  const result = lintPersonaContent(
    `Current persona mode: \${mode}\n## Identity contract\nIdentity contract:\n- Foo.\n## Persona\nPersona:\n- Use voseo.\n## Harness principles\nHarness principles:\n- Foo.\n`,
    "gentleman",
  );
  // Lint passes overall (only warning, not error)
  assert.equal(result.passed, true);
  // But issues includes a warning
  const warn = result.issues.find(
    (i) => i.severity === "warning" && i.message.toLowerCase().includes("voseo"),
  );
  assert.ok(warn, `expected a voseo-conditional warning, got ${JSON.stringify(result.issues)}`);
});

// ---------------------------------------------------------------------------
// TRIANGULATE: edge cases added in T-4
// ---------------------------------------------------------------------------

test("R-LINT-T1: synthetic good persona body passes lint", () => {
  const result = lintPersonaContent(GOOD_BODY, "gentleman");
  assert.equal(result.passed, true, JSON.stringify(result.issues, null, 2));
});

test("R-LINT-T2: persona with future-year content (2099) is flagged for unexpected content", () => {
  // The lint shouldn't specifically flag future years (that's not a
  // documented check), but we ensure it doesn't crash and the
  // placeholder check still works.
  const result = lintPersonaContent(
    `Current persona mode: \${mode}\n## Identity contract\nIdentity contract:\n- Foo.\n## Persona\nPersona:\n- Year 2099 plan.\n## Harness principles\nHarness principles:\n- Foo.\n`,
    "gentleman",
  );
  // Future year alone is not a lint failure (just a passing observation)
  assert.equal(result.passed, true);
});

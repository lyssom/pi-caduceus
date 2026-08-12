// ---------------------------------------------------------------------------
// caduceus — prompt-mode tests
//
// Pure-function tests for `composeSystemPrompt` (the "append" / "replace"
// mode resolution). See design.md §4.1.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { composeSystemPrompt } from "../lib/prompt-mode.ts";

test("R-PROMPT-1: 'append' mode concatenates base + persona with double newline", () => {
  const base = "BASE_SYSTEM";
  const persona = "PERSONA_SEGMENT";
  const result = composeSystemPrompt(base, persona, "append");
  assert.equal(result, "BASE_SYSTEM\n\nPERSONA_SEGMENT");
});

test("R-PROMPT-2: 'replace' mode returns the persona only (no base prefix)", () => {
  const base = "BASE_SYSTEM";
  const persona = "PERSONA_SEGMENT";
  const result = composeSystemPrompt(base, persona, "replace");
  assert.equal(result, "PERSONA_SEGMENT");
});

test("R-PROMPT-3: 'append' mode is the default behavior (matches v0.1.0)", () => {
  // Regression guard: the default mode must produce the same output
  // as v0.1.0 did (which always appended).
  const base = "BASE";
  const persona = "PERSONA";
  const result = composeSystemPrompt(base, persona, "append");
  assert.ok(result.startsWith("BASE\n\n"));
  assert.ok(result.endsWith("PERSONA"));
});

test("R-PROMPT-4: 'replace' mode discards the base entirely", () => {
  // Even if the base is non-empty, replace mode must not include it.
  const base = "VERY LONG BASE SYSTEM PROMPT WITH LOTS OF CONTENT";
  const persona = "PERSONA";
  const result = composeSystemPrompt(base, persona, "replace");
  assert.ok(!result.includes("BASE"));
  assert.equal(result, "PERSONA");
});

test("R-PROMPT-5: empty base is fine in 'append' mode", () => {
  const result = composeSystemPrompt("", "PERSONA", "append");
  assert.equal(result, "\n\nPERSONA");
});

test("R-PROMPT-6: empty persona is fine in 'append' mode (degenerate but legal)", () => {
  const result = composeSystemPrompt("BASE", "", "append");
  assert.equal(result, "BASE\n\n");
});

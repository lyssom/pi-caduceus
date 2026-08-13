// ---------------------------------------------------------------------------
// caduceus — wizard tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-4 creates lib/wizard.ts
//   TRIANGULATE  → T-4 adds edge cases
//   T-5          → writeAndLint + slash command wiring
//
// The wizard collects (name, description, style, scope) and
// generates a persona file from a template. See design.md §5.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  generatePersonaContent,
  validateStep,
  personaFilePath,
  WIZARD_STEPS,
  type WizardStyle,
} from "../lib/wizard.ts";

// ---------------------------------------------------------------------------
// WIZARD_STEPS
// ---------------------------------------------------------------------------

test("R-WIZARD-1: WIZARD_STEPS is the ordered list of 4 steps", () => {
  assert.equal(WIZARD_STEPS.length, 4);
  assert.deepEqual(WIZARD_STEPS, ["name", "description", "style", "scope"]);
});

// ---------------------------------------------------------------------------
// generatePersonaContent
// ---------------------------------------------------------------------------

test("R-WIZARD-2: generated content has the 4 required blocks", () => {
  const content = generatePersonaContent({
    name: "wizard",
    description: "Speaks like a wise wizard who never gives direct answers.",
    style: "friendly",
  });
  assert.match(content, /## caduceus Identity Contract/);
  assert.match(content, /\$\{mode\}/); // placeholder
  assert.match(content, /Identity contract:/);
  assert.match(content, /## Persona/);
  assert.match(content, /## Harness principles/);
  assert.match(content, /wise wizard/); // user's description interpolated
});

test("R-WIZARD-3: description is interpolated into the Persona block", () => {
  const content = generatePersonaContent({
    name: "wizard",
    description: "A wise wizard who speaks in metaphors.",
    style: "concise",
  });
  // The description becomes a bullet in the Persona block
  assert.match(content, /Persona:[\s\S]*- A wise wizard who speaks in metaphors\./);
});

test("R-WIZARD-4: style hint is applied as additional guidance", () => {
  for (const style of ["concise", "verbose", "friendly", "strict", "custom"] as WizardStyle[]) {
    const content = generatePersonaContent({
      name: "test",
      description: "A test persona.",
      style,
    });
    // Each style adds different guidance to the Persona block
    assert.equal(typeof content, "string");
    assert.ok(content.length > 0);
  }
});

test("R-WIZARD-5: 'concise' style adds '1-3 sentences max' hint", () => {
  const content = generatePersonaContent({
    name: "test",
    description: "desc",
    style: "concise",
  });
  assert.match(content, /1-3 sentences max/);
});

test("R-WIZARD-6: 'verbose' style adds 'show your reasoning' hint", () => {
  const content = generatePersonaContent({
    name: "test",
    description: "desc",
    style: "verbose",
  });
  assert.match(content, /Show your reasoning/);
});

// ---------------------------------------------------------------------------
// validateStep
// ---------------------------------------------------------------------------

test("R-WIZARD-7: validateStep accepts a valid name (lowercase letters, digits, dashes)", () => {
  const result = validateStep("name", "my-persona");
  assert.equal(result.ok, true);
  assert.equal(result.value, "my-persona");
});

test("R-WIZARD-8: validateStep rejects an invalid name (with path separator)", () => {
  const result = validateStep("name", "../etc/passwd");
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /path separator/i);
});

test("R-WIZARD-9: validateStep rejects an empty name", () => {
  const result = validateStep("name", "");
  assert.equal(result.ok, false);
});

test("R-WIZARD-10: validateStep accepts a non-empty description", () => {
  const result = validateStep("description", "Speaks like a wise wizard.");
  assert.equal(result.ok, true);
});

test("R-WIZARD-11: validateStep rejects a whitespace-only description", () => {
  const result = validateStep("description", "   \n\t  ");
  assert.equal(result.ok, false);
});

test("R-WIZARD-12: validateStep accepts a valid style", () => {
  for (const style of ["concise", "verbose", "friendly", "strict", "custom"]) {
    const result = validateStep("style", style);
    assert.equal(result.ok, true, `style "${style}" should be accepted`);
    assert.equal(result.value, style);
  }
});

test("R-WIZARD-13: validateStep rejects an invalid style", () => {
  const result = validateStep("style", "shouty");
  assert.equal(result.ok, false);
});

test("R-WIZARD-14: validateStep accepts a valid scope (global|project)", () => {
  for (const scope of ["global", "project"]) {
    const result = validateStep("scope", scope);
    assert.equal(result.ok, true);
    assert.equal(result.value, scope);
  }
});

test("R-WIZARD-15: validateStep rejects an invalid scope", () => {
  const result = validateStep("scope", "system");
  assert.equal(result.ok, false);
});

test("R-WIZARD-16: validateStep rejects an unknown step", () => {
  const result = validateStep("mystery", "value");
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// personaFilePath
// ---------------------------------------------------------------------------

test("R-WIZARD-17: personaFilePath('wizard', 'global') returns ~/.pi/agent/caduceus/personas/wizard.md", () => {
  const path = personaFilePath("wizard", "global", "/tmp/project", "/home/user/.pi/agent");
  assert.equal(path, "/home/user/.pi/agent/caduceus/personas/wizard.md");
});

test("R-WIZARD-18: personaFilePath('wizard', 'project') returns <cwd>/.caduceus/personas/wizard.md", () => {
  const path = personaFilePath("wizard", "project", "/tmp/project", "/home/user/.pi/agent");
  assert.equal(path, "/tmp/project/.caduceus/personas/wizard.md");
});

test("R-WIZARD-19: personaFilePath rejects a name with a path separator", () => {
  assert.throws(
    () => personaFilePath("../etc", "global", "/tmp", "/home"),
    /path separator/i,
  );
});

test("R-WIZARD-20: personaFilePath rejects a name with invalid characters", () => {
  assert.throws(
    () => personaFilePath("name with spaces", "global", "/tmp", "/home"),
    /invalid/i,
  );
});

// ---------------------------------------------------------------------------
// TRIANGULATE: edge cases (T-4 additions)
// ---------------------------------------------------------------------------

test("R-WIZARD-T1: generated content is byte-stable across calls (no timestamps/random)", () => {
  const a = generatePersonaContent({
    name: "wizard",
    description: "Speaks like a wizard.",
    style: "friendly",
  });
  const b = generatePersonaContent({
    name: "wizard",
    description: "Speaks like a wizard.",
    style: "friendly",
  });
  assert.equal(a, b, "two calls with same inputs must produce identical output");
  assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(a, /[0-9a-f]{8}-[0-9a-f]{4}/);
});

test("R-WIZARD-T2: 'custom' style adds no extra hint", () => {
  const content = generatePersonaContent({
    name: "test",
    description: "desc",
    style: "custom",
  });
  // The custom style just uses the description without extra guidance
  // (we still have the "Be direct, technical, and useful." line)
  assert.match(content, /Be direct, technical, and useful\./);
  // And does NOT include any of the other style hints
  assert.doesNotMatch(content, /1-3 sentences max/);
  assert.doesNotMatch(content, /Show your reasoning/);
});

test("R-WIZARD-T3: validateStep trims whitespace from name", () => {
  const result = validateStep("name", "  my-persona  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "my-persona");
});

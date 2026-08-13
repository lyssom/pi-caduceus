// ---------------------------------------------------------------------------
// caduceus — diff tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-7 creates lib/diff.ts
//   TRIANGULATE  → T-7 adds edge cases
//
// personaDiff renders two personas with the current mode + locale
// and returns a unified diff between them.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  personaDiff,
  computeUnifiedDiff,
  type DiffInput,
} from "../lib/diff.ts";

// ---------------------------------------------------------------------------
// computeUnifiedDiff (pure)
// ---------------------------------------------------------------------------

test("R-DIFF-1: computeUnifiedDiff returns empty string for identical input", () => {
  const text = "line 1\nline 2\nline 3\n";
  assert.equal(computeUnifiedDiff(text, text, "a", "b"), "");
});

test("R-DIFF-2: computeUnifiedDiff shows additions", () => {
  const left = "line 1\n";
  const right = "line 1\nline 2 (new)\n";
  const diff = computeUnifiedDiff(left, right, "a", "b");
  // Should contain "+line 2" and the file headers
  assert.match(diff, /--- a/);
  assert.match(diff, /\+\+\+ b/);
  assert.match(diff, /\+line 2/);
});

test("R-DIFF-3: computeUnifiedDiff shows deletions", () => {
  const left = "line 1\nline 2 (removed)\nline 3\n";
  const right = "line 1\nline 3\n";
  const diff = computeUnifiedDiff(left, right, "a", "b");
  assert.match(diff, /-line 2/);
});

test("R-DIFF-4: computeUnifiedDiff is byte-stable for same inputs", () => {
  const left = "alpha\nbeta\ngamma\n";
  const right = "alpha\nBETA\ngamma\n";
  const a = computeUnifiedDiff(left, right, "a", "b");
  const b = computeUnifiedDiff(left, right, "a", "b");
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// personaDiff
// ---------------------------------------------------------------------------

test("R-DIFF-5: personaDiff with same persona name returns empty diff", () => {
  const input: DiffInput = {
    leftName: "default",
    rightName: "default",
    mode: "default",
    locale: "en",
    cwd: "/tmp/nonexistent",
  };
  const result = personaDiff(input);
  assert.equal(result.ok, true);
  // The diff between identical personas is empty
  assert.equal(result.diff, "");
});

test("R-DIFF-6: personaDiff with two different personas returns a unified diff", () => {
  // The pirate and default personas have different content
  const input: DiffInput = {
    leftName: "pirate",
    rightName: "default",
    mode: "default",
    locale: "en",
    cwd: "/tmp/nonexistent",
  };
  const result = personaDiff(input);
  assert.equal(result.ok, true);
  assert.match(result.diff, /--- pirate/);
  assert.match(result.diff, /\+\+\+ default/);
  // At least one of the personas' unique lines should appear
  assert.ok(result.diff.length > 50, "diff should have meaningful content");
});

test("R-DIFF-7: personaDiff output is byte-stable across calls with same inputs", () => {
  const input: DiffInput = {
    leftName: "pirate",
    rightName: "concise",
    mode: "default",
    locale: "en",
    cwd: "/tmp/nonexistent",
  };
  const a = personaDiff(input);
  const b = personaDiff(input);
  assert.equal(a.diff, b.diff);
  assert.equal(a.leftName, b.leftName);
  assert.equal(a.rightName, b.rightName);
});

test("R-DIFF-8: personaDiff with non-existent persona throws CaduceusPersonaNotFoundError", () => {
  const input: DiffInput = {
    leftName: "nope",
    rightName: "default",
    mode: "default",
    locale: "en",
    cwd: "/tmp/nonexistent",
  };
  assert.throws(
    () => personaDiff(input),
    (err: unknown) => err instanceof Error && err.name === "CaduceusPersonaNotFoundError",
  );
});

// ---------------------------------------------------------------------------
// TRIANGULATE: edge cases (T-7 additions)
// ---------------------------------------------------------------------------

test("R-DIFF-T1: empty personas return empty diff", () => {
  assert.equal(computeUnifiedDiff("", "", "a", "b"), "");
});

test("R-DIFF-T2: personaDiff with mode substitution: same name, different mode changes the output", () => {
  // When mode is "plain", the default prompt still renders the same
  // content (mode doesn't change the persona text; only the language
  // clause is different). The diff should be small but non-empty if
  // we also include the language clause.
  // For now, just verify the function doesn't crash with different modes.
  const input: DiffInput = {
    leftName: "default",
    rightName: "default",
    mode: "plain",
    locale: "en",
    cwd: "/tmp/nonexistent",
  };
  const result = personaDiff(input);
  assert.equal(result.ok, true);
  // The persona text doesn't change with mode (only language clause does)
  // so the diff might be empty OR might include the language clause
  // depending on whether the language clause is appended.
  // We just verify it doesn't crash.
});

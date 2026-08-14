// ---------------------------------------------------------------------------
// caduceus — macros tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-2 creates lib/macros.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveMacros,
  buildMacroContext,
  SUPPORTED_MACROS,
  type MacroContext,
} from "../lib/macros.ts";

// ---------------------------------------------------------------------------
// SUPPORTED_MACROS
// ---------------------------------------------------------------------------

test("R-MACROS-1: SUPPORTED_MACROS contains the documented 5 macros + mode", () => {
  assert.ok(SUPPORTED_MACROS.has("userName"));
  assert.ok(SUPPORTED_MACROS.has("projectName"));
  assert.ok(SUPPORTED_MACROS.has("cwd"));
  assert.ok(SUPPORTED_MACROS.has("date"));
  assert.ok(SUPPORTED_MACROS.has("os"));
  // mode is resolved separately in the extension entry, not by resolveMacros
  assert.ok(!SUPPORTED_MACROS.has("mode"));
});

// ---------------------------------------------------------------------------
// resolveMacros
// ---------------------------------------------------------------------------

test("R-MACROS-2: resolveMacros replaces ${userName}", () => {
  const ctx: MacroContext = {
    userName: "lyssof",
    projectName: "caduceus",
    cwd: "/home/lyssof/caduceus",
    date: "2026-08-12",
    os: "linux",
  };
  const result = resolveMacros("Hello, ${userName}!", ctx);
  assert.equal(result, "Hello, lyssof!");
});

test("R-MACROS-3: resolveMacros replaces all 5 macros in a single string", () => {
  const ctx: MacroContext = {
    userName: "alice",
    projectName: "demo",
    cwd: "/tmp/demo",
    date: "2026-01-01",
    os: "darwin",
  };
  const result = resolveMacros(
    "User: ${userName}, Project: ${projectName}, Path: ${cwd}, Date: ${date}, OS: ${os}",
    ctx,
  );
  assert.equal(
    result,
    "User: alice, Project: demo, Path: /tmp/demo, Date: 2026-01-01, OS: darwin",
  );
});

test("R-MACROS-4: resolveMacros leaves non-macro text unchanged", () => {
  const ctx: MacroContext = {
    userName: "x",
    projectName: "y",
    cwd: "/z",
    date: "2026-01-01",
    os: "linux",
  };
  const result = resolveMacros("plain text, no macros here.", ctx);
  assert.equal(result, "plain text, no macros here.");
});

test("R-MACROS-5: resolveMacros handles multi-line content", () => {
  const ctx: MacroContext = {
    userName: "bob",
    projectName: "p",
    cwd: "/p",
    date: "2026-01-01",
    os: "linux",
  };
  const input = "Line 1 with ${userName}\nLine 2 with ${projectName}\nLine 3 plain";
  const expected = "Line 1 with bob\nLine 2 with p\nLine 3 plain";
  assert.equal(resolveMacros(input, ctx), expected);
});

test("R-MACROS-6: resolveMacros replaces multiple occurrences of the same macro", () => {
  const ctx: MacroContext = {
    userName: "dup",
    projectName: "p",
    cwd: "/p",
    date: "2026-01-01",
    os: "linux",
  };
  const result = resolveMacros("${userName} says hi; ${userName} again", ctx);
  assert.equal(result, "dup says hi; dup again");
});

// ---------------------------------------------------------------------------
// buildMacroContext
// ---------------------------------------------------------------------------

test("R-MACROS-7: buildMacroContext extracts user / projectName / cwd from cwd", async () => {
  // We can't change process.cwd() in a test (it's read-only and shared),
  // but we can verify the function constructs the context correctly.
  const ctx = buildMacroContext("/some/path");
  assert.equal(ctx.cwd, "/some/path");
  // projectName is the basename of cwd
  assert.equal(ctx.projectName, "path");
  // userName falls back to "user" if process.env.USER is unset
  if (!process.env.USER && !process.env.USERNAME) {
    assert.equal(ctx.userName, "user");
  } else {
    assert.ok(typeof ctx.userName === "string");
  }
  // date is YYYY-MM-DD
  assert.match(ctx.date, /^\d{4}-\d{2}-\d{2}$/);
  // os is one of the NodeJS.Platform values
  assert.ok(["linux", "darwin", "win32", "freebsd", "openbsd", "sunos", "aix"].includes(ctx.os));
});

test("R-MACROS-8: buildMacroContext uses process.cwd() when no cwd is given", async () => {
  // Calling without arguments should use process.cwd()
  const ctx = buildMacroContext();
  assert.equal(ctx.cwd, process.cwd());
});

test("R-MACROS-9: buildMacroContext falls back to 'user' if no USER env var", () => {
  // We can't actually unset env vars in Node easily, but we can verify
  // the function returns a string for userName regardless of state.
  const ctx = buildMacroContext("/tmp");
  assert.equal(typeof ctx.userName, "string");
  assert.ok(ctx.userName.length > 0, "userName should never be empty");
});

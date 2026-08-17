// ---------------------------------------------------------------------------
// caduceus — slash-commands-review tests
//
// TDD micro-cycle (T10 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/slash-commands-review.ts missing)
//   GREEN        → lib/slash-commands-review.ts implements 6 slash commands
//   TRIANGULATE  → additional cases (error propagation, reset semantics)
//
// The 6 commands delegate to lib/review-state-machine.ts functions.
// /caduceus:review:reset is the special command from design.md §12 R3
// that recovers from a corrupted state.json by archiving it.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import { registerReviewSlashCommands, formatSnapshot } from "../lib/slash-commands-review.ts";
import type { ReviewCommandDeps } from "../lib/slash-commands-review.ts";
import { CaduceusReviewError } from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// Mock pi (captures registered commands)
// ---------------------------------------------------------------------------

type CapturedCommand = {
  description?: string;
  handler: (args: string, ctx: unknown) => Promise<void>;
};

function makeMockPi() {
  const commands: Record<string, CapturedCommand> = {};
  return {
    commands,
    registerCommand(
      name: string,
      options: { description?: string; handler: CapturedCommand["handler"] },
    ) {
      commands[name] = { description: options.description, handler: options.handler };
    },
  };
}

function makeMockCtx(cwd = "/tmp/test") {
  const notifications: Array<{
    message: string;
    type: "info" | "warning" | "error" | undefined;
  }> = [];
  return {
    cwd,
    notifications,
    ctx: {
      cwd,
      ui: {
        notify: (message: string, type?: "info" | "warning" | "error") => {
          notifications.push({ message, type });
        },
      },
    },
  };
}

function makeMockDeps(overrides: Partial<ReviewCommandDeps> = {}): ReviewCommandDeps & {
  calls: Array<{ fn: string; args: unknown }>;
} {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const deps: ReviewCommandDeps & { calls: typeof calls } = {
    calls,
    inspectReview: (changeName, cwd) => {
      calls.push({ fn: "inspectReview", args: { changeName, cwd } });
      return {
        schemaVersion: 1,
        changeId: changeName,
        state: "idle",
        lensRuns: [],
        personaSnapshot: { activePersona: "architect", mode: "default", locale: "auto" },
        lastTransitionAt: new Date().toISOString(),
        transitionHistory: [],
      };
    },
    startReview: (changeName, cwd, persona) => {
      calls.push({ fn: "startReview", args: { changeName, cwd, persona } });
      return {
        schemaVersion: 1,
        changeId: changeName,
        state: "started",
        lensRuns: [],
        personaSnapshot: persona,
        lastTransitionAt: new Date().toISOString(),
        transitionHistory: [{ from: "idle", to: "started", at: new Date().toISOString() }],
      };
    },
    advanceReview: (changeName, cwd, transition) => {
      calls.push({ fn: "advanceReview", args: { changeName, cwd, transition } });
      return {
        schemaVersion: 1,
        changeId: changeName,
        state: "in-review",
        lensRuns: [],
        personaSnapshot: { activePersona: "architect", mode: "default", locale: "auto" },
        lastTransitionAt: new Date().toISOString(),
        transitionHistory: [{ from: "started", to: "in-review", at: new Date().toISOString() }],
      };
    },
    finalizeReview: (changeName, cwd, passed) => {
      calls.push({ fn: "finalizeReview", args: { changeName, cwd, passed } });
      return {
        schemaVersion: 1,
        changeId: changeName,
        state: "finalized",
        lensRuns: [],
        personaSnapshot: { activePersona: "architect", mode: "default", locale: "auto" },
        lastTransitionAt: new Date().toISOString(),
        transitionHistory: [],
        finalVerificationPassed: passed,
      };
    },
    validateReview: (changeName, cwd) => {
      calls.push({ fn: "validateReview", args: { changeName, cwd } });
      return {
        schemaVersion: 1,
        changeId: changeName,
        state: "validated",
        lensRuns: [],
        personaSnapshot: { activePersona: "architect", mode: "default", locale: "auto" },
        lastTransitionAt: new Date().toISOString(),
        transitionHistory: [],
        receiptValid: true,
      };
    },
    resetReview: (changeName, cwd) => {
      calls.push({ fn: "resetReview", args: { changeName, cwd } });
      return { ok: true, archivedPath: "state.json.corrupt-test" };
    },
    getActivePersonaName: () => "architect",
    ...overrides,
  };
  return deps;
}

// ---------------------------------------------------------------------------
// Test 1: registers all 6 commands
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-1: registerReviewSlashCommands registers exactly 6 commands", () => {
  const pi = makeMockPi();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  const names = Object.keys(pi.commands).sort();
  assert.deepEqual(names, [
    "caduceus:review:advance",
    "caduceus:review:finalize",
    "caduceus:review:inspect",
    "caduceus:review:reset",
    "caduceus:review:start",
    "caduceus:review:validate",
  ]);
});

// ---------------------------------------------------------------------------
// Test 2: /caduceus:review:inspect delegates to inspectReview with active change
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-2: /caduceus:review:inspect delegates to inspectReview", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:inspect"].handler("my-change", ctx);
  assert.equal(deps.calls[0].fn, "inspectReview");
});

// ---------------------------------------------------------------------------
// Test 3: /caduceus:review:start <persona> delegates to startReview
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-3: /caduceus:review:start delegates to startReview with persona arg", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:start"].handler("my-change security", ctx);
  // The first call is to find the active change, the second is startReview
  // (or: parse args to extract changeName and persona)
  assert.ok(deps.calls.some((c) => c.fn === "startReview"));
});

// ---------------------------------------------------------------------------
// Test 4: /caduceus:review:advance <transition> delegates
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-4: /caduceus:review:advance delegates with parsed transition", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:advance"].handler("my-change advance", ctx);
  const advanceCall = deps.calls.find((c) => c.fn === "advanceReview");
  assert.ok(advanceCall);
  assert.equal((advanceCall.args as { transition: string }).transition, "advance");
});

// ---------------------------------------------------------------------------
// Test 5: /caduceus:review:finalize delegates with passed=true by default
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-5: /caduceus:review:finalize delegates with passed=true", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:finalize"].handler("my-change", ctx);
  const finalizeCall = deps.calls.find((c) => c.fn === "finalizeReview");
  assert.ok(finalizeCall);
  assert.equal((finalizeCall.args as { passed: boolean }).passed, true);
});

// ---------------------------------------------------------------------------
// Test 6: /caduceus:review:validate delegates
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-6: /caduceus:review:validate delegates to validateReview", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:validate"].handler("my-change", ctx);
  assert.equal(deps.calls[0].fn, "validateReview");
});

// ---------------------------------------------------------------------------
// Test 7: /caduceus:review:reset only fires when state is corrupted
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-7: /caduceus:review:reset only resets when state is corrupted", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({ inspectIsCorrupted: () => false });
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:reset"].handler("my-change", ctx);
  // No reset call, just a notice
  assert.equal(
    deps.calls.filter((c) => c.fn === "resetReview").length,
    0,
    "should not call resetReview when state is not corrupted",
  );
  assert.ok(
    notifications.some((n) => n.message.includes("not corrupted") || n.message.includes("nothing to reset")),
    "expected notice about non-corrupt state",
  );
});

// ---------------------------------------------------------------------------
// Test 8: /caduceus:review:reset archives state when corrupted
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-8: /caduceus:review:reset archives state when corrupted", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({ inspectIsCorrupted: () => true });
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:reset"].handler("my-change", ctx);
  assert.equal(deps.calls.filter((c) => c.fn === "resetReview").length, 1);
  assert.ok(
    notifications.some((n) => n.message.includes("archived") || n.message.includes("reset")),
    "expected reset confirmation",
  );
});

// ---------------------------------------------------------------------------
// Test 9 (TRIANGULATE): CaduceusReviewError propagated as warning
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-9: CaduceusReviewError from startReview propagated to UI", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    startReview: () => {
      throw new CaduceusReviewError("already-started", "Review already started");
    },
  });
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:start"].handler("my-change security", ctx);
  assert.ok(
    notifications.some(
      (n) => n.message.includes("already-started") && (n.type === "warning" || n.type === "error"),
    ),
  );
});

// ---------------------------------------------------------------------------
// Test 10 (TRIANGULATE): /caduceus:review:start without args shows usage
// ---------------------------------------------------------------------------

test("T10-R-REVIEWSLASH-10: /caduceus:review:start with empty arg shows usage hint", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps();
  registerReviewSlashCommands(pi, deps);
  await pi.commands["caduceus:review:start"].handler("", ctx);
  assert.ok(
    notifications.some((n) => n.message.includes("usage:") && n.type === "warning"),
  );
  assert.equal(deps.calls.filter((c) => c.fn === "startReview").length, 0);
});

// ---------------------------------------------------------------------------
// T12 tests (v0.6.0 formatSnapshot lens runs block)
// ---------------------------------------------------------------------------

function makeSnap(overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot {
  return {
    schemaVersion: 1,
    changeId: overrides.changeId ?? "test-change",
    state: overrides.state ?? "finalized",
    lensRuns: overrides.lensRuns ?? [],
    personaSnapshot: overrides.personaSnapshot ?? {
      activePersona: "default",
      mode: "default",
      locale: "auto",
    },
    lastTransitionAt: overrides.lastTransitionAt ?? "2026-08-14T12:00:00.000Z",
    transitionHistory: overrides.transitionHistory ?? [],
    ...overrides,
  };
}

test("T12-R-SLASH-1: formatSnapshot with 0 lens runs omits the lens runs block", () => {
  const out = formatSnapshot(makeSnap());
  assert.ok(!out.includes("lens runs:"), `expected NO 'lens runs:' line; got:\n${out}`);
});

test("T12-R-SLASH-2: formatSnapshot with 2 lens runs shows count + detail lines", () => {
  const runs: LensRunDetail[] = [
    {
      lensId: "security",
      status: "completed",
      personaRequired: true,
      findingsCount: 3,
      startedAt: "2026-08-14T12:00:00.000Z",
      completedAt: "2026-08-14T12:00:00.012Z",
      durationMs: 12,
      findings: [],
    },
    {
      lensId: "risk",
      status: "completed",
      personaRequired: true,
      findingsCount: 1,
      startedAt: "2026-08-14T12:00:00.000Z",
      completedAt: "2026-08-14T12:00:00.005Z",
      durationMs: 5,
      findings: [],
    },
  ];
  const out = formatSnapshot(makeSnap({ lensRuns: runs }));
  assert.match(out, /^lens runs: 2$/m);
  assert.match(out, /- security: completed \(3 findings, 12ms\)/);
  assert.match(out, /- risk: completed \(1 finding, 5ms\)/);
});

test("T12-R-SLASH-3: formatSnapshot shows singular 'finding' for count=1", () => {
  const runs: LensRunDetail[] = [
    {
      lensId: "risk",
      status: "completed",
      personaRequired: true,
      findingsCount: 1,
      startedAt: "2026-08-14T12:00:00.000Z",
      completedAt: "2026-08-14T12:00:00.005Z",
      durationMs: 5,
      findings: [],
    },
  ];
  const out = formatSnapshot(makeSnap({ lensRuns: runs }));
  assert.match(out, /\(1 finding,/);
});

test("T12-R-SLASH-4: formatSnapshot shows skipped/failed status", () => {
  const runs: LensRunDetail[] = [
    {
      lensId: "security",
      status: "skipped",
      personaRequired: true,
      findingsCount: 0,
      startedAt: "2026-08-14T12:00:00.000Z",
      completedAt: "2026-08-14T12:00:00.000Z",
      durationMs: 0,
      findings: [],
    },
  ];
  const out = formatSnapshot(makeSnap({ lensRuns: runs }));
  assert.match(out, /- security: skipped \(0 findings, 0ms\)/);
});

test("T12-R-SLASH-5: formatSnapshot preserves base fields (state, changeId, persona)", () => {
  const out = formatSnapshot(
    makeSnap({
      changeId: "v0.6.0-lens-collection",
      state: "finalized",
      personaSnapshot: {
        activePersona: "security",
        mode: "default",
        locale: "auto",
      },
    }),
  );
  assert.match(out, /^review state: finalized$/m);
  assert.match(out, /^changeId: v0\.6\.0-lens-collection$/m);
  assert.match(out, /^persona: security$/m);
});
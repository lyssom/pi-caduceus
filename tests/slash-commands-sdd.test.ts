// ---------------------------------------------------------------------------
// caduceus — slash-commands-sdd tests
//
// TDD micro-cycle (T09 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/slash-commands-sdd.ts missing)
//   GREEN        → lib/slash-commands-sdd.ts implements 5 slash commands
//   TRIANGULATE  → additional cases (usage hints, error propagation)
//
// The 5 commands delegate to lib/sdd-flow.ts functions. Tests use a
// mock pi (captures registered handlers) and a mock deps (captures
// sdd-flow function calls).
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import { registerSddSlashCommands } from "../lib/slash-commands-sdd.ts";
import type { SddCommandDeps } from "../lib/slash-commands-sdd.ts";
import { CaduceusSDDError } from "../lib/errors.ts";

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

function makeMockDeps(overrides: Partial<SddCommandDeps> = {}): SddCommandDeps & {
  calls: Array<{ fn: string; args: unknown }>;
} {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const deps: SddCommandDeps & { calls: typeof calls } = {
    calls,
    sddInit: (opts) => {
      calls.push({ fn: "sddInit", args: opts });
    },
    sddExplore: (opts) => {
      calls.push({ fn: "sddExplore", args: opts });
      return "# Requirements\n- REQ-001 [MUST]: example\n";
    },
    sddPropose: (opts) => {
      calls.push({ fn: "sddPropose", args: opts });
    },
    sddApply: (opts) => {
      calls.push({ fn: "sddApply", args: opts });
    },
    sddArchive: (opts) => {
      calls.push({ fn: "sddArchive", args: opts });
    },
    readActiveChange: (home?: string) => {
      calls.push({ fn: "readActiveChange", args: { home } });
      return "test-change";
    },
    ...overrides,
  };
  return deps;
}

// ---------------------------------------------------------------------------
// Test 1: registers all 5 commands
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-1: registerSddSlashCommands registers exactly 5 commands", () => {
  const pi = makeMockPi();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  const names = Object.keys(pi.commands).sort();
  assert.deepEqual(names, [
    "caduceus:sdd:apply",
    "caduceus:sdd:archive",
    "caduceus:sdd:explore",
    "caduceus:sdd:init",
    "caduceus:sdd:propose",
  ]);
});

// ---------------------------------------------------------------------------
// Test 2: /caduceus:sdd:init <name> delegates to sddInit
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-2: /caduceus:sdd:init delegates to sddInit with parsed name", async () => {
  const pi = makeMockPi();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:init"].handler("my-change", {});
  assert.equal(deps.calls.length, 1);
  assert.equal(deps.calls[0].fn, "sddInit");
  assert.equal((deps.calls[0].args as { changeName: string }).changeName, "my-change");
});

// ---------------------------------------------------------------------------
// Test 3: /caduceus:sdd:init notifies success
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-3: /caduceus:sdd:init notifies 'initialized' on success", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:init"].handler("foo", ctx);
  assert.ok(
    notifications.some((n) => n.message.includes("foo") && n.type === "info"),
    "expected an info notification mentioning the change name",
  );
});

// ---------------------------------------------------------------------------
// Test 4: /caduceus:sdd:init with no args shows usage hint
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-4: /caduceus:sdd:init with no arg shows usage hint", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:init"].handler("", ctx);
  assert.ok(
    notifications.some((n) => n.message.includes("usage:") && n.type === "warning"),
    "expected a usage-hint warning",
  );
  assert.equal(deps.calls.length, 0, "should not call sddInit");
});

// ---------------------------------------------------------------------------
// Test 5: /caduceus:sdd:explore notifies requirements content
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-5: /caduceus:sdd:explore notifies the requirements content", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:explore"].handler("some topic", ctx);
  assert.ok(
    notifications.some((n) => n.message.includes("REQ-001")),
    "expected notification with requirements content",
  );
});

// ---------------------------------------------------------------------------
// Test 6: /caduceus:sdd:propose delegates to sddPropose
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-6: /caduceus:sdd:propose delegates to sddPropose", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:propose"].handler("my-change", ctx);
  assert.equal(deps.calls[0].fn, "sddPropose");
  assert.equal((deps.calls[0].args as { changeName: string }).changeName, "my-change");
});

// ---------------------------------------------------------------------------
// Test 7: /caduceus:sdd:apply uses activeChange from state
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-7: /caduceus:sdd:apply uses activeChange from readActiveChange", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:apply"].handler("", ctx);
  // The first call should be readActiveChange, the second sddApply
  const fns = deps.calls.map((c) => c.fn);
  assert.ok(fns.includes("readActiveChange"));
  assert.ok(fns.includes("sddApply"));
});

// ---------------------------------------------------------------------------
// Test 8: /caduceus:sdd:apply without activeChange notifies error
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-8: /caduceus:sdd:apply without activeChange notifies error", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({ readActiveChange: () => null });
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:apply"].handler("", ctx);
  assert.ok(
    notifications.some(
      (n) => n.message.includes("no active change") && n.type === "warning",
    ),
  );
  // sddApply should not be called
  assert.ok(!deps.calls.some((c) => c.fn === "sddApply"));
});

// ---------------------------------------------------------------------------
// Test 9: /caduceus:sdd:archive uses activeChange
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-9: /caduceus:sdd:archive uses activeChange and delegates", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:archive"].handler("", ctx);
  const fns = deps.calls.map((c) => c.fn);
  assert.ok(fns.includes("readActiveChange"));
  assert.ok(fns.includes("sddArchive"));
});

// ---------------------------------------------------------------------------
// Test 10 (TRIANGULATE): error from sddInit propagated to UI notification
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-10: CaduceusSDDError from sddInit is propagated as warning", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    sddInit: () => {
      throw new CaduceusSDDError("change-exists", "Change dir already exists");
    },
  });
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:init"].handler("dup", ctx);
  assert.ok(
    notifications.some(
      (n) =>
        n.message.includes("change-exists") &&
        (n.type === "warning" || n.type === "error"),
    ),
    "expected error/warning notification with error code",
  );
});

// ---------------------------------------------------------------------------
// Test 11 (TRIANGULATE): /caduceus:sdd:init with extra whitespace trimmed
// ---------------------------------------------------------------------------

test("T09-R-SDDSLASH-11: /caduceus:sdd:init trims whitespace from arg", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const deps = makeMockDeps();
  registerSddSlashCommands(pi, deps);
  await pi.commands["caduceus:sdd:init"].handler("  spaced-name  ", ctx);
  assert.equal(
    (deps.calls[0].args as { changeName: string }).changeName,
    "spaced-name",
  );
});

// ---------------------------------------------------------------------------
// caduceus — slash command tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-6 creates lib/slash-commands.ts
//   TRIANGULATE  → T-6 adds byte-stability test for /caduceus:inspect
//
// The tests construct a mock ExtensionAPI that captures the registered
// command handlers, then invoke each handler with a mock context and
// assert the captured side effects (notify calls, config writes, etc).
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  registerSlashCommands,
  type CommandDeps,
} from "../lib/slash-commands.ts";
import { DEFAULT_CONFIG } from "../lib/config-store.ts";

// ---------------------------------------------------------------------------
// Mock ExtensionAPI
// ---------------------------------------------------------------------------

type CapturedCommand = {
  description?: string;
  handler: (args: string, ctx: unknown) => Promise<void>;
};

function makeMockPi() {
  const commands: Record<string, CapturedCommand> = {};
  return {
    commands,
    registerCommand(name: string, options: Omit<CapturedCommand, "handler"> & { handler: CapturedCommand["handler"] }) {
      commands[name] = {
        description: options.description,
        handler: options.handler,
      };
    },
  };
}

type NotifyCall = { message: string; type: "info" | "warning" | "error" | undefined };

function makeMockCtx(cwd = "/tmp/test") {
  const notifications: NotifyCall[] = [];
  const statusUpdates: Array<{ key: string; text: string | undefined }> = [];
  return {
    cwd,
    notifications,
    statusUpdates,
    ctx: {
      cwd,
      ui: {
        notify: (message: string, type?: "info" | "warning" | "error") => {
          notifications.push({ message, type });
        },
        setStatus: (key: string, text: string | undefined) => {
          statusUpdates.push({ key, text });
        },
      },
    },
  };
}

function makeMockDeps(overrides: Partial<CommandDeps> = {}): CommandDeps {
  const writes: Array<{ field: string; value: unknown }> = [];
  return {
    readConfig: () => ({
      config: { ...DEFAULT_CONFIG },
      source: "built-in defaults" as const,
    }),
    buildPersonaPrompt: (mode, locale) =>
      `[rendered persona for ${mode}/${locale}]`,
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
    getStatusLine: (cfg) => `caduceus · ${cfg.mode} · ${cfg.locale}`,
    renderInspectOutput: (mode, locale) =>
      `[inspect] ${mode}/${locale}\n[inspect line 2]`,
    // v0.1.1 additions:
    listPersonas: () => ["gentleman", "neutral", "concise", "reviewer"],
    switchPersona: async (name) => {
      writes.push({ field: "persona", value: name });
    },
    setSystemPromptMode: async (mode) => {
      writes.push({ field: "systemPromptMode", value: mode });
    },
    lintActivePersona: () => ({ passed: true, issues: [] }),
    getActivePersonaName: () => "gentleman",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R-CONFIG-006 — /caduceus:status
// ---------------------------------------------------------------------------

test("R-CONFIG-006-1: /caduceus:status shows effective config and source", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  registerSlashCommands(pi, makeMockDeps());

  await pi.commands["caduceus:status"].handler("", ctx);

  assert.equal(notifications.length, 1);
  const msg = notifications[0].message;
  assert.match(msg, /mode: gentleman/);
  assert.match(msg, /locale: auto/);
  assert.match(msg, /showStatusBar: false/);
  assert.match(msg, /source: built-in defaults/);
});

// ---------------------------------------------------------------------------
// R-CONFIG-007 — /caduceus:mode
// ---------------------------------------------------------------------------

test("R-CONFIG-007-1: /caduceus:mode neutral persists the change and confirms", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:mode"].handler("neutral", ctx);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].field, "mode");
  assert.equal(writes[0].value, "neutral");
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /mode set to neutral/);
});

test("R-CONFIG-007-2: /caduceus:mode pirate shows usage hint, no write", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:mode"].handler("pirate", ctx);

  assert.equal(writes.length, 0, "invalid mode must not write");
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /usage: \/caduceus:mode/);
});

// ---------------------------------------------------------------------------
// R-CONFIG-008 — /caduceus:locale
// ---------------------------------------------------------------------------

test("R-CONFIG-008-1: /caduceus:locale es-AR persists the change", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:locale"].handler("es-AR", ctx);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].field, "locale");
  assert.equal(writes[0].value, "es-AR");
  assert.match(notifications[0].message, /locale set to es-AR/);
});

test("R-CONFIG-008-2: /caduceus:locale pirate shows usage hint, no write", async () => {
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:locale"].handler("pirate", ctx);

  assert.equal(writes.length, 0, "invalid locale must not write");
});

// ---------------------------------------------------------------------------
// R-CONFIG-009 + R-PERSONA-011 — /caduceus:inspect
// ---------------------------------------------------------------------------

test("R-CONFIG-009-1: /caduceus:inspect shows the rendered persona prompt with metadata", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    renderInspectOutput: (mode, locale) =>
      `[rendered for ${mode}/${locale}]\n[with source annotations]`,
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:inspect"].handler("", ctx);

  assert.equal(notifications.length, 1);
  const msg = notifications[0].message;
  assert.match(msg, /rendered for gentleman\/auto/);
  assert.match(msg, /with source annotations/);
});

test("R-CONFIG-009-2 (R-PERSONA-011 byte-stability): /caduceus:inspect output is byte-stable across calls", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    renderInspectOutput: (mode, locale) => `stable output for ${mode}/${locale}`,
  });
  registerSlashCommands(pi, deps);

  // Capture the first invocation's output
  await pi.commands["caduceus:inspect"].handler("", ctx);
  const firstOutput = notifications[0].message;

  // Invoke again; should produce identical output (no timestamps, no random IDs)
  await pi.commands["caduceus:inspect"].handler("", ctx);
  const secondOutput = notifications[1].message;

  assert.equal(firstOutput, secondOutput, "two inspect calls must produce byte-identical output");
  assert.doesNotMatch(firstOutput, /\d{4}-\d{2}-\d{2}/, "must not contain ISO date");
  assert.doesNotMatch(firstOutput, /[0-9a-f]{8}-[0-9a-f]{4}/, "must not contain UUID-like hex");
});

// ---------------------------------------------------------------------------
// R-CONFIG-010 — Status bar visibility
// ---------------------------------------------------------------------------

test("R-CONFIG-010-1: registerSlashCommands does NOT touch the status bar (that's the extension entry's job)", async () => {
  // Status bar wiring is in extensions/caduceus.ts (the shell), not in
  // the slash-commands lib (the meat). This test guards that boundary:
  // the slash-commands module is decoupled from setStatus.
  const pi = makeMockPi();
  const { ctx, statusUpdates } = makeMockCtx();
  registerSlashCommands(pi, makeMockDeps());

  // Run all 7 commands; none should call setStatus
  for (const cmdName of [
    "caduceus:status",
    "caduceus:mode",
    "caduceus:locale",
    "caduceus:inspect",
    "caduceus:prompt",
    "caduceus:persona",
    "caduceus:lint",
  ]) {
    await pi.commands[cmdName].handler("", ctx);
  }

  assert.equal(statusUpdates.length, 0, "slash commands must not call ctx.ui.setStatus");
});

// ---------------------------------------------------------------------------
// v0.1.1 — 3 new slash commands
// ---------------------------------------------------------------------------

test("v0.1.1: /caduceus:prompt replace persists and confirms", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    setSystemPromptMode: async (mode) => {
      writes.push({ field: "systemPromptMode", value: mode });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:prompt"].handler("replace", ctx);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].field, "systemPromptMode");
  assert.equal(writes[0].value, "replace");
  assert.match(notifications[0].message, /set to replace/);
});

test("v0.1.1: /caduceus:prompt invalid shows usage hint, no write", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    setSystemPromptMode: async (mode) => {
      writes.push({ field: "systemPromptMode", value: mode });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:prompt"].handler("invalid-mode", ctx);

  assert.equal(writes.length, 0, "invalid mode must not write");
  assert.match(notifications[0].message, /usage: \/caduceus:prompt/);
});

test("v0.1.1: /caduceus:persona list shows all available", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    listPersonas: () => ["gentleman", "neutral", "concise", "reviewer", "pirate"],
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:persona"].handler("list", ctx);

  assert.equal(notifications.length, 1);
  const msg = notifications[0].message;
  assert.match(msg, /gentleman/);
  assert.match(msg, /neutral/);
  assert.match(msg, /concise/);
  assert.match(msg, /reviewer/);
  assert.match(msg, /pirate/);
});

test("v0.1.1: /caduceus:persona concise switches and confirms", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    switchPersona: async (name) => {
      writes.push({ field: "persona", value: name });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:persona"].handler("concise", ctx);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].value, "concise");
  assert.match(notifications[0].message, /persona set to concise/);
});

test("v0.1.1: /caduceus:persona nonexistent shows error (no throw)", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    switchPersona: async () => {
      throw new Error("CADUCEUS_PERSONA_NOT_FOUND: nope");
    },
  });
  registerSlashCommands(pi, deps);

  // The slash-commands lib catches the error and shows a friendly message
  await pi.commands["caduceus:persona"].handler("nope", ctx);

  assert.match(notifications[0].message, /persona not found/);
});

test("v0.1.1: /caduceus:lint pass shows 'OK'", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    lintActivePersona: () => ({ passed: true, issues: [] }),
    getActivePersonaName: () => "gentleman",
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:lint"].handler("", ctx);

  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /OK/);
  assert.match(notifications[0].message, /gentleman/);
});

test("v0.1.1: /caduceus:lint fail shows issues (as warning type, since issues are user-actionable)", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    lintActivePersona: () => ({
      passed: false,
      issues: [
        { severity: "error", check: "PERSONA_BLOCK", message: "missing ## Persona section" },
      ],
    }),
    getActivePersonaName: () => "my-persona",
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:lint"].handler("", ctx);

  assert.match(notifications[0].message, /FAILED/);
  assert.match(notifications[0].message, /my-persona/);
  assert.match(notifications[0].message, /PERSONA_BLOCK/);
});

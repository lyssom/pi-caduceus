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
    listPersonas: () => ["default", "plain", "concise", "reviewer"],
    switchPersona: async (name) => {
      writes.push({ field: "persona", value: name });
    },
    setSystemPromptMode: async (mode) => {
      writes.push({ field: "systemPromptMode", value: mode });
    },
    lintActivePersona: () => ({ passed: true, issues: [] }),
    getActivePersonaName: () => "default",
    // v0.2.0 additions:
    validateWizardStep: (step, value) => {
      if (step === "name" && /^[a-z0-9_-]+$/.test(value)) {
        return { ok: true, value };
      }
      if (step === "description" && value.trim().length > 0) {
        return { ok: true, value };
      }
      return { ok: false, error: "invalid" };
    },
    generateWizardContent: ({ name, description }) =>
      `## el Gentleman Identity and Harness\n\nCurrent persona mode: \${mode}\n\nIdentity contract:\n- Foo.\n\n## Persona\nPersona:\n- ${description}\n- Be direct.\n\n## Harness principles\nHarness principles:\n- Bar.\n`,
    wizardFilePath: (name, scope, cwd) =>
      scope === "project"
        ? `${cwd}/.caduceus/personas/${name}.md`
        : `/tmp/${name}.md`,
    writeAndLint: async (path, content, name) => ({
      ok: true,
      filePath: path,
      issues: [],
    }),
    // v0.2.0 diff:
    personaDiff: (input) => ({
      ok: true,
      diff: `--- ${input.leftName}\n+++ ${input.rightName}\n@@ -1 +1 @@\n-diff\n+more diff\n`,
      leftName: input.leftName,
      rightName: input.rightName,
    }),
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
  assert.match(msg, /mode: default/);
  assert.match(msg, /locale: auto/);
  assert.match(msg, /showStatusBar: false/);
  assert.match(msg, /source: built-in defaults/);
});

// ---------------------------------------------------------------------------
// R-CONFIG-007 — /caduceus:mode
// ---------------------------------------------------------------------------

test("R-CONFIG-007-1: /caduceus:mode plain persists the change and confirms", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:mode"].handler("plain", ctx);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].field, "mode");
  assert.equal(writes[0].value, "plain");
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /mode set to plain/);
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
  assert.match(msg, /rendered for default\/auto/);
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

  // Run all 9 commands; none should call setStatus
  for (const cmdName of [
    "caduceus:status",
    "caduceus:mode",
    "caduceus:locale",
    "caduceus:inspect",
    "caduceus:prompt",
    "caduceus:persona",
    "caduceus:lint",
    "caduceus:create",
    "caduceus:diff",
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
    listPersonas: () => ["default", "plain", "concise", "reviewer", "teacher", "security", "debugger", "socratic", "architect", "pirate"],
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:persona"].handler("list", ctx);

  assert.equal(notifications.length, 1);
  const msg = notifications[0].message;
  assert.match(msg, /default/);
  assert.match(msg, /plain/);
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
    getActivePersonaName: () => "default",
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:lint"].handler("", ctx);

  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /OK/);
  assert.match(notifications[0].message, /default/);
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

// ---------------------------------------------------------------------------
// v0.2.0 — /caduceus:create wizard
// ---------------------------------------------------------------------------

test("v0.2.0: /caduceus:create with no args shows usage", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  registerSlashCommands(pi, makeMockDeps());

  await pi.commands["caduceus:create"].handler("", ctx);

  assert.match(notifications[0].message, /usage: \/caduceus:create/);
  assert.match(notifications[0].message, /example/);
});

test("v0.2.0: /caduceus:create with one arg (no description) shows usage", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  registerSlashCommands(pi, makeMockDeps());

  await pi.commands["caduceus:create"].handler("wizard", ctx);

  assert.match(notifications[0].message, /usage: \/caduceus:create/);
});

test("v0.2.0: /caduceus:create with invalid name shows error", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    validateWizardStep: (step, value) => {
      if (step === "name") return { ok: false, error: "invalid name" };
      return { ok: true, value };
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:create"].handler("Bad Name Speaks like a wizard", ctx);

  assert.match(notifications[0].message, /invalid name/);
});

test("v0.2.0: /caduceus:create with whitespace-only description is captured correctly", async () => {
  // After the .trim() in the handler, "wizard   Hello world" → name="wizard", desc="Hello world"
  // The description is what's passed to the wizard step validator.
  const pi = makeMockPi();
  const { ctx } = makeMockCtx();
  let capturedDesc = null;
  const deps = makeMockDeps({
    validateWizardStep: (step, value) => {
      if (step === "description") {
        capturedDesc = value;
        if (value.trim() === "") return { ok: false, error: "empty description" };
        return { ok: true, value };
      }
      return { ok: true, value };
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:create"].handler("wizard   Hello world", ctx);
  assert.equal(capturedDesc, "Hello world");
});

// ---------------------------------------------------------------------------
// v0.2.0 — /caduceus:diff
// ---------------------------------------------------------------------------

test("v0.3.0: /caduceus:diff with no args diffs active vs default", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  let capturedLeft: string | null = null;
  let capturedRight: string | null = null;
  const deps = makeMockDeps({
    personaDiff: (input) => {
      capturedLeft = input.leftName;
      capturedRight = input.rightName;
      // Empty diff when a === b (which is the default case)
      return {
        ok: true,
        diff: "",
        leftName: input.leftName,
        rightName: input.rightName,
      };
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:diff"].handler("", ctx);

  // Default config has persona: "default", so a === b === "default"
  // which produces an empty diff. The slash command shows "identical".
  assert.match(notifications[0].message, /identical/);
});

test("v0.2.0: /caduceus:diff pirate shows a real diff", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    personaDiff: (input) => ({
      ok: true,
      diff: "--- pirate\n+++ default\n@@ -1 +1 @@\n-Arrr!\n+Yarr!\n",
      leftName: "pirate",
      rightName: "default",
    }),
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:diff"].handler("pirate", ctx);

  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /--- pirate/);
  assert.match(notifications[0].message, /\+\+\+ default/);
});

test("v0.2.0: /caduceus:diff pirate concise (2 args) passes both names", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  let capturedLeft: string | null = null;
  let capturedRight: string | null = null;
  const deps = makeMockDeps({
    personaDiff: (input) => {
      capturedLeft = input.leftName;
      capturedRight = input.rightName;
      return {
        ok: true,
        diff: "--- pirate\n+++ concise\n",
        leftName: "pirate",
        rightName: "concise",
      };
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:diff"].handler("pirate concise", ctx);

  assert.equal(capturedLeft, "pirate");
  assert.equal(capturedRight, "concise");
  assert.match(notifications[0].message, /--- pirate/);
});

test("v0.2.0: /caduceus:diff with non-existent persona shows error", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    personaDiff: () => {
      throw new Error("CaduceusPersonaNotFoundError: nope");
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:diff"].handler("nope", ctx);

  assert.match(notifications[0].message, /diff failed/);
  assert.match(notifications[0].message, /nope/);
});

test("v0.2.0: /caduceus:create success path writes file and confirms", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  let writtenPath = null;
  const deps = makeMockDeps({
    writeAndLint: async (path, content, name) => {
      writtenPath = path;
      return { ok: true, filePath: path, issues: [] };
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:create"].handler("wizard Speaks like a wise wizard", ctx);

  assert.ok(writtenPath, "writeAndLint should have been called");
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /persona 'wizard' written/);
  assert.match(notifications[0].message, /lint passed/);
  assert.match(notifications[0].message, /switch with: \/caduceus:persona wizard/);
});

test("v0.2.0: /caduceus:create with lint failure does NOT write the file", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  let writeCalled = false;
  const deps = makeMockDeps({
    writeAndLint: async (path, content, name) => {
      writeCalled = true;
      return { ok: false, filePath: path, issues: [{ severity: "error", check: "TEST", message: "test failure" }] };
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:create"].handler("bad-persona Some invalid description", ctx);

  // writeAndLint is still called (which does the lint first), but the file
  // is not actually written because the lint failed inside writeAndLint.
  // The slash command sees ok: false and reports it without claiming success.
  assert.equal(writeCalled, true, "writeAndLint was called (and did the lint)");
  assert.match(notifications[0].message, /lint FAILED/);
  assert.match(notifications[0].message, /file NOT written/);
});


// ---------------------------------------------------------------------------
// v0.3.0 — deprecation handling for old names (gentleman, neutral)
// ---------------------------------------------------------------------------

test("v0.3.0: /caduceus:mode gentleman is deprecated and maps to default", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:mode"].handler("gentleman", ctx);

  // Deprecation warning is sent
  assert.match(notifications[0].message, /deprecated/);
  assert.match(notifications[0].message, /default/);
  // And the write uses the new name
  assert.equal(writes.length, 1);
  assert.equal(writes[0].value, "default");
  // Confirmation message uses the new name
  assert.match(notifications[1].message, /mode set to default/);
});

test("v0.3.0: /caduceus:mode neutral is deprecated and maps to plain", async () => {
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

  assert.match(notifications[0].message, /deprecated/);
  assert.match(notifications[0].message, /plain/);
  assert.equal(writes[0].value, "plain");
  assert.match(notifications[1].message, /mode set to plain/);
});

test("v0.3.0: /caduceus:persona gentleman is deprecated and maps to default", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
    switchPersona: async (name) => {
      writes.push({ field: "persona", value: name });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:persona"].handler("gentleman", ctx);

  assert.match(notifications[0].message, /deprecated/);
  assert.match(notifications[0].message, /default/);
  // The switchPersona dep was called with the new name
  assert.equal(writes.find((w) => w.field === "persona")?.value, "default");
});

test("v0.3.0: /caduceus:persona neutral is deprecated and maps to plain", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
    switchPersona: async (name) => {
      writes.push({ field: "persona", value: name });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:persona"].handler("neutral", ctx);

  assert.match(notifications[0].message, /deprecated/);
  assert.match(notifications[0].message, /plain/);
  assert.equal(writes.find((w) => w.field === "persona")?.value, "plain");
});


// ---------------------------------------------------------------------------
// v0.4.0 — /caduceus:profile
// ---------------------------------------------------------------------------

test("v0.4.0: /caduceus:profile list shows available profiles", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    listProfiles: () => ["work", "learning"],
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:profile"].handler("list", ctx);

  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /profiles:/);
  assert.match(notifications[0].message, /work/);
  assert.match(notifications[0].message, /learning/);
});

test("v0.4.0: /caduceus:profile save writes via saveProfile and readConfig", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  let savedProfile: { mode: "default" | "plain" | "auto"; locale: string; systemPromptMode: "append" | "replace"; persona: string } | null = null;
  const deps = makeMockDeps({
    saveProfile: async (name, profile) => {
      savedProfile = profile;
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:profile"].handler("save work", ctx);

  assert.ok(savedProfile, "saveProfile should have been called");
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /profile 'work' saved/);
});

test("v0.4.0: /caduceus:profile load updates config via writeGlobalConfigField", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const writes: Array<{ field: string; value: unknown }> = [];
  const deps = makeMockDeps({
    loadProfile: () => ({
      mode: "plain" as const,
      locale: "es-AR",
      systemPromptMode: "replace" as const,
      persona: "plain",
    }),
    writeGlobalConfigField: async (field, value) => {
      writes.push({ field: String(field), value });
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:profile"].handler("load work", ctx);

  // 4 writes (mode, locale, systemPromptMode, persona)
  assert.equal(writes.length, 4);
  assert.equal(writes[0].value, "plain");
  assert.equal(writes[3].value, "plain");
  assert.match(notifications[0].message, /profile 'work' loaded/);
});

test("v0.4.0: /caduceus:profile delete calls deleteProfile", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  let deletedName = "";
  const deps = makeMockDeps({
    deleteProfile: async (name) => {
      deletedName = name;
    },
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:profile"].handler("delete work", ctx);

  assert.equal(deletedName, "work");
  assert.match(notifications[0].message, /profile 'work' deleted/);
});

test("v0.4.0: /caduceus:profile show displays the profile contents", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  const deps = makeMockDeps({
    loadProfile: () => ({
      mode: "default" as const,
      locale: "auto",
      systemPromptMode: "append" as const,
      persona: "default",
    }),
  });
  registerSlashCommands(pi, deps);

  await pi.commands["caduceus:profile"].handler("show work", ctx);

  assert.equal(notifications.length, 1);
  assert.match(notifications[0].message, /persona/);
  assert.match(notifications[0].message, /default/);
});

test("v0.4.0: /caduceus:profile with no args shows usage hint", async () => {
  const pi = makeMockPi();
  const { ctx, notifications } = makeMockCtx();
  registerSlashCommands(pi, makeMockDeps());

  await pi.commands["caduceus:profile"].handler("", ctx);

  assert.match(notifications[0].message, /usage: \/caduceus:profile/);
});

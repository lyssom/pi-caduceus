// ---------------------------------------------------------------------------
// caduceus — extension entry structural test
//
// The extension entry is the SHELL: the only file that imports from pi.
// This test does not exercise the slash-command or persona-prompt
// behavior (covered by their dedicated test files). It only verifies
// that the extension wires the expected handlers and commands.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import caduceus from "../extensions/caduceus.ts";

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

function makeMockPi() {
  const handlers: Record<string, Handler[]> = {};
  const commands: Record<string, { description?: string; handler: Handler }> = {};
  return {
    handlers,
    commands,
    registerCommand(name: string, options: { description?: string; handler: Handler }) {
      commands[name] = { description: options.description, handler: options.handler };
    },
    on(event: string, handler: Handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
  };
}

test("extension registers session_start, before_agent_start, and 10 slash commands", () => {
  const pi = makeMockPi();
  caduceus(pi as unknown as Parameters<typeof caduceus>[0]);

  // 1. session_start handler
  assert.ok(pi.handlers["session_start"], "session_start handler must be registered");
  assert.equal(pi.handlers["session_start"].length, 1);

  // 2. before_agent_start handler
  assert.ok(pi.handlers["before_agent_start"], "before_agent_start handler must be registered");
  assert.equal(pi.handlers["before_agent_start"].length, 1);

  // 3. 9 slash commands (4 from v0.1.0 + 3 from v0.1.1 + 2 from v0.2.0)
  assert.equal(Object.keys(pi.commands).length, 10, "exactly 10 commands must be registered");
  for (const name of [
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
    assert.ok(pi.commands[name], `${name} must be registered`);
    assert.equal(typeof pi.commands[name].handler, "function");
  }
});

test("session_start handler does not throw when given a minimal mock context", async () => {
  const pi = makeMockPi();
  caduceus(pi as unknown as Parameters<typeof caduceus>[0]);
  const handler = pi.handlers["session_start"][0];

  // Minimal mock context (no real cwd, no real ui)
  const ctx = {
    cwd: "/tmp",
    ui: {
      notify: () => {},
      setStatus: () => {},
    },
  };

  // session_start must not throw
  await handler({}, ctx);
});

test("before_agent_start handler returns { systemPrompt: <original> + <persona> }", async () => {
  const pi = makeMockPi();
  caduceus(pi as unknown as Parameters<typeof caduceus>[0]);

  // Trigger session_start first so `effective` is populated
  const sessionStart = pi.handlers["session_start"][0];
  await sessionStart(
    {},
    {
      cwd: "/tmp",
      ui: { notify: () => {}, setStatus: () => {} },
    },
  );

  // Ensure append mode (in case a global config has 'replace' from prior test runs)
  await pi.commands["caduceus:prompt"].handler("append", {
    cwd: "/tmp",
    ui: { notify: () => {}, setStatus: () => {} },
  } as unknown as Record<string, unknown>);

  const beforeStart = pi.handlers["before_agent_start"][0];
  const result = await beforeStart(
    { prompt: "hola, ¿cómo estás?", systemPrompt: "BASE_SYSTEM" },
    { cwd: "/tmp" },
  );

  assert.ok(result && typeof result === "object");
  const sysPrompt = (result as { systemPrompt: string }).systemPrompt;
  assert.ok(sysPrompt.startsWith("BASE_SYSTEM\n\n"), "systemPrompt must start with original + '\\n\\n'");
  assert.match(sysPrompt, /Current persona mode: default/);
  assert.match(sysPrompt, /caduceus Identity Contract/);
});

test("v0.1.1: before_agent_start with systemPromptMode='replace' returns persona only (no base prefix)", async () => {
  const pi = makeMockPi();
  caduceus(pi as unknown as Parameters<typeof caduceus>[0]);

  const sessionStart = pi.handlers["session_start"][0];
  await sessionStart(
    {},
    {
      cwd: "/tmp",
      ui: { notify: () => {}, setStatus: () => {} },
    },
  );

  // Switch to replace mode
  await pi.commands["caduceus:prompt"].handler("replace", {
    cwd: "/tmp",
    ui: { notify: () => {}, setStatus: () => {} },
  } as unknown as Record<string, unknown>);

  const beforeStart = pi.handlers["before_agent_start"][0];
  const result = await beforeStart(
    { prompt: "hola", systemPrompt: "BASE_SYSTEM_SHOULD_NOT_APPEAR" },
    { cwd: "/tmp" },
  );

  const sysPrompt = (result as { systemPrompt: string }).systemPrompt;
  assert.ok(!sysPrompt.includes("BASE_SYSTEM_SHOULD_NOT_APPEAR"), "replace mode must omit the base");
  assert.match(sysPrompt, /Current persona mode: default/);
});

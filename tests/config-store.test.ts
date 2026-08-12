// ---------------------------------------------------------------------------
// caduceus — config store tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-5 creates lib/config-store.ts + lib/errors.ts + lib/version.ts
//   TRIANGULATE  → T-5 adds R-CONFIG-011/013/014 package.json integration tests
//   REFACTOR     → T-5 cleans up if needed
//
// Tests use a temp dir for the "home" location; the impl accepts a `home`
// argument so tests can isolate the file system.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readConfig,
  writeGlobalConfig,
  writeGlobalConfigField,
  parseJsonc,
  DEFAULT_CONFIG,
} from "../lib/config-store.ts";
import { CaduceusConfigError } from "../lib/errors.ts";
import { CADUCEUS_VERSION } from "../lib/version.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "caduceus-test-"));
}

function cleanup(home: string): void {
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    // Best-effort
  }
}

// ---------------------------------------------------------------------------
// CADUCEUS_VERSION
// ---------------------------------------------------------------------------

test("CADUCEUS_VERSION is '0.1.0'", () => {
  assert.equal(CADUCEUS_VERSION, "0.1.0");
});

// ---------------------------------------------------------------------------
// R-CONFIG-001 — Default configuration
// ---------------------------------------------------------------------------

test("R-CONFIG-001-1: readConfig with no files returns built-in defaults", () => {
  const home = makeTempHome();
  try {
    const { config, source } = readConfig({
      cwd: home,
      home: join(home, "agent"),
    });
    assert.deepEqual(config, DEFAULT_CONFIG);
    assert.equal(source, "built-in defaults");
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// R-CONFIG-002 — Global config read
// ---------------------------------------------------------------------------

test("R-CONFIG-002-1: readConfig reads global caduceus.json and merges with defaults", () => {
  const home = makeTempHome();
  try {
    const agentDir = join(home, "agent");
    const cfgPath = join(agentDir, "caduceus.json");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(cfgPath, JSON.stringify({ mode: "neutral", locale: "es-AR" }));

    const { config, source } = readConfig({ cwd: home, home: agentDir });
    assert.equal(config.mode, "neutral");
    assert.equal(config.locale, "es-AR");
    // Unset fields fall back to defaults
    assert.equal(config.showStatusBar, false);
    assert.equal(config.allowProjectOverride, true);
    assert.equal(source, "global");
  } finally {
    cleanup(home);
  }
});

test("R-CONFIG-002-2: malformed global config throws CaduceusConfigError", () => {
  const home = makeTempHome();
  try {
    const agentDir = join(home, "agent");
    const cfgPath = join(agentDir, "caduceus.json");
    mkdirSync(agentDir, { recursive: true });
    // Trailing comma = malformed JSON
    writeFileSync(cfgPath, '{ "mode": "neutral", }');

    assert.throws(
      () => readConfig({ cwd: home, home: agentDir }),
      (err: unknown) => err instanceof CaduceusConfigError,
    );
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// R-CONFIG-003 — Project override
// ---------------------------------------------------------------------------

test("R-CONFIG-003-1: project .caduceusrc overrides per-field when allowProjectOverride is true", () => {
  const home = makeTempHome();
  try {
    const agentDir = join(home, "agent");
    const projectDir = join(home, "project");
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(agentDir, "caduceus.json"),
      JSON.stringify({ allowProjectOverride: true, mode: "gentleman" }),
    );
    writeFileSync(join(projectDir, ".caduceusrc"), '{ "mode": "neutral" }');

    const { config, source } = readConfig({ cwd: projectDir, home: agentDir });
    assert.equal(config.mode, "neutral");
    assert.equal(config.allowProjectOverride, true);
    assert.equal(source, "global+project");
  } finally {
    cleanup(home);
  }
});

test("R-CONFIG-003-2: project .caduceusrc is IGNORED when allowProjectOverride is false", () => {
  const home = makeTempHome();
  try {
    const agentDir = join(home, "agent");
    const projectDir = join(home, "project");
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(agentDir, "caduceus.json"),
      JSON.stringify({ allowProjectOverride: false, mode: "gentleman" }),
    );
    writeFileSync(join(projectDir, ".caduceusrc"), '{ "mode": "neutral" }');

    const { config, source } = readConfig({ cwd: projectDir, home: agentDir });
    assert.equal(config.mode, "gentleman"); // not overridden
    assert.equal(source, "global");
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// R-CONFIG-004 — JSONC tolerant parsing
// ---------------------------------------------------------------------------

test("R-CONFIG-004-1a: parseJsonc strips line comments", () => {
  const result = parseJsonc('// comment\n{ "mode": "neutral" }');
  assert.deepEqual(result, { mode: "neutral" });
});

test("R-CONFIG-004-1b: parseJsonc strips block comments", () => {
  const result = parseJsonc('/* block */\n{ /* inline */ "locale": "es-AR" }');
  assert.deepEqual(result, { locale: "es-AR" });
});

test("R-CONFIG-004-1c: parseJsonc preserves '://' in URLs (negative lookbehind on ':')", () => {
  const result = parseJsonc('{ "url": "https://example.com" }');
  assert.deepEqual(result, { url: "https://example.com" });
});

test("R-CONFIG-004-1d: parseJsonc preserves '//' inside string values", () => {
  const result = parseJsonc('{ "a": "x // not a comment" }');
  assert.deepEqual(result, { a: "x // not a comment" });
});

// ---------------------------------------------------------------------------
// R-CONFIG-005 — Atomic write
// ---------------------------------------------------------------------------

test("R-CONFIG-005-1: writeGlobalConfig creates file with full content, no leftover .tmp", async () => {
  const home = makeTempHome();
  try {
    const agentDir = join(home, "agent");
    mkdirSync(agentDir, { recursive: true });
    const cfgPath = join(agentDir, "caduceus.json");

    await writeGlobalConfig(
      { ...DEFAULT_CONFIG, mode: "neutral" },
      { home: agentDir },
    );

    assert.ok(existsSync(cfgPath), "config file should exist after write");
    const dirContents = readdirSync(agentDir);
    const tmpFiles = dirContents.filter((f) => f.startsWith("caduceus.json.tmp."));
    assert.equal(
      tmpFiles.length,
      0,
      `no temp files should remain, found: ${tmpFiles.join(", ")}`,
    );
  } finally {
    cleanup(home);
  }
});

test("R-CONFIG-005-2: writeGlobalConfigField updates only the specified field", async () => {
  const home = makeTempHome();
  try {
    const agentDir = join(home, "agent");
    mkdirSync(agentDir, { recursive: true });
    const cfgPath = join(agentDir, "caduceus.json");

    writeFileSync(
      cfgPath,
      JSON.stringify({
        mode: "gentleman",
        locale: "auto",
        showStatusBar: false,
        allowProjectOverride: true,
      }),
    );

    await writeGlobalConfigField("mode", "neutral", { home: agentDir });

    const { config } = readConfig({ cwd: home, home: agentDir });
    assert.equal(config.mode, "neutral");
    assert.equal(config.locale, "auto"); // unchanged
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// caduceus — profile-store tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-4 creates lib/profile-store.ts
//   TRIANGULATE  → T-4 adds malformed JSON / missing field cases
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  listProfiles,
  loadProfile,
  saveProfile,
  deleteProfile,
  profileFilePath,
  DEFAULT_PROFILE,
} from "../lib/profile-store.ts";
import {
  CaduceusProfileNotFoundError,
  CaduceusProfileError,
} from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "caduceus-profile-"));
}

function cleanup(home: string): void {
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// profileFilePath
// ---------------------------------------------------------------------------

test("R-PROFILE-1: profileFilePath('work', 'global') returns the global path", () => {
  const path = profileFilePath("work", "global", "/tmp/project", "/home/user/.pi/agent");
  assert.equal(path, "/home/user/.pi/agent/caduceus/profiles/work.json");
});

test("R-PROFILE-2: profileFilePath('work', 'project') returns the project path", () => {
  const path = profileFilePath("work", "project", "/tmp/project", "/home/user/.pi/agent");
  assert.equal(path, "/tmp/project/.caduceus/profiles/work.json");
});

// ---------------------------------------------------------------------------
// listProfiles
// ---------------------------------------------------------------------------

test("R-PROFILE-3: listProfiles returns built-in empty when no files exist", () => {
  const home = makeTempHome();
  try {
    const names = listProfiles("/nonexistent", home);
    assert.deepEqual(names, []);
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-4: listProfiles returns global profiles", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "caduceus", "profiles");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "work.json"), JSON.stringify(DEFAULT_PROFILE));
    writeFileSync(join(globalDir, "learning.json"), JSON.stringify(DEFAULT_PROFILE));

    const names = listProfiles("/nonexistent", home);
    assert.ok(names.includes("work"));
    assert.ok(names.includes("learning"));
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-5: listProfiles returns project profiles", () => {
  const home = makeTempHome();
  try {
    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "profiles"), { recursive: true });
    writeFileSync(join(projectDir, ".caduceus", "profiles", "hacker.json"), JSON.stringify(DEFAULT_PROFILE));

    const names = listProfiles(projectDir, home);
    assert.ok(names.includes("hacker"));
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-6: project shadows global with the same name", () => {
  const home = makeTempHome();
  try {
    // Global: "shared"
    const globalDir = join(home, "caduceus", "profiles");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "shared.json"), JSON.stringify(DEFAULT_PROFILE));

    // Project: "shared"
    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "profiles"), { recursive: true });
    writeFileSync(join(projectDir, ".caduceus", "profiles", "shared.json"), JSON.stringify(DEFAULT_PROFILE));

    const names = listProfiles(projectDir, home);
    const sharedCount = names.filter((n) => n === "shared").length;
    assert.equal(sharedCount, 1, "shared profile should appear once");
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// loadProfile
// ---------------------------------------------------------------------------

test("R-PROFILE-7: loadProfile returns the profile contents", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "caduceus", "profiles");
    mkdirSync(globalDir, { recursive: true });
    const profile = { mode: "plain", locale: "auto", systemPromptMode: "replace", persona: "plain" };
    writeFileSync(join(globalDir, "work.json"), JSON.stringify(profile));

    const loaded = loadProfile("work", "/nonexistent", home);
    assert.deepEqual(loaded, profile);
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-8: loadProfile throws CaduceusProfileNotFoundError for missing", () => {
  const home = makeTempHome();
  try {
    assert.throws(
      () => loadProfile("nope", "/nonexistent", home),
      (err: unknown) => err instanceof CaduceusProfileNotFoundError,
    );
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-9: loadProfile prefers project profile over global", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "caduceus", "profiles");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "shared.json"), JSON.stringify({ mode: "default", persona: "default", locale: "auto", systemPromptMode: "append" }));

    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "profiles"), { recursive: true });
    writeFileSync(join(projectDir, ".caduceus", "profiles", "shared.json"), JSON.stringify({ mode: "plain", persona: "plain", locale: "auto", systemPromptMode: "replace" }));

    const loaded = loadProfile("shared", projectDir, home);
    assert.equal(loaded.persona, "plain");
    assert.equal(loaded.systemPromptMode, "replace");
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// saveProfile + deleteProfile
// ---------------------------------------------------------------------------

test("R-PROFILE-10: saveProfile writes the file (with mkdir -p)", async () => {
  const home = makeTempHome();
  try {
    const profile = { ...DEFAULT_PROFILE, mode: "plain" as const };
    await saveProfile("work", profile, "/nonexistent", home);
    const path = join(home, "caduceus", "profiles", "work.json");
    const content = readFileSync(path, "utf8");
    const loaded = JSON.parse(content);
    assert.equal(loaded.mode, "plain");
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-11: deleteProfile removes the file", async () => {
  const home = makeTempHome();
  try {
    const profile = { ...DEFAULT_PROFILE };
    await saveProfile("work", profile, "/nonexistent", home);
    const path = join(home, "caduceus", "profiles", "work.json");
    // confirm file exists
    assert.ok(readFileSync(path, "utf8").length > 0);
    await deleteProfile("work", "/nonexistent", home);
    // After delete, the file should not exist; loadProfile throws
    assert.throws(
      () => loadProfile("work", "/nonexistent", home),
      (err: unknown) => err instanceof CaduceusProfileNotFoundError,
    );
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// TRIANGULATE: malformed JSON + missing field
// ---------------------------------------------------------------------------

test("R-PROFILE-T1: malformed JSON throws CaduceusProfileError", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "caduceus", "profiles");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "broken.json"), "{ not json }");

    assert.throws(
      () => loadProfile("broken", "/nonexistent", home),
      (err: unknown) => err instanceof CaduceusProfileError,
    );
  } finally {
    cleanup(home);
  }
});

test("R-PROFILE-T2: missing required field throws CaduceusProfileError", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "caduceus", "profiles");
    mkdirSync(globalDir, { recursive: true });
    // Missing 'persona' field
    writeFileSync(join(globalDir, "partial.json"), JSON.stringify({ mode: "default", locale: "auto", systemPromptMode: "append" }));

    assert.throws(
      () => loadProfile("partial", "/nonexistent", home),
      (err: unknown) => err instanceof CaduceusProfileError,
    );
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// DEFAULT_PROFILE
// ---------------------------------------------------------------------------

test("R-PROFILE-DEFAULTS: DEFAULT_PROFILE has all 4 required fields", () => {
  assert.equal(typeof DEFAULT_PROFILE.mode, "string");
  assert.equal(typeof DEFAULT_PROFILE.locale, "string");
  assert.equal(typeof DEFAULT_PROFILE.systemPromptMode, "string");
  assert.equal(typeof DEFAULT_PROFILE.persona, "string");
});

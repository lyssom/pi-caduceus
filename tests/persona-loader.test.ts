// ---------------------------------------------------------------------------
// caduceus — persona loader tests
//
// TDD micro-cycle:
//   RED          → this file (imports fail)
//   GREEN        → T-2 creates lib/persona-loader.ts
//   TRIANGULATE  → T-2 adds project-shadows-global, global-shadows-builtin, malformed-file cases
//
// Persona resolution order (matches design.md §4.2):
//   1. Built-in (read from <repo>/prompts/<name>.md)
//   2. Global   (read from ~/.pi/agent/caduceus/personas/<name>.md)
//   3. Project  (read from ./.caduceus/personas/<name>.md)
//
// Tests use a temp dir as both `home` and `cwd`, similar to config-store tests.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadPersona,
  listPersonas,
  CaduceusPersonaNotFoundError,
} from "../lib/persona-loader.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "caduceus-personas-"));
}

function cleanup(home: string): void {
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// loadPersona: built-in personas
// ---------------------------------------------------------------------------

test("loadPersona('gentleman') returns the built-in gentleman persona", () => {
  const home = makeTempHome();
  try {
    const persona = loadPersona("gentleman", home, home);
    assert.equal(persona.name, "gentleman");
    assert.equal(persona.source, "built-in");
    assert.equal(persona.path, null);
    assert.match(persona.content, /natural Rioplatense Spanish with voseo/);
  } finally {
    cleanup(home);
  }
});

test("loadPersona('neutral') returns the built-in neutral persona", () => {
  const home = makeTempHome();
  try {
    const persona = loadPersona("neutral", home, home);
    assert.equal(persona.name, "neutral");
    assert.equal(persona.source, "built-in");
    assert.match(persona.content, /Do NOT use voseo/);
  } finally {
    cleanup(home);
  }
});

test("loadPersona('concise') returns the built-in concise persona", () => {
  const home = makeTempHome();
  try {
    const persona = loadPersona("concise", home, home);
    assert.equal(persona.name, "concise");
    assert.equal(persona.source, "built-in");
    assert.match(persona.content, /\$\{mode\}/);  // must have the placeholder
  } finally {
    cleanup(home);
  }
});

test("loadPersona('reviewer') returns the built-in reviewer persona", () => {
  const home = makeTempHome();
  try {
    const persona = loadPersona("reviewer", home, home);
    assert.equal(persona.name, "reviewer");
    assert.equal(persona.source, "built-in");
    assert.match(persona.content, /\$\{mode\}/);
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// loadPersona: global persona
// ---------------------------------------------------------------------------

test("loadPersona reads from ~/.pi/agent/caduceus/personas/<name>.md (global)", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "agent", "caduceus", "personas");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "pirate.md"),
      "# pirate\nSpeak like a pirate.\n",
    );

    const persona = loadPersona("pirate", home, join(home, "agent"));
    assert.equal(persona.name, "pirate");
    assert.equal(persona.source, "global");
    assert.match(persona.path ?? "", /pirate\.md$/);
    assert.match(persona.content, /pirate/i);
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// loadPersona: project persona (shadows global and built-in)
// ---------------------------------------------------------------------------

test("loadPersona reads from ./.caduceus/personas/<name>.md (project)", () => {
  const home = makeTempHome();
  try {
    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "personas"), { recursive: true });
    writeFileSync(
      join(projectDir, ".caduceus", "personas", "pirate.md"),
      "# pirate (project override)\nSpeak like a pirate, but nicer.\n",
    );

    const persona = loadPersona("pirate", projectDir, join(home, "agent"));
    assert.equal(persona.source, "project");
    assert.match(persona.content, /project override/);
  } finally {
    cleanup(home);
  }
});

test("project persona shadows global persona with the same name", () => {
  const home = makeTempHome();
  try {
    // Global: "pirate.md"
    const globalDir = join(home, "agent", "caduceus", "personas");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "pirate.md"), "# pirate (global)\n");

    // Project: "pirate.md" — should win
    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "personas"), { recursive: true });
    writeFileSync(
      join(projectDir, ".caduceus", "personas", "pirate.md"),
      "# pirate (project)\n",
    );

    const persona = loadPersona("pirate", projectDir, join(home, "agent"));
    assert.equal(persona.source, "project");
    assert.match(persona.content, /project/);
  } finally {
    cleanup(home);
  }
});

test("global persona shadows built-in persona with the same name", () => {
  const home = makeTempHome();
  try {
    // Custom global "gentleman" shadows the built-in
    const globalDir = join(home, "agent", "caduceus", "personas");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "gentleman.md"),
      "# my-gentleman (custom global)\n${mode}\n",
    );

    const persona = loadPersona("gentleman", home, join(home, "agent"));
    assert.equal(persona.source, "global");
    assert.match(persona.content, /my-gentleman/);
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// loadPersona: missing persona
// ---------------------------------------------------------------------------

test("loadPersona throws CaduceusPersonaNotFoundError for unknown persona", () => {
  const home = makeTempHome();
  try {
    assert.throws(
      () => loadPersona("nope", home, join(home, "agent")),
      (err: unknown) => err instanceof CaduceusPersonaNotFoundError,
    );
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// listPersonas
// ---------------------------------------------------------------------------

test("listPersonas returns built-in personas by default", () => {
  const home = makeTempHome();
  try {
    const names = listPersonas(home, join(home, "agent"));
    assert.ok(names.includes("gentleman"));
    assert.ok(names.includes("neutral"));
    assert.ok(names.includes("concise"));
    assert.ok(names.includes("reviewer"));
  } finally {
    cleanup(home);
  }
});

test("listPersonas includes global personas", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "agent", "caduceus", "personas");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "pirate.md"), "# pirate\n");
    writeFileSync(join(globalDir, "wizard.md"), "# wizard\n");

    const names = listPersonas(home, join(home, "agent"));
    assert.ok(names.includes("pirate"));
    assert.ok(names.includes("wizard"));
  } finally {
    cleanup(home);
  }
});

test("listPersonas includes project personas", () => {
  const home = makeTempHome();
  try {
    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "personas"), { recursive: true });
    writeFileSync(join(projectDir, ".caduceus", "personas", "hacker.md"), "# hacker\n");

    const names = listPersonas(projectDir, join(home, "agent"));
    assert.ok(names.includes("hacker"));
  } finally {
    cleanup(home);
  }
});

test("listPersonas dedups when project shadows global", () => {
  const home = makeTempHome();
  try {
    const globalDir = join(home, "agent", "caduceus", "personas");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "shared.md"), "# shared (global)\n");

    const projectDir = join(home, "project");
    mkdirSync(join(projectDir, ".caduceus", "personas"), { recursive: true });
    writeFileSync(join(projectDir, ".caduceus", "personas", "shared.md"), "# shared (project)\n");

    const names = listPersonas(projectDir, join(home, "agent"));
    const sharedCount = names.filter((n) => n === "shared").length;
    assert.equal(sharedCount, 1, "shared persona should appear once, not twice");
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// TRIANGULATE: malformed file fallback
// ---------------------------------------------------------------------------

test("malformed project file: read error does not crash — falls through to global or built-in", () => {
  // A project file that becomes unreadable (e.g. a directory with the same
  // name) should not break the resolver. The persona-loader should
  // silently fall through to the next precedence level.
  const home = makeTempHome();
  try {
    const projectDir = join(home, "project");
    const personasDir = join(projectDir, ".caduceus", "personas");
    mkdirSync(personasDir, { recursive: true });
    // Create a DIRECTORY named "gentleman.md" where the file should be.
    // This makes readFileSync throw EISDIR.
    mkdirSync(join(personasDir, "gentleman.md"));

    // Should fall through to the built-in (since the project path
    // throws and the global doesn't exist).
    const persona = loadPersona("gentleman", projectDir, join(home, "agent"));
    assert.equal(persona.source, "built-in");
  } finally {
    cleanup(home);
  }
});

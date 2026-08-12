// ---------------------------------------------------------------------------
// caduceus — persona loader
//
// Resolves a persona by name from the 3-tier precedence chain:
//   1. Built-in  (read from <repo>/prompts/<name>.md)
//   2. Global    (read from ~/.pi/agent/caduceus/personas/<name>.md)
//   3. Project   (read from ./.caduceus/personas/<name>.md)
//
// `loadPersona` reads the file content at call time (one-shot per call).
// Callers (e.g. extensions/caduceus.ts) typically cache the result in a
// closure variable and only re-load when the persona name changes.
//
// `listPersonas` enumerates all available personas (built-in + global +
// project), with project shadowing global shadowing built-in (deduped).
// ---------------------------------------------------------------------------

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

import { CaduceusPersonaNotFoundError } from "./errors.ts";

// Re-export the error from this module's public surface for convenience.
export { CaduceusPersonaNotFoundError };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PersonaName = string;
export type PersonaSource = "built-in" | "global" | "project";

export type LoadedPersona = {
  name: PersonaName;
  content: string;
  source: PersonaSource;
  path: string | null; // null for built-ins
};

// Built-in persona names. The set is closed — adding a new built-in
// requires updating this set AND adding the corresponding prompt file.
const BUILT_IN_PERSONAS: ReadonlySet<PersonaName> = new Set([
  "gentleman",
  "neutral",
  "concise",
  "reviewer",
  "teacher",
  "security",
  "debugger",
  "socratic",
  "architect",
  "pirate",
]);

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const BUILT_IN_DIR = join(here, "..", "prompts");

function resolveHome(home?: string): string {
  return home ?? join(homedir(), ".pi", "agent");
}

function builtInPath(name: PersonaName): string {
  return join(BUILT_IN_DIR, `${name}.md`);
}

function globalPath(name: PersonaName, home?: string): string {
  return join(resolveHome(home), "caduceus", "personas", `${name}.md`);
}

function projectPath(name: PersonaName, cwd: string): string {
  return join(cwd, ".caduceus", "personas", `${name}.md`);
}

// ---------------------------------------------------------------------------
// Internal: read a file safely, returning null on any error
// (EISDIR, EACCES, ENOENT, malformed UTF-8, etc.)
// ---------------------------------------------------------------------------

function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal: list files in a directory whose name ends with `.md`
// (the persona filename convention). Returns an empty array on any
// directory error (ENOENT, EACCES).
// ---------------------------------------------------------------------------

function listMdFiles(dir: string): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3)); // strip `.md`
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a persona by name. Throws `CaduceusPersonaNotFoundError` if the
 * persona is not found in any of the 3 tiers.
 *
 * Precedence (highest priority first checked):
 *   1. Project   (./.caduceus/personas/<name>.md)  — most specific
 *   2. Global    (~/.pi/agent/caduceus/personas/<name>.md)
 *   3. Built-in  (<repo>/prompts/<name>.md)         — least specific (fallback)
 */
export function loadPersona(
  name: PersonaName,
  cwd: string,
  home?: string,
): LoadedPersona {
  // 1. Project (highest priority)
  const project = safeReadFile(projectPath(name, cwd));
  if (project !== null) {
    return {
      name,
      content: project,
      source: "project",
      path: projectPath(name, cwd),
    };
  }

  // 2. Global
  const global = safeReadFile(globalPath(name, home));
  if (global !== null) {
    return {
      name,
      content: global,
      source: "global",
      path: globalPath(name, home),
    };
  }

  // 3. Built-in (lowest priority)
  const builtIn = safeReadFile(builtInPath(name));
  if (builtIn !== null) {
    return { name, content: builtIn, source: "built-in", path: null };
  }

  throw new CaduceusPersonaNotFoundError(name);
}

/**
 * List all available personas (built-in + global + project), with
 * project shadowing global shadowing built-in. Returns a stable
 * alphabetical list.
 */
export function listPersonas(cwd: string, home?: string): PersonaName[] {
  const builtIn = Array.from(BUILT_IN_PERSONAS);
  const global = listMdFiles(join(resolveHome(home), "caduceus", "personas"));
  const project = listMdFiles(join(cwd, ".caduceus", "personas"));

  // Union with project winning over global winning over built-in.
  // Iteration order: built-in first, then global (add new), then
  // project (add new + override existing).
  const seen = new Set<PersonaName>();
  const result: PersonaName[] = [];

  for (const name of builtIn) {
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  for (const name of global) {
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  for (const name of project) {
    // Project always wins — replace if present.
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }

  return result.sort();
}

/**
 * Test-only: returns the closed set of built-in persona names.
 * Not exported in the public API surface.
 */
export function _builtInPersonaNames(): ReadonlySet<PersonaName> {
  return BUILT_IN_PERSONAS;
}

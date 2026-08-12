// ---------------------------------------------------------------------------
// caduceus — configuration store
//
// The only file in caduceus that reads/writes the filesystem for config.
// Supports:
//   - readConfig(deps): merge global ~/.pi/agent/caduceus.json + project
//     .caduceusrc (when allowProjectOverride) + built-in defaults.
//   - writeGlobalConfig(config, deps): atomic write via tmp+rename.
//   - updateGlobalConfigField(field, value, deps): read-modify-write one field.
//   - parseJsonc(input): JSONC-tolerant parser (line + block comments),
//     preserves '//' inside string values via a state machine.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from "node:fs";
import { writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

import { CaduceusConfigError } from "./errors.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PersonaMode = "gentleman" | "neutral" | "auto";
export type LocalePreference = "auto" | string;
export type CaduceusConfig = {
  mode: PersonaMode;
  locale: LocalePreference;
  showStatusBar: boolean;
  allowProjectOverride: boolean;
};
export type ConfigSource =
  | "built-in defaults"
  | "global"
  | "global+project"
  | "project";
export type EffectiveConfig = {
  config: CaduceusConfig;
  source: ConfigSource;
};

export const DEFAULT_CONFIG: CaduceusConfig = {
  mode: "gentleman",
  locale: "auto",
  showStatusBar: false,
  allowProjectOverride: true,
};

export type ConfigDeps = {
  cwd: string;
  home?: string;
};

function resolveHome(home?: string): string {
  return home ?? join(homedir(), ".pi", "agent");
}

// ---------------------------------------------------------------------------
// JSONC parser (state machine, respects string boundaries)
// ---------------------------------------------------------------------------

// Parse a JSONC string. Strips forward-slash-forward-slash line comments
// and block comments (forward-slash-star ... star-forward-slash) while
// preserving the forward-slash characters inside string values.
// Designed for .caduceusrc (JSONC tolerant). The global caduceus.json is
// strict JSON and does not go through this parser.
export function parseJsonc(input: string): unknown {
  let out = "";
  let i = 0;
  let inString = false;
  let escape = false;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    // Outside a string
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      // Block comment
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) {
        i++;
      }
      i += 2; // skip */
      continue;
    }
    if (ch === "/" && next === "/") {
      // Line comment
      while (i < input.length && input[i] !== "\n") {
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }

  return JSON.parse(out.trim());
}

// ---------------------------------------------------------------------------
// Config read
// ---------------------------------------------------------------------------

function readJsonStrict(path: string): CaduceusConfig {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as CaduceusConfig;
}

function readJsoncSafe(path: string): CaduceusConfig {
  const raw = readFileSync(path, "utf8");
  return parseJsonc(raw) as CaduceusConfig;
}

// Read the effective config: defaults < global < project (if allowed).
// Throws CaduceusConfigError if any file is malformed.
export function readConfig(deps: ConfigDeps): EffectiveConfig {
  const home = resolveHome(deps.home);
  const globalPath = join(home, "caduceus.json");
  const projectPath = join(deps.cwd, ".caduceusrc");

  // Step 1: global
  let globalConfig: CaduceusConfig | null = null;
  if (existsSync(globalPath)) {
    try {
      globalConfig = readJsonStrict(globalPath);
    } catch (err) {
      throw new CaduceusConfigError(
        `Failed to parse ${globalPath}: ${(err as Error).message}`,
        globalPath,
      );
    }
  }

  // Step 2: merge global into defaults
  let effective: CaduceusConfig = { ...DEFAULT_CONFIG, ...(globalConfig ?? {}) };

  // Step 3: project override (only when allowed)
  if (effective.allowProjectOverride && existsSync(projectPath)) {
    let projectConfig: CaduceusConfig;
    try {
      projectConfig = readJsoncSafe(projectPath);
    } catch (err) {
      throw new CaduceusConfigError(
        `Failed to parse ${projectPath}: ${(err as Error).message}`,
        projectPath,
      );
    }
    effective = { ...effective, ...projectConfig };
    if (globalConfig) {
      return { config: effective, source: "global+project" };
    }
    return { config: effective, source: "project" };
  }

  if (globalConfig) {
    return { config: effective, source: "global" };
  }
  return { config: effective, source: "built-in defaults" };
}

// ---------------------------------------------------------------------------
// Config write (atomic)
// ---------------------------------------------------------------------------

async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp.${randomUUID()}`;
  const content = JSON.stringify(data, null, 2) + "\n";
  try {
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, path);
  } catch (err) {
    // Best-effort cleanup of the temp file
    try {
      await unlink(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }
}

// Write the full global config (atomic via tmp+rename). Overwrites any
// existing file at ~/.pi/agent/caduceus.json.
export async function writeGlobalConfig(
  config: CaduceusConfig,
  deps: { home?: string } = {},
): Promise<void> {
  const home = resolveHome(deps.home);
  await atomicWriteJson(join(home, "caduceus.json"), config);
}

// Update a single field of the global config (read-modify-write). Reads
// the current effective config, applies the change, writes atomically.
export async function updateGlobalConfigField<K extends keyof CaduceusConfig>(
  field: K,
  value: CaduceusConfig[K],
  deps: { home?: string; cwd?: string } = {},
): Promise<void> {
  const home = resolveHome(deps.home);
  const cwd = deps.cwd ?? process.cwd();
  const current = readConfig({ cwd, home });
  const next: CaduceusConfig = { ...current.config, [field]: value };
  await writeGlobalConfig(next, { home });
}

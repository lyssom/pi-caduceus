// ---------------------------------------------------------------------------
// caduceus — profile store
//
// Pure storage layer for caduceus profiles. A profile is a subset of
// CaduceusConfig saved to a JSON file. Users can save / load / list /
// delete profiles to switch whole config sets.
//
// Storage paths:
//   Global:  ~/.pi/agent/caduceus/profiles/<name>.json
//   Project: <cwd>/.caduceus/profiles/<name>.json
//
// Precedence: project > global (project shadows global).
// ---------------------------------------------------------------------------

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { writeFile, rename, mkdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import {
  CaduceusProfileError,
  CaduceusProfileNotFoundError,
} from "./errors.ts";
import type {
  LocalePreference,
  PersonaMode,
  SystemPromptMode,
} from "./config-store.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProfileName = string;

export type Profile = {
  mode: PersonaMode;
  locale: LocalePreference;
  systemPromptMode: SystemPromptMode;
  persona: string;
};

export const DEFAULT_PROFILE: Profile = {
  mode: "default",
  locale: "auto",
  systemPromptMode: "append",
  persona: "default",
};

function resolveHome(home?: string): string {
  return home ?? join(homedir(), ".pi", "agent");
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

export function profileFilePath(
  name: ProfileName,
  scope: "global" | "project",
  cwd: string,
  home?: string,
): string {
  if (scope === "project") {
    return join(cwd, ".caduceus", "profiles", `${name}.json`);
  }
  return join(resolveHome(home), "caduceus", "profiles", `${name}.json`);
}

// ---------------------------------------------------------------------------
// Internal: read a profile JSON file safely
// ---------------------------------------------------------------------------

function readProfile(path: string): Profile {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CaduceusProfileNotFoundError(path);
    }
    throw new CaduceusProfileError(`Failed to read ${path}: ${(err as Error).message}`, path);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CaduceusProfileError(
      `Failed to parse ${path}: ${(err as Error).message}`,
      path,
    );
  }
  if (!isProfile(parsed)) {
    throw new CaduceusProfileError(
      `Invalid profile in ${path}: missing required field`,
      path,
    );
  }
  return parsed;
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mode === "string" &&
    typeof v.locale === "string" &&
    typeof v.systemPromptMode === "string" &&
    typeof v.persona === "string"
  );
}

// ---------------------------------------------------------------------------
// Internal: list .json files in a directory
// ---------------------------------------------------------------------------

function listJsonFiles(dir: string): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all available profile names. Project profiles shadow global
 * profiles with the same name. Returns a sorted, deduplicated list.
 */
export function listProfiles(cwd: string, home?: string): ProfileName[] {
  const globalDir = join(resolveHome(home), "caduceus", "profiles");
  const projectDir = join(cwd, ".caduceus", "profiles");
  const global = listJsonFiles(globalDir);
  const project = listJsonFiles(projectDir);

  const seen = new Set<ProfileName>();
  const result: ProfileName[] = [];
  for (const name of project) {
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
  return result.sort();
}

/**
 * Load a profile by name. Project profiles shadow global profiles.
 * Throws CaduceusProfileNotFoundError if the profile is not found.
 * Throws CaduceusProfileError if the file exists but is malformed.
 */
export function loadProfile(
  name: ProfileName,
  cwd: string,
  home?: string,
): Profile {
  const projectPath = profileFilePath(name, "project", cwd, home);
  if (existsSync(projectPath)) {
    return readProfile(projectPath);
  }
  const globalPath = profileFilePath(name, "global", cwd, home);
  if (existsSync(globalPath)) {
    return readProfile(globalPath);
  }
  throw new CaduceusProfileNotFoundError(name);
}

/**
 * Save a profile to the global path. Uses atomic write via tmp +
 * rename. Creates parent directories as needed.
 */
export async function saveProfile(
  name: ProfileName,
  profile: Profile,
  cwd: string,
  home?: string,
): Promise<void> {
  const targetPath = profileFilePath(name, "global", cwd, home);
  const tmpPath = `${targetPath}.tmp.${randomUUID()}`;
  const content = JSON.stringify(profile, null, 2) + "\n";
  try {
    await mkdir(join(targetPath, ".."), { recursive: true });
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, targetPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // best-effort
    }
    throw err;
  }
}

/**
 * Delete a profile from the global path. If the file doesn't exist,
 * the function is a no-op (returns without throwing).
 */
export async function deleteProfile(
  name: ProfileName,
  cwd: string,
  home?: string,
): Promise<void> {
  const targetPath = profileFilePath(name, "global", cwd, home);
  try {
    await unlink(targetPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return; // already gone
    }
    throw err;
  }
}

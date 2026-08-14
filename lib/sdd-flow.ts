// ---------------------------------------------------------------------------
// caduceus — SDD flow
//
// Implements the 5 SDD command operations (introduced in v0.5.0):
//
//   sddInit      create openspec/changes/<name>/ + 5 MD files
//   sddExplore   return requirements.md skeleton for the active change
//   sddPropose   generate proposal.md from requirements.md
//   sddApply     mark checkboxes for completed tasks
//   sddArchive   move the change dir to openspec/changes/archive/
//
// State of the "active change" lives in
// <home>/.pi/agent/caduceus/state.json (default: ~/.pi/agent/...).
//
// Phase A: all operations are deterministic, no LLM involvement.
// Phase B will add interactive LLM assistance to sddExplore and
// sddPropose.
//
// See design.md §3.2 and §4 for the API contract.
// ---------------------------------------------------------------------------

import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { CaduceusSDDError } from "./errors.ts";
import {
  renderTemplate,
  type SddTemplateContext,
  type SddTemplateId,
} from "./sdd-templates.ts";

// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export type SddInitOptions = {
  changeName: string;
  cwd: string;
  home?: string;
};

export type SddExploreOptions = {
  changeName: string;
  topic: string;
  cwd: string;
  home?: string;
};

export type SddProposeOptions = {
  changeName: string;
  requirementsMarkdown: string;
  cwd: string;
  home?: string;
};

export type SddApplyOptions = {
  changeName: string;
  completedTasks: ReadonlyArray<number>;
  cwd: string;
  home?: string;
};

export type SddArchiveOptions = {
  changeName: string;
  cwd: string;
  home?: string;
};

// ---------------------------------------------------------------------------
// Internal: paths + state file
// ---------------------------------------------------------------------------

const NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;

function resolveHome(home?: string): string {
  return home ?? homedir();
}

function statePathFor(home: string): string {
  return join(home, ".pi", "agent", "caduceus", "state.json");
}

function changeDirFor(changeName: string, cwd: string): string {
  return join(cwd, "openspec", "changes", changeName);
}

function archiveDirFor(cwd: string): string {
  return join(cwd, "openspec", "changes", "archive");
}

type SddState = { activeChange: string | null };

/**
 * Read the active change name from `~/.pi/agent/caduceus/state.json`.
 * Returns null if no state file exists or it is malformed.
 *
 * Exported (rather than kept internal to this module) so that the
 * slash-command wiring in extensions/caduceus.ts and the tests in
 * tests/slash-commands-sdd.test.ts can share a single source of truth.
 */
export function readActiveChange(home?: string): string | null {
  const h = resolveHome(home);
  const p = statePathFor(h);
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as SddState;
    return parsed.activeChange ?? null;
  } catch {
    return null;
  }
}

function readState(home: string): SddState {
  const p = statePathFor(home);
  if (!existsSync(p)) return { activeChange: null };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SddState;
  } catch {
    return { activeChange: null };
  }
}

function writeState(home: string, state: SddState): void {
  const p = statePathFor(home);
  mkdirSync(join(p, ".."), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function archiveTimestamp(): string {
  // 2026-08-14T15-30-45Z (colons/dots replaced for filesystem safety)
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ---------------------------------------------------------------------------
// Public API: sddInit
// ---------------------------------------------------------------------------

export function sddInit(opts: SddInitOptions): void {
  if (!NAME_REGEX.test(opts.changeName)) {
    throw new CaduceusSDDError(
      "invalid-name",
      `Invalid change name '${opts.changeName}'. Must match ${NAME_REGEX}.`,
    );
  }

  const home = resolveHome(opts.home);
  const cd = changeDirFor(opts.changeName, opts.cwd);

  if (existsSync(cd)) {
    throw new CaduceusSDDError(
      "change-exists",
      `Change directory already exists: ${cd}`,
    );
  }

  mkdirSync(cd, { recursive: true });

  // Render the 5 templates with the change context
  const ctx: SddTemplateContext = {
    changeName: opts.changeName,
    date: todayIso(),
    userName: process.env.USER ?? process.env.USERNAME ?? "user",
    projectName: opts.changeName,
  };

  const templates: ReadonlyArray<SddTemplateId> = [
    "proposal",
    "design",
    "tasks",
    "requirements",
    "constitution",
  ];
  for (const id of templates) {
    writeFileSync(join(cd, `${id}.md`), renderTemplate(id, ctx), "utf8");
  }

  // Update state.json
  writeState(home, { activeChange: opts.changeName });
}

// ---------------------------------------------------------------------------
// Public API: sddExplore
// ---------------------------------------------------------------------------

export function sddExplore(opts: SddExploreOptions): string {
  const cd = changeDirFor(opts.changeName, opts.cwd);
  const requirementsPath = join(cd, "requirements.md");

  if (!existsSync(requirementsPath)) {
    throw new CaduceusSDDError(
      "requirements-missing",
      `No requirements.md at ${requirementsPath}; run sddInit first.`,
    );
  }

  // Phase A: return the existing requirements.md skeleton unchanged.
  // Phase B will inject LLM-assisted requirement generation here.
  return readFileSync(requirementsPath, "utf8");
}

// ---------------------------------------------------------------------------
// Public API: sddPropose
// ---------------------------------------------------------------------------

export function sddPropose(opts: SddProposeOptions): void {
  const cd = changeDirFor(opts.changeName, opts.cwd);
  const requirementsPath = join(cd, "requirements.md");

  if (!existsSync(requirementsPath)) {
    throw new CaduceusSDDError(
      "requirements-missing",
      `Cannot propose: requirements.md missing at ${requirementsPath}.`,
    );
  }

  // Phase A: render the proposal template with the change context.
  // Phase B will inject LLM-assisted proposal generation here,
  // incorporating the parsed requirements content.
  const ctx: SddTemplateContext = {
    changeName: opts.changeName,
    date: todayIso(),
    userName: process.env.USER ?? process.env.USERNAME ?? "user",
    projectName: opts.changeName,
  };
  const proposal = renderTemplate("proposal", ctx);
  writeFileSync(join(cd, "proposal.md"), proposal, "utf8");

  // Update state.json so subsequent operations target this change.
  writeState(resolveHome(opts.home), { activeChange: opts.changeName });
}

// ---------------------------------------------------------------------------
// Public API: sddApply
// ---------------------------------------------------------------------------

/**
 * Replace `- [ ]` with `- [x]` for checkboxes within the named task
 * sections of tasks.md. Idempotent: already-checked boxes are
 * left alone.
 */
function markTaskCheckboxes(tasksContent: string, completedTasks: ReadonlyArray<number>): string {
  if (completedTasks.length === 0) return tasksContent;
  const targets = new Set(completedTasks);
  const lines = tasksContent.split("\n");
  let currentTask: number | null = null;
  const out: string[] = [];
  for (const line of lines) {
    const header = line.match(/^##\s+Task\s+(\d+):/);
    if (header) {
      currentTask = parseInt(header[1], 10);
    }
    const isInTargetTask = currentTask !== null && targets.has(currentTask);
    const isUncheckedBox = /^-\s+\[\s\]/.test(line);
    if (isInTargetTask && isUncheckedBox) {
      out.push(line.replace(/^-\s+\[\s\]/, "- [x]"));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

export function sddApply(opts: SddApplyOptions): void {
  const cd = changeDirFor(opts.changeName, opts.cwd);
  const tasksPath = join(cd, "tasks.md");
  if (!existsSync(tasksPath)) {
    throw new CaduceusSDDError(
      "requirements-missing",
      `No tasks.md at ${tasksPath}; run sddInit first.`,
    );
  }
  const original = readFileSync(tasksPath, "utf8");
  const updated = markTaskCheckboxes(original, opts.completedTasks);
  if (updated !== original) {
    const tmp = `${tasksPath}.tmp`;
    writeFileSync(tmp, updated, "utf8");
    renameSync(tmp, tasksPath);
  }
}

// ---------------------------------------------------------------------------
// Public API: sddArchive
// ---------------------------------------------------------------------------

/**
 * Check that a finalized receipt exists for the change. Returns the
 * parsed receipt if valid; throws not-finalized otherwise.
 */
function requireFinalizedReceipt(cd: string): { finalVerificationPassed: boolean } {
  const p = join(cd, ".review", "receipt.json");
  if (!existsSync(p)) {
    throw new CaduceusSDDError(
      "not-finalized",
      `No receipt at ${p}; finalize the review first.`,
    );
  }
  let parsed: { finalVerificationPassed?: boolean };
  try {
    parsed = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    throw new CaduceusSDDError(
      "not-finalized",
      `Receipt at ${p} is not valid JSON.`,
    );
  }
  if (parsed.finalVerificationPassed !== true) {
    throw new CaduceusSDDError(
      "not-finalized",
      `Receipt at ${p} has finalVerificationPassed !== true.`,
    );
  }
  return parsed as { finalVerificationPassed: boolean };
}

/**
 * Append a decision-records row to the project's STATUS.md §8 table.
 * Falls back to appending an HTML comment if the §8 table isn't
 * detected.
 */
function appendStatusRow(cwd: string, changeName: string, date: string): void {
  const statusPath = join(cwd, "STATUS.md");
  if (!existsSync(statusPath)) return;
  const content = readFileSync(statusPath, "utf8");
  const row = `| ${date} (${changeName}) | archived via sdd-archive | _via sdd-archive_ |\n`;

  // Try to find the §8 table and insert before the next section
  const section8Idx = content.search(/##\s*8\..*Decision records/i);
  if (section8Idx < 0) {
    // Fallback: append at end as a comment
    writeFileSync(
      statusPath,
      content + `\n<!-- sdd-archive: ${changeName} on ${date} -->\n`,
      "utf8",
    );
    return;
  }
  // Find the end of the §8 table: look for the next `\n## ` or `\n# ` after §8
  const afterSection = content.slice(section8Idx);
  const nextSectionMatch = afterSection.match(/\n##\s+\d+\./);
  const insertPoint = nextSectionMatch
    ? section8Idx + (nextSectionMatch.index ?? afterSection.length)
    : content.length;
  const newContent =
    content.slice(0, insertPoint) + row + content.slice(insertPoint);
  writeFileSync(statusPath, newContent, "utf8");
}

export function sddArchive(opts: SddArchiveOptions): void {
  const cd = changeDirFor(opts.changeName, opts.cwd);
  requireFinalizedReceipt(cd);

  const archiveBase = archiveDirFor(opts.cwd);
  mkdirSync(archiveBase, { recursive: true });
  const archiveName = `${archiveTimestamp()}-${opts.changeName}`;
  const dest = join(archiveBase, archiveName);
  if (existsSync(dest)) {
    throw new CaduceusSDDError(
      "not-finalized",
      `Archive target already exists: ${dest}`,
    );
  }
  renameSync(cd, dest);

  // Append row to STATUS.md §8 (best-effort; ignored if STATUS.md missing)
  try {
    appendStatusRow(opts.cwd, opts.changeName, todayIso());
  } catch {
    // Swallow — STATUS.md modification is best-effort for Phase A.
  }

  // Clear activeChange if it pointed to this change
  const home = resolveHome(opts.home);
  const state = readState(home);
  if (state.activeChange === opts.changeName) {
    writeState(home, { activeChange: null });
  }
}

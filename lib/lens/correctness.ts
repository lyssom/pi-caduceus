// ---------------------------------------------------------------------------
// caduceus — correctness lens (v0.6.0 T04)
//
// Static-analysis lens for cross-file reference consistency.
//
//   P1  — design.md references REQ-NNN not declared in requirements.md
//   P2  — design.md references CON-NNN not declared in constitution.md
//   P2  — tasks.md ## Task N: block missing '**Done when:**'
//         (GATED by v0.6.0 template marker; v0.5.0 archived exempt
//          per REQ-020 / CON-008)
//   P2  — tasks.md ## Task N: block has zero checkbox steps (always)
//
// Algorithm: design.md §6.2. Pure-TS; no network, no process, no LLM.
//
// Findings are capped at 20 per REQ-005 with `truncated: true` set on
// the LensFindings summary when truncated.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { Lens, LensFinding } from "../review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQ_ID_RE = /\bREQ-(\d+)\b/g;
const CON_ID_RE = /\bCON-(\d+)\b/g;
const TASK_HEADING_RE = /^##\s+Task\s+(\d+):/gm;
const CHECKBOX_RE = /^- \[ \]/gm;
const DONE_WHEN_RE = /\*\*Done when:\*\*/;

const MARKER_V060 =
  /<!--\s*caduceus:tasks-template-version\s+0\.6\.0\s*-->/;

const FINDING_CAP = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Extract all IDs (e.g. "REQ-001", "CON-002") from a markdown body.
 * Shared with `spec-compliance.ts` (T07) via the shape, not via import —
 * each lens file is self-contained.
 */
function extractIds(text: string, regex: RegExp, prefix: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(regex)) {
    out.add(`${prefix}${m[1]}`);
  }
  return out;
}

type TaskBlock = { number: number; content: string };

/**
 * Split a tasks.md body into per-task blocks keyed by `## Task N:`
 * heading. Returns an empty array if no headings are found.
 */
function splitTasks(tasksText: string): TaskBlock[] {
  const headings = [...tasksText.matchAll(TASK_HEADING_RE)];
  const blocks: TaskBlock[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index!;
    const end =
      i + 1 < headings.length ? headings[i + 1].index! : tasksText.length;
    blocks.push({
      number: parseInt(headings[i][1], 10),
      content: tasksText.slice(start, end),
    });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Public API: correctnessLens
// ---------------------------------------------------------------------------

export const correctnessLens: Lens = {
  id: "correctness",
  displayName: "Correctness",
  description:
    "Cross-file reference consistency: REQ-NNN / CON-NNN linkage, " +
    "Done when: contract (v0.6.0+ gated), task checkbox presence.",

  async run(changeDir) {
    const t0 = Date.now();
    const findings: LensFinding[] = [];

    // Read all 4 relevant files; treat missing as empty so downstream
    // parsers don't throw.
    const requirementsText =
      readIfExists(join(changeDir, "requirements.md")) ?? "";
    const designText =
      readIfExists(join(changeDir, "design.md")) ?? "";
    const constitutionText =
      readIfExists(join(changeDir, "constitution.md")) ?? "";
    const tasksText = readIfExists(join(changeDir, "tasks.md")) ?? "";

    // ----- P1: design.md references REQ-NNN not in requirements.md
    {
      const declaredReqs = extractIds(requirementsText, REQ_ID_RE, "REQ-");
      const referencedReqs = extractIds(designText, REQ_ID_RE, "REQ-");
      for (const ref of referencedReqs) {
        if (!declaredReqs.has(ref)) {
          findings.push({
            severity: "P1",
            summary:
              `${ref} referenced in design.md but not declared ` +
              `in requirements.md`,
            location: "design.md",
            recommendation:
              `Either add ${ref} to requirements.md or remove the ` +
              `reference from design.md.`,
          });
        }
      }
    }

    // ----- P2: design.md references CON-NNN not in constitution.md
    {
      const declaredCons = extractIds(constitutionText, CON_ID_RE, "CON-");
      const referencedCons = extractIds(designText, CON_ID_RE, "CON-");
      for (const ref of referencedCons) {
        if (!declaredCons.has(ref)) {
          findings.push({
            severity: "P2",
            summary:
              `${ref} referenced in design.md but not declared ` +
              `in constitution.md`,
            location: "design.md",
            recommendation:
              `Either add ${ref} to constitution.md or remove the ` +
              `reference from design.md.`,
          });
        }
      }
    }

    // ----- P2: tasks.md '**Done when:**' missing per task
    // Gated by v0.6.0 marker (REQ-020 / CON-008).
    // v0.5.0 marker → exempt (no false positives on archived changes).
    // No marker    → exempt (conservative; legacy/malformed files).
    // Other version → exempt (future gates in v0.6.x patches).
    const isV060 = MARKER_V060.test(tasksText);
    if (isV060) {
      const taskBlocks = splitTasks(tasksText);
      for (const block of taskBlocks) {
        if (!DONE_WHEN_RE.test(block.content)) {
          findings.push({
            severity: "P2",
            summary:
              `Task ${block.number} missing '**Done when:**' contract line`,
            location: `tasks.md §Task ${block.number}`,
            recommendation:
              "Add a '**Done when:**' line stating the observable " +
              "completion criterion.",
          });
        }
      }
    }

    // ----- P2: tasks.md task with zero checkbox steps (always fires)
    const taskBlocks = splitTasks(tasksText);
    for (const block of taskBlocks) {
      const checkboxCount = (block.content.match(CHECKBOX_RE) ?? []).length;
      if (checkboxCount === 0) {
        findings.push({
          severity: "P2",
          summary: `Task ${block.number} has zero checkbox steps`,
          location: `tasks.md §Task ${block.number}`,
          recommendation:
            "Add at least one '- [ ]' checkbox step per task " +
            "(caduceus convention: tasks are atomic, testable units).",
        });
      }
    }

    // ----- Cap findings at 20 (REQ-005); set truncated flag
    let truncated: boolean | undefined;
    if (findings.length > FINDING_CAP) {
      findings.length = FINDING_CAP;
      truncated = true;
    }

    return {
      lensId: "correctness",
      findings: Object.freeze(findings),
      durationMs: Date.now() - t0,
      truncated,
    };
  },
};
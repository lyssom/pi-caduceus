// ---------------------------------------------------------------------------
// caduceus — risk lens (v0.6.0 T03)
//
// Static-analysis lens that surfaces high-impact changes before review.
//
//   P1  — BREAKING / DEPRECAT keyword in proposal.md (per occurrence, with line)
//   P2  — ≥3 TODO/FIXME/XXX/HACK markers across the 5 MD artifacts (aggregate)
//   P3  — change directory contains >10 files (aggregate, REQ-026)
//
// Algorithm: design.md §6.1. Pure-TS; no network, no process, no LLM.
//
// Findings are capped at 20 per REQ-005 with `truncated: true` set on
// the LensFindings summary when truncated.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import type { Lens, LensFinding } from "../review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MD_FILES: ReadonlyArray<string> = Object.freeze([
  "proposal.md",
  "design.md",
  "tasks.md",
  "requirements.md",
  "constitution.md",
]);

const KEYWORD_RE = /\bbreaking\b|\bdeprecat\b/gi;
const TODO_RE = /\b(?:TODO|FIXME|XXX|HACK)\b/g;
const FILE_COUNT_THRESHOLD = 10;
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

function countFiles(changeDir: string): number {
  try {
    return readdirSync(changeDir).filter((f) => !f.startsWith(".")).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Public API: riskLens
// ---------------------------------------------------------------------------

export const riskLens: Lens = {
  id: "risk",
  displayName: "Risk",
  description:
    "Surface high-impact changes: BREAKING/DEPRECAT keywords (P1), " +
    "≥3 TODO/FIXME/XXX/HACK markers (P2), >10 files in change dir (P3).",

  async run(changeDir) {
    const t0 = Date.now();
    const findings: LensFinding[] = [];

    // ----- P1: BREAKING/DEPRECAT keyword in proposal.md (per occurrence)
    const proposalPath = join(changeDir, "proposal.md");
    const proposalContent = readIfExists(proposalPath);
    if (proposalContent !== null) {
      const lines = proposalContent.split("\n");
      for (let i = 0; i < lines.length; i++) {
        // Use matchAll to count all matches per line (defensive: >1 keyword
        // per line is rare but possible).
        const matches = [...lines[i].matchAll(KEYWORD_RE)];
        for (const _ of matches) {
          findings.push({
            severity: "P1",
            summary: `BREAKING/DEPRECAT keyword in proposal.md line ${i + 1}`,
            location: "proposal.md",
            recommendation:
              "Confirm intent; BREAKING/DEPRECAT changes surface " +
              "for explicit user review at finalize time.",
            line: i + 1,
          });
        }
      }
    }

    // ----- P2: ≥3 TODO/FIXME/XXX/HACK markers across the 5 MD artifacts
    let totalMarkers = 0;
    const markerBreakdown: string[] = [];
    for (const file of MD_FILES) {
      const content = readIfExists(join(changeDir, file));
      if (content === null) continue;
      const matches = content.match(TODO_RE);
      if (matches && matches.length > 0) {
        totalMarkers += matches.length;
        markerBreakdown.push(`${file}:${matches.length}`);
      }
    }
    if (totalMarkers >= 3) {
      findings.push({
        severity: "P2",
        summary: `Found ${totalMarkers} TODO/FIXME/XXX/HACK marker${
          totalMarkers === 1 ? "" : "s"
        } across ${markerBreakdown.length} artifact${
          markerBreakdown.length === 1 ? "" : "s"
        }`,
        location: markerBreakdown.join(", "),
        recommendation:
          "Resolve or remove TODO/FIXME markers before archive; " +
          "they signal unfinished work that reviewers will surface.",
      });
    }

    // ----- P3: change directory contains >10 files (REQ-026)
    const fileCount = countFiles(changeDir);
    if (fileCount > FILE_COUNT_THRESHOLD) {
      findings.push({
        severity: "P3",
        summary: `Change directory contains ${fileCount} files (>${FILE_COUNT_THRESHOLD} threshold)`,
        location: basename(changeDir),
        recommendation:
          "Consider splitting this change into smaller increments " +
          "or moving helpers to lib/.",
      });
    }

    // ----- Cap findings at 20 (REQ-005); set truncated flag
    let truncated: boolean | undefined;
    if (findings.length > FINDING_CAP) {
      findings.length = FINDING_CAP;
      truncated = true;
    }

    return {
      lensId: "risk",
      findings: Object.freeze(findings),
      durationMs: Date.now() - t0,
      truncated,
    };
  },
};
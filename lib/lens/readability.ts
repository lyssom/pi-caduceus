// ---------------------------------------------------------------------------
// caduceus — readability lens (v0.6.0 T06)
//
// Static-analysis lens for readability heuristics.
//
//   P2  — any MD file > 200 lines (per file)
//   P2  — proposal.md missing required section (## 1. Intent /
//         ## 3. Scope / ## 4. Success criteria)
//   P3  — any MD file has a depth-5+ heading (excessive nesting)
//
// Algorithm: design.md §6.4. Pure-TS; no network, no process, no LLM.
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

const MD_FILES: ReadonlyArray<string> = Object.freeze([
  "proposal.md",
  "design.md",
  "tasks.md",
  "requirements.md",
  "constitution.md",
]);

const REQUIRED_PROPOSAL_SECTIONS: ReadonlyArray<string> = Object.freeze([
  "## 1. Intent",
  "## 3. Scope",
  "## 4. Success criteria",
]);

const LINE_COUNT_THRESHOLD = 200;
const DEPTH_THRESHOLD = 4; // depth-5 heading (# × 5) triggers P3
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
 * Count the number of consecutive `#` characters at the start of a line,
 * up to a maximum of 6. Returns 0 if the line is not a heading (no
 * whitespace after the `#`s).
 */
function headingDepth(line: string): number {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

function maxDepth(text: string): number {
  let max = 0;
  for (const line of text.split("\n")) {
    const d = headingDepth(line);
    if (d > max) max = d;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Public API: readabilityLens
// ---------------------------------------------------------------------------

export const readabilityLens: Lens = {
  id: "readability",
  displayName: "Readability",
  description:
    "Static readability heuristics: MD files >200 lines (P2), " +
    "proposal.md missing required sections (P2), depth-5+ headings (P3).",

  async run(changeDir) {
    const t0 = Date.now();
    const findings: LensFinding[] = [];

    // ----- P2 per file > 200 lines
    // ----- P3 per file with depth-5+ heading
    for (const file of MD_FILES) {
      const content = readIfExists(join(changeDir, file));
      if (content === null) continue;

      const lineCount = content.split("\n").length;
      if (lineCount > LINE_COUNT_THRESHOLD) {
        findings.push({
          severity: "P2",
          summary:
            `${file} is ${lineCount} lines (>${LINE_COUNT_THRESHOLD} threshold)`,
          location: file,
          recommendation:
            "Split the file into smaller artifacts or move detail " +
            "into lib/ modules referenced from the proposal.",
        });
      }

      const depth = maxDepth(content);
      if (depth > DEPTH_THRESHOLD) {
        findings.push({
          severity: "P3",
          summary:
            `${file} has a depth-${depth} heading (>${DEPTH_THRESHOLD}); ` +
            `consider flattening`,
          location: file,
          recommendation:
            "Reduce heading nesting; depth-5+ headings are usually a " +
            "sign that a topic should be split into a separate artifact.",
        });
      }
    }

    // ----- P2: proposal.md missing required sections
    const proposalText =
      readIfExists(join(changeDir, "proposal.md")) ?? "";
    if (proposalText) {
      for (const section of REQUIRED_PROPOSAL_SECTIONS) {
        // Match the section heading anywhere in the file (not anchored)
        const re = new RegExp(`^${escapeRegex(section)}\\s*$`, "m");
        if (!re.test(proposalText)) {
          findings.push({
            severity: "P2",
            summary: `proposal.md missing required section '${section}'`,
            location: "proposal.md",
            recommendation:
              `Add the '${section}' section per the caduceus ` +
              `proposal template (proposal.md §3 / §4 / §8).`,
          });
        }
      }
    }

    // ----- Cap findings at 20 (REQ-005); set truncated flag
    let truncated: boolean | undefined;
    if (findings.length > FINDING_CAP) {
      findings.length = FINDING_CAP;
      truncated = true;
    }

    return {
      lensId: "readability",
      findings: Object.freeze(findings),
      durationMs: Date.now() - t0,
      truncated,
    };
  },
};

// ---------------------------------------------------------------------------
// Internal: regex escape for required-section matcher
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
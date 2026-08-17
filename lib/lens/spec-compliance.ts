// ---------------------------------------------------------------------------
// caduceus — spec-compliance lens (v0.6.0 T07)
//
// Static-analysis lens for spec/task/con alignment.
//
//   P1  — REQ-NNN declared in requirements.md but not referenced
//         in tasks.md (orphan requirement)
//   P2  — proposal.md §3 Scope section omits the changeName
//         (state.json activeChange, else dir basename)
//   P2  — CON-NNN declared in constitution.md but not referenced
//         in proposal.md or design.md (orphan principle)
//
// Algorithm: design.md §6.5. Pure-TS; no network, no process, no LLM.
//
// Findings are capped at 20 per REQ-005 with `truncated: true` set on
// the LensFindings summary when truncated.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import type { Lens, LensFinding } from "../review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQ_ID_RE = /\bREQ-(\d+)\b/g;
const CON_ID_RE = /\bCON-(\d+)\b/g;

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

function extractIds(text: string, regex: RegExp, prefix: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(regex)) {
    out.add(`${prefix}${m[1]}`);
  }
  return out;
}

/**
 * Extract the body of the `## 3. Scope` section. Returns "" if the section
 * is absent. The section ends at the next `## ` heading or end-of-doc.
 *
 * Implementation note: a line-based scanner is simpler and more reliable
 * than a regex with `\s*$` lookahead (which consumed the newline and
 * caused off-by-one capture failures under strip-types).
 */
function extractScopeSection(proposalText: string): string {
  const lines = proposalText.split("\n");
  let inScope = false;
  const captured: string[] = [];
  for (const line of lines) {
    if (/^## 3\. Scope\s*$/.test(line)) {
      inScope = true;
      continue;
    }
    if (inScope) {
      if (/^## /.test(line)) break;
      captured.push(line);
    }
  }
  return captured.join("\n");
}

/**
 * Resolve the active change name. Prefer state.json's `activeChange`
 * (when present and parseable); else fall back to the directory basename.
 * Tolerant of corrupt state.json: any read/parse error → fallback.
 */
function resolveChangeName(changeDir: string): string {
  const statePath = join(changeDir, ".review", "state.json");
  if (existsSync(statePath)) {
    try {
      const raw = readFileSync(statePath, "utf8");
      const parsed = JSON.parse(raw) as { activeChange?: string };
      if (typeof parsed.activeChange === "string" && parsed.activeChange) {
        return parsed.activeChange;
      }
    } catch {
      // fall through to basename
    }
  }
  return basename(changeDir);
}

// ---------------------------------------------------------------------------
// Public API: specComplianceLens
// ---------------------------------------------------------------------------

export const specComplianceLens: Lens = {
  id: "spec-compliance",
  displayName: "Spec Compliance",
  description:
    "Spec/task alignment: REQ-NNN coverage (P1), changeName in §3 " +
    "Scope (P2), CON-NNN referenced in proposal/design (P2).",

  async run(changeDir) {
    const t0 = Date.now();
    const findings: LensFinding[] = [];

    const requirementsText =
      readIfExists(join(changeDir, "requirements.md")) ?? "";
    const proposalText =
      readIfExists(join(changeDir, "proposal.md")) ?? "";
    const designText =
      readIfExists(join(changeDir, "design.md")) ?? "";
    const tasksText = readIfExists(join(changeDir, "tasks.md")) ?? "";
    const constitutionText =
      readIfExists(join(changeDir, "constitution.md")) ?? "";

    // ----- P1: REQ-NNN declared but not covered by any task
    {
      const declaredReqs = extractIds(requirementsText, REQ_ID_RE, "REQ-");
      const taskReqs = extractIds(tasksText, REQ_ID_RE, "REQ-");
      for (const req of declaredReqs) {
        if (!taskReqs.has(req)) {
          findings.push({
            severity: "P1",
            summary:
              `${req} declared in requirements.md but no task references it`,
            location: "requirements.md",
            recommendation:
              `Either add a task referencing ${req} or remove ` +
              `${req} from requirements.md.`,
          });
        }
      }
    }

    // ----- P2: proposal.md §3 Scope mentions the changeName
    {
      const changeName = resolveChangeName(changeDir);
      if (changeName && proposalText) {
        const scopeBody = extractScopeSection(proposalText);
        if (!scopeBody.includes(changeName)) {
          findings.push({
            severity: "P2",
            summary:
              `proposal.md §3 Scope does not mention changeName '${changeName}'`,
            location: "proposal.md §3",
            recommendation:
              `Add an explicit reference to '${changeName}' in the ` +
              `§3 Scope section (state.json activeChange or dir basename).`,
          });
        }
      }
    }

    // ----- P2: CON-NNN declared but not referenced in proposal/design
    {
      const declaredCons = extractIds(constitutionText, CON_ID_RE, "CON-");
      if (declaredCons.size > 0) {
        const proposalCons = extractIds(proposalText, CON_ID_RE, "CON-");
        const designCons = extractIds(designText, CON_ID_RE, "CON-");
        for (const con of declaredCons) {
          if (!proposalCons.has(con) && !designCons.has(con)) {
            findings.push({
              severity: "P2",
              summary:
                `${con} declared in constitution.md but not ` +
                `referenced in proposal.md or design.md`,
              location: "constitution.md",
              recommendation:
                `Either reference ${con} in proposal.md or design.md, ` +
                `or remove it from constitution.md if no longer needed.`,
            });
          }
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
      lensId: "spec-compliance",
      findings: Object.freeze(findings),
      durationMs: Date.now() - t0,
      truncated,
    };
  },
};
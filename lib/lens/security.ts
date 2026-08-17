// ---------------------------------------------------------------------------
// caduceus — security lens (v0.6.0 T05)
//
// Static-analysis lens for security-relevant patterns.
//
//   P0  — MUST/SHALL-level CON-NNN in constitution.md lacks CWE field
//   P1  — secret-like keyword in tasks.md or design.md (per occurrence)
//         (password / api_key / api-key / apikey / token / secret)
//   P1  — risky shell pattern in tasks.md (per occurrence)
//         (curl|sh / wget|sh / sudo<space>)
//
// Algorithm: design.md §6.3. Pure-TS; no network, no process, no LLM.
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

const PRINCIPLE_HEADER = /^###\s+(CON-\d+):/m;
const LEVEL_REGEX = /\*\*Level\*\*:\s*(\S+(?:\s+NOT)?)/;
const CWE_FIELD_RE = /\*\*CWE\*\*:/;

const SECRET_RE = /\b(?:password|api[_-]?key|token|secret)\b/gi;
const RISKY_SHELL_RE = /curl\s*\|\s*sh|wget\s*\|\s*sh|sudo\s/gi;

const FILES_FOR_SECRET_SCAN: ReadonlyArray<string> = Object.freeze([
  "tasks.md",
  "design.md",
]);

const FILES_FOR_SHELL_SCAN: ReadonlyArray<string> = Object.freeze([
  "tasks.md",
]);

const FINDING_CAP = 20;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function readIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

type Principle = { id: string; body: string };

function parsePrinciples(constitutionText: string): Principle[] {
  if (!constitutionText.trim()) return [];
  const parts = constitutionText.split(PRINCIPLE_HEADER);
  const principles: Principle[] = [];
  // parts[0] is front matter; then alternates [id, body, id, body, ...]
  for (let i = 1; i < parts.length; i += 2) {
    principles.push({ id: parts[i], body: parts[i + 1] ?? "" });
  }
  return principles;
}

function isMustOrShall(level: string): boolean {
  return level.startsWith("MUST") || level.startsWith("SHALL");
}

function emitKeywordFindings(
  text: string,
  file: string,
  regex: RegExp,
  keywordHint: string,
  findings: LensFinding[],
): void {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const matches = [...lines[i].matchAll(regex)];
    for (const m of matches) {
      findings.push({
        severity: "P1",
        summary:
          `Security-sensitive keyword '${m[0]}' in ${file} line ${i + 1} ` +
          `(category: ${keywordHint})`,
        location: file,
        recommendation:
          "Avoid embedding secrets in MD; use a secrets manager " +
          "or environment variable loader.",
        line: i + 1,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Public API: securityLens
// ---------------------------------------------------------------------------

export const securityLens: Lens = {
  id: "security",
  displayName: "Security",
  description:
    "CWE mapping for MUST-level principles (P0); secret keywords " +
    "(password / api_key / token / secret) in tasks or design (P1); " +
    "risky shell patterns curl|sh / wget|sh / sudo (P1).",

  async run(changeDir) {
    const t0 = Date.now();
    const findings: LensFinding[] = [];

    // ----- P0: MUST/SHALL-level CON-NNN lacks CWE field
    const constitutionText =
      readIfExists(join(changeDir, "constitution.md")) ?? "";
    const principles = parsePrinciples(constitutionText);
    for (const p of principles) {
      const levelMatch = p.body.match(LEVEL_REGEX);
      const level = levelMatch ? levelMatch[1] : "";
      if (isMustOrShall(level) && !CWE_FIELD_RE.test(p.body)) {
        findings.push({
          severity: "P0",
          summary:
            `${p.id} (Level: '${level || "(empty)"}') lacks CWE field`,
          location: "constitution.md",
          recommendation:
            "MUST/SHALL-level principles MUST provide a CWE-NNN " +
            "reference or 'CWE: N/A' explicitly.",
        });
      }
    }

    // ----- P1: secret keywords in tasks.md and design.md
    for (const file of FILES_FOR_SECRET_SCAN) {
      const content = readIfExists(join(changeDir, file)) ?? "";
      if (content) {
        emitKeywordFindings(
          content, file, SECRET_RE, "secret-like keyword", findings,
        );
      }
    }

    // ----- P1: risky shell patterns in tasks.md
    for (const file of FILES_FOR_SHELL_SCAN) {
      const content = readIfExists(join(changeDir, file)) ?? "";
      if (content) {
        emitKeywordFindings(
          content, file, RISKY_SHELL_RE, "risky shell pattern", findings,
        );
      }
    }

    // ----- Cap findings at 20 (REQ-005); set truncated flag
    let truncated: boolean | undefined;
    if (findings.length > FINDING_CAP) {
      findings.length = FINDING_CAP;
      truncated = true;
    }

    return {
      lensId: "security",
      findings: Object.freeze(findings),
      durationMs: Date.now() - t0,
      truncated,
    };
  },
};
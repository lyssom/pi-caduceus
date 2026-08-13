// ---------------------------------------------------------------------------
// caduceus — persona linter
//
// Static checks on persona content. Catches the same invariants that
// R-PERSONA-* assert at test time, but as a runtime check on any
// user-provided persona.
//
// Severity rules:
//   - ERROR:   invariant violation → lint fails (passed = false)
//   - WARNING: heuristic concern   → lint still passes
//
// See design.md §4.3 for the full check list.
// ---------------------------------------------------------------------------

import type { PersonaName } from "./persona-loader.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LintSeverity = "error" | "warning";
export type LintIssue = {
  severity: LintSeverity;
  message: string;
  check: LintCheckId;
};
export type LintCheckId =
  | "CONFLICTING_VOICE_MARKERS"
  | "IDENTITY_BLOCK"
  | "PERSONA_BLOCK"
  | "PRINCIPLES_BLOCK"
  | "NO_TIMESTAMP"
  | "MODE_PLACEHOLDER";

export type LintResult = {
  passed: boolean;
  issues: LintIssue[];
};

// ---------------------------------------------------------------------------
// Internal: individual checks (each is a small pure function)
// ---------------------------------------------------------------------------

type CheckFn = (content: string, name: PersonaName) => LintIssue | null;

const hasIdentityBlock: CheckFn = (content) => {
  if (!content.includes("Identity contract:")) {
    return {
      severity: "error",
      check: "IDENTITY_BLOCK",
      message: "Persona must contain an 'Identity contract:' line.",
    };
  }
  return null;
};

const hasPersonaBlock: CheckFn = (content) => {
  if (!/^## Persona\s*$/m.test(content)) {
    return {
      severity: "error",
      check: "PERSONA_BLOCK",
      message: "Persona must contain a '## Persona' section.",
    };
  }
  return null;
};

const hasPrinciplesBlock: CheckFn = (content) => {
  if (!/^## Harness principles\s*$/m.test(content)) {
    return {
      severity: "error",
      check: "PRINCIPLES_BLOCK",
      message: "Persona must contain a '## Harness principles' section.",
    };
  }
  return null;
};

const hasModePlaceholder: CheckFn = (content) => {
  if (!content.includes("${mode}")) {
    return {
      severity: "error",
      check: "MODE_PLACEHOLDER",
      message: "Persona must contain the '${mode}' placeholder (runtime substitution).",
    };
  }
  return null;
};

const checkNoTimestamp: CheckFn = (content) => {
  // ISO date pattern: YYYY-MM-DD
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(content)) {
    return {
      severity: "error",
      check: "NO_TIMESTAMP",
      message: "Persona must not contain an ISO date (would break byte-stability).",
    };
  }
  // UUID-like hex pattern: 8-4-4-4-12
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(content)) {
    return {
      severity: "error",
      check: "NO_TIMESTAMP",
      message: "Persona must not contain a UUID-like hex string (would break byte-stability).",
    };
  }
  return null;
};

// v0.3.0: new lint check. Replaces the v0.2.0 cross-mode leak checks.
// Detects personas that try to be both "concise" and "verbose" in the
// same block — a recipe for model confusion.
const CONCISE_MARKERS = [
  "1-3 sentences",
  "brief",
  "concise",
  "minimal",
  "no preamble",
  "no postscript",
  "short",
];
const VERBOSE_MARKERS = [
  "thorough",
  "in detail",
  "show your reasoning",
  "explain tradeoffs",
  "step by step",
  "elaborate",
  "show the code",
];

const checkConflictingVoiceMarkers: CheckFn = (content) => {
  // Only look inside the Persona block (between "## Persona" and the next "## ").
  const personaMatch = content.match(/^## Persona\s*\n([\s\S]*?)\n## /m);
  if (!personaMatch) return null; // PERSONA_BLOCK check handles missing
  const personaBlock = personaMatch[1];

  const conciseHits = CONCISE_MARKERS.filter((m) =>
    personaBlock.toLowerCase().includes(m.toLowerCase()),
  );
  const verboseHits = VERBOSE_MARKERS.filter((m) =>
    personaBlock.toLowerCase().includes(m.toLowerCase()),
  );

  if (conciseHits.length >= 1 && verboseHits.length >= 1) {
    return {
      severity: "warning",
      check: "CONFLICTING_VOICE_MARKERS",
      message:
        `Persona block contains both concise and verbose markers ` +
        `(concise: ${conciseHits.join(", ")}; verbose: ${verboseHits.join(", ")}). ` +
        `Pick a direction; ambiguity confuses the model.`,
    };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Internal: run all checks
// ---------------------------------------------------------------------------

const ALL_CHECKS: ReadonlyArray<CheckFn> = [
  hasIdentityBlock,
  hasPersonaBlock,
  hasPrinciplesBlock,
  hasModePlaceholder,
  checkNoTimestamp,
  checkConflictingVoiceMarkers,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all lint checks on a persona's markdown content. Returns a result
 * with the list of issues (each tagged with severity and check ID) and a
 * `passed` boolean (false if any issue has severity "error").
 */
export function lintPersonaContent(
  content: string,
  name: PersonaName,
): LintResult {
  const issues: LintIssue[] = [];
  for (const check of ALL_CHECKS) {
    const issue = check(content, name);
    if (issue !== null) issues.push(issue);
  }
  const passed = !issues.some((i) => i.severity === "error");
  return { passed, issues };
}

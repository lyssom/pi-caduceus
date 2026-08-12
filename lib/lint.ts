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
  | "CROSS_MODE_LEAK_GENTLEMAN"
  | "CROSS_MODE_LEAK_NEUTRAL"
  | "VOSE_CONDITIONAL"
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

const checkCrossModeLeakGentleman: CheckFn = (content, name) => {
  // "Do NOT use voseo" is the neutral persona's signature phrase.
  // Only the neutral persona may contain it; any other persona is
  // leaking the neutral clause.
  if (name === "neutral") return null;
  if (content.includes("Do NOT use voseo")) {
    return {
      severity: "error",
      check: "CROSS_MODE_LEAK_GENTLEMAN",
      message: `Persona '${name}' must not contain 'Do NOT use voseo' (that's the neutral clause).`,
    };
  }
  return null;
};

const checkCrossModeLeakNeutral: CheckFn = (content, name) => {
  // "natural Rioplatense Spanish with voseo" is the gentleman persona's
  // signature phrase. Only the gentleman persona may contain it; any
  // other persona is leaking the gentleman clause.
  if (name === "gentleman") return null;
  if (content.includes("natural Rioplatense Spanish with voseo")) {
    return {
      severity: "error",
      check: "CROSS_MODE_LEAK_NEUTRAL",
      message: `Persona '${name}' must not contain 'natural Rioplatense Spanish with voseo' (that's the gentleman clause).`,
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

const checkVoseConditional: CheckFn = (content, name) => {
  // Heuristic: voseo/do-not-voseo references should be inside a
  // "When the user writes Spanish..." conditional sentence.
  // If found bare, warn.
  const hasVoseo = /voseo/i.test(content);
  if (!hasVoseo) return null;

  // Check for the canonical conditional phrasing
  const hasConditional =
    /when the user writes spanish/i.test(content) ||
    /if the user writes spanish/i.test(content);

  if (hasConditional) return null;

  return {
    severity: "warning",
    check: "VOSE_CONDITIONAL",
    message:
      `Voseo reference found but no "When the user writes Spanish..." conditional. ` +
      `Consider wrapping voseo clauses in a conditional so English-only users aren't confused.`,
  };
};

// ---------------------------------------------------------------------------
// Internal: run all checks
// ---------------------------------------------------------------------------

const ALL_CHECKS: ReadonlyArray<CheckFn> = [
  hasIdentityBlock,
  hasPersonaBlock,
  hasPrinciplesBlock,
  hasModePlaceholder,
  checkCrossModeLeakGentleman,
  checkCrossModeLeakNeutral,
  checkNoTimestamp,
  checkVoseConditional,
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

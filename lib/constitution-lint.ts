// ---------------------------------------------------------------------------
// caduceus — constitution lint
//
// Static checks on constitution.md content (introduced in v0.5.0).
// Validates the format documented in design.md §6.2: principles use
// CON-NNN prefix, RFC 2119 levels (MUST / SHOULD / MAY / etc.), and
// CWE mappings for MUST-level principles.
//
// Severity rules (per design.md §3.7):
//   - ERROR:   invariant violation → lint fails
//   - WARNING: heuristic concern   → lint still passes
//
// See tasks.md T01 for the 5-check acceptance criteria.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ConstitutionLintId =
  | "CONSTITUTION_EXISTS"
  | "CONSTITUTION_RFC2119"
  | "CONSTITUTION_CWE_MAPPING"
  | "CONSTITUTION_COUNT"
  | "CONSTITUTION_NO_DUPLICATE_IDS";

export type LintViolation = {
  checkId: string;
  message: string;
  severity: "error" | "warning";
  location?: string;
};

export type ConstitutionLintCheck = {
  id: ConstitutionLintId;
  run: (markdown: string) => ReadonlyArray<LintViolation>;
};

// ---------------------------------------------------------------------------
// Internal: parser
// ---------------------------------------------------------------------------

type Principle = {
  id: string;
  level: string;
  hasCwe: boolean;
};

const PRINCIPLE_HEADER = /^###\s+(CON-\d+):/m;
const LEVEL_REGEX = /\*\*Level\*\*:\s*(\S+(?:\s+NOT)?)/;
const CWE_FIELD_REGEX = /\*\*CWE\*\*:/;

/**
 * Parse the constitution markdown into a list of principles.
 * A principle block starts with `### CON-NNN:` and ends at the next
 * `### CON-NNN:` header or end-of-document.
 */
function parsePrinciples(markdown: string): Principle[] {
  if (!markdown.trim()) return [];
  const parts = markdown.split(PRINCIPLE_HEADER);
  // parts[0] is the front matter (before the first principle).
  // parts then alternates: [id, body, id, body, ...].
  const principles: Principle[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1] ?? "";
    const levelMatch = body.match(LEVEL_REGEX);
    principles.push({
      id,
      level: levelMatch ? levelMatch[1] : "",
      hasCwe: CWE_FIELD_REGEX.test(body),
    });
  }
  return principles;
}

// ---------------------------------------------------------------------------
// Internal: RFC 2119 keyword set
// ---------------------------------------------------------------------------

/**
 * RFC 2119 keywords (the canonical set used by IETF). The parser
 * recognizes compound keywords ("MUST NOT", "SHOULD NOT", etc.)
 * via the regex's `(?:\s+NOT)?` group.
 */
const RFC_2119_KEYWORDS: ReadonlySet<string> = new Set([
  "MUST",
  "MUST NOT",
  "SHOULD",
  "SHOULD NOT",
  "MAY",
  "MAY NOT",
  "SHALL",
  "SHALL NOT",
]);

function isBindingLevel(level: string): boolean {
  return (
    level.startsWith("MUST") ||
    level.startsWith("SHOULD") ||
    level.startsWith("SHALL")
  );
}

// ---------------------------------------------------------------------------
// Internal: individual checks
// ---------------------------------------------------------------------------

const CONSTITUTION_EXISTS_CHECK: ConstitutionLintCheck = {
  id: "CONSTITUTION_EXISTS",
  run: (markdown) => {
    if (!markdown.trim()) {
      return [
        {
          checkId: "CONSTITUTION_EXISTS",
          severity: "error",
          message: "Constitution file is empty or missing.",
        },
      ];
    }
    return [];
  },
};

const CONSTITUTION_RFC2119_CHECK: ConstitutionLintCheck = {
  id: "CONSTITUTION_RFC2119",
  run: (markdown) => {
    const principles = parsePrinciples(markdown);
    const violations: LintViolation[] = [];
    for (const p of principles) {
      if (!RFC_2119_KEYWORDS.has(p.level)) {
        violations.push({
          checkId: "CONSTITUTION_RFC2119",
          severity: "error",
          message:
            `Principle ${p.id} has invalid Level '${p.level || "(empty)"}'. ` +
            `Must be one of RFC 2119 keywords: ${Array.from(RFC_2119_KEYWORDS).join(", ")}.`,
          location: p.id,
        });
      }
    }
    return violations;
  },
};

const CONSTITUTION_CWE_MAPPING_CHECK: ConstitutionLintCheck = {
  id: "CONSTITUTION_CWE_MAPPING",
  run: (markdown) => {
    const principles = parsePrinciples(markdown);
    const violations: LintViolation[] = [];
    for (const p of principles) {
      // Warn for MUST-level principles lacking CWE.
      // Also warn for invalid levels (not RFC 2119, not MAY): the user
      // clearly intended a binding constraint (RECOMMENDED, etc.) and
      // the RFC2119 check will fire separately, but a missing CWE is
      // still a smell worth flagging.
      const isMust =
        p.level.startsWith("MUST") || p.level.startsWith("SHALL");
      const isInvalidNonMay =
        !RFC_2119_KEYWORDS.has(p.level) && p.level !== "";
      if ((isMust || isInvalidNonMay) && !p.hasCwe) {
        violations.push({
          checkId: "CONSTITUTION_CWE_MAPPING",
          severity: "warning",
          message:
            `Principle ${p.id} (Level: '${p.level || "(empty)"}') ` +
            `lacks a CWE field. SHOULD provide a CWE-NNN reference ` +
            `(or 'CWE: N/A' explicitly).`,
          location: p.id,
        });
      }
    }
    return violations;
  },
};

const CONSTITUTION_COUNT_CHECK: ConstitutionLintCheck = {
  id: "CONSTITUTION_COUNT",
  run: (markdown) => {
    const principles = parsePrinciples(markdown);
    if (principles.length === 0) {
      return [
        {
          checkId: "CONSTITUTION_COUNT",
          severity: "error",
          message:
            "Constitution contains 0 principles. Must have at least one principle.",
        },
      ];
    }
    // Fire "MAY-only" warning only if EVERY principle has an explicit MAY
    // level. Invalid levels (RECOMMENDED, etc.) are NOT counted as MAY;
    // the RFC2119 check fires for those, and we don't want to double-warn
    // for the same root cause.
    const allExplicitlyMay = principles.every(
      (p) => p.level === "MAY" || p.level === "MAY NOT",
    );
    if (allExplicitlyMay) {
      return [
        {
          checkId: "CONSTITUTION_COUNT",
          severity: "warning",
          message:
            "Constitution contains only MAY-level principles. " +
            "Constitution is non-binding; consider adding SHOULD or MUST.",
        },
      ];
    }
    return [];
  },
};

const CONSTITUTION_NO_DUPLICATE_IDS_CHECK: ConstitutionLintCheck = {
  id: "CONSTITUTION_NO_DUPLICATE_IDS",
  run: (markdown) => {
    const principles = parsePrinciples(markdown);
    const counts = new Map<string, number>();
    for (const p of principles) {
      counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    }
    const violations: LintViolation[] = [];
    for (const [id, count] of counts.entries()) {
      if (count > 1) {
        violations.push({
          checkId: "CONSTITUTION_NO_DUPLICATE_IDS",
          severity: "error",
          message: `Principle ID ${id} appears ${count} times. IDs must be unique.`,
          location: id,
        });
      }
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The 5 constitution lint checks, in stable order. Order does not
 * affect lint output semantics but is preserved for stable error
 * reporting and snapshot tests.
 */
export const CONSTITUTION_CHECKS: ReadonlyArray<ConstitutionLintCheck> = [
  CONSTITUTION_EXISTS_CHECK,
  CONSTITUTION_RFC2119_CHECK,
  CONSTITUTION_CWE_MAPPING_CHECK,
  CONSTITUTION_COUNT_CHECK,
  CONSTITUTION_NO_DUPLICATE_IDS_CHECK,
];

/**
 * Run all constitution lint checks on the given markdown.
 * Returns the aggregated list of violations across all 5 checks.
 * Caller decides pass/fail based on `severity === "error"` count.
 */
export function lintConstitutionContent(markdown: string): LintViolation[] {
  const violations: LintViolation[] = [];
  for (const check of CONSTITUTION_CHECKS) {
    violations.push(...check.run(markdown));
  }
  return violations;
}

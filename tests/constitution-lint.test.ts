// ---------------------------------------------------------------------------
// caduceus — constitution lint tests
//
// TDD micro-cycle (T01 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/constitution-lint.ts missing)
//   GREEN        → lib/constitution-lint.ts implements the 5 checks
//   TRIANGULATE  → additional cases below force more general regex
//                  parsing (compound RFC 2119 keywords, case sensitivity,
//                  N/A CWE handling, multiple violations per principle)
//
// The constitution lint enforces the format documented in
// design.md §6.2: principles use CON-NNN prefix, RFC 2119 levels,
// CWE mappings (or N/A for MUST).
//
// See design.md §3.7 for the check list and types.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONSTITUTION_CHECKS,
  lintConstitutionContent,
} from "../lib/constitution-lint.ts";

// ---------------------------------------------------------------------------
// Canonical constitution template (per design.md §6.2)
// ---------------------------------------------------------------------------

const CANONICAL_CONSTITUTION = `<!-- caduceus:constitution-template-version 0.5.0 -->

# Constitution — example-change

> Non-negotiable constraints for this change. Each principle carries
> an RFC 2119 level. MUST-level principles SHOULD map to a CWE ID
> (use \`CWE: N/A\` if no CWE applies). MAY-level principles may omit
> the CWE field.

## Principles

### CON-001: Cross-site scripting prevention
- **Level**: MUST
- **CWE**: CWE-79
- **Description**:
  Code MUST escape all user-controlled strings before rendering
  to any HTML context. This applies to all template engines
  and any direct DOM manipulation.

### CON-002: Atomic state transitions
- **Level**: MUST
- **CWE**: CWE-362
- **Description**:
  State machine transitions MUST be atomic. A transition
  either completes fully or leaves no observable state change.

### CON-003: Documentation entry required
- **Level**: SHOULD
- **CWE**: N/A
- **Description**:
  Every change SHOULD add a row to CHANGELOG.md.
`;

// ---------------------------------------------------------------------------
// Test 1: CONSTITUTION_CHECKS exports exactly 5 checks
// ---------------------------------------------------------------------------

test("T01-R-CLINT-1: CONSTITUTION_CHECKS has exactly 5 entries", () => {
  assert.equal(CONSTITUTION_CHECKS.length, 5);
  const ids = CONSTITUTION_CHECKS.map((c) => c.id);
  assert.deepEqual(
    ids.sort(),
    [
      "CONSTITUTION_COUNT",
      "CONSTITUTION_CWE_MAPPING",
      "CONSTITUTION_EXISTS",
      "CONSTITUTION_NO_DUPLICATE_IDS",
      "CONSTITUTION_RFC2119",
    ],
  );
});

// ---------------------------------------------------------------------------
// Test 2: canonical template passes all 5 checks (0 violations)
// ---------------------------------------------------------------------------

test("T01-R-CLINT-2: canonical constitution passes all 5 checks", () => {
  const violations = lintConstitutionContent(CANONICAL_CONSTITUTION);
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
});

// ---------------------------------------------------------------------------
// Test 3: empty content fails CONSTITUTION_EXISTS and CONSTITUTION_COUNT
// (severity: error)
// ---------------------------------------------------------------------------

test("T01-R-CLINT-3: empty content produces CONSTITUTION_EXISTS + CONSTITUTION_COUNT errors", () => {
  const violations = lintConstitutionContent("");
  const errors = violations.filter((v) => v.severity === "error");
  const errorChecks = errors.map((v) => v.checkId).sort();
  assert.ok(
    errorChecks.includes("CONSTITUTION_EXISTS"),
    `expected CONSTITUTION_EXISTS error, got ${errorChecks.join(", ")}`,
  );
  assert.ok(
    errorChecks.includes("CONSTITUTION_COUNT"),
    `expected CONSTITUTION_COUNT error, got ${errorChecks.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Test 4: constitution with only MAY principles produces warning
// ---------------------------------------------------------------------------

const MAY_ONLY_CONSTITUTION = `### CON-001: Optional optimization
- **Level**: MAY
- **Description**:
  Code MAY use the new optimization when convenient.
`;

test("T01-R-CLINT-4: MAY-only constitution produces CONSTITUTION_COUNT warning (not error)", () => {
  const violations = lintConstitutionContent(MAY_ONLY_CONSTITUTION);
  const countViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_COUNT",
  );
  assert.equal(countViolations.length, 1);
  assert.equal(countViolations[0].severity, "warning");
  // No errors expected (CONSTITUTION_EXISTS passes — file exists with content)
  const errors = violations.filter((v) => v.severity === "error");
  assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

// ---------------------------------------------------------------------------
// Test 5: duplicate CON-NNN IDs fail CONSTITUTION_NO_DUPLICATE_IDS
// ---------------------------------------------------------------------------

const DUPLICATE_IDS_CONSTITUTION = `### CON-001: First
- **Level**: MUST
- **CWE**: CWE-79
- **Description**:
  First principle.

### CON-001: Duplicate ID
- **Level**: SHOULD
- **CWE**: N/A
- **Description**:
  Duplicate ID.
`;

test("T01-R-CLINT-5: duplicate CON-001 IDs produce CONSTITUTION_NO_DUPLICATE_IDS error", () => {
  const violations = lintConstitutionContent(DUPLICATE_IDS_CONSTITUTION);
  const dupViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_NO_DUPLICATE_IDS",
  );
  assert.equal(dupViolations.length, 1);
  assert.equal(dupViolations[0].severity, "error");
  assert.match(dupViolations[0].message, /CON-001/);
});

// ---------------------------------------------------------------------------
// Test 6: MUST principle without CWE produces CONSTITUTION_CWE_MAPPING warning
// ---------------------------------------------------------------------------

const MUST_WITHOUT_CWE = `### CON-001: No CWE
- **Level**: MUST
- **Description**:
  This MUST has no CWE.
`;

test("T01-R-CLINT-6: MUST principle without CWE produces CONSTITUTION_CWE_MAPPING warning", () => {
  const violations = lintConstitutionContent(MUST_WITHOUT_CWE);
  const cweViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_CWE_MAPPING",
  );
  assert.equal(cweViolations.length, 1);
  assert.equal(cweViolations[0].severity, "warning");
});

// ---------------------------------------------------------------------------
// Test 7 (TRIANGULATE — forces general RFC 2119 keyword matching)
// Mix RFC 2119 keywords at various positions; non-allowed keywords fail.
// ---------------------------------------------------------------------------

const BAD_KEYWORDS_CONSTITUTION = `### CON-001: Uses forbidden keyword
- **Level**: RECOMMENDED
- **CWE**: N/A
- **Description**:
  RECOMMENDED is not an RFC 2119 keyword.
`;

test("T01-R-CLINT-7: non-RFC-2119 keyword in Level field fails CONSTITUTION_RFC2119", () => {
  const violations = lintConstitutionContent(BAD_KEYWORDS_CONSTITUTION);
  const rfcViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_RFC2119",
  );
  assert.ok(
    rfcViolations.length >= 1,
    `expected at least one CONSTITUTION_RFC2119 violation, got ${rfcViolations.length}`,
  );
});

// ---------------------------------------------------------------------------
// Test 8 (TRIANGULATE — multi-principle mixed-level listing)
// ---------------------------------------------------------------------------

const MIXED_LEVELS_CONSTITUTION = `### CON-001: MUST
- **Level**: MUST
- **CWE**: CWE-79
- **Description**:
  Must do X.

### CON-002: SHOULD
- **Level**: SHOULD
- **CWE**: CWE-200
- **Description**:
  Should do Y.

### CON-003: MAY
- **Level**: MAY
- **Description**:
  May do Z.
`;

test("T01-R-CLINT-8: mixed MUST/SHOULD/MAY listing passes all 5 checks", () => {
  const violations = lintConstitutionContent(MIXED_LEVELS_CONSTITUTION);
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
});

// ---------------------------------------------------------------------------
// Test 9 (TRIANGULATE — compound RFC 2119 keywords)
// ---------------------------------------------------------------------------

const MUST_NOT_CONSTITUTION = `### CON-001: Block unsafe operations
- **Level**: MUST NOT
- **CWE**: CWE-78
- **Description**:
  Code MUST NOT execute user-controlled commands.
`;

test("T01-R-CLINT-9: compound keyword MUST NOT is recognized as valid RFC 2119", () => {
  const violations = lintConstitutionContent(MUST_NOT_CONSTITUTION);
  const rfcViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_RFC2119",
  );
  assert.equal(
    rfcViolations.length,
    0,
    `expected 0 RFC2119 violations for 'MUST NOT', got ${JSON.stringify(rfcViolations)}`,
  );
  // MUST NOT also counts as binding (has MUST prefix)
  const countViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_COUNT",
  );
  assert.equal(countViolations.length, 0);
});

// ---------------------------------------------------------------------------
// Test 10 (TRIANGULATE — case sensitivity)
// RFC 2119 keywords are uppercase; lowercase should fail.
// ---------------------------------------------------------------------------

const LOWERCASE_LEVEL_CONSTITUTION = `### CON-001: lowercase level
- **Level**: must
- **CWE**: CWE-79
- **Description**:
  Lowercase 'must' is not a valid RFC 2119 keyword.
`;

test("T01-R-CLINT-10: lowercase 'must' fails CONSTITUTION_RFC2119 (case-sensitive)", () => {
  const violations = lintConstitutionContent(LOWERCASE_LEVEL_CONSTITUTION);
  const rfcViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_RFC2119",
  );
  assert.ok(
    rfcViolations.length >= 1,
    `expected RFC2119 violation for lowercase 'must', got 0`,
  );
});

// ---------------------------------------------------------------------------
// Test 11 (TRIANGULATE — N/A CWE on MUST is conservative, no warning)
// Design.md §6.2: N/A counts as "field exists". Conservative: no warn.
// ---------------------------------------------------------------------------

const MUST_WITH_NA_CWE = `### CON-001: MUST with N/A CWE
- **Level**: MUST
- **CWE**: N/A
- **Description**:
  CWE field exists but is N/A.
`;

test("T01-R-CLINT-11: MUST with CWE: N/A does NOT warn (conservative)", () => {
  const violations = lintConstitutionContent(MUST_WITH_NA_CWE);
  const cweViolations = violations.filter(
    (v) => v.checkId === "CONSTITUTION_CWE_MAPPING",
  );
  assert.equal(
    cweViolations.length,
    0,
    `expected 0 CWE violations for 'CWE: N/A', got ${JSON.stringify(cweViolations)}`,
  );
});

// ---------------------------------------------------------------------------
// Test 12 (TRIANGULATE — multiple violations on one principle aggregate)
// A principle with both bad RFC2119 level AND no CWE produces 2 violations.
// ---------------------------------------------------------------------------

const DOUBLE_OFFENSE_CONSTITUTION = `### CON-001: Two problems
- **Level**: RECOMMENDED
- **Description**:
  Bad level AND no CWE field.
`;

test("T01-R-CLINT-12: principle with bad level + missing CWE produces 2 violations", () => {
  const violations = lintConstitutionContent(DOUBLE_OFFENSE_CONSTITUTION);
  const ids = violations.map((v) => v.checkId).sort();
  assert.ok(ids.includes("CONSTITUTION_RFC2119"));
  assert.ok(ids.includes("CONSTITUTION_CWE_MAPPING"));
  assert.equal(violations.length, 2, `expected 2 violations, got ${JSON.stringify(violations)}`);
});

// ---------------------------------------------------------------------------
// Test 13 (TRIANGULATE — violation carries location = principle ID)
// ---------------------------------------------------------------------------

test("T01-R-CLINT-13: violation carries location field pointing to principle ID", () => {
  const violations = lintConstitutionContent(MUST_WITHOUT_CWE);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].location, "CON-001");
});

// ---------------------------------------------------------------------------
// Test 14 (TRIANGULATE — whitespace-only content treated as empty)
// ---------------------------------------------------------------------------

test("T01-R-CLINT-14: whitespace-only content treated as empty (CONSTITUTION_EXISTS error)", () => {
  const violations = lintConstitutionContent("   \n\t\n  ");
  const errors = violations.filter((v) => v.severity === "error");
  assert.ok(
    errors.some((v) => v.checkId === "CONSTITUTION_EXISTS"),
    `expected CONSTITUTION_EXISTS error, got ${errors.map((v) => v.checkId).join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Test 15 (TRIANGULATE — leading front matter doesn't break parser)
// ---------------------------------------------------------------------------

const WITH_FRONT_MATTER = `<!-- some-comment -->

# Constitution — example-change

> Front matter description.

## Principles

### CON-001: First principle
- **Level**: MUST
- **CWE**: CWE-79
- **Description**:
  Test front matter handling.
`;

test("T01-R-CLINT-15: front matter (HTML comment + heading) does not break parser", () => {
  const violations = lintConstitutionContent(WITH_FRONT_MATTER);
  assert.deepEqual(
    violations,
    [],
    `expected 0 violations with front matter, got ${JSON.stringify(violations)}`,
  );
});

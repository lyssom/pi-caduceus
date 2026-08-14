// ---------------------------------------------------------------------------
// caduceus — constitution lint tests
//
// TDD micro-cycle (T01 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/constitution-lint.ts missing)
//   GREEN        → lib/constitution-lint.ts implements the 5 checks
//   TRIANGULATE  → additional cases below force more general regex
//                  parsing (mixed-level listings, multi-line descriptions,
//                  N/A CWE handling)
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

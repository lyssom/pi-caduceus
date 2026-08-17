<!-- caduceus:constitution-template-version 0.6.0 -->

# Constitution — caduceus-v0.6.0-lens-collection

> Non-negotiable constraints for this change. Each principle carries
> an RFC 2119 level. MUST-level principles SHOULD map to a CWE ID
> (use `CWE: N/A` if no CWE applies). MAY-level principles may omit
> the CWE field.

## Principles

### CON-001: Pure-TS static analysis only

- **Level**: MUST
- **CWE**: CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
- **Description**:
  Each lens `run` function MUST perform only pure-TypeScript static
  analysis over the 5 MD artifacts of the change directory.
  MUST NOT open network sockets, MUST NOT spawn child processes, MUST
  NOT call any LLM API, MUST NOT invoke `fetch`/`http`/`https`/`net`/
  `child_process`, and MUST NOT use dynamic `import()` to load
  untrusted modules.
  Lens findings MUST be deterministic and byte-stable given the same
  inputs.

### CON-002: No external pi-package imports

- **Level**: MUST
- **CWE**: CWE-1357 (Reliance on Insufficiently Trustworthy Component)
- **Description**:
  caduceus MUST NOT import from `pi-review`, `pi-agents`, `dracond`
  (`pi-goal-list-loop-audit`), or `pi-muselinn-harness` in source code
  (`lib/`, `extensions/`, `scripts/`).
  Mechanical enforcement: `scripts/verify-package.mjs` checks 15/16/17.
  Patterns may be cited in `docs/` and `openspec/` design documents
  only.

### CON-003: AGPL-3.0 license isolation for dracond references

- **Level**: MUST
- **CWE**: CWE-1357 (Reliance on Insufficiently Trustworthy Component)
- **Description**:
  `pi-goal-list-loop-audit` (dracond) is AGPL-3.0-only. caduceus is MIT.
  caduceus MUST NOT statically or dynamically link any dracond code.
  Reference must be at the design-pattern level only, never code-level.
  Any future integration of detached-auditor semantics MUST be
  implemented in pure TypeScript from scratch and shipped under MIT,
  never by porting dracond source.

### CON-004: Backward compatibility with v0.5.0 receipts and tests

- **Level**: MUST
- **CWE**: N/A
- **Description**:
  All 309 v0.5.0 tests MUST pass unchanged after v0.6.0 is applied.
  v0.5.0 receipts (with `lensRuns: []`) MUST still validate via
  `validateReceipt`. The package MUST install cleanly on a fresh
  checkout with no migration steps. The `createLensRegistry()` empty-
  state behavior MUST be preserved for test isolation even after
  `lib/lens/index.ts` ships a default-populated registry.

### CON-005: Strict TDD evidence per task

- **Level**: MUST
- **CWE**: N/A
- **Description**:
  Every implementation task in `tasks.md` MUST follow
  RED → GREEN → TRIANGULATE → REFACTOR.
  Each task MUST show a test commit (or test file write) BEFORE the
  corresponding implementation commit (or source file write).
  CI MUST be able to verify RED by checking out the task commit and
  observing the failing test.

### CON-006: Lens findings cap and truncation flag

- **Level**: SHOULD
- **CWE**: N/A
- **Description**:
  When a lens produces more than 20 findings, the findings array MUST
  be capped at the first 20 in stable order, and a `truncated: true`
  flag MUST be set on the `LensFindings` summary object.
  This prevents oversized receipts on pathological changes.

### CON-007: Receipt content hash scope unchanged

- **Level**: MUST
- **CWE**: N/A
- **Description**:
  The receipt `contentHash` MUST continue to cover only the 5 MD
  artifacts (proposal/design/tasks/requirements/constitution).
  The `lensRuns` field MUST NOT contribute to the content hash.
  This keeps receipt validation byte-stable across lens executions.

### CON-008: Template version bump gates new detection rules

- **Level**: MUST
- **CWE**: CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **Description**:
  When a lens depends on a new template convention (e.g., "Done when:"
  contract on tasks.md), the lens MUST scope its detection to changes
  whose corresponding artifact carries the new template version marker
  (`<!-- caduceus:<id>-template-version 0.6.0 -->`).
  v0.5.0-archived changes MUST be exempt from the new rule.

### CON-009: Detached auditor worker deferred to v0.8.0+

- **Level**: MAY
- **CWE**: N/A
- **Description**:
  A detached, extension-less auditor worker process pattern (à la
  `pi-goal-list-loop-audit` v0.34.22+) MAY be evaluated for v0.8.0+ as
  a separate `caduceus-auditor` companion package.
  Triggering condition for evaluation: false-negative rate of the
  v0.6.0 static lens framework exceeds 20% when benchmarked against
  the v0.6.0 archive.
  v0.6.0 MUST NOT implement the detached worker pattern.
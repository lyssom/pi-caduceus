<!-- caduceus:requirements-template-version 0.5.0 -->

# Requirements — caduceus-v0.5.0-lifecycle-foundation

> RFC 2119 enforcement levels (MUST / SHOULD / MAY).
> Each requirement has a unique ID for traceability.
> Enforcement level is on the requirement line itself, not in section headers.

- **REQ-001 [MUST]**: All 14 existing slash commands continue to work after the v0.5.0 module split (backward compat).
- **REQ-002 [MUST]**: New SDD commands (sdd:init, sdd:explore, sdd:propose, sdd:apply, sdd:archive) are registered and delegate to lib/sdd-flow.ts.
- **REQ-003 [MUST]**: New review commands (review:inspect, review:start, review:advance, review:finalize, review:validate, review:reset) are registered and delegate to lib/review-state-machine.ts.
- **REQ-004 [MUST]**: scripts/verify-package.mjs has 17/17 checks passing including 3 new forbid-external-pi-packages checks.
- **REQ-005 [SHOULD]**: All 309 tests pass with 0 regressions against v0.4.0.
- **REQ-101 [SHOULD]**: Phase A lenses are stubs but the 5 lens slots exist and the persona-router correctly allocates required lens runs.
- **REQ-201 [MAY]**: /caduceus:status command displays the 21 slash commands grouped (Core / SDD / Review) — accepted as deferred.
<!-- caduceus:constitution-template-version 0.5.0 -->

# Constitution — caduceus-v0.5.0-lifecycle-foundation

> Non-negotiable constraints for this change. Each principle carries
> an RFC 2119 level. MUST-level principles SHOULD map to a CWE ID
> (use `CWE: N/A` if no CWE applies). MAY-level principles may omit
> the CWE field.

## Principles

### CON-001: Zero runtime dependencies
- **Level**: MUST
- **CWE**: N/A
- **Description**:
  caduceus v0.5.0 MUST maintain 0 runtime dependencies (only the
  optional peer `@earendil-works/pi-coding-agent`). External pi
  packages (pi-review, pi-agents, dracond, pi-muselinn-harness)
  are mechanically excluded by scripts/verify-package.mjs.

### CON-002: Content-bound receipt integrity
- **Level**: MUST
- **CWE**: CWE-345
- **Description**:
  Review receipts MUST be content-bound via SHA-256 over the 5
  artifact files. No cryptographic signing (owner is sole user;
  no supply-chain threat model). Receipts MUST be invalidated
  when any of the 5 files changes post-finalization.

### CON-003: Brand independence preserved
- **Level**: MUST
- **CWE**: N/A
- **Description**:
  caduceus v0.5.0 MUST NOT contain any "el Gentleman" /
  "Rioplatense" / "voseo"-specific content. Mechanical check via
  scripts/verify-package.mjs grep.

### CON-004: Strict TDD posture maintained
- **Level**: SHOULD
- **CWE**: N/A
- **Description**:
  Every implementation task SHOULD follow RED → GREEN → TRIANGULATE
  → REFACTOR. Each commit SHOULD preserve TDD evidence via test
  output snapshots.

### CON-005: Persona-aware lens routing (Phase A)
- **Level**: MAY
- **CWE**: N/A
- **Description**:
  Phase A lenses MAY remain unimplemented (the registry is empty).
  Phase B (v0.6.0) MAY populate concrete lens `run` functions.
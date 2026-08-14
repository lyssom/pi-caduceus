# caduceus v0.5.0 — Design

> **Status:** Design draft. Awaiting `tasks` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.5.0-lifecycle-foundation`
> **Source contracts:** [`proposal.md`](./proposal.md),
> [`openspec/AGENTS.md`](../../AGENTS.md),
> [`STATUS.md`](../../../STATUS.md) (to be amended per `proposal.md §9`)

## 1. Purpose

Translate the v0.5.0 proposal into a concrete technical design
covering the six additions in `proposal.md §3.1`. This document
is implementation-ready: every type, function signature, file
path, and state transition is fully specified.

## 2. Module map (delta from v0.4.0)

```text
caduceus/
├── extensions/caduceus.ts             # MODIFIED — register 10 new slash commands
├── lib/
│   ├── ...                            # 13 existing modules (unchanged exports)
│   ├── sdd-templates.ts               # NEW — proposal/design/tasks/requirements/constitution template generators
│   ├── sdd-flow.ts                    # NEW — sdd-init / sdd-explore / sdd-propose / sdd-apply / sdd-archive
│   ├── review-state-machine.ts        # NEW — inspect / start / advance / finalize / validate
│   ├── review-receipt.ts              # NEW — content-bound JSON receipt (SHA-256, no signature)
│   ├── review-lens-framework.ts       # NEW — Lens interface, LensRegistry, 5 named slots
│   ├── persona-lens-router.ts         # NEW — persona → required-lens-subset routing
│   ├── constitution-lint.ts           # NEW — 5 constitution lint checks
│   ├── lint.ts                        # MODIFIED — register 5 new lint checks
│   ├── slash-commands.ts              # MODIFIED — add 10 new command handlers + grouping
│   └── errors.ts                      # MODIFIED — add CaduceusSDDError, CaduceusReviewError, CaduceusConstitutionError
├── tests/
│   ├── ...                            # 13 existing test files (preserved)
│   ├── sdd-templates.test.ts          # NEW — ~4 tests
│   ├── sdd-flow.test.ts               # NEW — ~6 tests
│   ├── review-state-machine.test.ts   # NEW — ~8 tests
│   ├── review-receipt.test.ts         # NEW — ~4 tests
│   ├── review-lens-framework.test.ts  # NEW — ~4 tests
│   ├── persona-lens-router.test.ts    # NEW — ~3 tests
│   └── constitution-lint.test.ts      # NEW — ~4 tests
├── scripts/
│   └── verify-package.mjs             # MODIFIED — add Checks 15 / 16 / 17
├── openspec/changes/<name>/           # NEW ARTIFACT DIRECTORY (per project, not in repo)
│   ├── proposal.md                    # (existing convention, reused)
│   ├── design.md                      # (existing convention, reused)
│   ├── tasks.md                       # (existing convention, reused)
│   ├── requirements.md                # NEW ARTIFACT (per change)
│   ├── constitution.md                # NEW ARTIFACT (per change)
│   └── .review/                       # NEW REVIEW STATE DIRECTORY (per change)
│       ├── state.json                 # NEW — current state machine snapshot
│       └── receipt.json               # NEW — finalized receipt (when finalized)
├── README.md                          # MODIFIED — new "Lifecycle Foundation" section
├── CHANGELOG.md                       # MODIFIED — v0.5.0 entry
├── STATUS.md                          # MODIFIED — 5 amendments per proposal §9
└── openspec/AGENTS.md                 # MODIFIED — non-negotiable invariants updated
```

**New files (lib):** 8
**Modified files (lib):** 4 (`lint.ts`, `slash-commands.ts`, `errors.ts`, plus minor touch-ups)
**New test files:** 7
**Modified test files:** 2 (`lint.test.ts`, `slash-commands.test.ts`, `extension-entry.test.ts`)
**New artifact types per change:** 2 (`requirements.md`, `constitution.md`)
**New runtime directories per change:** 1 (`.review/`)
**New verification checks:** 3
**Modified docs:** 4 (`README.md`, `CHANGELOG.md`, `STATUS.md`, `AGENTS.md`)

## 3. New types

### 3.1 `lib/sdd-templates.ts`

```ts
export type SddTemplateId =
  | "proposal"
  | "design"
  | "tasks"
  | "requirements"
  | "constitution";

export type SddTemplateContext = {
  changeName: string;
  date: string;             // YYYY-MM-DD
  userName: string;
  projectName: string;
  // Phase B/C/D will extend this with reviewer assignment, persona, etc.
};

export function renderTemplate(
  id: SddTemplateId,
  ctx: SddTemplateContext,
): string;  // throws CaduceusTemplateError if id unknown

export const TEMPLATE_IDS: ReadonlySet<SddTemplateId>;
```

Templates are **plain string functions**, not file readers.
They produce the canonical content for each artifact type.
The current contents:

- `proposal.md`: reuses the v0.4.0-era template (Intent / Why now /
  Scope / Success criteria / Rollback)
- `design.md`: reuses the v0.4.0-era template (Purpose / Module map
  / Types / ...)
- `tasks.md`: reuses the v0.4.0-era template (numbered task list
  with checkboxes)
- `requirements.md`: new. RFC 2119 / EARS-style requirements
  (see `§6.1` for shape)
- `constitution.md`: new. MUST / SHOULD / MAY principles with
  CWE / MITRE mapping (see `§6.2` for shape)

### 3.2 `lib/sdd-flow.ts`

```ts
export type ChangeId = string;  // kebab-case, validated against /^[a-z0-9][a-z0-9-]*$/

export type SddInitOptions = {
  changeName: string;
  cwd: string;
};

export type SddProposeOptions = {
  changeName: string;
  requirementsMarkdown: string;  // from sdd-explore
  cwd: string;
};

export type SddApplyOptions = {
  changeName: string;
  completedTasks: ReadonlyArray<number>;
  cwd: string;
};

export type SddArchiveOptions = {
  changeName: string;
  cwd: string;
};

export function sddInit(opts: SddInitOptions): Promise<void>;
//   throws CaduceusSDDError("change-exists") if dir already exists
//   throws CaduceusSDDError("invalid-name") if changeName fails regex

export function sddExplore(opts: {
  changeName: string;
  topic: string;
  cwd: string;
}): Promise<string>;  // returns requirements.md markdown
//   Phase A: returns the template skeleton + a single MUST placeholder
//            requirement; the human / LLM fills in the rest interactively
//   Phase B: will invoke the lens framework for assistance

export function sddPropose(opts: SddProposeOptions): Promise<void>;
//   throws CaduceusSDDError("requirements-missing") if requirements.md absent
//   reads requirements.md, generates proposal.md (Phase A: template-only)

export function sddApply(opts: SddApplyOptions): Promise<void>;
//   reads tasks.md, updates checkboxes for completedTasks indices
//   does NOT execute code; that's delegated to the pi tool loop

export function sddArchive(opts: SddArchiveOptions): Promise<void>;
//   moves openspec/changes/<name>/ → openspec/changes/archive/<date>-<name>/
//   appends a row to STATUS.md §8 Decision Records
//   throws CaduceusSDDError("not-finalized") if .review/receipt.json absent
//     and finalVerificationPassed !== true
```

### 3.3 `lib/review-state-machine.ts`

```ts
export type ReviewState =
  | "idle"
  | "started"
  | "in-review"
  | "finalized"
  | "validated"
  | "abandoned";

export type ReviewTransition =
  | "start"
  | "advance"
  | "finalize"
  | "validate"
  | "abandon";

export type ReviewSnapshot = {
  schemaVersion: 1;
  changeId: ChangeId;
  state: ReviewState;
  lensRuns: ReadonlyArray<LensRunSummary>;  // see §3.5
  personaSnapshot: PersonaSnapshot;
  lastTransitionAt: string;  // ISO timestamp
  transitionHistory: ReadonlyArray<{
    from: ReviewState;
    to: ReviewState;
    at: string;
  }>;
};

export type PersonaSnapshot = {
  activePersona: string;
  mode: "default" | "plain" | "auto";
  locale: string;
};

export function inspectReview(
  changeName: string,
  cwd: string,
): ReviewSnapshot;  // returns initial snapshot if no state file

export function startReview(
  changeName: string,
  cwd: string,
  personaSnapshot: PersonaSnapshot,
): ReviewSnapshot;
//   throws CaduceusReviewError("already-started") if state is not idle
//   allocates lens runs from persona-lens-router (see §3.7)
//   writes state.json, returns new snapshot

export function advanceReview(
  changeName: string,
  cwd: string,
  transition: ReviewTransition,
): ReviewSnapshot;
//   throws CaduceusReviewError("invalid-transition") if transition not
//     allowed from current state
//   updates state.json, appends to transitionHistory

export function finalizeReview(
  changeName: string,
  cwd: string,
  finalVerificationPassed: boolean,
): ReviewSnapshot & { receiptPath: string };
//   throws CaduceusReviewError("not-in-review") if state is not in-review
//   computes content hash, writes receipt.json, transitions to finalized

export function validateReview(
  changeName: string,
  cwd: string,
): ReviewSnapshot & { receiptValid: boolean };
//   throws CaduceusReviewError("not-finalized") if no receipt exists
//   re-computes content hash, compares to receipt.contentHash
//   idempotent: running twice produces identical output
```

State-transition table (formal):

| From | Transition | To | Preconditions |
|---|---|---|---|
| `idle` | `start` | `started` | (initial) |
| `started` | `advance` | `in-review` | lens runs allocated |
| `in-review` | `advance` | `in-review` | (idempotent; lens progress updated) |
| `in-review` | `finalize` | `finalized` | at least one lens slot recorded |
| `finalized` | `validate` | `validated` | receipt content hash matches |
| `validated` | `validate` | `validated` | (idempotent) |
| `idle` / `started` / `in-review` / `finalized` | `abandon` | `abandoned` | always allowed from non-terminal states |

**Terminal-state semantics:**

- `validated` is a **terminal state**. No transition out of `validated`
  is permitted except `validate → validated` (idempotent re-check).
  To re-review after `validated`, the user must `abandon` (transitions
  to `abandoned`) followed by `start` (transitions to `started`).
  This preserves the audit trail and prevents silent invalidation
  of a receipt that has been verified as matching the current
  artifact content.
- `abandoned` is a **terminal state**. From `abandoned`, only
  `start` transitions to `started` (a new review session).
- The `advance` transition from `validated → in-review` is
  **forbidden** by the state machine. The `validateReceipt` helper
  (see §5.3) refuses to advance if the content hash no longer
  matches the receipt's recorded hash.

### 3.4 `lib/review-receipt.ts`

```ts
export type LensRunSummary = {
  lensId: string;            // one of the 5 named slots (see §3.5)
  status: "queued" | "running" | "skipped" | "completed";
  personaRequired: boolean;  // true if the active persona mandates this lens
  findingsCount: number;     // 0 in Phase A (no lens implementations yet)
  startedAt: string | null;
  completedAt: string | null;
};

export type ReviewReceipt = {
  schemaVersion: 1;
  changeId: ChangeId;
  changeName: string;
  contentHash: string;       // "sha256:<hex>" — over proposal + design + tasks + requirements + constitution
  lensRuns: ReadonlyArray<LensRunSummary>;
  personaSnapshot: PersonaSnapshot;
  finalVerificationPassed: boolean;
  createdAt: string;
  finalizedAt: string | null;
  validatedAt: string | null;
};

export function computeContentHash(
  changeDir: string,
): string;
//   reads proposal.md + design.md + tasks.md + requirements.md + constitution.md
//   concatenates with stable separators (file path + newline + content + newline)
//   returns "sha256:<64-hex-chars>"
//   throws CaduceusReviewError("missing-artifact") if any required file is absent

export function writeReceipt(
  changeDir: string,
  snapshot: ReviewSnapshot,
  finalVerificationPassed: boolean,
): ReviewReceipt;

export function readReceipt(changeDir: string): ReviewReceipt;
//   throws CaduceusReviewError("no-receipt") if receipt.json absent

export function validateReceipt(
  changeDir: string,
): { valid: boolean; reason?: string };
//   re-computes contentHash, compares to receipt.contentHash
//   also verifies personaSnapshot matches the current active persona
//     (mismatch → invalid; persona is part of the receipt contract)
```

The content hash is **content-bound** (Marri 2026 pattern):
changing any of the 5 artifact files invalidates the receipt.
There is **no cryptographic signature**; integrity comes from
the hash being re-computable.

### 3.5 `lib/review-lens-framework.ts`

```ts
export type LensId =
  | "risk"
  | "correctness"
  | "security"
  | "readability"
  | "spec-compliance";

export type Lens = {
  id: LensId;
  displayName: string;
  description: string;
  // Phase A: all lenses are stubs that return empty findings.
  // Phase B will populate `run` with real implementations.
  run?: (changeDir: string) => Promise<LensFindings>;
};

export type LensFindings = {
  lensId: LensId;
  findings: ReadonlyArray<LensFinding>;
  durationMs: number;
};

export type LensFinding = {
  severity: "P0" | "P1" | "P2" | "P3";
  summary: string;
  location: string;       // file path or section
  recommendation: string;
};

export type LensRegistry = {
  register(lens: Lens): void;
  get(lensId: LensId): Lens | undefined;
  list(): ReadonlyArray<Lens>;
  has(lensId: LensId): boolean;
};

export function createLensRegistry(): LensRegistry;

export const LENS_SLOTS: ReadonlyArray<LensId>;
//   = ["risk", "correctness", "security", "readability", "spec-compliance"]

export const LENS_DISPLAY_NAMES: Readonly<Record<LensId, string>>;
//   = { risk: "Risk", correctness: "Correctness", ... }
```

Phase A behavior: every lens's `run` is `undefined`. When the
state machine tries to advance a lens run, it produces a
`LensRunSummary` with `status: "skipped"` and `findingsCount: 0`.
The lens registry exists but is empty. The 5 slot IDs are reserved
constants.

### 3.6 `lib/persona-lens-router.ts`

```ts
export type LensSelectionRule = {
  persona: string;
  required: ReadonlyArray<LensId>;  // must run when this persona is active
};

export const PERSONA_LENS_ROUTING: ReadonlyArray<LensSelectionRule>;
//   Phase A routing table:
//   [
//     { persona: "security", required: ["security", "risk"] },
//     { persona: "reviewer", required: ["readability", "spec-compliance"] },
//     { persona: "architect", required: ["spec-compliance", "risk"] },
//     { persona: "debugger", required: ["correctness"] },
//     // default, plain, concise, teacher, socratic, pirate: required = []
//   ]

export function requiredLensesForPersona(persona: string): ReadonlyArray<LensId>;

export function allocateLensRuns(
  registry: LensRegistry,
  personaSnapshot: PersonaSnapshot,
): ReadonlyArray<LensRunSummary>;
//   returns LensRunSummary[] with one entry per required lens
//   (Phase A: all status="queued" since registry is empty)
```

### 3.7 `lib/constitution-lint.ts`

```ts
export type ConstitutionLintId =
  | "CONSTITUTION_EXISTS"
  | "CONSTITUTION_RFC2119"
  | "CONSTITUTION_CWE_MAPPING"
  | "CONSTITUTION_COUNT"
  | "CONSTITUTION_NO_DUPLICATE_IDS";

export type ConstitutionLintCheck = {
  id: ConstitutionLintId;
  run: (constitutionMarkdown: string) => ReadonlyArray<LintViolation>;
};

export const CONSTITUTION_CHECKS: ReadonlyArray<ConstitutionLintCheck>;

export type LintViolation = {
  checkId: string;
  message: string;
  severity: "error" | "warning";
  location?: string;  // line number, if applicable
};
```

The 5 checks are implemented as pure functions over the
constitution markdown. They integrate into the existing
`lib/lint.ts` lint pipeline.

### 3.8 `lib/errors.ts` additions

```ts
export class CaduceusSDDError extends CaduceusError {
  readonly code:
    | "change-exists"
    | "invalid-name"
    | "requirements-missing"
    | "not-finalized";
  constructor(code: ..., message: string) { ... }
}

export class CaduceusReviewError extends CaduceusError {
  readonly code:
    | "already-started"
    | "invalid-transition"
    | "not-in-review"
    | "not-finalized"
    | "missing-artifact"
    | "no-receipt";
  constructor(code: ..., message: string) { ... }
}

export class CaduceusConstitutionError extends CaduceusError {
  readonly code:
    | "missing"
    | "rfc2119-violation"
    | "cwe-mapping-invalid"
    | "duplicate-id";
  constructor(code: ..., message: string) { ... }
}
```

All three subclasses extend the existing `CaduceusError` and
are exported from `lib/errors.ts` for use across the new modules.

## 4. SDD command system

### 4.1 File paths

```
<cwd>/openspec/changes/<changeName>/{proposal,design,tasks,requirements,constitution}.md
<cwd>/openspec/changes/<changeName>/.review/state.json
<cwd>/openspec/changes/<changeName>/.review/receipt.json
<cwd>/openspec/changes/archive/<date>-<changeName>/
```

The `.review/` directory is dotfile-prefixed so it's hidden
in casual `ls` output. Its two JSON files are JSON-formatted
machine state, never edited by hand.

### 4.2 Slash commands

```
/caduceus:sdd-init <changeName>
/caduceus:sdd-explore <topic>           (uses active change; errors if no init)
/caduceus:sdd-propose <changeName>
/caduceus:sdd-apply                     (uses active change)
/caduceus:sdd-archive                   (uses active change; requires finalized receipt)
```

The "active change" is tracked in `~/.pi/agent/caduceus/state.json`
under `activeChange: string | null`. Setting the active change
is implicit on `sdd-init` and `sdd-propose`; switching is
explicit via a future `/caduceus:sdd-switch <changeName>` (deferred
to v0.6.0 unless needed for Phase A).

### 4.3 Templates

Templates are inlined in `lib/sdd-templates.ts` as string
constants. Each template has a `<!-- caduceus:placeholder X -->` marker
where dynamic content gets substituted (e.g., the change name).

Templates are **deterministic and byte-stable** — two calls
with the same `changeName` produce identical content. This is
critical for the `lib/diff.ts` byte-stability invariant.

### 4.4 Error paths

| Error | When | Recovery |
|---|---|---|
| `change-exists` | `sdd-init` finds `openspec/changes/<name>/` already | Suggest removing or renaming |
| `invalid-name` | `changeName` fails `^[a-z0-9][a-z0-9-]*$` | Show usage hint |
| `requirements-missing` | `sdd-propose` finds no `requirements.md` | Suggest `sdd-explore` first |
| `not-finalized` | `sdd-archive` finds no `receipt.json` or `finalVerificationPassed !== true` | Suggest `sdd-review-finalize` first |
| `not-in-review` | `review-finalize` called when state is not `in-review` | Show current state |

## 5. Review state machine

### 5.1 Storage

```
openspec/changes/<name>/.review/state.json
openspec/changes/<name>/.review/receipt.json   (only after finalize)
```

Both files are written atomically (write to `.tmp`, rename).
They are never edited by hand; if found invalid, the user is
instructed to delete and restart.

### 5.2 Content hashing

The content hash covers exactly 5 files:
- `proposal.md`
- `design.md`
- `tasks.md`
- `requirements.md`
- `constitution.md`

The hash is computed as:

**Normalization rules (applied to each file before hashing):**

```ts
// lib/review-receipt.ts (refined normalization)
function normalize(content: string): string {
  return content
    .replace(/\r\n/g, "\n")        // CRLF → LF (Windows-safe)
    .replace(/[ \t]+$/gm, "")      // strip trailing whitespace per line
    .replace(/\n+$/, "\n");        // ensure exactly one trailing newline
}
```

- **Encoding**: UTF-8 (explicit, declared in the contract)
- **Line endings**: normalized to LF (CRLF folded)
- **Trailing whitespace**: stripped per line
- **Final newline**: exactly one

These normalization rules prevent Windows editors and copy-paste
from spuriously invalidating receipts. The rules are deterministic
and produce identical output on any platform.

**Hash computation:**

```
sha256(
  "--- proposal.md ---\n" + normalize(content(proposal.md)) + "\n" +
  "--- design.md ---\n" + normalize(content(design.md)) + "\n" +
  "--- tasks.md ---\n" + normalize(content(tasks.md)) + "\n" +
  "--- requirements.md ---\n" + normalize(content(requirements.md)) + "\n" +
  "--- constitution.md ---\n" + normalize(content(constitution.md)) + "\n"
)
```

The hash is computed via `node:crypto`'s `createHash('sha256')`.
The output is encoded as `"sha256:<64-hex-chars>"`.

The hash is **content-bound**: any byte change in any of the 5
files (post-normalization) invalidates the receipt.

### 5.3 Persona in the receipt

The receipt's `personaSnapshot` is part of the contract.
`validateReceipt` checks that the current active persona
matches `receipt.personaSnapshot.activePersona`. If the user
switches personas, the receipt is invalidated and must be
re-finalized. This is intentional: persona influences lens
selection (per `lib/persona-lens-router.ts`), so a receipt
under one persona is not a valid receipt under another.

## 6. Data schemas (full)

### 6.1 `requirements.md` shape

```markdown
<!-- caduceus:requirements-template-version 0.5.0 -->

# Requirements — <changeName>

> RFC 2119 enforcement levels (MUST / SHOULD / MAY).
> Each requirement has a unique ID for traceability.
> Enforcement level is on the requirement line itself, not in section headers.

- **REQ-001 [MUST]**: <description>
- **REQ-002 [MUST]**: <description>
- **REQ-101 [SHOULD]**: <description>
- **REQ-201 [MAY]**: <description>
```

The level is placed **inline on each requirement line** rather
than in section headers. This makes the level machine-parseable
per requirement (via a single regex) and supports mixed-level
listing without forcing readers to scan section boundaries.

Lint regex (used by a new `REQUIREMENTS_RFC2119` check on
requirements.md):

```
/^\s*-\s+\*\*REQ-\d+\s+\[(MUST|SHOULD|MAY)\]\*\*:/
```

### 6.2 `constitution.md` shape

```markdown
<!-- caduceus:constitution-template-version 0.5.0 -->

# Constitution — <changeName>

> Non-negotiable constraints for this change. Each principle carries
> an RFC 2119 level. MUST-level principles SHOULD map to a CWE ID
> (use `CWE: N/A` if no CWE applies). MAY-level principles may omit
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
```

**Schema rules:**

- **Principle ID prefix**: `CON-NNN` (constitution; consistent
  across all principles regardless of category)
- **Level**: one of `MUST` / `SHOULD` / `MAY` (RFC 2119)
- **CWE**: a `CWE-NNN` ID, or `N/A` if no CWE applies
  - `MUST`-level principles **SHOULD** have a CWE; lint
    `CONSTITUTION_CWE_MAPPING` warns if missing
  - `SHOULD`/`MAY`-level principles may omit CWE
- **Description**: multi-line allowed, indented 2 spaces
  under the `**Description**:` label
- **Template version marker**: `<!-- caduceus:constitution-template-version 0.5.0 -->`
  at the top of the file (see `§12 R1` for the rationale)

The 5 lint checks (§3.7) validate this format.

### 6.3 Persona-to-lens routing table

| Persona | Required lenses (Phase A) |
|---|---|
| `default` | (none) |
| `plain` | (none) |
| `concise` | (none) |
| `reviewer` | `readability`, `spec-compliance` |
| `teacher` | (none) |
| `security` | `security`, `risk` |
| `debugger` | `correctness` |
| `socratic` | (none) |
| `architect` | `spec-compliance`, `risk` |
| `pirate` | (none) |

## 7. File changes (consolidated)

### 7.1 New files in `lib/`

| Path | LOC est | Exports |
|---|---|---|
| `sdd-templates.ts` | 250 | `renderTemplate`, `TEMPLATE_IDS`, `SddTemplateId`, `SddTemplateContext` |
| `sdd-flow.ts` | 400 | `sddInit`, `sddExplore`, `sddPropose`, `sddApply`, `sddArchive`, options types |
| `review-state-machine.ts` | 350 | `inspectReview`, `startReview`, `advanceReview`, `finalizeReview`, `validateReview`, types |
| `review-receipt.ts` | 250 | `computeContentHash`, `writeReceipt`, `readReceipt`, `validateReceipt`, types |
| `review-lens-framework.ts` | 200 | `createLensRegistry`, `LENS_SLOTS`, `LENS_DISPLAY_NAMES`, types |
| `persona-lens-router.ts` | 150 | `PERSONA_LENS_ROUTING`, `requiredLensesForPersona`, `allocateLensRuns` |
| `constitution-lint.ts` | 250 | `CONSTITUTION_CHECKS`, types |
| **Subtotal** | **~1,850 LOC** | |

### 7.2 Modified files in `lib/`

| Path | Change |
|---|---|
| `lint.ts` | Register 5 new constitution checks via `CONSTITUTION_CHECKS` |
| `slash-commands.ts` | Add 10 new handlers (5 SDD + 5 review); add grouping support |
| `errors.ts` | Add 3 new error subclasses |
| `version.ts` | Bump `CADUCEUS_VERSION` to `0.5.0` |

### 7.3 New files in `tests/`

| Path | Tests est | Covers |
|---|---|---|
| `sdd-templates.test.ts` | 4 | Template rendering for each of 5 templates |
| `sdd-flow.test.ts` | 6 | Init / explore / propose / apply / archive happy paths + 1 error path |
| `review-state-machine.test.ts` | 8 | All 6 transitions + 2 invalid-transition rejections |
| `review-receipt.test.ts` | 4 | Hash determinism + receipt round-trip + validation |
| `review-lens-framework.test.ts` | 4 | Lens registry CRUD + slot constants + Phase A stub behavior |
| `persona-lens-router.test.ts` | 3 | Routing table correctness for 3 sample personas |
| `constitution-lint.test.ts` | 4 | All 5 lint checks pass on canonical template + fail on bad input |
| **Subtotal** | **~33 tests** | |

### 7.4 Modified files in `tests/`

| Path | Change |
|---|---|
| `lint.test.ts` | Add tests for 5 new constitution checks (currently covers 8) |
| `slash-commands.test.ts` | Add tests for 10 new commands (currently covers 14) |
| `extension-entry.test.ts` | Verify new commands don't break existing entry wiring |

### 7.5 Estimated total LOC

- New `lib/`: ~1,850
- Modified `lib/`: ~150 (handlers + lint registration)
- New `tests/`: ~900
- Modified `tests/`: ~200
- **Total delta: ~3,000 LOC** (within v0.4.0's 400-budget frame at ~7.5×, size-exception needed)

The budget frame was 400 LOC per the v0.4.0 size-exception precedent.
v0.5.0 is **MAJOR** and warrants a larger budget; a new size-exception
at ~3,000 LOC is reasonable for the scope.

## 8. Test plan (strict TDD ordering)

The implementation MUST follow strict TDD:
**RED → GREEN → TRIANGULATE → REFACTOR**. The order is enforced
by the test files being written before their corresponding
implementation files.

### 8.1 Phase order

1. `lib/constitution-lint.ts` (5 checks first; everything else
   depends on the format being well-defined)
2. `lib/sdd-templates.ts` (rendering the canonical 5 templates)
3. `lib/review-lens-framework.ts` (lens registry + slot constants;
   no deps)
4. `lib/persona-lens-router.ts` (uses lens framework)
5. `lib/review-receipt.ts` (no state machine dependency; pure I/O;
   tests use hand-crafted fixtures)
6. `lib/sdd-flow.ts` (uses templates; writes the files that
   review-receipt later hashes)
7. `lib/review-state-machine.ts` (uses receipt + lens framework)
8. `lib/slash-commands.ts` additions (uses everything above)
9. `extensions/caduceus.ts` wiring (final)
10. `scripts/verify-package.mjs` Checks 15/16/17

### 8.2 Strict TDD evidence requirements

For each new module:
- RED: write the test file first; commit; show test fails
- GREEN: write the minimum implementation; commit; show test passes
- TRIANGULATE: add a second test that forces a more general
  implementation; commit; show test passes
- REFACTOR: clean up; commit; all tests still green

This evidence is captured in the `tasks.md` per-task
verification section.

## 9. Verification extensions

`scripts/verify-package.mjs` adds 3 new checks (total: 17/17):

### Check 15: no import of external pi packages

```js
// pseudo-code
const FORBIDDEN_IMPORTS = [
  "pi-review",
  "pi-agents",
  "dracond",
  "pi-muselinn-harness",
];
for (const srcFile of allTsFiles()) {
  const content = readFile(srcFile);
  for (const pkg of FORBIDDEN_IMPORTS) {
    if (content.includes(`from "${pkg}"`) ||
        content.includes(`from '${pkg}'`)) {
      fail(`Check 15: ${srcFile} imports forbidden package '${pkg}'`);
    }
  }
}
```

### Check 16: no dependency on external pi packages

```js
const pkg = readPackageJson();
const allDeps = {
  ...pkg.dependencies,
  ...pkg.peerDependencies,
  ...pkg.optionalDependencies,
  ...pkg.devDependencies,
};
const FORBIDDEN = [
  "pi-review", "pi-agents", "dracond", "pi-muselinn-harness",
];
for (const f of FORBIDDEN) {
  if (f in allDeps) {
    fail(`Check 16: package.json depends on forbidden '${f}'`);
  }
}
```

`@earendil-works/pi-coding-agent` (the existing peer) is exempt.

### Check 17: no prompt / content fingerprint overlap

```js
// Reads a known fingerprint for each external package's prompt
// directory (if any) and checks for byte-overlap. Phase A is
// a stub: it only checks the `prompts/` directory for any
// file containing "pi-review" or "dracond" in its content.
for (const promptFile of glob("prompts/*.md")) {
  const content = readFile(promptFile);
  for (const f of ["pi-review", "dracond", "pi-agents"]) {
    if (content.includes(f)) {
      fail(`Check 17: ${promptFile} mentions forbidden '${f}'`);
    }
  }
}
```

This is a lightweight fingerprint; full content fingerprinting
would require pulling the upstream packages and diffing. Phase A
ships the lightweight version; Phase B may extend.

## 10. Backward compatibility

| Existing artifact | v0.5.0 behavior |
|---|---|
| Existing 14 slash commands | Unchanged behavior; same handlers |
| Existing 10 personas | Unchanged; `PERSONA_LENS_ROUTING` adds lens requirements but no persona text changes |
| Existing 8 lint checks | Unchanged; new 5 are added alongside |
| `~/.pi/agent/caduceus.json` schema | Backward compat: existing fields unchanged |
| `openspec/changes/<name>/{proposal,design,tasks}.md` only | Continue to work; constitution lint only fires if `constitution.md` exists |
| Existing 5 archived changes (`v0.1.0` through `v0.4.0`) | Not retroactively required to have `requirements.md` / `constitution.md` |
| Existing 186 tests | All must pass unchanged |

The v0.4.0 → v0.5.0 migration is **zero-config**: users who
upgrade see 10 new slash commands and 5 new lint checks; nothing
existing breaks.

## 11. Open design questions

- **Q1**: Should `sdd-init` reject names with uppercase, or
  lowercase-them with a warning? — **My recommendation:** reject
  with usage hint. Matches existing slash-command style.

- **Q2**: Should the review state machine allow a `validated →
  in-review` transition (for re-review after artifact changes)?
  — **My recommendation:** **No.** `validated` is terminal. To
  re-review, run `abandon` (transitions to `abandoned`) followed
  by `start` (transitions to `started`). This preserves the audit
  trail (`abandoned` row in `transitionHistory`) and prevents
  silent invalidation of validated receipts.

- **Q3**: Should the active persona snapshot in the receipt be
  just `activePersona`, or include `mode` and `locale`?
  — **My recommendation:** include all three. Future phases
  (lens implementations) may branch on mode/locale.

- **Q4**: How should `CONSTITUTION_COUNT` handle different
  edge cases? — **My recommendation (revised):** two-layer rule:
  - **0 principles total** → **error** (constitution file exists
    but is empty; degenerate)
  - **only MAY principles** (≥1 MAY, 0 MUST, 0 SHOULD) →
    **warning** (non-binding constitution; still legal in some
    contexts like pure documentation changes)
  - **at least 1 SHOULD or MUST** → **pass**

---

## 12. Known risks and mitigations

Five risks surfaced during self-review. Each is acknowledged
here with its mitigation; the implementation must apply them.

### R1: Template version drift

**Risk**: `lib/sdd-templates.ts` is frozen at v0.5.0. If a future
version (v0.5.1, v0.6.0) changes the template format, existing
`openspec/changes/<name>/` directories keep the old format
because templates are rendered only on `sdd-init`. The drift is
silent and can confuse later `sdd-archive` calls.

**Mitigation**:

- Each template produces a header marker on render:
  - `<!-- caduceus:requirements-template-version 0.5.0 -->`
  - `<!-- caduceus:constitution-template-version 0.5.0 -->`
  - (proposal/design/tasks templates keep their existing format
    for now; markers added in a future v0.6.x)
- New lint check `CONSTITUTION_TEMPLATE_VERSION`: warns if the
  marker is missing or older than the running caduceus version.
- Migration policy (v0.6.x): on `sdd-init`, if the marker is
  older, append a `## Migration from <old-version>` section.

### R2: Lens slot hardcoded constants

**Risk**: Phase A defines `LENS_SLOTS` as a fixed 5-element
constant. Adding a 6th lens slot (e.g., `performance`) in
Phase B requires either changing the constant (breaks `schemaVersion`
of any in-flight receipt) or maintaining parallel constants
(`LENS_SLOTS_V2` — fragmentation).

**Mitigation**:

- Introduce `LENS_REGISTRY_VERSION` (starts at `1`):
  ```ts
  export const LENS_REGISTRY_VERSION = 1;
  export const LENS_SLOTS_V1: ReadonlyArray<LensId> = [
    "risk", "correctness", "security", "readability", "spec-compliance",
  ];
  ```
- Receipts carry `lensRegistryVersion: 1` alongside
  `schemaVersion: 1`. A receipt under version `N` is invalid
  if `LENS_REGISTRY_VERSION !== N`.
- Future versions add `LENS_SLOTS_V2` without breaking V1
  receipts (they remain valid under V1 lens semantics).

### R3: Corrupted state.json recovery

**Risk**: If `openspec/changes/<name>/.review/state.json` is
corrupted (manual edit, disk error, interrupted write), the
state machine throws a JSON parse error and the user is stuck.

**Mitigation**:

- `inspectReview` detects parse failures and returns a special
  snapshot: `{ state: "corrupted", error: "<message>" }`
- The slash command response for a corrupted state suggests:
  1. Inspect the file manually for damage
  2. If unrecoverable, run `/caduceus:review-reset` (new command
     in v0.5.0) which archives the corrupt state to
     `.review/state.json.corrupt-<timestamp>` and starts fresh
- `writeReceipt` / `writeState` always write atomically
  (write to `.tmp`, rename) to prevent half-written files

### R4: slash-commands.ts size

**Risk**: `lib/slash-commands.ts` is currently 18,017 bytes
(13 existing handlers). Adding 10 new handlers (5 SDD + 5 review)
plus the grouping logic pushes it past 25,000 bytes — too large
for a single file.

**Mitigation**: split the module:

- `lib/slash-commands-core.ts` — existing 14 handlers (refactored
  to a common registration function, no behavior change)
- `lib/slash-commands-sdd.ts` — 5 SDD handlers
- `lib/slash-commands-review.ts` — 5 review handlers
- `lib/slash-commands.ts` — re-exports + dispatch table
  (calls each sub-module's `register(pi, deps)`)

Each sub-module is < 10KB; the dispatch table stays small.
Backward compat: existing 14 commands keep the same
`/caduceus:<name>` URLs.

### R5: Constitution vs. project invariants precedence

**Risk**: `openspec/AGENTS.md §3` defines 7 non-negotiable
project invariants (e.g., "0 runtime deps", "byte-stable
persona diff"). A change-level `constitution.md` could
theoretically conflict with these (e.g., a MUST-level
principle requiring a runtime dep).

**Mitigation**:

- Project invariants are **meta-rules**; they always win
  over constitution principles.
- New lint check `CONSTITUTION_NO_PROJECT_CONFLICT`:
  - Scans constitution.md for any principle whose `Description`
    references known-banned patterns (`postinstall`, `native binary`,
    `runtime dependency on`, etc.)
  - Warns (not errors) on potential conflicts; the human reviewer
    decides
- The `sdd-archive` command refuses to proceed if
  `CONSTITUTION_NO_PROJECT_CONFLICT` has unresolved warnings

---

> **End of design.** Awaiting lyssom review. Once accepted,
> proceed to `sdd-tasks` and produce `tasks.md`.

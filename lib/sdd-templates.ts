// ---------------------------------------------------------------------------
// caduceus — SDD templates
//
// Deterministic, byte-stable renderers for the 5 OpenSpec change
// artifacts (introduced in v0.5.0): proposal, design, tasks,
// requirements, constitution.
//
// Each template carries a `<!-- caduceus:<id>-template-version 0.5.0 -->`
// marker at the top, per design.md §12 R1 (template version drift
// mitigation).
//
// Renderers are pure: same input context always produces byte-identical
// output. This is critical for the `lib/diff.ts` byte-stability invariant
// and for the content-hash computation in lib/review-receipt.ts.
//
// See design.md §3.1 for the API contract, §6.1 / §6.2 for the
// requirements.md / constitution.md template shapes.
// ---------------------------------------------------------------------------

import { CaduceusTemplateError } from "./errors.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
};

// ---------------------------------------------------------------------------
// Internal: marker + version
// ---------------------------------------------------------------------------

const TEMPLATE_VERSION = "0.6.0";

function marker(id: SddTemplateId): string {
  return `<!-- caduceus:${id}-template-version ${TEMPLATE_VERSION} -->`;
}

// ---------------------------------------------------------------------------
// Template bodies (pure functions of context)
// ---------------------------------------------------------------------------

function renderProposal(ctx: SddTemplateContext): string {
  return `${marker("proposal")}

# caduceus v0.6.0 — ${ctx.changeName}

> **Status:** Proposal draft. Awaiting \`design\` phase.
> **Date:** ${ctx.date}
> **Change:** \`${ctx.changeName}\`
> **Owner:** ${ctx.userName}

## 1. Intent

State what this change delivers in one paragraph.

## 2. Why now

What pressure (user need, business constraint, technical debt)
makes this change necessary now?

## 3. Scope

### 3.1 In scope

- Item 1
- Item 2
- Item 3

### 3.2 Out of scope

- Item A
- Item B

## 4. Success criteria

1. Observable outcome 1
2. Observable outcome 2
3. All existing tests pass

## 5. Rollback

How to revert this change if needed.

## 6. Next phase

\`sdd-design\` — write design.md covering module map, types,
and behavior.
`;
}

function renderDesign(ctx: SddTemplateContext): string {
  return `${marker("design")}

# caduceus v0.6.0 — Design

> **Status:** Design draft. Awaiting \`tasks\` phase.
> **Date:** ${ctx.date}
> **Change:** \`${ctx.changeName}\`

## 1. Purpose

Translate the proposal into a concrete technical design.

## 2. Module map

\`\`\`text
new-file.ts             # NEW — purpose
existing-file.ts        # MODIFIED — what changes
\`\`\`

## 3. Types

\`\`\`ts
export type Example = {
  field: string;
};
\`\`\`

## 4. Behavior

Describe the implementation in prose. Reference types above.

## 5. File changes

- **New**: \`path/to/new.ts\`
- **Modified**: \`path/to/existing.ts\`

## 6. Test plan

List the test files to add or modify.
`;
}

/**
 * Render the per-task 'Done when:' verification contract line.
 * v0.6.0+: every `## Task N:` block must contain this line; the
 * `correctness` lens (lib/lens/correctness.ts) enforces its presence
 * on changes whose tasks.md carries the v0.6.0 template version
 * marker.
 */
function renderTaskContract(_taskNumber: number): string {
  return `**Done when:** <state observable completion criterion>`;
}

function renderTasks(ctx: SddTemplateContext): string {
  return `${marker("tasks")}

# caduceus v0.6.0 — Tasks

> **Date:** ${ctx.date}
> **Change:** \`${ctx.changeName}\`

## Task 1: First implementation task

- [ ] Step 1.1 — RED test
- [ ] Step 1.2 — GREEN implementation
- [ ] Step 1.3 — TRIANGULATE second test
- [ ] Step 1.4 — REFACTOR
${renderTaskContract(1)}

## Task 2: Second implementation task

- [ ] Step 2.1 — RED test
- [ ] Step 2.2 — GREEN implementation
- [ ] Step 2.3 — TRIANGULATE second test
- [ ] Step 2.4 — REFACTOR
${renderTaskContract(2)}

## Task 3: Documentation update

- [ ] Step 3.1 — Update README
- [ ] Step 3.2 — Update CHANGELOG
${renderTaskContract(3)}
`;
}

function renderRequirements(ctx: SddTemplateContext): string {
  return `${marker("requirements")}

# Requirements — ${ctx.changeName}

> RFC 2119 enforcement levels (MUST / SHOULD / MAY).
> Each requirement has a unique ID for traceability.
> Enforcement level is on the requirement line itself, not in section headers.

- **REQ-001 [MUST]**: <state the first MUST requirement here>
- **REQ-002 [MUST]**: <state the second MUST requirement here>

- **REQ-101 [SHOULD]**: <state a SHOULD requirement>

- **REQ-201 [MAY]**: <state a MAY requirement>
`;
}

function renderConstitution(ctx: SddTemplateContext): string {
  return `${marker("constitution")}

# Constitution — ${ctx.changeName}

> Non-negotiable constraints for this change. Each principle carries
> an RFC 2119 level. MUST-level principles SHOULD map to a CWE ID
> (use \`CWE: N/A\` if no CWE applies). MAY-level principles may omit
> the CWE field.

## Principles

### CON-001: <principle name here>
- **Level**: MUST
- **CWE**: CWE-NNN
- **Description**:
  <multi-line description allowed, indented 2 spaces under the label>
  <continue description on additional indented lines>

### CON-002: <second principle name>
- **Level**: MUST
- **CWE**: CWE-NNN
- **Description**:
  <state the second MUST principle description>

### CON-003: <third principle name>
- **Level**: SHOULD
- **CWE**: N/A
- **Description**:
  <a SHOULD principle; CWE: N/A is acceptable for non-MUST levels>
`;
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const RENDERERS: Readonly<Record<SddTemplateId, (ctx: SddTemplateContext) => string>> = {
  proposal: renderProposal,
  design: renderDesign,
  tasks: renderTasks,
  requirements: renderRequirements,
  constitution: renderConstitution,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The 5 template IDs that caduceus knows how to render. Stable set;
 * adding a new template requires adding a new ID here AND updating
 * the constitution linter if the new template introduces new lint rules.
 */
export const TEMPLATE_IDS: ReadonlySet<SddTemplateId> = new Set(
  Object.keys(RENDERERS) as SddTemplateId[],
);

/**
 * Render a template by ID with the given context. Two calls with
 * identical context produce byte-identical output (no timestamps,
 * no random IDs, no environment-dependent data).
 *
 * Throws `CaduceusTemplateError` if the ID is not recognized.
 */
export function renderTemplate(
  id: SddTemplateId,
  ctx: SddTemplateContext,
): string {
  const renderer = RENDERERS[id];
  if (!renderer) {
    throw new CaduceusTemplateError(id);
  }
  return renderer(ctx);
}

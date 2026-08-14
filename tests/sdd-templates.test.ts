// ---------------------------------------------------------------------------
// caduceus — SDD templates tests
//
// TDD micro-cycle (T02 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/sdd-templates.ts missing)
//   GREEN        → lib/sdd-templates.ts implements 5 template renderers
//   TRIANGULATE  → additional cases (whitespace, edge inputs, multi-byte names)
//
// Each of the 5 templates (proposal / design / tasks / requirements /
// constitution) must:
//   - Carry its `<!-- caduceus:...-template-version 0.5.0 -->` marker
//   - Be deterministic and byte-stable (two calls with same ctx →
//     byte-identical output)
//   - Substitute dynamic fields (changeName, date, userName, projectName)
//
// See design.md §3.1, §6.1, §6.2 for the template contracts.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  renderTemplate,
  TEMPLATE_IDS,
  type SddTemplateContext,
} from "../lib/sdd-templates.ts";
import { CaduceusTemplateError } from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CTX: SddTemplateContext = {
  changeName: "test-change",
  date: "2026-08-14",
  userName: "lyssom",
  projectName: "caduceus",
};

// ---------------------------------------------------------------------------
// Test 1: TEMPLATE_IDS exports exactly 5 template IDs
// ---------------------------------------------------------------------------

test("T02-R-TPL-1: TEMPLATE_IDS has exactly 5 entries", () => {
  assert.equal(TEMPLATE_IDS.size, 5);
  assert.deepEqual(
    Array.from(TEMPLATE_IDS).sort(),
    [
      "constitution",
      "design",
      "proposal",
      "requirements",
      "tasks",
    ],
  );
});

// ---------------------------------------------------------------------------
// Test 2: each template renders non-empty content
// ---------------------------------------------------------------------------

test("T02-R-TPL-2: renderTemplate returns non-empty content for each of 5 IDs", () => {
  for (const id of TEMPLATE_IDS) {
    const out = renderTemplate(id, CTX);
    assert.ok(out.length > 100, `${id} rendered too few bytes: ${out.length}`);
    assert.ok(out.includes(CTX.changeName), `${id} missing changeName`);
  }
});

// ---------------------------------------------------------------------------
// Test 3: byte-stability — two calls with same ctx produce identical output
// ---------------------------------------------------------------------------

test("T02-R-TPL-3: renderTemplate is byte-stable for identical contexts", () => {
  for (const id of TEMPLATE_IDS) {
    const a = renderTemplate(id, CTX);
    const b = renderTemplate(id, CTX);
    assert.equal(a, b, `${id} not byte-stable`);
  }
});

// ---------------------------------------------------------------------------
// Test 4: each template carries its version marker
// ---------------------------------------------------------------------------

test("T02-R-TPL-4: every template carries the caduceus version marker", () => {
  const expectations: Record<string, RegExp> = {
    proposal: /<!-- caduceus:proposal-template-version 0\.5\.0 -->/,
    design: /<!-- caduceus:design-template-version 0\.5\.0 -->/,
    tasks: /<!-- caduceus:tasks-template-version 0\.5\.0 -->/,
    requirements: /<!-- caduceus:requirements-template-version 0\.5\.0 -->/,
    constitution: /<!-- caduceus:constitution-template-version 0\.5\.0 -->/,
  };
  for (const id of TEMPLATE_IDS) {
    const out = renderTemplate(id, CTX);
    assert.match(out, expectations[id], `${id} missing its version marker`);
  }
});

// ---------------------------------------------------------------------------
// Test 5: requirements.md uses INLINE level markers (not section headers)
// ---------------------------------------------------------------------------

test("T02-R-TPL-5: requirements template uses inline [MUST]/[SHOULD]/[MAY] format", () => {
  const out = renderTemplate("requirements", CTX);
  // Inline format: - **REQ-NNN [LEVEL]**: description
  assert.match(out, /\*\*REQ-\d+\s+\[MUST\]\*\*:/);
  assert.match(out, /\*\*REQ-\d+\s+\[SHOULD\]\*\*:/);
  assert.match(out, /\*\*REQ-\d+\s+\[MAY\]\*\*:/);
  // NO section headers for level (design.md §6.1 revised)
  assert.doesNotMatch(out, /^## MUST$/m);
  assert.doesNotMatch(out, /^## SHOULD$/m);
  assert.doesNotMatch(out, /^## MAY$/m);
});

// ---------------------------------------------------------------------------
// Test 6: constitution template uses CON-NNN prefix
// ---------------------------------------------------------------------------

test("T02-R-TPL-6: constitution template uses CON-NNN prefix (no SEC/COR)", () => {
  const out = renderTemplate("constitution", CTX);
  assert.match(out, /^### CON-\d+:/m, "constitution must use CON-NNN prefix");
  assert.doesNotMatch(out, /^### SEC-\d+:/m, "no SEC- prefix allowed");
  assert.doesNotMatch(out, /^### COR-\d+:/m, "no COR- prefix allowed");
});

// ---------------------------------------------------------------------------
// Test 7: constitution template does NOT include MITRE URL field
// ---------------------------------------------------------------------------

test("T02-R-TPL-7: constitution template does not include MITRE URL field", () => {
  const out = renderTemplate("constitution", CTX);
  assert.doesNotMatch(out, /\*\*MITRE\*\*:/, "MITRE field not allowed");
  assert.doesNotMatch(out, /cwe\.mitre\.org/, "MITRE URL not allowed");
});

// ---------------------------------------------------------------------------
// Test 8: constitution template uses multi-line Description format
// ---------------------------------------------------------------------------

test("T02-R-TPL-8: constitution template uses multi-line Description (indented 2 spaces)", () => {
  const out = renderTemplate("constitution", CTX);
  assert.match(out, /\*\*Description\*\*:\n {2}\S+/);
});

// ---------------------------------------------------------------------------
// Test 9: unknown template ID throws CaduceusTemplateError
// ---------------------------------------------------------------------------

test("T02-R-TPL-9: unknown template id throws CaduceusTemplateError", () => {
  // Cast to bypass the template-id type guard intentionally.
  assert.throws(
    () => renderTemplate("nonexistent" as never, CTX),
    CaduceusTemplateError,
  );
});

// ---------------------------------------------------------------------------
// Test 10: each template substitutes changeName correctly
// ---------------------------------------------------------------------------

test("T02-R-TPL-10: renderTemplate substitutes changeName into output", () => {
  const ctx: SddTemplateContext = {
    ...CTX,
    changeName: "unique-marker-xyz",
  };
  for (const id of TEMPLATE_IDS) {
    const out = renderTemplate(id, ctx);
    assert.ok(
      out.includes("unique-marker-xyz"),
      `${id} did not substitute changeName`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 11 (TRIANGULATE): proposal template includes the SDD section headers
// ---------------------------------------------------------------------------

test("T02-R-TPL-11: proposal template has SDD canonical section structure", () => {
  const out = renderTemplate("proposal", CTX);
  // Numbered section headings (matches v0.4.0 proposal convention)
  assert.match(out, /^# caduceus v0\.5\.0 —/m, "missing versioned title");
  assert.match(out, /^## 1\. Intent/m);
  assert.match(out, /^## 2\. Why now/m);
  assert.match(out, /^## 3\. Scope/m);
});

// ---------------------------------------------------------------------------
// Test 12 (TRIANGULATE): tasks template uses checkbox markdown
// ---------------------------------------------------------------------------

test("T02-R-TPL-12: tasks template uses checkbox markdown", () => {
  const out = renderTemplate("tasks", CTX);
  assert.match(out, /^- \[ \]/m, "tasks must have unchecked checkbox items");
});

// ---------------------------------------------------------------------------
// Test 13 (TRIANGULATE): date field substitutes correctly
// ---------------------------------------------------------------------------

test("T02-R-TPL-13: renderTemplate substitutes the date field", () => {
  const ctx: SddTemplateContext = {
    ...CTX,
    date: "2099-12-31",
  };
  const out = renderTemplate("proposal", ctx);
  assert.ok(out.includes("2099-12-31"), "date did not substitute");
});

// ---------------------------------------------------------------------------
// Test 14 (TRIANGULATE): all 5 templates end with a single trailing newline
// ---------------------------------------------------------------------------

test("T02-R-TPL-14: all templates end with a single trailing newline", () => {
  for (const id of TEMPLATE_IDS) {
    const out = renderTemplate(id, CTX);
    assert.ok(
      out.endsWith("\n"),
      `${id} does not end with newline (ends with ${JSON.stringify(out.slice(-5))})`,
    );
    assert.ok(
      !out.endsWith("\n\n"),
      `${id} ends with double newline (byte-stability violation)`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 15 (TRIANGULATE): each template renders distinct content
// ---------------------------------------------------------------------------

test("T02-R-TPL-15: each template renders distinct (non-overlapping) content", () => {
  const outputs = new Map<string, string>();
  for (const id of TEMPLATE_IDS) {
    outputs.set(id, renderTemplate(id, CTX));
  }
  // Pairwise check: each template's output must not be identical to another.
  const ids = Array.from(TEMPLATE_IDS);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = outputs.get(ids[i])!;
      const b = outputs.get(ids[j])!;
      assert.notEqual(a, b, `${ids[i]} and ${ids[j]} produced identical output`);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 16 (TRIANGULATE): TEMPLATE_IDS is iterable
// ---------------------------------------------------------------------------

test("T02-R-TPL-16: TEMPLATE_IDS is iterable (Set semantics)", () => {
  const arr = Array.from(TEMPLATE_IDS);
  assert.equal(arr.length, 5);
  // Set deduplicates
  const set = new Set(arr);
  assert.equal(set.size, 5);
});

// ---------------------------------------------------------------------------
// Test 17 (TRIANGULATE): CaduceusTemplateError carries templateId field
// ---------------------------------------------------------------------------

test("T02-R-TPL-17: CaduceusTemplateError carries the offending templateId", () => {
  try {
    renderTemplate("nonexistent" as never, CTX);
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof CaduceusTemplateError);
    assert.equal((err as CaduceusTemplateError).templateId, "nonexistent");
    assert.equal((err as CaduceusTemplateError).code, "CADUCEUS_TEMPLATE_ERROR");
  }
});

// ---------------------------------------------------------------------------
// Test 18 (TRIANGULATE): tasks template has numbered task IDs
// ---------------------------------------------------------------------------

test("T02-R-TPL-18: tasks template has sequentially numbered task headings", () => {
  const out = renderTemplate("tasks", CTX);
  assert.match(out, /^## Task 1:/m);
  assert.match(out, /^## Task 2:/m);
  assert.match(out, /^## Task 3:/m);
});


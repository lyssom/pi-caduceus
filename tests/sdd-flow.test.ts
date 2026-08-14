// ---------------------------------------------------------------------------
// caduceus — sdd-flow tests
//
// TDD micro-cycle (T06 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/sdd-flow.ts missing)
//   GREEN        → lib/sdd-flow.ts implements the 5 SDD operations
//   TRIANGULATE  → additional cases (idempotency, edge inputs,
//                   STATUS.md append on archive)
//
// Each operation writes/reads openspec/changes/<name>/. The
// `home` parameter controls where the per-user state file
// (`~/.pi/agent/caduceus/state.json`) lives — defaults to OS
// home, override in tests.
//
// See design.md §3.2 and §4.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  sddInit,
  sddExplore,
  sddPropose,
  sddApply,
  sddArchive,
} from "../lib/sdd-flow.ts";
import { CaduceusSDDError } from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Ctx {
  cwd: string;
  home: string;
}

function makeCtx(): Ctx {
  const cwd = mkdtempSync(join(tmpdir(), "caduceus-flow-cwd-"));
  const home = mkdtempSync(join(tmpdir(), "caduceus-flow-home-"));
  mkdirSync(join(cwd, "openspec"), { recursive: true });
  return { cwd, home };
}

function readStateJson(home: string): { activeChange?: string } {
  const p = join(home, ".pi", "agent", "caduceus", "state.json");
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}

// ---------------------------------------------------------------------------
// Test 1: sddInit creates the 5 MD files
// ---------------------------------------------------------------------------

test("T06-R-FLOW-1: sddInit creates 5 MD files in openspec/changes/<name>/", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "test-change", cwd: ctx.cwd, home: ctx.home });
    const dir = join(ctx.cwd, "openspec", "changes", "test-change");
    for (const f of ["proposal.md", "design.md", "tasks.md", "requirements.md", "constitution.md"]) {
      assert.ok(existsSync(join(dir, f)), `${f} not created`);
    }
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: sddInit sets activeChange in state.json
// ---------------------------------------------------------------------------

test("T06-R-FLOW-2: sddInit sets activeChange in ~/.pi/agent/caduceus/state.json", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "my-change", cwd: ctx.cwd, home: ctx.home });
    const state = readStateJson(ctx.home);
    assert.equal(state.activeChange, "my-change");
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: sddInit throws change-exists if dir already exists
// ---------------------------------------------------------------------------

test("T06-R-FLOW-3: sddInit throws change-exists when dir exists", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "dup-change", cwd: ctx.cwd, home: ctx.home });
    assert.throws(
      () => sddInit({ changeName: "dup-change", cwd: ctx.cwd, home: ctx.home }),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusSDDError);
        assert.equal((err as CaduceusSDDError).code, "change-exists");
        return true;
      },
    );
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: sddInit throws invalid-name for bad names
// ---------------------------------------------------------------------------

test("T06-R-FLOW-4: sddInit throws invalid-name for names with uppercase or leading dash", () => {
  const ctx = makeCtx();
  try {
    for (const bad of ["BadName", "-leading-dash", "with space", ""]) {
      assert.throws(
        () => sddInit({ changeName: bad, cwd: ctx.cwd, home: ctx.home }),
        (err: unknown) => {
          assert.ok(err instanceof CaduceusSDDError);
          assert.equal((err as CaduceusSDDError).code, "invalid-name");
          return true;
        },
        `expected throw for name '${bad}'`,
      );
    }
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: sddExplore returns the requirements.md content
// ---------------------------------------------------------------------------

test("T06-R-FLOW-5: sddExplore returns requirements.md skeleton for active change", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "explore-me", cwd: ctx.cwd, home: ctx.home });
    const out = sddExplore({ changeName: "explore-me", topic: "anything", cwd: ctx.cwd, home: ctx.home });
    assert.ok(out.includes("REQ-001"));
    assert.ok(out.includes("RFC 2119"));
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: sddPropose creates proposal.md from template + requirements
// ---------------------------------------------------------------------------

test("T06-R-FLOW-6: sddPropose creates proposal.md for active change", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "propose-me", cwd: ctx.cwd, home: ctx.home });
    sddPropose({ changeName: "propose-me", requirementsMarkdown: "# Reqs\n", cwd: ctx.cwd, home: ctx.home });
    const proposal = readFileSync(
      join(ctx.cwd, "openspec", "changes", "propose-me", "proposal.md"),
      "utf8",
    );
    assert.ok(proposal.includes("propose-me"));
    assert.match(proposal, /^## 1\. Intent/m);
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: sddPropose throws requirements-missing when requirements.md absent
// ---------------------------------------------------------------------------

test("T06-R-FLOW-7: sddPropose throws requirements-missing when requirements.md absent", () => {
  const ctx = makeCtx();
  try {
    // Create a dir without requirements.md
    const dir = join(ctx.cwd, "openspec", "changes", "no-reqs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "# proposal\n");
    writeFileSync(join(dir, "design.md"), "# design\n");
    writeFileSync(join(dir, "tasks.md"), "# tasks\n");
    writeFileSync(join(dir, "constitution.md"), "# constitution\n");
    assert.throws(
      () => sddPropose({
        changeName: "no-reqs",
        requirementsMarkdown: "ignored",
        cwd: ctx.cwd,
        home: ctx.home,
      }),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusSDDError);
        assert.equal((err as CaduceusSDDError).code, "requirements-missing");
        return true;
      },
    );
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: sddApply marks checkboxes for completedTasks
// ---------------------------------------------------------------------------

test("T06-R-FLOW-8: sddApply marks checkboxes for completedTasks", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "apply-me", cwd: ctx.cwd, home: ctx.home });
    sddApply({ changeName: "apply-me", completedTasks: [1], cwd: ctx.cwd, home: ctx.home });
    const tasks = readFileSync(
      join(ctx.cwd, "openspec", "changes", "apply-me", "tasks.md"),
      "utf8",
    );
    // Task 1's checkboxes should be [x]; Task 2's should still be [ ]
    assert.match(tasks, /## Task 1:[\s\S]*?(- \[x\])/);
    // Find content between Task 1 and Task 2; at least one [x]
    const task1Block = tasks.match(/## Task 1:[\s\S]*?(?=## Task 2:)/)?.[0] ?? "";
    assert.ok(task1Block.includes("[x]"), "Task 1 should have checked boxes");
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: sddApply is idempotent
// ---------------------------------------------------------------------------

test("T06-R-FLOW-9: sddApply is idempotent on same input", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "idem", cwd: ctx.cwd, home: ctx.home });
    sddApply({ changeName: "idem", completedTasks: [1, 2], cwd: ctx.cwd, home: ctx.home });
    const before = readFileSync(
      join(ctx.cwd, "openspec", "changes", "idem", "tasks.md"),
      "utf8",
    );
    sddApply({ changeName: "idem", completedTasks: [1, 2], cwd: ctx.cwd, home: ctx.home });
    const after = readFileSync(
      join(ctx.cwd, "openspec", "changes", "idem", "tasks.md"),
      "utf8",
    );
    assert.equal(before, after);
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 10: sddArchive moves dir to archive/
// ---------------------------------------------------------------------------

test("T06-R-FLOW-10: sddArchive moves dir to openspec/changes/archive/", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "archive-me", cwd: ctx.cwd, home: ctx.home });
    // Need a finalized receipt for archive to succeed
    const changeDir = join(ctx.cwd, "openspec", "changes", "archive-me");
    mkdirSync(join(changeDir, ".review"), { recursive: true });
    writeFileSync(
      join(changeDir, ".review", "receipt.json"),
      JSON.stringify({ finalVerificationPassed: true }),
    );
    sddArchive({ changeName: "archive-me", cwd: ctx.cwd, home: ctx.home });
    assert.ok(!existsSync(changeDir), "original dir should be gone");
    const archiveDir = join(ctx.cwd, "openspec", "changes", "archive");
    assert.ok(existsSync(archiveDir), "archive dir should exist");
    const archived = readdirSync(archiveDir).find((f) => f.includes("archive-me"));
    assert.ok(archived, "archived dir should be inside archive/");
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 11: sddArchive throws not-finalized without valid receipt
// ---------------------------------------------------------------------------

test("T06-R-FLOW-11: sddArchive throws not-finalized when receipt missing or invalid", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "no-receipt", cwd: ctx.cwd, home: ctx.home });
    assert.throws(
      () => sddArchive({ changeName: "no-receipt", cwd: ctx.cwd, home: ctx.home }),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusSDDError);
        assert.equal((err as CaduceusSDDError).code, "not-finalized");
        return true;
      },
    );
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 12 (TRIANGULATE): sddApply with empty completedTasks does nothing
// ---------------------------------------------------------------------------

test("T06-R-FLOW-12: sddApply with empty completedTasks leaves tasks.md unchanged", () => {
  const ctx = makeCtx();
  try {
    sddInit({ changeName: "empty-apply", cwd: ctx.cwd, home: ctx.home });
    const before = readFileSync(
      join(ctx.cwd, "openspec", "changes", "empty-apply", "tasks.md"),
      "utf8",
    );
    sddApply({ changeName: "empty-apply", completedTasks: [], cwd: ctx.cwd, home: ctx.home });
    const after = readFileSync(
      join(ctx.cwd, "openspec", "changes", "empty-apply", "tasks.md"),
      "utf8",
    );
    assert.equal(before, after);
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 13 (TRIANGULATE): sddArchive appends row to STATUS.md §8
// ---------------------------------------------------------------------------

test("T06-R-FLOW-13: sddArchive appends a decision-records row to STATUS.md", () => {
  const ctx = makeCtx();
  try {
    // Place a minimal STATUS.md in cwd so we can verify the append
    writeFileSync(
      join(ctx.cwd, "STATUS.md"),
      "# STATUS\n\n## 8. Decision records\n\n| Date | Decision | Rationale |\n| --- | --- | --- |\n| old | old | old |\n",
    );
    sddInit({ changeName: "log-me", cwd: ctx.cwd, home: ctx.home });
    const changeDir = join(ctx.cwd, "openspec", "changes", "log-me");
    mkdirSync(join(changeDir, ".review"), { recursive: true });
    writeFileSync(
      join(changeDir, ".review", "receipt.json"),
      JSON.stringify({ finalVerificationPassed: true }),
    );
    sddArchive({ changeName: "log-me", cwd: ctx.cwd, home: ctx.home });
    const status = readFileSync(join(ctx.cwd, "STATUS.md"), "utf8");
    assert.ok(status.includes("log-me"), "STATUS.md should mention the change name");
    assert.ok(status.split("\n").length > 6, "STATUS.md should have grown");
  } finally {
    rmSync(ctx.cwd, { recursive: true });
    rmSync(ctx.home, { recursive: true });
  }
});

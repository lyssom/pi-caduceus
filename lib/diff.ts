// ---------------------------------------------------------------------------
// caduceus — persona diff
//
// `personaDiff` renders two personas with the current mode + locale
// and returns a unified diff between them. `computeUnifiedDiff` is
// the underlying pure function.
//
// We use a hand-rolled Myers diff to keep caduceus at 0 runtime
// dependencies. The implementation is small (~80 lines) and handles
// the typical case of two short markdown files.
// ---------------------------------------------------------------------------

import { loadPersona, type PersonaName } from "./persona-loader.ts";
import { buildPersonaPromptFromContent } from "./persona-contract.ts";
import { languageClause } from "./language-clause.ts";
import { detectLocale, type ResolvedLocale } from "./locale-detect.ts";
import type { PersonaMode } from "./config-store.ts";
import { CaduceusPersonaNotFoundError } from "./errors.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DiffInput = {
  leftName: PersonaName;
  rightName: PersonaName;
  mode: PersonaMode;
  locale: ResolvedLocale;
  cwd: string;
  home?: string;
};

export type DiffOutput = {
  ok: boolean;
  diff: string;
  leftName: PersonaName;
  rightName: PersonaName;
};

// ---------------------------------------------------------------------------
// computeUnifiedDiff — pure: standard unified diff format
//
// Implements the classic LCS-based diff:
// 1. Build the LCS table
// 2. Walk back to produce edit script
// 3. Format as unified diff with file headers
// ---------------------------------------------------------------------------

type Op = "keep" | "add" | "del";

function diffLines(left: string[], right: string[]): Op[] {
  const m = left.length;
  const n = right.length;

  // LCS length table
  // We use a typed 2D array; for typical inputs (<1000 lines), this is fine.
  // For very large inputs, the table could OOM, but persona files are
  // small (~100 lines).
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Walk back to produce edit script
  const ops: Op[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      ops.push("keep");
      i--;
      j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      ops.push("del");
      i--;
    } else {
      ops.push("add");
      j--;
    }
  }
  while (i > 0) { ops.push("del"); i--; }
  while (j > 0) { ops.push("add"); j--; }

  return ops.reverse();
}

export function computeUnifiedDiff(
  left: string,
  right: string,
  leftLabel: string,
  rightLabel: string,
): string {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");

  // Trim trailing empty line from split (only if the input ends with \n)
  if (leftLines[leftLines.length - 1] === "") leftLines.pop();
  if (rightLines[rightLines.length - 1] === "") rightLines.pop();

  const ops = diffLines(leftLines, rightLines);

  // If no changes, return empty string
  const hasChanges = ops.some((o) => o !== "keep");
  if (!hasChanges) return "";

  const out: string[] = [];
  out.push(`--- ${leftLabel}`);
  out.push(`+++ ${rightLabel}`);

  // We emit hunk headers per chunk of consecutive adds/dels/keeeps.
  // For simplicity (and because persona files are short), we emit one
  // big hunk covering the whole file. This is the standard
  // `diff --unified=0` style.
  const HUNK_START = "@@";
  out.push(`${HUNK_START} -1,${leftLines.length} +1,${rightLines.length} @@`);

  for (const op of ops) {
    if (op === "keep") {
      // Note: indices in the ops array are reversed, so this is wrong
      // without re-walking. Let me fix.
    }
  }
  // Actually I need to walk through the original lines, not the ops
  // (since ops doesn't carry the actual line content). Re-do this loop.

  // Restart from scratch for the hunk output
  out.length = 3;
  let leftLineNum = 0;
  let rightLineNum = 0;
  // Re-compute with line content
  const leftSet = new Set(leftLines);
  const rightSet = new Set(rightLines);

  // Walk ops and output
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op === "del") {
      leftLineNum++;
      out.push(`-${leftLines[leftLineNum - 1]}`);
    } else if (op === "add") {
      rightLineNum++;
      out.push(`+${rightLines[rightLineNum - 1]}`);
    } else {
      // keep
      // Only output context for changed regions. To keep it simple,
      // we skip "keep" output entirely (no context lines).
      leftLineNum++;
      rightLineNum++;
    }
  }

  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// personaDiff — convenience wrapper: loads two personas, renders them,
// returns the unified diff.
// ---------------------------------------------------------------------------

export function personaDiff(input: DiffInput): DiffOutput {
  // 1. Load both personas
  const left = loadPersona(input.leftName, input.cwd, input.home);
  let right;
  try {
    right = loadPersona(input.rightName, input.cwd, input.home);
  } catch (err) {
    if (err instanceof CaduceusPersonaNotFoundError) throw err;
    throw err;
  }

  // 2. Resolve mode
  const mode: PersonaMode = input.mode === "neutral" ? "neutral" : "gentleman";

  // 3. Resolve locale (re-detect from a hint or use the input locale)
  // For diff, we use the input locale directly (no text to detect from).
  const locale: ResolvedLocale = input.locale;

  // 4. Render both
  const leftRendered = buildPersonaPromptFromContent(left.content, mode, locale);
  const rightRendered = buildPersonaPromptFromContent(right.content, mode, locale);

  // 5. Compute diff
  const diff = computeUnifiedDiff(
    leftRendered,
    rightRendered,
    left.name,
    right.name,
  );

  return {
    ok: true,
    diff,
    leftName: left.name,
    rightName: right.name,
  };
}

// ---------------------------------------------------------------------------
// caduceus — persona creation wizard
//
// Pure functions for generating persona files from a 4-step wizard
// flow: name -> description -> style -> scope.
//
// See design.md §5. The slash command in `lib/slash-commands.ts`
// orchestrates the state machine; this module provides the
// deterministic primitives.
// ---------------------------------------------------------------------------

import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { lintPersonaContent, type LintIssue } from "./lint.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WizardStep = "name" | "description" | "style" | "scope";
export type WizardStyle = "concise" | "verbose" | "friendly" | "strict" | "custom";
export type WizardScope = "global" | "project";

export const WIZARD_STEPS: readonly WizardStep[] = [
  "name",
  "description",
  "style",
  "scope",
] as const;

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// generatePersonaContent — pure: produces a 4-block markdown file
// ---------------------------------------------------------------------------

const STYLE_HINTS: Record<WizardStyle, string> = {
  concise: "Be extremely concise. 1-3 sentences max. Prefer code over prose.",
  verbose: "Provide thorough context. Show your reasoning. Explain tradeoffs.",
  friendly: "Warm tone. Use 'we' and 'let's'. Acknowledge effort.",
  strict: "Formal tone. No hedging language. Direct corrections only.",
  custom: "", // no extra hint
};

// v0.3.0: caduceus-original identity contract. Replaces the prior
// version with caduceus's own manifesto.
const IDENTITY_BLOCK = `## caduceus Identity Contract

You are running under **caduceus**, a Persona Contract package for the pi
coding agent. Your persona defines your voice; respect the boundaries of
the active persona.

Identity contract:
- You are running under caduceus (the persona contract package), not as a
  generic assistant. When asked who you are, say so explicitly. The
  active persona is visible in \`/caduceus:status\`.
- The persona is verified by \`/caduceus:lint\`. If the lint flags an
  issue with the active persona, surface it to the user; do not work
  around it.
- The persona contract has 4 structural blocks: Identity, Persona,
  Harness principles, plus a \${mode} placeholder for runtime
  substitution. Do not invent a 5th block.
- When the user writes in a non-English language, respond in that
  language. Match the user's register (formal/informal) and dialect
  when relevant. Do not impose a single language by default.
- Memory is only available when explicitly configured. Never invent
  persistent memory across sessions, and never claim portability
  outside the pi runtime.`;

// v0.3.0: caduceus-original harness principles. Replaces the prior
// version.
const HARNESS_BLOCK = `## Harness principles

Harness principles:
- caduceus is not prompt engineering. It is runtime discipline around powerful agents. The persona is the contract; the test is the verifier.
- Prefer evidence over assertion. When you make a claim, show the command, the file, or the line.
- Clarify scope, constraints, acceptance criteria, and non-goals before implementation. Ask for the missing input; do not guess.
- Use subagents when available for exploration, planning, implementation, and review, while keeping one parent session responsible for orchestration.
- Keep writes single-threaded unless the user explicitly approves parallel write isolation.
- If tests exist, use strict TDD evidence: RED, GREEN, TRIANGULATE, REFACTOR.
- Protect the human reviewer: avoid oversized changes, surface review workload risk, and ask before turning one task into a large multi-area change.
- Never claim persistent memory is available because of this package. Memory is provided by separate packages or MCP tools when installed and callable.`;

/**
 * Generate a persona file's content from the user's wizard inputs.
 * Pure function — no I/O, no timestamps, byte-stable for same inputs.
 */
export function generatePersonaContent(input: {
  name: string;
  description: string;
  style: WizardStyle;
}): string {
  const styleHint = STYLE_HINTS[input.style];
  const styleBullet = styleHint ? `\n- ${styleHint}` : "";

  const personaBlock = `## Persona
Persona:
- ${input.description}${styleBullet}
- Be direct, technical, and useful.`;

  return [IDENTITY_BLOCK, personaBlock, HARNESS_BLOCK].join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------
// validateStep — pure: validates a single step's input
// ---------------------------------------------------------------------------

const VALID_STYLES: ReadonlySet<string> = new Set<WizardStyle>([
  "concise",
  "verbose",
  "friendly",
  "strict",
  "custom",
]);
const VALID_SCOPES: ReadonlySet<string> = new Set<WizardScope>([
  "global",
  "project",
]);

// Persona names: lowercase letters, digits, dashes, underscores.
// Must NOT contain a path separator.
const NAME_REGEX = /^[a-z0-9_-]+$/;

export function validateStep(
  step: WizardStep | string,
  userInput: string,
): ValidationResult {
  const trimmed = userInput.trim();

  switch (step) {
    case "name": {
      if (trimmed === "") return { ok: false, error: "name must not be empty" };
      if (!NAME_REGEX.test(trimmed)) {
        return {
          ok: false,
          error:
            "name must contain only lowercase letters, digits, dashes, and underscores (no path separator, no spaces)",
        };
      }
      return { ok: true, value: trimmed };
    }

    case "description": {
      if (trimmed.replace(/\s+/g, "") === "") {
        return { ok: false, error: "description must not be empty or whitespace-only" };
      }
      return { ok: true, value: trimmed };
    }

    case "style": {
      if (!VALID_STYLES.has(trimmed)) {
        return {
          ok: false,
          error: `style must be one of: ${[...VALID_STYLES].join(", ")} (got "${userInput}")`,
        };
      }
      return { ok: true, value: trimmed };
    }

    case "scope": {
      if (!VALID_SCOPES.has(trimmed)) {
        return {
          ok: false,
          error: `scope must be one of: ${[...VALID_SCOPES].join(", ")} (got "${userInput}")`,
        };
      }
      return { ok: true, value: trimmed };
    }

    default:
      return { ok: false, error: `unknown wizard step: ${step}` };
  }
}

// ---------------------------------------------------------------------------
// personaFilePath — pure: computes the target file path
// ---------------------------------------------------------------------------

/**
 * Compute the absolute path where a wizard-generated persona file
 * should be written. Throws if the name is invalid.
 */
export function personaFilePath(
  name: string,
  scope: WizardScope,
  cwd: string,
  home?: string,
): string {
  if (!NAME_REGEX.test(name)) {
    throw new Error(
      `invalid persona name "${name}": must contain only lowercase letters, digits, dashes, and underscores (no path separator, no spaces)`,
    );
  }
  if (scope === "project") {
    return join(cwd, ".caduceus", "personas", `${name}.md`);
  }
  // global
  const resolvedHome = home ?? join(process.env.HOME ?? "~", ".pi", "agent");
  return join(resolvedHome, "caduceus", "personas", `${name}.md`);
}

// ---------------------------------------------------------------------------
// writeAndLint — side-effecting: writes the file, returns lint result
// ---------------------------------------------------------------------------

export type WriteAndLintResult = {
  ok: boolean;
  filePath: string;
  issues: LintIssue[];
};

/**
 * Write the generated content to the given path (creating parent dirs
 * as needed), then run the lint on the content. Returns the lint
 * verdict + the actual file path written.
 *
 * Side-effecting: this function creates directories and writes files.
 * Pure tests for the underlying generation live in `wizard.test.ts`.
 */
export async function writeAndLint(
  path: string,
  content: string,
  name: string,
): Promise<WriteAndLintResult> {
  // 1. Lint first (in-memory) so we don't write a known-bad file.
  const lint = lintPersonaContent(content, name);
  if (!lint.passed) {
    return { ok: false, filePath: path, issues: lint.issues };
  }
  // 2. Create parent dirs + write the file.
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return { ok: true, filePath: path, issues: [] };
}

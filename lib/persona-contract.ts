// ---------------------------------------------------------------------------
// caduceus — persona contract
//
// Pure function: (mode, locale) -> rendered persona prompt string.
//
// The persona prompt body is loaded from prompts/<mode>.md at module load
// and cached. The ${mode} placeholder in the file is substituted with the
// actual mode at call time.
//
// Per DNA-2 (INIT.md §4), every line in the rendered output is traceable:
//   - ## el Gentleman Identity and Harness (file header)
//   - Current persona mode: <mode>      (substituted at runtime)
//   - You are el Gentleman: ...          (file body)
//   - ## Identity contract              (file body)
//   - ## Persona                        (file body, byte-for-byte from gentle-pi)
//   - ## Harness principles             (file body)
//
// The byte-for-byte match against gentle-pi is enforced by
// tests/persona-contract.test.ts (R-PERSONA-007/008).
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const MODE_PLACEHOLDER = "${mode}";

const GENTLEMAN_PROMPT = readFileSync(
  join(repoRoot, "prompts", "gentleman.md"),
  "utf8",
);
const NEUTRAL_PROMPT = readFileSync(
  join(repoRoot, "prompts", "neutral.md"),
  "utf8",
);

/**
 * Resolve a mode string. `"auto"` maps to `"gentleman"`.
 */
function resolveMode(mode: string): "gentleman" | "neutral" {
  if (mode === "auto") return "gentleman";
  if (mode === "gentleman" || mode === "neutral") return mode;
  // Defensive: unknown modes fall back to gentleman (R-PERSONA-001-3 spirit).
  return "gentleman";
}

/**
 * Build the rendered persona prompt for the given (mode, locale).
 *
 * Locale is accepted for API compatibility with the rest of the caduceus
 * pipeline (locale-detect.ts, language-clause.ts) but the persona prompt
 * file already contains the language clause inline (in the persona block).
 * Future revisions may move the language clause to a separate
 * languageClause(locale, mode) helper (T-3).
 */
export function buildPersonaPrompt(
  mode: string,
  _locale: string,
): string {
  const resolved = resolveMode(mode);
  const template = resolved === "neutral" ? NEUTRAL_PROMPT : GENTLEMAN_PROMPT;
  return template.split(MODE_PLACEHOLDER).join(resolved);
}

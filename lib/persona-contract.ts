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
//   - ## caduceus Identity Contract (file header)
//   - Current persona mode: <mode>      (substituted at runtime)
//   - You are running under **caduceus**...          (file body)
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

const DEFAULT_PROMPT = readFileSync(
  join(repoRoot, "prompts", "default.md"),
  "utf8",
);
const PLAIN_PROMPT = readFileSync(
  join(repoRoot, "prompts", "plain.md"),
  "utf8",
);

/**
 * Resolve a mode string. `"auto"` maps to `"default"`.
 */
function resolveMode(mode: string): "default" | "plain" {
  if (mode === "auto") return "default";
  if (mode === "default" || mode === "plain") return mode;
  // Defensive: unknown modes fall back to default.
  return "default";
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
  const template = resolved === "plain" ? PLAIN_PROMPT : DEFAULT_PROMPT;
  return template.split(MODE_PLACEHOLDER).join(resolved);
}

/**
 * Render a persona from arbitrary markdown content. Pure function: no
 * I/O, no side effects. Substitutes the `${mode}` placeholder with the
 * resolved mode and (optionally) appends a language clause.
 *
 * The mode argument is passed for API symmetry with `buildPersonaPrompt`;
 * the actual mode substitution uses it. The locale is currently unused
 * here (the language clause is appended by the extension entry, not
 * this function) but is part of the signature for forward compat.
 */
export function buildPersonaPromptFromContent(
  content: string,
  mode: string,
  _locale: string,
): string {
  const resolved = resolveMode(mode);
  return content.split(MODE_PLACEHOLDER).join(resolved);
}

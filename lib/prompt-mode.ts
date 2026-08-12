// ---------------------------------------------------------------------------
// caduceus — system prompt composition
//
// Pure function: compose the system prompt for the current
// `event.systemPrompt` and the rendered persona string, according
// to the configured mode.
//
// - "append":  return `${event.systemPrompt}\n\n${persona}`  (v0.1.0 behavior)
// - "replace": return persona only                            (new behavior)
//
// Used by the extension entry's `before_agent_start` handler.
// ---------------------------------------------------------------------------

import type { SystemPromptMode } from "./config-store.ts";

/**
 * Compose the final system prompt string for the current turn.
 *
 * @param base      The system prompt built by pi (tool descriptions, context
 *                  files, skills, etc.). Used when mode is "append".
 * @param persona   The rendered persona prompt segment. Always present in
 *                  the output regardless of mode.
 * @param mode      How to combine `base` and `persona`.
 */
export function composeSystemPrompt(
  base: string,
  persona: string,
  mode: SystemPromptMode,
): string {
  if (mode === "replace") return persona;
  // mode === "append" (default — preserves v0.1.0 behavior)
  return `${base}\n\n${persona}`;
}

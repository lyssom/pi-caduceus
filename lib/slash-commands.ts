// ---------------------------------------------------------------------------
// caduceus — slash commands (dispatcher)
//
// Thin dispatcher that wires together the v0.5.0 slash-command
// sub-modules:
//
//   - lib/slash-commands-core.ts    (14 existing v0.1.0–v0.4.0 commands)
//   - lib/slash-commands-sdd.ts     (5 new v0.5.0 SDD commands — T09)
//   - lib/slash-commands-review.ts  (5 new v0.5.0 review commands — T10)
//
// The combined `registerSlashCommands(pi, deps)` preserves the
// v0.4.0 public API (single entry point used by
// extensions/caduceus.ts and the test suite). Each sub-module
// also exposes its own `register*` function so the extension
// entry can compose them explicitly in T11.
//
// See design.md §12 R4 for the module-split rationale.
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  registerCoreSlashCommands,
  type CommandDeps,
} from "./slash-commands-core.ts";

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export type { CommandDeps };

// Default exports from core (preserved so callers don't need to
// change their import paths).
export {
  defaultRenderInspectOutput,
  type CommandDeps as CoreCommandDeps,
} from "./slash-commands-core.ts";

// ---------------------------------------------------------------------------
// Combined registration
// ---------------------------------------------------------------------------

/**
 * Register all v0.5.0 slash commands on the given pi ExtensionAPI.
 * In Phase A (T08), this only registers the core 14 commands. After
 * T09 and T10 land, it will additionally register the 5 SDD
 * commands and the 5 review commands. The extension entry may also
 * call the per-module `register*` functions directly for finer
 * control (see extensions/caduceus.ts).
 */
export function registerSlashCommands(
  pi: ExtensionAPI,
  deps: CommandDeps,
): void {
  registerCoreSlashCommands(pi, deps);
}

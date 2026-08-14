// ---------------------------------------------------------------------------
// caduceus — slash commands (dispatcher)
//
// Thin dispatcher that wires together the v0.5.0 slash-command
// sub-modules:
//
//   - lib/slash-commands-core.ts    (14 existing v0.1.0–v0.4.0 commands)
//   - lib/slash-commands-sdd.ts     (5 new v0.5.0 SDD commands)
//   - lib/slash-commands-review.ts  (6 new v0.5.0 review commands)
//
// Public API:
//
//   registerSlashCommands(pi, coreDeps)
//     — backward-compat alias for registerCoreSlashCommands.
//       Used by tests/slash-commands.test.ts and other v0.4.x callers.
//
//   registerAllSlashCommands(pi, { core, sdd, review })
//     — registers all 24 v0.5.0 slash commands in one call.
//       Called by extensions/caduceus.ts.
//
// See design.md §12 R4 for the module-split rationale.
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  registerCoreSlashCommands,
  type CommandDeps,
} from "./slash-commands-core.ts";
import {
  registerSddSlashCommands,
  type SddCommandDeps,
} from "./slash-commands-sdd.ts";
import {
  registerReviewSlashCommands,
  type ReviewCommandDeps,
} from "./slash-commands-review.ts";

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export type { CommandDeps, SddCommandDeps, ReviewCommandDeps };

// Default exports from core (preserved so callers don't need to
// change their import paths).
export { defaultRenderInspectOutput } from "./slash-commands-core.ts";

// Per-module register functions, exported for callers that want to
// compose them individually (e.g., test harnesses).
export {
  registerCoreSlashCommands,
} from "./slash-commands-core.ts";
export {
  registerSddSlashCommands,
} from "./slash-commands-sdd.ts";
export {
  registerReviewSlashCommands,
} from "./slash-commands-review.ts";

// ---------------------------------------------------------------------------
// Combined deps interface
// ---------------------------------------------------------------------------

export type AllSlashCommandDeps = {
  core: CommandDeps;
  sdd: SddCommandDeps;
  review: ReviewCommandDeps;
};

// ---------------------------------------------------------------------------
// Registration functions
// ---------------------------------------------------------------------------

/**
 * Register the 14 v0.1.0–v0.4.0 core slash commands only.
 * Backward-compatible alias used by tests/slash-commands.test.ts.
 */
export function registerSlashCommands(
  pi: ExtensionAPI,
  deps: CommandDeps,
): void {
  registerCoreSlashCommands(pi, deps);
}

/**
 * Register all 24 v0.5.0 slash commands (14 core + 5 SDD + 6 review).
 * Order: core first, then SDD, then review — preserves the order
 * the extension entry would otherwise have to manage explicitly.
 */
export function registerAllSlashCommands(
  pi: ExtensionAPI,
  deps: AllSlashCommandDeps,
): void {
  registerCoreSlashCommands(pi, deps.core);
  registerSddSlashCommands(pi, deps.sdd);
  registerReviewSlashCommands(pi, deps.review);
}
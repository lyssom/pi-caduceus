// ---------------------------------------------------------------------------
// caduceus — review slash commands
//
// Registers 6 slash commands on the pi ExtensionAPI (introduced
// in v0.5.0):
//
//   /caduceus:review:inspect          — show current review snapshot
//   /caduceus:review:start <change> <persona?> — start a new review
//   /caduceus:review:advance <change> <transition?> — advance state
//   /caduceus:review:finalize <change> — finalize + write receipt
//   /caduceus:review:validate <change> — re-validate receipt
//   /caduceus:review:reset <change>    — recover from corrupted state
//                                       (per design.md §12 R3)
//
// Each handler delegates to lib/review-state-machine.ts. The slash
// layer only does arg parsing and error → UI mapping.
//
// See design.md §4.2, §12 R3, and tasks.md T10.
// ---------------------------------------------------------------------------

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import {
  type ReviewSnapshot,
  type FinalizeResult,
  type ValidateResult,
} from "./review-state-machine.ts";
import type { PersonaSnapshot } from "./review-types.ts";
import { CaduceusReviewError } from "./errors.ts";

// ---------------------------------------------------------------------------
// Public API: deps interface
// ---------------------------------------------------------------------------

/**
 * Dependencies for the review slash commands. Each entry maps a
 * slash command to its review-state-machine function. The extension
 * entry wires real implementations; tests provide mocks.
 */
export type ReviewCommandDeps = {
  inspectReview: (changeName: string, cwd: string) => ReviewSnapshot;
  startReview: (
    changeName: string,
    cwd: string,
    persona: PersonaSnapshot,
  ) => ReviewSnapshot;
  advanceReview: (
    changeName: string,
    cwd: string,
    transition: "advance" | "abandon",
  ) => ReviewSnapshot;
  finalizeReview: (
    changeName: string,
    cwd: string,
    passed: boolean,
  ) => FinalizeResult;
  validateReview: (changeName: string, cwd: string) => ValidateResult;
  resetReview: (changeName: string, cwd: string) => { ok: boolean };
  inspectIsCorrupted: (changeName: string, cwd: string) => boolean;
  getActivePersonaName: () => string;
};

// ---------------------------------------------------------------------------
// Internal: error mapping + helpers
// ---------------------------------------------------------------------------

function handleReviewError(
  ctx: ExtensionCommandContext,
  err: unknown,
): void {
  if (err instanceof CaduceusReviewError) {
    ctx.ui.notify(`${err.code}: ${err.message}`, "warning");
    return;
  }
  throw err;
}

function parseChangeName(args: string): string {
  return args.trim().split(/\s+/)[0] ?? "";
}

/** Format a ReviewSnapshot for UI display. */
function formatSnapshot(snap: ReviewSnapshot): string {
  const lines = [
    `review state: ${snap.state}`,
    `changeId: ${snap.changeId}`,
    `persona: ${snap.personaSnapshot.activePersona || "(none)"}`,
    `lens runs: ${snap.lensRuns.length}`,
    `transitions: ${snap.transitionHistory.length}`,
    `lastTransitionAt: ${snap.lastTransitionAt}`,
  ];
  if (snap.error) lines.push(`error: ${snap.error}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API: registration
// ---------------------------------------------------------------------------

export function registerReviewSlashCommands(
  pi: ExtensionAPI,
  deps: ReviewCommandDeps,
): void {
  // /caduceus:review:inspect <change-name>
  pi.registerCommand("caduceus:review:inspect", {
    description: "Show the current review state snapshot for the named change.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const changeName = parseChangeName(args);
      if (!changeName) {
        ctx.ui.notify(
          "usage: /caduceus:review:inspect <change-name>",
          "warning",
        );
        return;
      }
      try {
        const snap = deps.inspectReview(changeName, ctx.cwd);
        ctx.ui.notify(formatSnapshot(snap), "info");
      } catch (err) {
        handleReviewError(ctx, err);
      }
    },
  });

  // /caduceus:review:start <change-name> [<persona>]
  pi.registerCommand("caduceus:review:start", {
    description: "Start a review for the named change; persona defaults to active.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const parts = args.trim().split(/\s+/);
      const changeName = parts[0] ?? "";
      const personaName = parts[1] || deps.getActivePersonaName();
      if (!changeName || !personaName) {
        ctx.ui.notify(
          "usage: /caduceus:review:start <change-name> [<persona>]",
          "warning",
        );
        return;
      }
      try {
        deps.startReview(changeName, ctx.cwd, {
          activePersona: personaName,
          mode: "default",
          locale: "auto",
        });
        ctx.ui.notify(
          `review started for '${changeName}' with persona '${personaName}'`,
          "info",
        );
      } catch (err) {
        handleReviewError(ctx, err);
      }
    },
  });

  // /caduceus:review:advance <change-name> [<transition>]
  pi.registerCommand("caduceus:review:advance", {
    description: "Advance the review state (transition: advance | abandon).",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const parts = args.trim().split(/\s+/);
      const changeName = parts[0] ?? "";
      const transition = (parts[1] ?? "advance") as "advance" | "abandon";
      if (!changeName) {
        ctx.ui.notify(
          "usage: /caduceus:review:advance <change-name> [advance|abandon]",
          "warning",
        );
        return;
      }
      if (transition !== "advance" && transition !== "abandon") {
        ctx.ui.notify(
          `invalid transition '${transition}'; use 'advance' or 'abandon'`,
          "warning",
        );
        return;
      }
      try {
        const snap = deps.advanceReview(changeName, ctx.cwd, transition);
        ctx.ui.notify(
          `review advanced to '${snap.state}'`,
          "info",
        );
      } catch (err) {
        handleReviewError(ctx, err);
      }
    },
  });

  // /caduceus:review:finalize <change-name>
  pi.registerCommand("caduceus:review:finalize", {
    description: "Finalize the review and write a content-bound receipt.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const changeName = parseChangeName(args);
      if (!changeName) {
        ctx.ui.notify(
          "usage: /caduceus:review:finalize <change-name>",
          "warning",
        );
        return;
      }
      try {
        const result = deps.finalizeReview(changeName, ctx.cwd, true);
        ctx.ui.notify(
          `review finalized for '${changeName}' (passed=${result.finalVerificationPassed})`,
          "info",
        );
      } catch (err) {
        handleReviewError(ctx, err);
      }
    },
  });

  // /caduceus:review:validate <change-name>
  pi.registerCommand("caduceus:review:validate", {
    description: "Re-validate a finalized receipt against current artifacts.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const changeName = parseChangeName(args);
      if (!changeName) {
        ctx.ui.notify(
          "usage: /caduceus:review:validate <change-name>",
          "warning",
        );
        return;
      }
      try {
        const result = deps.validateReview(changeName, ctx.cwd);
        ctx.ui.notify(
          `review '${changeName}': ${result.state}, receiptValid=${result.receiptValid}`,
          result.receiptValid ? "info" : "warning",
        );
      } catch (err) {
        handleReviewError(ctx, err);
      }
    },
  });

  // /caduceus:review:reset <change-name>
  pi.registerCommand("caduceus:review:reset", {
    description: "Recover from corrupted state.json (archives it and clears state).",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const changeName = parseChangeName(args);
      if (!changeName) {
        ctx.ui.notify(
          "usage: /caduceus:review:reset <change-name>",
          "warning",
        );
        return;
      }
      if (!deps.inspectIsCorrupted(changeName, ctx.cwd)) {
        ctx.ui.notify(
          `review state for '${changeName}' is not corrupted; nothing to reset`,
          "info",
        );
        return;
      }
      try {
        const result = deps.resetReview(changeName, ctx.cwd);
        if (result.ok) {
          ctx.ui.notify(
            `corrupt state for '${changeName}' archived; review state cleared`,
            "info",
          );
        } else {
          ctx.ui.notify(
            `reset failed for '${changeName}'`,
            "warning",
          );
        }
      } catch (err) {
        handleReviewError(ctx, err);
      }
    },
  });
}
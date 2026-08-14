// ---------------------------------------------------------------------------
// caduceus — SDD slash commands
//
// Registers 5 slash commands on the pi ExtensionAPI (introduced
// in v0.5.0):
//
//   /caduceus:sdd:init <name>     initialize change dir + 5 MD files
//   /caduceus:sdd:explore <topic> show requirements.md skeleton
//   /caduceus:sdd:propose <name> generate proposal.md
//   /caduceus:sdd:apply           mark tasks completed
//   /caduceus:sdd:archive         move change to archive/
//
// Each handler delegates to lib/sdd-flow.ts. The slash layer only
// does arg parsing, active-change resolution, and error → UI mapping.
//
// See design.md §4.2 and tasks.md T09.
// ---------------------------------------------------------------------------

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import {
  type SddInitOptions,
  type SddExploreOptions,
  type SddProposeOptions,
  type SddApplyOptions,
  type SddArchiveOptions,
} from "./sdd-flow.ts";
import { CaduceusSDDError } from "./errors.ts";

// ---------------------------------------------------------------------------
// Public API: deps interface
// ---------------------------------------------------------------------------

/**
 * Dependencies for the SDD slash commands. Each entry maps a slash
 * command to its sdd-flow function. The extension entry wires real
 * implementations; tests provide mocks.
 */
export type SddCommandDeps = {
  sddInit: (opts: SddInitOptions) => void;
  sddExplore: (opts: SddExploreOptions) => string;
  sddPropose: (opts: SddProposeOptions) => void;
  sddApply: (opts: SddApplyOptions) => void;
  sddArchive: (opts: SddArchiveOptions) => void;
  /**
   * Read the active change name from `~/.pi/agent/caduceus/state.json`.
   * Returns null if no active change.
   */
  readActiveChange: (home?: string) => string | null;
};

// ---------------------------------------------------------------------------
// Internal: error mapping
// ---------------------------------------------------------------------------

function handleSddError(
  ctx: ExtensionCommandContext,
  err: unknown,
): void {
  if (err instanceof CaduceusSDDError) {
    ctx.ui.notify(`${err.code}: ${err.message}`, "warning");
    return;
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Public API: registration
// ---------------------------------------------------------------------------

export function registerSddSlashCommands(
  pi: ExtensionAPI,
  deps: SddCommandDeps,
): void {
  // /caduceus:sdd:init <name>
  pi.registerCommand("caduceus:sdd:init", {
    description: "Initialize a new change directory with 5 MD templates.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify(
          "usage: /caduceus:sdd:init <change-name>",
          "warning",
        );
        return;
      }
      try {
        deps.sddInit({ changeName: name, cwd: ctx.cwd });
        ctx.ui.notify(`change '${name}' initialized`, "info");
      } catch (err) {
        handleSddError(ctx, err);
      }
    },
  });

  // /caduceus:sdd:explore <topic>
  pi.registerCommand("caduceus:sdd:explore", {
    description: "Show requirements.md skeleton for the active change.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const topic = args.trim();
      const active = deps.readActiveChange();
      if (!active) {
        ctx.ui.notify(
          "no active change; run /caduceus:sdd:init <name> first",
          "warning",
        );
        return;
      }
      try {
        const content = deps.sddExplore({
          changeName: active,
          topic,
          cwd: ctx.cwd,
        });
        ctx.ui.notify(content, "info");
      } catch (err) {
        handleSddError(ctx, err);
      }
    },
  });

  // /caduceus:sdd:propose <name>
  pi.registerCommand("caduceus:sdd:propose", {
    description: "Generate proposal.md from requirements.md.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const name = args.trim();
      if (!name) {
        ctx.ui.notify(
          "usage: /caduceus:sdd:propose <change-name>",
          "warning",
        );
        return;
      }
      try {
        deps.sddPropose({
          changeName: name,
          requirementsMarkdown: "",  // Phase A: not used by sddPropose
          cwd: ctx.cwd,
        });
        ctx.ui.notify(`proposal for '${name}' generated`, "info");
      } catch (err) {
        handleSddError(ctx, err);
      }
    },
  });

  // /caduceus:sdd:apply
  pi.registerCommand("caduceus:sdd:apply", {
    description: "Mark tasks completed for the active change.",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const active = deps.readActiveChange();
      if (!active) {
        ctx.ui.notify(
          "no active change; run /caduceus:sdd:init <name> first",
          "warning",
        );
        return;
      }
      try {
        // Phase A: completedTasks comes from a future Phase B
        // LLM-driven parser. The slash command is just the trigger.
        deps.sddApply({
          changeName: active,
          completedTasks: [],
          cwd: ctx.cwd,
        });
        ctx.ui.notify(`tasks applied for '${active}'`, "info");
      } catch (err) {
        handleSddError(ctx, err);
      }
    },
  });

  // /caduceus:sdd:archive
  pi.registerCommand("caduceus:sdd:archive", {
    description: "Move the active change to openspec/changes/archive/.",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const active = deps.readActiveChange();
      if (!active) {
        ctx.ui.notify(
          "no active change; run /caduceus:sdd:init <name> first",
          "warning",
        );
        return;
      }
      try {
        deps.sddArchive({ changeName: active, cwd: ctx.cwd });
        ctx.ui.notify(`change '${active}' archived`, "info");
      } catch (err) {
        handleSddError(ctx, err);
      }
    },
  });
}

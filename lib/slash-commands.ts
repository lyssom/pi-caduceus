// ---------------------------------------------------------------------------
// caduceus — slash commands
//
// Registers four slash commands on the pi ExtensionAPI:
//   /caduceus:status   — show the effective config
//   /caduceus:mode     — change the persona mode
//   /caduceus:locale   — change the locale preference
//   /caduceus:inspect  — print the rendered persona prompt
//
// The module is decoupled from pi where possible: only the `pi` parameter
// is typed as ExtensionAPI. All other dependencies (config read/write,
// persona build, inspect render) are passed via `CommandDeps`. This makes
// every command handler unit-testable with a mock pi and mock deps.
// ---------------------------------------------------------------------------

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { CaduceusConfig, EffectiveConfig, PersonaMode } from "./config-store.ts";
import { buildPersonaPrompt } from "./persona-contract.ts";
import type { ResolvedLocale } from "./locale-detect.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CommandDeps = {
  readConfig: (cwd: string) => EffectiveConfig;
  buildPersonaPrompt: (mode: PersonaMode, locale: ResolvedLocale) => string;
  writeGlobalConfigField: <K extends keyof CaduceusConfig>(
    field: K,
    value: CaduceusConfig[K],
  ) => Promise<void>;
  getStatusLine: (config: CaduceusConfig) => string;
  renderInspectOutput: (mode: PersonaMode, locale: ResolvedLocale) => string;
};

// ---------------------------------------------------------------------------
// Default renderInspectOutput implementation
// ---------------------------------------------------------------------------

/**
 * Default inspect renderer. Returns the rendered persona prompt with a
 * footer line showing the caduceus version.
 *
 * The slash-commands module does NOT do source-line annotations itself
 * (the prompt file content is opaque to it). The extension entry can
 * override this via CommandDeps.renderInspectOutput if it wants a richer
 * format with line provenance.
 */
export function defaultRenderInspectOutput(
  mode: PersonaMode,
  locale: ResolvedLocale,
): string {
  const persona = buildPersonaPrompt(mode, locale);
  return [
    "## caduceus inspect",
    `mode: ${mode}`,
    `locale: ${locale}`,
    "",
    persona,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_MODES: PersonaMode[] = ["gentleman", "neutral", "auto"];

// Closed set for slash-command validation. Custom locales (R-LOCALE-007)
// are accepted by the file-based config path (.caduceusrc) but NOT by the
// slash command — users typing /caduceus:locale <value> are likely
// making a typo, and an arbitrary custom locale could silently bypass
// the language-clause logic.
const VALID_LOCALES = new Set(["auto", "es-AR", "es-ES", "en", "zh"]);

function isValidMode(s: string): s is PersonaMode {
  return VALID_MODES.includes(s as PersonaMode);
}

function isValidLocale(s: string): boolean {
  return VALID_LOCALES.has(s);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerSlashCommands(
  pi: ExtensionAPI,
  deps: CommandDeps,
): void {
  // /caduceus:status --------------------------------------------------------
  pi.registerCommand("caduceus:status", {
    description: "Show the effective caduceus config (mode, locale, status bar, source).",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const { config, source } = deps.readConfig(ctx.cwd);
      const lines = [
        "caduceus status:",
        `  mode: ${config.mode}`,
        `  locale: ${config.locale}`,
        `  showStatusBar: ${config.showStatusBar}`,
        `  allowProjectOverride: ${config.allowProjectOverride}`,
        `  source: ${source}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /caduceus:mode ----------------------------------------------------------
  pi.registerCommand("caduceus:mode", {
    description: "Set the persona mode: gentleman | neutral | auto.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const value = args.trim();
      if (!isValidMode(value)) {
        ctx.ui.notify(
          `usage: /caduceus:mode <gentleman|neutral|auto> (got "${args}")`,
          "warning",
        );
        return;
      }
      await deps.writeGlobalConfigField("mode", value);
      ctx.ui.notify(`mode set to ${value}`, "info");
    },
  });

  // /caduceus:locale --------------------------------------------------------
  pi.registerCommand("caduceus:locale", {
    description: "Set the locale preference: auto | es-AR | es-ES | en | zh (or custom).",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const value = args.trim();
      if (!isValidLocale(value)) {
        ctx.ui.notify(
          `usage: /caduceus:locale <auto|es-AR|es-ES|en|zh> (got "${args}")`,
          "warning",
        );
        return;
      }
      await deps.writeGlobalConfigField("locale", value);
      ctx.ui.notify(`locale set to ${value}`, "info");
    },
  });

  // /caduceus:inspect -------------------------------------------------------
  pi.registerCommand("caduceus:inspect", {
    description: "Print the rendered persona prompt for the current (mode, locale).",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const { config } = deps.readConfig(ctx.cwd);
      const mode = config.mode;
      // We pass the config locale (which may be "auto"); the actual locale
      // is resolved at before_agent_start time. For inspect, we show
      // what the prompt would look like at the configured locale.
      const locale = config.locale as ResolvedLocale;
      const output = deps.renderInspectOutput(mode, locale);
      ctx.ui.notify(output, "info");
    },
  });
}

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

import type {
  CaduceusConfig,
  EffectiveConfig,
  PersonaMode,
  SystemPromptMode,
} from "./config-store.ts";
import { buildPersonaPrompt } from "./persona-contract.ts";
import type { ResolvedLocale } from "./locale-detect.ts";
import type { PersonaName } from "./persona-loader.ts";
import type { LintResult } from "./lint.ts";

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
  // v0.1.1 additions:
  listPersonas: (cwd: string) => PersonaName[];
  switchPersona: (name: PersonaName) => Promise<void>;
  setSystemPromptMode: (mode: SystemPromptMode) => Promise<void>;
  lintActivePersona: () => LintResult;
  getActivePersonaName: () => PersonaName;
  // v0.2.0 additions (wizard):
  validateWizardStep: (step: string, value: string) => { ok: boolean; error?: string; value?: string };
  generateWizardContent: (input: { name: string; description: string; style: "concise" | "verbose" | "friendly" | "strict" | "custom" }) => string;
  wizardFilePath: (name: string, scope: "global" | "project", cwd: string) => string;
  writeAndLint: (path: string, content: string, name: string) => Promise<{ ok: boolean; filePath: string; issues: { severity: "error" | "warning"; message: string; check: string }[] }>;
  // v0.2.0 additions (diff):
  personaDiff: (input: {
    leftName: string;
    rightName: string;
    mode: "default" | "plain" | "auto";
    locale: string;
    cwd: string;
  }) => { ok: boolean; diff: string; leftName: string; rightName: string };
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

const VALID_MODES: PersonaMode[] = ["default", "plain", "auto"];

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
    description: "Show the effective caduceus config (mode, locale, persona, prompt mode, source).",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const { config, source } = deps.readConfig(ctx.cwd);
      const lines = [
        "caduceus status:",
        `  mode: ${config.mode}`,
        `  locale: ${config.locale}`,
        `  persona: ${config.persona}`,
        `  systemPromptMode: ${config.systemPromptMode}`,
        `  showStatusBar: ${config.showStatusBar}`,
        `  allowProjectOverride: ${config.allowProjectOverride}`,
        `  source: ${source}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /caduceus:mode ----------------------------------------------------------
  pi.registerCommand("caduceus:mode", {
    description: "Set the persona mode: default | plain | auto.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const value = args.trim();
      if (!isValidMode(value)) {
        ctx.ui.notify(
          `usage: /caduceus:mode <default|plain|auto> (got "${args}")`,
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

  // /caduceus:prompt --------------------------------------------------------
  pi.registerCommand("caduceus:prompt", {
    description: "Set how the persona segment is injected: append (default) | replace.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const value = args.trim();
      if (value !== "append" && value !== "replace") {
        ctx.ui.notify(
          `usage: /caduceus:prompt <append|replace> (got "${args}")`,
          "warning",
        );
        return;
      }
      await deps.setSystemPromptMode(value);
      ctx.ui.notify(`systemPromptMode set to ${value}`, "info");
    },
  });

  // /caduceus:persona -------------------------------------------------------
  pi.registerCommand("caduceus:persona", {
    description: "Switch persona (<name>) or list all available (list).",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const value = args.trim();
      if (value === "list") {
        const names = deps.listPersonas(ctx.cwd);
        const lines = ["available personas:", ...names.map((n) => `  - ${n}`)];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }
      if (value === "") {
        ctx.ui.notify(
          `usage: /caduceus:persona <name|list> (active: ${deps.getActivePersonaName()})`,
          "info",
        );
        return;
      }
      try {
        await deps.switchPersona(value);
        ctx.ui.notify(`persona set to ${value}`, "info");
      } catch (err) {
        // CaduceusPersonaNotFoundError surfaces as a friendly message
        ctx.ui.notify(
          `persona not found: ${value}. Try /caduceus:persona list.`,
          "warning",
        );
      }
    },
  });

  // /caduceus:lint ----------------------------------------------------------
  pi.registerCommand("caduceus:lint", {
    description: "Run static checks on the active persona and report any contract violations.",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const result = deps.lintActivePersona();
      const persona = deps.getActivePersonaName();
      if (result.passed && result.issues.length === 0) {
        ctx.ui.notify(`persona '${persona}': OK (no issues)`, "info");
        return;
      }
      if (result.passed) {
        // Has only warnings, no errors
        const lines = [
          `persona '${persona}': passed with ${result.issues.length} warning(s):`,
          ...result.issues.map(
            (i) => `  [${i.severity}] ${i.check}: ${i.message}`,
          ),
        ];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }
      const lines = [
        `persona '${persona}': FAILED lint (${result.issues.length} issue(s)):`,
        ...result.issues.map(
          (i) => `  [${i.severity}] ${i.check}: ${i.message}`,
        ),
      ];
      ctx.ui.notify(lines.join("\n"), "warning");
    },
  });
pi.registerCommand("caduceus:create", {
  description: "Create a new persona from a name and description. Usage: /caduceus:create <name> <description...>",
  handler: async (args, ctx) => {
    const trimmed = args.trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx < 0) {
      ctx.ui.notify(
        "usage: /caduceus:create <name> <description...>\n  example: /caduceus:create wizard Speaks like a wise wizard who never gives direct answers",
        "info",
      );
      return;
    }
    const name = trimmed.slice(0, spaceIdx);
    const description = trimmed.slice(spaceIdx + 1).trim();

    const nameCheck = deps.validateWizardStep?.("name", name);
    if (!nameCheck?.ok) {
      ctx.ui.notify(`invalid name: ${nameCheck?.error ?? "unknown error"}`, "warning");
      return;
    }
    const descCheck = deps.validateWizardStep?.("description", description);
    if (!descCheck?.ok) {
      ctx.ui.notify(`invalid description: ${descCheck?.error ?? "unknown error"}`, "warning");
      return;
    }

    const content = deps.generateWizardContent!({ name, description, style: "custom" });
    const path = deps.wizardFilePath!(name, "project", ctx.cwd);
    const result = await deps.writeAndLint!(path, content, name);

    if (!result.ok) {
      const lines = [
        `wizard: generated '${name}' but lint FAILED:`,
        ...result.issues.map((i) => `  [${i.severity}] ${i.check}: ${i.message}`),
        `file NOT written. fix the issues manually.`,
      ];
      ctx.ui.notify(lines.join("\n"), "warning");
      return;
    }

    ctx.ui.notify(
      `persona '${name}' written to ${result.filePath}\n` +
      `lint passed. switch with: /caduceus:persona ${name}`,
      "info",
    );
  },
});


// /caduceus:diff ----------------------------------------------------------
pi.registerCommand("caduceus:diff", {
  description: "Diff two personas. Usage: /caduceus:diff [a [b]] (defaults: a=active, b=default).",
  handler: async (args, ctx) => {
    const tokens = args.trim().split(/\s+/).filter(Boolean);
    const { config } = deps.readConfig(ctx.cwd);
    const mode = config.mode;
    const locale = config.locale;

    let a: string, b: string;
    if (tokens.length === 0) {
      // 0 args: diff active persona vs default
      a = config.persona;
      b = "default";
    } else if (tokens.length === 1) {
      // 1 arg: diff <arg> vs active
      a = tokens[0];
      b = config.persona;
    } else {
      // 2 args: diff <a> vs <b>
      a = tokens[0];
      b = tokens[1];
    }

    try {
      const result = deps.personaDiff({
        leftName: a,
        rightName: b,
        mode,
        locale,
        cwd: ctx.cwd,
      });
      if (result.diff === "") {
        ctx.ui.notify(`personas '${result.leftName}' and '${result.rightName}' are identical`, "info");
      } else {
        ctx.ui.notify(result.diff, "info");
      }
    } catch (err) {
      ctx.ui.notify(
        `diff failed: ${(err as Error).message}`,
        "warning",
      );
    }
  },
});
}

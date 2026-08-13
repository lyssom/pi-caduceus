// ---------------------------------------------------------------------------
// caduceus — extension entry
//
// The ONLY file in caduceus that imports from pi. Per INIT.md §4 DNA-1,
// this is the SHELL: it talks to pi. All other modules are MEAT: pure,
// testable, independent of pi's runtime.
//
// Wires 7 slash commands + 2 events:
//   1. session_start       — read config, set status bar (if showStatusBar)
//   2. before_agent_start  — inject the persona segment into the system prompt
//                            (append or replace mode)
//   3-9. slash commands    — status, mode, locale, prompt, persona, inspect, lint
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  readConfig,
  writeGlobalConfigField,
  DEFAULT_CONFIG,
  type EffectiveConfig,
  type PersonaMode,
  type SystemPromptMode,
  type PersonaName,
} from "../lib/config-store.ts";
import { buildPersonaPrompt } from "../lib/persona-contract.ts";
import { detectLocale, type ResolvedLocale } from "../lib/locale-detect.ts";
import {
  registerSlashCommands,
  defaultRenderInspectOutput,
} from "../lib/slash-commands.ts";
import { composeSystemPrompt } from "../lib/prompt-mode.ts";
import {
  loadPersona,
  listPersonas,
  type LoadedPersona,
} from "../lib/persona-loader.ts";
import { lintPersonaContent } from "../lib/lint.ts";
import { personaDiff } from "../lib/diff.ts";
import {
  validateStep as validateWizardStep,
  generatePersonaContent as generateWizardContent,
  personaFilePath as wizardFilePath,
  writeAndLint,
} from "../lib/wizard.ts";
import { CADUCEUS_VERSION } from "../lib/version.ts";
import { CaduceusConfigError } from "../lib/errors.ts";

// v0.3.0: lib/language-clause.ts was removed. The persona prompt is
// no longer appended with a mode-specific language clause.

// CADUCEUS_VERSION is exported for downstream consumers; not used in this
// file directly but kept here for self-identification and future log lines.
void CADUCEUS_VERSION;

/**
 * Default export — the pi extension factory.
 */
export default function caduceus(pi: ExtensionAPI): void {
  // Per-session state (closure variables)
  let effective: EffectiveConfig | null = null;
  let cwd: string | null = null;
  let loadedPersona: LoadedPersona | null = null;
  let systemPromptMode: SystemPromptMode = "append";

  // -----------------------------------------------------------------------
  // 1. session_start
  // -----------------------------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    try {
      effective = readConfig({ cwd: ctx.cwd });
    } catch (err) {
      if (err instanceof CaduceusConfigError) {
        ctx.ui.notify(
          `caduceus: malformed ${err.path}, using built-in defaults`,
          "warning",
        );
      }
      effective = {
        config: { ...DEFAULT_CONFIG },
        source: "built-in defaults",
      };
    }
    // Load the active persona (catch errors so the session still starts)
    try {
      loadedPersona = loadPersona(effective.config.persona, ctx.cwd);
    } catch (err) {
      // Persona not found — fall back to default and notify
      ctx.ui.notify(
        `caduceus: persona '${effective.config.persona}' not found, using 'default'`,
        "warning",
      );
      effective = {
        config: { ...effective.config, persona: "default" },
        source: effective.source,
      };
      loadedPersona = loadPersona("default", ctx.cwd);
    }
    // Sync the system-prompt mode from config
    systemPromptMode = effective.config.systemPromptMode;
    // Set the status bar (if enabled)
    if (effective.config.showStatusBar) {
      ctx.ui.setStatus(
        "caduceus",
        `caduceus · ${effective.config.persona} · ${effective.config.mode} · ${effective.config.locale}`,
      );
    }
  });

  // -----------------------------------------------------------------------
  // 2. before_agent_start
  // -----------------------------------------------------------------------
  pi.on("before_agent_start", async (event, _ctx) => {
    const cfg = effective?.config ?? DEFAULT_CONFIG;
    // v0.3.0: mode names are "default" and "plain" (replacing "gentleman" / "neutral")
    const mode: PersonaMode = cfg.mode === "plain" ? "plain" : "default";
    const locale: ResolvedLocale = detectLocale(event.prompt, process.env, cfg.locale);

    // Use the loaded persona if it matches the current config; otherwise
    // re-load. This handles persona changes via /caduceus:persona.
    const targetName = cfg.persona;
    if (!loadedPersona || loadedPersona.name !== targetName) {
      try {
        loadedPersona = loadPersona(targetName, cwd ?? process.cwd());
      } catch {
        // Should not happen — session_start already validates
        loadedPersona = loadPersona("default", cwd ?? process.cwd());
      }
    }

    // Render the persona: substitute ${mode} with the resolved mode.
    // v0.3.0: no language clause is appended; the persona prompt is
    // language-neutral and the model is expected to detect the user's
    // input language naturally.
    const renderedContent = loadedPersona.content.split("${mode}").join(mode);
    const persona = renderedContent.trim();

    return {
      systemPrompt: composeSystemPrompt(
        event.systemPrompt,
        persona,
        systemPromptMode,
      ),
    };
  });

  // -----------------------------------------------------------------------
  // 3-9. Slash commands
  // -----------------------------------------------------------------------
  registerSlashCommands(pi, {
    readConfig: (cwd: string) =>
      effective ?? readConfig({ cwd }),
    buildPersonaPrompt,
    writeGlobalConfigField,
    getStatusLine: (cfg) =>
      `caduceus · ${cfg.mode} · ${cfg.locale}`,
    renderInspectOutput: defaultRenderInspectOutput,
    // v0.1.1:
    listPersonas: (cwd: string) => listPersonas(cwd),
    switchPersona: async (name: PersonaName) => {
      // 1. Re-load the persona content (validates it exists)
      const p = loadPersona(name, cwd ?? process.cwd());
      loadedPersona = p;
      // 2. Persist the choice to global config
      await writeGlobalConfigField("persona", name);
      // 3. Update the effective config snapshot
      if (effective) {
        effective = {
          config: { ...effective.config, persona: name },
          source: effective.source,
        };
      }
    },
    setSystemPromptMode: async (mode: SystemPromptMode) => {
      systemPromptMode = mode;
      await writeGlobalConfigField("systemPromptMode", mode);
      if (effective) {
        effective = {
          config: { ...effective.config, systemPromptMode: mode },
          source: effective.source,
        };
      }
    },
    lintActivePersona: () => {
      if (!loadedPersona) {
        return {
          passed: true,
          issues: [],
        };
      }
      return lintPersonaContent(loadedPersona.content, loadedPersona.name);
    },
    getActivePersonaName: () =>
      loadedPersona?.name ?? DEFAULT_CONFIG.persona,
    // v0.2.0 wizard:
    validateWizardStep,
    generateWizardContent,
    wizardFilePath,
    writeAndLint,
    // v0.2.0 diff:
    personaDiff,
  });
}

// ---------------------------------------------------------------------------
// (v0.3.0: language-clause lookup was removed; the persona prompt is
// language-neutral now.)
// ---------------------------------------------------------------------------

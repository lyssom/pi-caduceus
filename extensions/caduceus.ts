// ---------------------------------------------------------------------------
// caduceus — extension entry
//
// The ONLY file in caduceus that imports from pi. Per INIT.md §4 DNA-1,
// this is the SHELL: it talks to pi. All other modules are MEAT: pure,
// testable, independent of pi's runtime.
//
// Registers three things on the ExtensionAPI:
//   1. session_start     — read config, set status bar (if showStatusBar)
//   2. before_agent_start — inject the persona segment into the system prompt
//   3. four slash commands via registerSlashCommands
//
// The persona injection chains with any other extension's
// before_agent_start handler (verified against pi-coding-agent 0.84.1:
// dist/core/extensions/runner.js:837-893, last-writer-wins but each
// handler reads the latest currentSystemPrompt).
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  readConfig,
  writeGlobalConfigField,
  DEFAULT_CONFIG,
  type EffectiveConfig,
  type PersonaMode,
} from "../lib/config-store.ts";
import { buildPersonaPrompt } from "../lib/persona-contract.ts";
import { detectLocale, type ResolvedLocale } from "../lib/locale-detect.ts";
import { registerSlashCommands, defaultRenderInspectOutput } from "../lib/slash-commands.ts";
import { CADUCEUS_VERSION } from "../lib/version.ts";
import { CaduceusConfigError } from "../lib/errors.ts";

// CADUCEUS_VERSION is exported for downstream consumers; not used in this
// file directly but kept here for self-identification and future log lines.
void CADUCEUS_VERSION;

/**
 * Default export — the pi extension factory.
 *
 * pi calls this function once per session, then invokes the registered
 * handlers. The closure variable `effective` is per-extension-instance
 * (pi creates a fresh extension per session), so no cross-session
 * state leaks.
 */
export default function caduceus(pi: ExtensionAPI): void {
  let effective: EffectiveConfig | null = null;

  // -----------------------------------------------------------------------
  // 1. session_start — read config, set status bar
  // -----------------------------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    try {
      effective = readConfig({ cwd: ctx.cwd });
    } catch (err) {
      if (err instanceof CaduceusConfigError) {
        ctx.ui.notify(
          `caduceus: malformed ${err.path}, using built-in defaults`,
          "warning",
        );
      }
      // Fall through to defaults (do not re-throw — pi would mark the
      // session as failed and the user would have no way to recover).
      effective = {
        config: { ...DEFAULT_CONFIG },
        source: "built-in defaults",
      };
    }
    if (effective.config.showStatusBar) {
      ctx.ui.setStatus(
        "caduceus",
        `caduceus · ${effective.config.mode} · ${effective.config.locale}`,
      );
    }
  });

  // -----------------------------------------------------------------------
  // 2. before_agent_start — inject the persona segment
  // -----------------------------------------------------------------------
  pi.on("before_agent_start", async (event, _ctx) => {
    const cfg = effective?.config ?? DEFAULT_CONFIG;
    // Resolve mode: "auto" maps to "gentleman" (per persona-contract).
    const mode: PersonaMode = cfg.mode === "neutral" ? "neutral" : "gentleman";
    // Resolve locale via the detection chain (text > env > config > fallback).
    const locale: ResolvedLocale = detectLocale(event.prompt, process.env, cfg.locale);
    const persona = buildPersonaPrompt(mode, locale);
    return {
      systemPrompt: `${event.systemPrompt}\n\n${persona}`,
    };
  });

  // -----------------------------------------------------------------------
  // 3. Slash commands
  // -----------------------------------------------------------------------
  registerSlashCommands(pi, {
    readConfig: (cwd: string) =>
      effective ?? readConfig({ cwd }),
    buildPersonaPrompt,
    writeGlobalConfigField,
    getStatusLine: (cfg) =>
      `caduceus · ${cfg.mode} · ${cfg.locale}`,
    renderInspectOutput: defaultRenderInspectOutput,
  });
}

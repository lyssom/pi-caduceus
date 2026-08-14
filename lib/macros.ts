// ---------------------------------------------------------------------------
// caduceus — persona macros
//
// Runtime substitution for `${userName}`, `${projectName}`, `${cwd}`,
// `${date}`, `${os}` placeholders in persona markdown files.
//
// The `${mode}` placeholder is handled separately by the extension entry
// (it's part of the persona contract, not a runtime macro).
//
// Pure functions: no I/O, no global state. The caller provides
// `MacroContext` explicitly so the function is testable.
// ---------------------------------------------------------------------------

import { basename } from "node:path";

const FALLBACK_USER_NAME = "user";

// Closed set of supported macros. The `mode` placeholder is NOT in this
// set because it is resolved by the extension entry, not by this module.
export const SUPPORTED_MACROS: ReadonlySet<string> = new Set([
  "userName",
  "projectName",
  "cwd",
  "date",
  "os",
]);

export type MacroContext = {
  userName: string;
  projectName: string;
  cwd: string;
  date: string;     // YYYY-MM-DD
  os: NodeJS.Platform;
};

/**
 * Build a MacroContext from the current working directory. The cwd
 * argument is optional; if omitted, process.cwd() is used.
 *
 * The date is captured at call time (today, YYYY-MM-DD). The userName
 * comes from $USER or $USERNAME, falling back to "user".
 */
export function buildMacroContext(cwd?: string): MacroContext {
  const resolvedCwd = cwd ?? process.cwd();
  return {
    userName: process.env.USER ?? process.env.USERNAME ?? FALLBACK_USER_NAME,
    projectName: basename(resolvedCwd),
    cwd: resolvedCwd,
    date: new Date().toISOString().slice(0, 10),
    os: process.platform,
  };
}

/**
 * Replace all `${macro}` occurrences in the content with their resolved
 * values from the context. The `${mode}` placeholder is NOT touched
 * (the extension entry handles it separately).
 *
 * Unknown macros are left as-is (the lint catches them at content-load
 * time, not at runtime). This is intentional: a persona file with
 * `${futureMacro}` is still functional; the user just sees the raw
 * placeholder until the macro is implemented.
 */
export function resolveMacros(content: string, ctx: MacroContext): string {
  return content
    .replace(/\$\{userName\}/g, ctx.userName)
    .replace(/\$\{projectName\}/g, ctx.projectName)
    .replace(/\$\{cwd\}/g, ctx.cwd)
    .replace(/\$\{date\}/g, ctx.date)
    .replace(/\$\{os\}/g, ctx.os);
}

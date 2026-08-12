// ---------------------------------------------------------------------------
// caduceus — language clause
//
// Pure function: (locale, mode) -> a one-line language boundary string
// for the persona prompt. Returns "" when the locale does not need a
// Spanish clause (en, zh, or any custom locale).
//
// Spec: R-PERSONA-010. Selection table in design.md §5.4.
//
// Type definitions are inlined here to avoid a circular dependency with
// lib/config-store.ts (T-5) and lib/locale-detect.ts (T-4). When those
// modules land, they re-export the same types; consumers can import from
// either module.
// ---------------------------------------------------------------------------

export type PersonaMode = "gentleman" | "neutral" | "auto";
export type ResolvedLocale =
  | "es-AR"
  | "es-ES"
  | "en"
  | "zh"
  | string;

// Locale codes that get a built-in language clause. Everything else ("en",
// "zh", custom locales like "pt-BR") returns "".
const SPANISH_LOCALES = new Set(["es-AR", "es-ES", "auto"]);

const GENTLEMAN_ES_AR_CLAUSE =
  "Language: natural Rioplatense Spanish with voseo when the user writes Spanish.";

const GENTLEMAN_ES_ES_CLAUSE =
  "Language: neutral/professional Spanish (no voseo) when the user writes Spanish.";

const NEUTRAL_ES_CLAUSE =
  "Language: neutral/professional Spanish (no voseo) when the user writes Spanish.";

/**
 * Build the language boundary line for the given (locale, mode) pair.
 *
 * Returns a non-empty string only for Spanish locales (es-AR, es-ES, auto).
 * For all other locales (en, zh, custom) returns the empty string.
 */
export function languageClause(
  locale: ResolvedLocale,
  mode: PersonaMode,
): string {
  if (!SPANISH_LOCALES.has(locale)) return "";

  if (mode === "neutral") return NEUTRAL_ES_CLAUSE;

  // mode === "gentleman" (or "auto" — but languageClause receives resolved modes,
  // and "auto" is only set when locale is also "auto", in which case we treat
  // it as a Spanish locale)
  if (locale === "es-ES") return GENTLEMAN_ES_ES_CLAUSE;

  return GENTLEMAN_ES_AR_CLAUSE;
}

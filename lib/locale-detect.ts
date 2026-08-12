// ---------------------------------------------------------------------------
// caduceus — locale detection
//
// Pure function: (text, env, configLocale) -> ResolvedLocale.
//
// Resolution order (matches R-LOCALE-002 and design.md §5.3):
//   1. If configLocale !== "auto", return it (custom locale passthrough).
//   2. If text has Spanish cues (diacritics or common words), classify as
//      "es-AR" (>= 2 voseo markers) or "es-ES" (otherwise).
//   3. If text has >= 3 CJK ideographs, classify as "zh".
//   4. If text has >= 3 words and >= 60% English common words (and no
//      diacritics — already passed the Spanish check), classify as "en".
//   5. If env.LC_ALL is set, normalize and return.
//   6. If env.LANG is set, normalize and return.
//   7. Fallback: "en".
// ---------------------------------------------------------------------------

export type ResolvedLocale =
  | "es-AR"
  | "es-ES"
  | "en"
  | "zh"
  | string;

export type LocalePreference = "auto" | ResolvedLocale;

const SPANISH_DIACRITIC_RE = /[áéíóúñü¿¡]/i;

// Spanish common words (with surrounding spaces to avoid false matches inside other words).
// Padded into the lowercased input for matching.
const SPANISH_COMMON_WORDS = [
  " que ", " como ", " para ", " pero ", " muy ", " también ",
];

const VOSEO_MARKERS = [
  "vos ", "tenés", "querés", "hacé", "andá", "sos ", "podés",
];

// Top ~100 English common words. Lowercase, no punctuation.
const ENGLISH_COMMON_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there",
  "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no",
  "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then",
  "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first",
  "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "has", "had", "did", "got", "let",
]);

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

function hasSpanishDiacritics(text: string): boolean {
  return SPANISH_DIACRITIC_RE.test(text);
}

function hasSpanishCommonWords(paddedLower: string): boolean {
  return SPANISH_COMMON_WORDS.some((w) => paddedLower.includes(w));
}

function countVoseoMarkers(paddedLower: string): number {
  return VOSEO_MARKERS.filter((m) => paddedLower.includes(m)).length;
}

function countCjkIdeographs(text: string): number {
  // U+4E00..U+9FFF is the CJK Unified Ideographs block
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code !== undefined && code >= 0x4e00 && code <= 0x9fff) {
      count++;
    }
  }
  return count;
}

function isEnglishDominant(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length < 3) return false;
  const englishCount = words.filter((w) => ENGLISH_COMMON_WORDS.has(w)).length;
  return englishCount / words.length >= 0.6;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a POSIX-style LANG/LC_ALL value (e.g. "es_ES.UTF-8") to a
 * caduceus ResolvedLocale. Returns null for unsupported or empty values.
 *
 * Spanish territories default to "es-AR"; set `env.CADUCEUS_ES_TERRITORY`
 * to "ES" to get "es-ES" instead.
 */
export function normalizeEnvLocale(
  envValue: string,
  env?: NodeJS.ProcessEnv,
): ResolvedLocale | null {
  // Strip encoding suffix
  const withoutEncoding = envValue.replace(/\..*$/, "");
  const [lang, _territory] = withoutEncoding.split("_");
  if (!lang) return null;
  if (lang === "C" || lang === "POSIX") return null;

  if (lang === "es") {
    if (env?.CADUCEUS_ES_TERRITORY === "ES") return "es-ES";
    return "es-AR";
  }
  if (lang === "en") return "en";
  if (lang === "zh") return "zh";

  return null;
}

/**
 * Resolve the user's locale from the prompt text, process environment,
 * and configured preference. Pure function — no I/O, no global state.
 *
 * See file header for the resolution order. Returns a non-empty
 * ResolvedLocale (never the string "auto").
 */
export function detectLocale(
  text: string,
  env: NodeJS.ProcessEnv,
  configLocale: LocalePreference,
): ResolvedLocale {
  // 1. Config override (custom locale passthrough)
  if (configLocale !== "auto") return configLocale;

  // 2. Spanish check (with voseo disambiguation)
  const paddedLower = " " + text.toLowerCase() + " ";
  if (hasSpanishDiacritics(text) || hasSpanishCommonWords(paddedLower)) {
    const voseoCount = countVoseoMarkers(paddedLower);
    return voseoCount >= 2 ? "es-AR" : "es-ES";
  }

  // 3. Chinese check
  if (countCjkIdeographs(text) >= 3) {
    return "zh";
  }

  // 4. English check (no diacritics already passed Spanish check)
  if (isEnglishDominant(text)) {
    return "en";
  }

  // 5. env.LC_ALL
  if (env.LC_ALL) {
    const r = normalizeEnvLocale(env.LC_ALL, env);
    if (r) return r;
  }

  // 6. env.LANG
  if (env.LANG) {
    const r = normalizeEnvLocale(env.LANG, env);
    if (r) return r;
  }

  // 7. Fallback
  return "en";
}

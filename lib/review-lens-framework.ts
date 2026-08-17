// ---------------------------------------------------------------------------
// caduceus — review lens framework
//
// Lens interface + registry for the review state machine (introduced
// in v0.5.0). The framework provides 5 named lens SLOTS that can be
// populated with concrete lens implementations in Phase B / v0.6.0.
//
// In Phase A (v0.5.0), the registry starts empty: slots exist as
// constants (LENS_SLOTS_V1) but no lens has a `run` implementation.
// This lets the state machine and persona router be wired up and
// tested in Phase A without requiring any lens to actually execute.
//
// See design.md §3.5 for the type contract and §12 R2 for the
// LENS_REGISTRY_VERSION rationale (forward-compat for adding slots
// without breaking in-flight receipts).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LensId =
  | "risk"
  | "correctness"
  | "security"
  | "readability"
  | "spec-compliance";

export type LensFinding = {
  severity: "P0" | "P1" | "P2" | "P3";
  summary: string;
  location: string;
  recommendation: string;
  /**
   * Source line for keyword/grep findings. Omitted for section-level
   * findings. Introduced in v0.6.0 per REQ-004 and design.md §5.
   */
  line?: number;
};

export type LensFindings = {
  lensId: LensId;
  findings: ReadonlyArray<LensFinding>;
  durationMs: number;
  /**
   * True when the findings array was capped at 20 per REQ-005.
   * Introduced in v0.6.0 per REQ-005 and design.md §5.
   */
  truncated?: boolean;
};

export type Lens = {
  id: LensId;
  displayName: string;
  description: string;
  // Phase A: undefined. Phase B: a function that runs the lens
  // against a change directory and produces findings.
  run?: (changeDir: string) => Promise<LensFindings>;
};

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/**
 * Current lens registry schema version. Bump this whenever a slot
 * is added/removed/renamed; receipts carry this number so a receipt
 * under version N is invalid under a different LENS_REGISTRY_VERSION.
 * Per design.md §12 R2.
 */
export const LENS_REGISTRY_VERSION = 1;

/**
 * The 5 named lens slots in caduceus v0.5.0. Stable order so that
 * receipt JSON is byte-stable across runs.
 */
export const LENS_SLOTS_V1: ReadonlyArray<LensId> = Object.freeze([
  "risk",
  "correctness",
  "security",
  "readability",
  "spec-compliance",
]);

/**
 * Display names for each lens ID. Shown in slash-command output
 * and review-state JSON for human readability.
 */
export const LENS_DISPLAY_NAMES: Readonly<Record<LensId, string>> =
  Object.freeze({
    risk: "Risk",
    correctness: "Correctness",
    security: "Security",
    readability: "Readability",
    "spec-compliance": "Spec Compliance",
  });

// ---------------------------------------------------------------------------
// Public API: registry
// ---------------------------------------------------------------------------

export type LensRegistry = {
  /** Register a lens. Throws if a lens with the same ID is already registered. */
  register(lens: Lens): void;
  /** Look up a lens by ID. Returns undefined if not registered. */
  get(lensId: LensId): Lens | undefined;
  /** Return a snapshot array of all registered lenses. */
  list(): ReadonlyArray<Lens>;
  /** Check if a lens is registered. */
  has(lensId: LensId): boolean;
};

/**
 * Create a fresh LensRegistry. Each call returns an independent
 * registry (no shared state), so callers can safely build multiple
 * registries (e.g. for tests).
 */
export function createLensRegistry(): LensRegistry {
  const lenses = new Map<LensId, Lens>();

  return {
    register(lens) {
      if (lenses.has(lens.id)) {
        throw new Error(
          `Lens '${lens.id}' is already registered`,
        );
      }
      lenses.set(lens.id, lens);
    },

    get(lensId) {
      return lenses.get(lensId);
    },

    list() {
      return Array.from(lenses.values());
    },

    has(lensId) {
      return lenses.has(lensId);
    },
  };
}

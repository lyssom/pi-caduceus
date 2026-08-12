# Caduceus — Project Initialization File

> **Status:** Seed file. Persistent decision record for the new `caduceus` Pi package.
> **Date created:** 2026-01
> **Owner:** TBD
> **Use:** Copy this file into a fresh project folder as the starting point. The
> next session opens it, verifies the decisions, and runs the SDD preflight
> before any code is written.

---

## 1. Locked Decisions

| # | Decision | Value |
|---|---|---|
| 1 | **Package name** | `caduceus` |
| 2 | **MVP scope** | **Option A — Persona Contract package** (pure prompt-orchestration, no native binary, no skills in v0.1.0) |
| 3 | **Repo identity** | **Independent** (separate repo from `gentle-pi`, separate npm package, own org/owner TBD) |
| 4 | **Initial version** | `0.1.0` (semver: pre-stable, signals "small surface, expect iteration") |

---

## 2. Why "caduceus" — Naming Rationale

### 2.1 Mythological anchor
Hermes's staff. In Greek myth the caduceus is the **staff of the messenger
god**, two snakes entwined around a winged rod. It is also a classical
**symbol of commerce, contracts, and negotiated agreement** — not (despite
common misuse) of medicine.

### 2.2 Mapping to the product
| Caduceus element | Caduceus (the package) meaning |
|---|---|
| Winged rod | Fast prompt orchestration — inject language + persona clauses before the first token |
| Two snakes | The two persona modes: `gentleman` and `neutral` — intertwined but never simultaneously active |
| Merchant / herald role | A contract layer between the user and the model — not decoration, not roleplay |
| Boundary-staff, not weapon | Discipline, not aggression. Replaces "harness" / "framework" metaphors |

### 2.3 Ecosystem fit
- The pi ecosystem already has `pi-hermes-memory` (memory layer) — Hermes
  itself is taken, but the **staff** (caduceus) is a different artifact and
  signals "layer above the messenger, not the messenger."
- Mythological naming has precedent and traction: `@danypops/papyrus`
  (writing surface), `@vigolium/piolium` (vigil), `pi-powerline-footer`
  (artifact), `@dietrichgebert/ponytail` (anti-serious). Caduceus sits
  cleanly in this family.
- Anti-collision check (recorded for re-verification before npm publish):
  - `caduceus` on npm: must be re-checked at publish time
  - `pi-caduceus` scope alias: optional
  - See §7 for the exact query to run before claiming the name

### 2.4 Why not the other candidates
| Candidate | Reason rejected |
|---|---|
| `shellman` | Strong concept, but `shell` connotes "container around content" — that is `gentle-pi`'s position. Caduceus is one layer above. |
| `mantisman` | Mantis = predator / patience. Wrong posture: caduceus is a contract, not a hunter. |
| `piolio` | Too close to `@vigolium/piolium`; naming confusion. |
| `ponytail-fork` | Borrowed irony; lacks brand independence. |

---

## 3. MVP Scope (Option A — Persona Contract)

### 3.1 In scope for v0.1.0
- **Persona contract engine** — pure-function prompt assembly given
  `(mode, locale)`.
- **Two modes**: `gentleman` (senior architect persona, Rioplatense voseo
  for Spanish), `neutral` (professional/neutral Spanish, voseo forbidden).
- **Language clause injection** — automatic locale detection plus
  configurable override.
- **Configuration store** at `~/.pi/agent/caduceus.json` with project-level
  override via `.caduceusrc` (JSON or JSONC).
- **Slash commands**:
  - `/caduceus:status` — print current effective prompt and source lines.
  - `/caduceus:mode <gentleman|neutral|auto>` — switch mode.
  - `/caduceus:locale <auto|es-AR|es-ES|en|zh|...>` — override locale.
  - `/caduceus:inspect` — dump the exact prompt segment about to be
    injected, with line provenance (file + line number).
- **Status bar** in the TUI footer showing the active mode and locale
  (optional, gated by config flag).
- **Theme** — one starter theme `caduceus.json`, sea-blue (`#1B4D7A`)
  accent, distinct from gentle-pi's rose.
- **Tests** for: persona contract, language clause, config store,
  slash-command wiring.

### 3.2 Explicitly out of scope (deferred to v0.2+)
- ❌ Native review tooling (rejected; belongs to `gentle-pi`)
- ❌ SDD/OpenSpec flow (rejected; belongs to `gentle-pi`)
- ❌ Subagent chains / phase agents (rejected)
- ❌ Delivery skills (branch-pr, chained-pr, comment-writer, etc.)
  — these are `gentle-pi`'s and would create overlap
- ❌ Postinstall hooks or native binary download
- ❌ Third-party runtime dependencies (target: 0 deps)
- ❌ Multilingual UI strings (English-only UI in v0.1.0)

### 3.3 Why this scope
- Fastest path to a real, publishable, named, recognizable artifact.
- Zero native-binary risk → no `gentle-ai` runtime, no signed archives, no
  Go toolchain pain.
- Fills an empty quadrant of the pi ecosystem: **persona-as-contract**.
- Composable: future `caduceus-review`, `caduceus-sdd` can layer on top.

---

## 4. Design DNA — Three Principles

### DNA-1 · Shell vs Meat
- **Shell** = persona contract + language clauses + tool whitelist.
  **Not hot-mutable.** Change mode via command, not by editing
  AGENTS.md mid-session.
- **Meat** = project-level `.caduceusrc`, skills, AGENTS.md, custom
  prompts. **Fully user-controlled.**
- Mental model: lobster — the shell defines posture, but the meat is
  what the user actually eats. Shell dies, meat goes bad. The shell
  outlives the meat and outlives the session.

### DNA-2 · Persona is a Contract, Not a Costume
- A "persona" in this package is a **deterministic prompt
  transformation function** with documented inputs and outputs.
- `caduceus inspect` must produce a **provable, line-citable** prompt
  segment. No mystery. No vibes.
- Anti-pattern explicitly rejected: "Just tell the model to act like X."
  Every persona directive in caduceus must be a testable, falsifiable
  statement of behavior.

### DNA-3 · Light by Default, Compose Later
- v0.1.0 ships one thing and ships it well.
- Future expansion is by **separate packages** (`caduceus-review`,
  `caduceus-sdd`, etc.), not by growing the core.
- Pi's own minimalism philosophy inherited: do less, do it testable,
  let users opt in to more.

---

## 5. Architecture (MVP-A)

```
caduceus/
├── package.json              # pi manifest, keywords, 0 runtime deps
├── README.md                 # positioning + install + screenshot
├── LICENSE                   # MIT
│
├── extensions/
│   └── caduceus.ts           # entry: registers hook + slash commands
│
├── lib/
│   ├── persona-contract.ts   # core: pure function (mode, locale) → prompt
│   ├── language-clause.ts    # language clause selection
│   ├── locale-detect.ts      # detect from input / env / config
│   ├── config-store.ts       # read/write ~/.pi/agent/caduceus.json + .caduceusrc
│   ├── slash-commands.ts     # /caduceus:* command registry
│   ├── status-bar.ts         # TUI footer (uses pi-tui peer)
│   └── version.ts            # exported const CADUCEUS_VERSION
│
├── prompts/
│   ├── gentleman.md          # full persona segment (gentleman mode)
│   └── neutral.md            # full persona segment (neutral mode)
│
├── themes/
│   └── caduceus.json         # sea-blue starter theme
│
├── tests/
│   ├── persona-contract.test.ts
│   ├── language-clause.test.ts
│   ├── locale-detect.test.ts
│   ├── config-store.test.ts
│   └── slash-commands.test.ts
│
└── scripts/
    └── verify-package.mjs    # pre-publish file integrity check
```

### 5.1 Module contracts (locked)
- `persona-contract.ts` is **pure**: no I/O, no side effects,
  no global state. Given `(mode, locale)`, returns the assembled
  prompt segment string. Easy to unit test, easy to inspect.
- `language-clause.ts` is **single-responsibility**: locale in,
  clause out. No persona logic.
- `config-store.ts` is the **only** file that touches the
  filesystem for config. Singleton by design.
- `caduceus.ts` is the **only** file that registers pi hooks.
  All side effects on pi's runtime funnel through here.

### 5.2 Configuration schema
```ts
type CaduceusConfig = {
  mode: "gentleman" | "neutral" | "auto";
  locale: "auto" | "es-AR" | "es-ES" | "en" | "zh" | string;
  showStatusBar: boolean;
  allowProjectOverride: boolean; // .caduceusrc may override global
};
```

---

## 6. Visual & Brand

| Element | caduceus | gentle-pi (sibling, for contrast) |
|---|---|---|
| Primary color | Sea blue `#1B4D7A` | Rose `#FF69B4` |
| Secondary | Light blue `#7FB3D5` | Grey / off-white |
| Mark | Caduceus staff (winged rod with two snakes) | Rose + text logo |
| Tagline (draft) | *"The contract that shapes the voice."* | (existing tagline) |
| Anti-positioning | *"Persona is a contract, not a costume."* | *"Controlled development harness."* |

Tagline and mark need a designer pass before publish; the color
contrast with gentle-pi is the deliberate brand-separation move.

---

## 7. Reference Sources

This section is the audit trail for the decisions above. Every claim
that came from external research is backed by a URL or a measured
data point from the user's own `gentle-pi` install.

### 7.1 pi.dev/packages — official publishing requirements
- **Pi Packages docs (canonical):** https://pi.dev/docs/latest/packages
  - `pi` manifest required in `package.json`.
  - `keywords` must include `"pi-package"`.
  - Gallery auto-indexes npm packages tagged `pi-package`; no manual
    submission form.
  - Optional `image` and `video` keys for gallery preview cards.
  - Peer deps: list core pi packages under `peerDependencies` with
    empty range; do not bundle them.
- **Catalog (live):** https://pi.dev/packages
  - Confirms gallery is auto-indexed.
  - Existing examples: `pi-hermes-memory`, `pi-powerline-footer`,
    `pi-rtk-optimizer`, `pi-simplify`, `pi-web-access`,
    `@vigolium/piolium`, `@danypops/papyrus`,
    `@dietrichgebert/ponytail`, `bigpowers`, `@braintrust/pi-extension`,
    `@reddb-io/red-skills-dev`, `pi-mcp-adapter`, `@narumitw/pi-plan-mode`.
- **Coding-agent README:** https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md
  - Install command: `pi install npm:<pkg>` or `pi install git:<ref>`.
  - Update / list commands documented.

### 7.2 Ecosystem naming patterns
Confirmed naming styles in the wild (collected 2026-01 from
`https://pi.dev/packages`):
- **Mythological / classical:** `@vigolium/piolium` (vigil + pi + -ium),
  `@danypops/papyrus` (writing surface), `pi-hermes-memory` (Hermes
  as messenger), caduceus (Hermes's staff — sits cleanly above Hermes).
- **Direct functional:** `pi-powerline-footer`, `pi-rtk-optimizer`,
  `pi-simplify`, `pi-web-access`, `pi-mcp-adapter`.
- **Anti-serious / ironic:** `@dietrichgebert/ponytail`, `bigpowers`.
- **Org / vendor prefix:** `@braintrust/pi-extension`,
  `@reddb-io/red-skills-dev`, `@narumitw/pi-plan-mode`.

### 7.3 gentle-pi baseline measurements
Measured against the installed `gentle-pi` package at
`/root/.pi/agent/npm/node_modules/gentle-pi`, version **2.1.2**
(package.json), with `gentle-ai` runtime version **2.2.2** locked
in `.gentle-ai/`.

| Path | Lines | Notes |
|---|---:|---|
| Total project | **71,138** | All `.ts/.js/.mjs/.json/.md/.yaml` excluding `node_modules` and `tests/fixtures` |
| `extensions/gentle-ai.ts` | 6,523 | Single-file giant: persona contract, language injection, SDD routing all live here |
| `extensions/` total (7 files) | 9,505 | Other 6: `codegraph-tools`, `pi-pretty`, `quiet-tools`, `sdd-init`, `skill-registry`, `startup-banner` |
| `lib/` total (31 files) | 14,512 | ~70% is review system (`review-*.ts`, 15+ files), plus `sdd-preflight`, `openspec-deltas`, etc. |
| `skills/` count | 12 | `branch-pr`, `chained-pr`, `cognitive-doc-design`, `comment-writer`, `gentle-ai`, `issue-creation`, `judgment-day`, `release`, `skill-creator`, `skill-improver`, `skill-registry`, `work-unit-commits` |
| `contracts/` | — | `review-integration/v1` + `v2` (legacy coexistence — flagged as "the kind of dead weight caduceus should avoid") |
| `runtime/` | — | Native review CLI: signed archives (Darwin/Linux) + Go source build (Windows) — **this is the heaviest cost in gentle-pi and is explicitly not in caduceus** |
| `tests/` | 3,000+ | Strong coverage; caduceus must not ship with weaker testing than this |
| `postinstall` | yes | Heavy: `scripts/install-gentle-ai.mjs` — caduceus v0.1.0 has **no** postinstall |

### 7.4 gentle-pi key deps (re-evaluation surface for caduceus)
From `gentle-pi/package.json`:
- `@earendil-works/pi-tui` (peer) — **caduceus may need this** for the
  TUI status bar; verify license.
- `@heyhuynhgiabuu/pi-pretty` (runtime, `0.6.14`) — third-party
  cosmetic; **caduceus should NOT depend on this** to keep the
  dependency surface clean and the package self-contained.
- `packageManager: pnpm@11.1.1` — pi packages are conventionally
  pnpm-managed; caduceus should follow.

### 7.5 gentle-pi persona contract — direct excerpts
From `extensions/gentle-ai.ts`:
- Line 262 (gentleman mode): `"- When the user writes Spanish, answer in natural Rioplatense Spanish with voseo."`
- Line 272 (neutral mode): `"- When the user writes Spanish, use neutral/professional Spanish. Do NOT use voseo (vos tenés, vos querés, hacé, andá, etc.) or any regional conjugations."`
- Lines 283–284: ternary that picks the language clause at prompt-build
  time based on the active persona.
- The test files `tests/persona-single-channel.test.ts`,
  `tests/persona-neutral-voseo.test.ts`,
  `tests/artifact-language.test.ts` enforce:
  - `gentleman` prompt contains "natural Rioplatense Spanish with voseo"
  - `neutral` prompt contains "Do NOT use voseo"
  - cross-mode leakage is forbidden
  - these are the **exact invariants caduceus must reproduce and extend**.

---

## 8. Open Questions (to be answered before SDD apply)

These were raised in the discussion but not yet locked. They should
be answered during the SDD explore phase, not deferred past it.

1. **npm name availability.** Run `npm view caduceus` and
   `npm view pi-caduceus` before opening the repo. If `caduceus` is
   taken, fall back to `@<owner>/caduceus` (scope) or to a renomination
   round.
2. **Owner / org.** Is this under the existing `Gentleman-Programming`
   GitHub org, or under a new one? Decision affects GitHub repo
   creation, npm publish auth, and badge text in the README.
3. **Repository name on GitHub.** `caduceus` vs `pi-caduceus` vs
   `@<owner>/caduceus`. Must match the npm name.
4. **License file.** MIT assumed (matches gentle-pi family); confirm
   before publish.
5. **Logo / banner assets.** Who designs the caduceus mark and the
   sea-blue theme preview? Done before `0.1.0` publish or deferred to
   `0.1.1`?
6. **English UI vs i18n.** v0.1.0 ships English-only UI strings — is
   this acceptable for first release, or do we need Spanish/Chinese
   UI from day one?
7. **Status bar default.** Should the TUI status bar be on by
   default, off by default, or opt-in via a slash command?

---

## 9. Next Steps

### 9.1 Now (this session, after this file is saved)
- **Create the project folder** at a path of your choice. Suggested:
  `~/code/caduceus/` (or whatever convention you use).
- **Copy this file** into the new folder as `INIT.md` (or keep as
  `CADUCEUS_INIT.md` and let SDD consume it from there).
- **Re-read** this file end-to-end before opening the next session.

### 9.2 Next session (cold start, after folder exists)
- The orchestrator should **open this file first** in the new project.
- Run the **SDD preflight** (mode, artifact store, PR chaining, review
  budget). Caduceus is small enough that the lightweight defaults
  should be fine; the user picks.
- The orchestrator then runs the standard SDD flow:
  `explore` → `proposal` → `spec` → `tasks` → `apply` → `verify` →
  `publish`. Caduceus being a greenfield project, the **proposal**
  phase is the most important — it is where the architecture in §5
  gets confirmed, modified, or rejected.

### 9.3 First publish
- `npm view caduceus` to confirm name is free.
- `npm publish` (or use the GitHub Actions flow with `NPM_OTP`).
- Verify on https://pi.dev/packages — gallery indexes automatically.
- Add `image` and/or `video` to the `pi` manifest for a better
  gallery card (raw GitHub URLs, stable refs).

### 9.4 Strict TDD posture
- Caduceus is small but its correctness depends on
  testable prompt invariants. **The first test in `tests/` must be
  a failing persona-contract test** (RED), then a passing one
  (GREEN), then a triangulation test (TRIANGULATE), then refactor.
- Mirror the `gentle-pi` test posture:
  `assert.match(prompt, /natural Rioplatense Spanish with voseo/i)`
  for `gentleman` mode and
  `assert.match(prompt, /Do NOT use voseo/i)` for `neutral` mode.
- Add new invariants specific to caduceus:
  - mode switch updates the prompt deterministically,
  - locale override produces the expected clause,
  - `caduceus inspect` output is byte-stable.

---

## 10. Anti-Goals (things caduceus will NOT become)

Locking these in writing so future sessions don't drift:

- ❌ Not a fork of `gentle-pi`. Different name, different repo, different
  scope, different postinstall surface.
- ❌ Not a "lite gentle-pi". Caduceus does one thing (persona contract).
  If you want gentle-pi features, install gentle-pi.
- ❌ Not a native-binary package. No `gentle-ai`, no signed archives,
  no Go toolchain, no postinstall hooks.
- ❌ Not a multi-persona framework. Two modes in v0.1.0. New modes are
  opt-in via config but must each be added with their own test
  suite and their own `inspect` evidence.
- ❌ Not a replacement for the user's AGENTS.md / project skills. The
  shell defines posture; the meat is the user's.

---

## 11. Sign-off

> When the user opens the new project folder and confirms the
> decisions above match their intent, this file is the contract.
> Any change to a locked decision (§1) requires an explicit
> amendment recorded in a new section, not an in-place edit.

# caduceus v0.4.0 — Profiles + Persona Macros

> **Status:** Proposal complete. Awaiting `design` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.4.0`
> **Source contracts:** [`proposal-v0.3.1`](./caduceus-v0.3.1/proposal.md),
> [`design-v0.3.1`](./caduceus-v0.3.1/design.md),
> prior post-v0.1.0 strategic analysis
> **Upstream:** v0.3.1 is live on npm + GitHub

## 1. Intent

Ship **caduceus v0.4.0** — a minor release that makes the
persona system more **contextual** and **portable** across work
contexts. Two features:

1. **Profile system** — save and load whole config sets. Lets
   users switch between work / learning / code-review caduceus
   configurations with one command, instead of editing 3+ fields
   manually.
2. **Persona macros** — `${userName}`, `${projectName}`, `${cwd}`,
   `${date}`, `${os}` are auto-resolved at runtime. Makes personas
   more dynamic (e.g., "Welcome back, ${userName}!" or "You're
   working on ${projectName}.").

Both features are **purely additive** (no breaking changes). The
default config and existing personas continue to work unchanged.

## 2. Why now

| Pressure | Source | v0.4.0 impact |
|---|---|---|
| Users with multiple projects want different caduceus configs | Common UX pattern (similar to pip's requirements files, npm's `.npmrc`, etc.) | Profile system makes switching trivial |
| Personas are static — can't reference user / project / cwd | Observation from v0.3.0 personas using `${mode}` placeholder | Macros make personas contextual |
| v0.3.0 made caduceus its own product; v0.4.0 should make it usable for daily work | Post-v0.3.0 strategic gap | Both features target "daily use" |
| Per-model variants (P2 from v0.2.0 roadmap) need empirical research | Speculative | **Deferred** to v0.5.0+ |
| LLM-generated personas (P2) violate 0 runtime deps | Architectural constraint | **Deferred** to v0.5.0+ (would need a separate "caduceus-gen" optional package) |
| Community gallery (P3) premature | 0 users | **Deferred** to v0.5.0+ |

## 3. Scope (locked)

### 3.1 In scope for v0.4.0

- **Profile system**:
  - Storage: `~/.pi/agent/caduceus/profiles/<name>.json` (global)
  - Storage: `./caduceus/profiles/<name>.json` (project)
  - Precedence: project > global > built-in (no built-in profiles; only user-created)
  - `/caduceus:profile list` — show all available profiles
  - `/caduceus:profile save <name>` — save current config as a profile
  - `/caduceus:profile load <name>` — load a profile (updates the running config and writes to `~/.pi/agent/caduceus.json`)
  - `/caduceus:profile delete <name>` — delete a profile
  - `/caduceus:profile show <name>` — show a profile's contents
  - Profile schema: a subset of `CaduceusConfig` (the same fields)
  - When loaded, the active persona is re-loaded from disk (existing v0.1.1 behavior)
- **Persona macros**:
  - `${userName}` → `process.env.USER ?? process.env.USERNAME ?? "user"`
  - `${projectName}` → basename of `process.cwd()`
  - `${cwd}` → `process.cwd()` (the full path)
  - `${date}` → today's date in ISO format (`YYYY-MM-DD`)
  - `${os}` → `process.platform` (`linux` / `darwin` / `win32` / etc.)
  - Resolution happens at the extension entry's `before_agent_start`
  - Built-in personas gain 0-1 macro references (max); user personas
    can use as many as they want
  - The lint check `MODE_PLACEHOLDER` is renamed to `PLACEHOLDER` and
    now requires `${mode}` to be present AND only allows the
    documented `${...}` placeholders (others trigger a warning)
- **Test coverage** for both features (strict TDD, RED first)
- **Documentation updates**: README "Profiles" + "Persona macros" sections, CHANGELOG entry

### 3.2 Explicitly out of scope (deferred to v0.5.0+)

- ❌ Per-model variants (`prompts/gentleman.claude.md`) — needs
  empirical research; no data to justify the work
- ❌ LLM-generated personas (real `/caduceus:generate` with LLM) —
  violates 0 runtime deps; would need a separate `caduceus-gen`
  optional package
- ❌ Community gallery (`npx caduceus add <name>`) — 0 users; premature
- ❌ Persona effectiveness measurement — needs >100 downloads/month
- ❌ Web playground for persona preview
- ❌ Dark/light dual themes

### 3.3 Backward compatibility

- Default config and existing 10 personas work unchanged
- All 156 v0.3.1 tests pass unchanged
- The new lint check (`PLACEHOLDER`) is additive: it only
  validates that no UNKNOWN placeholders are used. Unknown
  placeholders trigger a warning (not an error), so existing
  personas that don't use any macro besides `${mode}` continue to
  pass lint cleanly.

## 4. Success criteria (all must be true at archive)

1. `npm test` exits 0; full suite ≥ 175 tests (was 156), 0
   failures.
2. `node scripts/verify-package.mjs` exits 0; 14/14
   pre-publish checks pass.
3. **Profile system**:
   - `/caduceus:profile save work` creates `~/.pi/agent/caduceus/profiles/work.json`
   - `/caduceus:profile load work` updates the running config and
     `~/.pi/agent/caduceus.json`
   - `/caduceus:profile list` shows both global and project profiles
   - `/caduceus:profile delete work` removes the file
   - Project profiles shadow global profiles with the same name
   - Profiles with the same name as a built-in persona name
     (`default`, `plain`, etc.) are rejected with a usage hint
4. **Persona macros**:
   - Built-in personas may use 0-1 macro references (max 1 for
     v0.4.0 to keep the default persona clean)
   - User personas can use any number of macros
   - The `${userName}` macro resolves to the OS user (or
     "user" as fallback)
   - The rendered persona text shows the resolved values (e.g.,
     "You are ${userName}" becomes "You are lyssom")
5. **Backward compat**: a v0.3.1 config and the 10 built-in
   personas continue to work without changes.
6. v0.4.0 is published to npm and listed on pi.dev gallery.

## 5. Open questions for the user (none blocking)

- Q1: Should `/caduceus:profile save` save the **current effective
  config** (after migration, defaults, etc.) or just the **raw
  global config on disk**? — **My recommendation:** save current
  effective config. This way, the user can save a profile after
  exploring interactively, and the saved profile reflects what they
  actually wanted.
- Q2: Should the macro resolution be **silent** (the persona just
  contains the resolved text) or **explicit** (the persona contains
  `${userName}` and the extension substitutes at runtime)? —
  **My recommendation:** explicit substitution at runtime. This is
  the only way per-session data (like cwd) can be referenced. The
  trade-off is that the persona file is not "complete" until
  rendered, but this is consistent with how `${mode}` already works.
- Q3: Should `${cwd}` and `${projectName}` use `process.cwd()` at
  render time, or the `cwd` value from the loaded config? These are
  usually the same, but the config-level `cwd` is the panel's
  session-start value. — **My recommendation:** use `process.cwd()`
  for simplicity; the `cwd` config is for slash-command context
  (which is also `process.cwd()` anyway).

## 6. Marketing plan (non-SDD, separate workstream)

- **Forum post update (D-1)**: short note on v0.4.0 release
  ("caduceus v0.4.0: profiles + persona macros").
- **No new blog post** — v0.4.0 is a feature release, not a
  strategy release. The v0.3.0 brand-independence story is the
  bigger narrative.

## 7. Rollback

v0.4.0 is purely additive. Rolling back to v0.3.1:
1. `pi remove npm:pi-caduceus`
2. `pi install npm:pi-caduceus@0.3.1`
3. Any saved profiles in `~/.pi/agent/caduceus/profiles/` are
   ignored by v0.3.1 (no data loss).
4. Any persona using `${userName}` etc. will render with the
   literal `${userName}` text (since v0.3.1 doesn't substitute
   macros). The persona is still functional; just shows the raw
   placeholder.

## 8. Next phase

`sdd-design` — write
`openspec/changes/caduceus-v0.4.0/design.md` covering:
- Profile file format and storage paths
- Profile slash command handler state machine
- Macro resolution implementation in `before_agent_start`
- Updated lint check (`PLACEHOLDER`)
- File changes (which files to add/modify)
- Test file mapping

Then `sdd-tasks` — 8 implementation tasks. Estimated 500 lines,
over 400 budget; size-exception proposed.

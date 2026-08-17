# Marketing copy for pi-caduceus v0.6.0

> Drop-in copy for HN / Reddit / Discord / X / dev.to.
> All variants are aligned on the same positioning, just tuned per
> channel. Edit lightly before posting.

## Positioning (the one-liner)

> **pi-caduceus** is a pure-TS, 0-deps persona-aware Spec-Driven
> Development lifecycle harness for [pi](https://pi.dev). It does
> the persona + 5-MD-file SDD + 6-state review + 5 static-analysis
> lenses core in ~7 kLOC — without the brand-locked personas, native
> binaries, or AGPL strings that other pi ecosystem packages carry.

## Variants by channel

### Hacker News (Show HN)

**Title**: Show HN: pi-caduceus – 0-deps, MIT persona + SDD + 5 static-analysis lenses for pi

**Body**:

> Hey HN,
>
> I shipped v0.6.0 of [pi-caduceus](https://github.com/lyssom/pi-caduceus)
> — a pure-TS Spec-Driven Development lifecycle harness for the
> [pi](https://pi.dev) coding agent.
>
> What's inside (3-minute skim):
>
> - **10 built-in personas**, all MIT-original. Drop your own .md
>   into `~/.pi/agent/caduceus/personas/`; lint runs on every switch.
> - **5-MD-file SDD lifecycle** (proposal/design/tasks/requirements/constitution)
>   with an RFC 2119 constitution pattern (MUST/SHOULD/MAY +
>   CWE mapping).
> - **6-state review machine** with **content-bound SHA-256 receipts**
>   over the 5 MD artifacts (no crypto signing; we documented why
>   in `docs/RESEARCH.md`).
> - **5 static-analysis lenses** (risk / correctness / security /
>   readability / spec-compliance) with P0–P3 severity and
>   persona-aware routing (security persona runs [security, risk];
>   reviewer runs [readability, spec-compliance]; etc.).
>
> **The interesting part**: 0 runtime deps, 0 native binaries, 0
> postinstall. The whole package is ~116 kB packed, 387 tests run
> with plain `node --test`, no jest/vitest/build step.
>
> I deliberately built it as a **focused middle ground**:
>
> | | LOC | Tarball | License |
> |---|---|---|---|
> | gentle-pi | ~56k | ~7.6 MB | MIT (but brand-locked personas) |
> | dracond | ~28k | ~545 kB | **AGPL-3.0-only** |
> | **pi-caduceus** | **~7k** | **~116 kB** | **MIT** |
>
> Patterns from gentle-pi and dracond are re-implemented in pure TS
> from scratch (the verify-package.mjs script greps the source for
> any banned import).
>
> Roadmap is in `STATUS.md §7`: v0.7.0 = persona-aware subagent
> routing; v0.8.0 = goal loop + triple budget. Detached auditor
> worker (à la dracond) is deferred behind a 20% false-negative
> trigger so it doesn't accidentally license-pollute the codebase.
>
> Would love feedback on the lens design (the "Done when:" contract
> gating by template version marker is the most interesting bit) and
> the overall positioning vs the established pi ecosystem players.

### Reddit (r/AIcoding, r/LocalLLaMA, r/typescript)

**Title**: pi-caduceus v0.6.0 — pure-TS, 0-deps Spec-Driven Development for the pi coding agent (5 lenses, content-bound receipts, MIT)

**Body**:

> I've been building a focused middle-ground alternative to the
> heavier pi ecosystem packages.
>
> **What it is**: a 7 kLOC pure-TS harness that handles persona
> injection, a 5-MD-file Spec-Driven Development lifecycle
> (explore → propose → apply → archive), a 6-state review machine
> with SHA-256 content-bound receipts, and 5 static-analysis lenses
> (risk / correctness / security / readability / spec-compliance)
> with P0–P3 severity.
>
> **What it isn't**:
> - ❌ 0 runtime deps (verified by `scripts/verify-package.mjs`)
> - ❌ 0 native binaries
> - ❌ 0 postinstall
> - ❌ Not a fork of any other pi package (greps for forbidden imports)
> - ❌ Not AGPL-3.0 (intentional; dracond is)
>
> **Numbers**:
> - 387 tests, plain `node --test`
> - 17 pre-publish verify checks
> - ~116 kB packed, ~557 kB unpacked
>
> **Most interesting design choice**: the `correctness` lens
> detects missing `**Done when:**` contract lines in `tasks.md` —
> but ONLY on changes whose `tasks.md` carries the v0.6.0 template
> marker. v0.5.0-archived changes are exempt (no false positives).
> This means you can introduce new lens rules via a template bump
> without breaking history.
>
> GitHub: https://github.com/lyssom/pi-caduceus
> npm: `npm install pi-caduceus` (or `pi install npm:pi-caduceus`)
>
> Roadmap: v0.7.0 = subagents, v0.8.0 = goal loop + budget.
>
> Open to feedback on lens design and the whole "focused
> middle-ground" positioning.

### Discord (pi.dev Discord, programming channels)

**Channel-appropriate copy**:

> 📣 **pi-caduceus v0.6.0 shipped** — 5 static-analysis lenses
> (P0–P3) wired into the review state machine, content-bound
> receipts now carry per-lens findings, `resetReview` is real,
> `finalizeReview` is async. 0 deps / 0 native / 0 postinstall.
> 387 tests.
>
> `pi install npm:pi-caduceus`
>
> Roadmap → v0.7.0 subagents, v0.8.0 goal loop + budget.
> https://github.com/lyssom/pi-caduceus

### X / Twitter thread (7 posts)

**1/7** (hook):
> Shipped pi-caduceus v0.6.0 — a pure-TS, 0-deps persona + SDD + 5
> static-analysis lens harness for the pi coding agent.
> 7 kLOC, 387 tests, ~116 kB packed. MIT.
>
> pi install npm:pi-caduceus
> github.com/lyssom/pi-caduceus

**2/7** (problem):
> Other pi ecosystem packages are either 56 kLOC with native
> binaries (gentle-pi) or 28 kLOC under AGPL-3.0 (dracond). Both
> require trust tradeoffs. caduceus is the focused middle ground:
> 7 kLOC of pure TS that does the persona + SDD + review + lens
> core well, bridges to nothing.

**3/7** (what's new in v0.6.0):
> v0.6.0 ships:
> - 5 lenses (risk / correctness / security / readability / spec-compliance)
> - P0/P1/P2/P3 severity tiers
> - Persona-aware routing (security → [security, risk], etc.)
> - Receipt format extended: `lensRuns: LensRunDetail[]` with
>   per-lens findings
> - `resetReview` real impl (was a v0.5.0 stub)

**4/7** (the interesting design choice):
> The `correctness` lens detects missing "Done when:" contract
> lines in tasks.md — but ONLY on changes whose tasks.md carries
> the v0.6.0 template marker. v0.5.0-archived changes exempt.
>
> Means you can ship new lens rules via a template version bump
> without false-positiving on history.

**5/7** (architecture):
> DNA-3 split:
> - extensions/caduceus.ts — SHELL (the only file that imports from pi)
> - lib/ — MEAT (pure-TS modules, 24 of them)
>
> All 387 tests run with plain `node --test`. No jest, no vitest,
> no build step.

**6/7** (roadmap):
> What's next:
> - v0.7.0: persona-aware subagent orchestration
> - v0.8.0: triple-budget goal loop
> - detached auditor worker (dracond-style): deferred behind 20%
>   false-negative trigger + AGPL-3.0 isolation

**7/7** (CTA):
> Try it:
> `pi install npm:pi-caduceus`
>
> GH: github.com/lyssom/pi-caduceus
> Docs: docs/RESEARCH.md (full ecosystem alignment) + STATUS.md
> (state of the project)
>
> Star ⭐ if it resonates. Issue 📋 if it doesn't.

### dev.to / personal blog (longer-form)

**Title**: Why I built a 7 kLOC Spec-Driven Development harness for the pi coding agent

**Outline**:

1. **Why pi-caduceus exists** — the persona/SDD ecosystem has
   "heavyweight" (gentle-pi, dracond) and "feature-thin" options
   but no focused middle ground
2. **DNA-3: light at the core** — 0 deps, 0 native, 0 postinstall;
   shell vs meat split; pure-TS modules are independently testable
3. **The lens framework** — 5 named slots, persona-aware routing,
   P0–P3 severity; the trickiest design was gating new lens rules
   by template version marker (CON-008 / REQ-020)
4. **Receipts that don't lie** — content-bound SHA-256 over the 5
   MD files; no crypto signing, but documented why in RESEARCH.md
5. **Brand independence** — the verify-package.mjs script greps
   the source for forbidden imports + content fingerprints of
   dracond, gentle-pi, pi-review, pi-agents
6. **Roadmap** — v0.7.0 subagents, v0.8.0 goal loop + budget
7. **What surprised me** — Node 22 not supporting `(?i)` inline
   regex flags; pure-TS testability; content-bound receipt
   composability
8. **Try it** — `pi install npm:pi-caduceus`

## Tag suggestions

GitHub topics (already set): pi-extension, persona, lens-framework,
spec-driven-development, lifecycle-harness, pi-coding-agent,
pi-package, review-gate, constitutional-ai, typescript, mit-license

Hashtags for X / Mastodon: `#pi` `#pi-dev` `#ai-coding` `#sdd`
`#persona` `#lens-framework` `#typescript` `#mit`

## Where to post first (priority order)

1. **Show HN** — biggest leverage if it makes the front page
2. **pi.dev Discord** (if you have access) — direct audience
3. **r/AIcoding** — niche but relevant
4. **r/typescript** — angle on the pure-TS / 0-deps choice
5. **Your own blog / dev.to** — long-form content for SEO
6. **X thread** — secondary; bigger if HN takes off

## Things to NOT say

- ❌ "Best / fastest / lightest" — superlatives invite skepticism
- ❌ "Drop-in replacement for gentle-pi" — false; caduceus is
  focused but smaller
- ❌ "AGPL-free alternative to dracond" — true but combative;
  leads to licensing debates
- ❌ "AI agent / LLM-powered" — caduceus is **pure static** by
  design; calling it "AI-powered" invites scrutiny
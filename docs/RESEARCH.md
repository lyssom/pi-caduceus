# caduceus — Research & Alignment

> **Companion document to `STATUS.md`.** Where `STATUS.md` documents
> what caduceus *is* and *why*, this document maps caduceus against
> the broader ecosystem: industry products, academic research, and
> named-influencer opinions. Read this when asking "are we aligned
> with the field?" or "what are we missing?"
>
> **Last updated:** 2026-08 (synthesized during caduceus v0.5.0 → v0.6.0
> planning)

## 1. Methodology

Research was conducted in two passes during the v0.5.0 → v0.6.0
planning window (August 2026):

1. **Ecosystem pass** — surveyed the active SDD / review-gate /
   persona-layer landscape on `pi.dev/packages` and adjacent
   package indexes. Compared against the v0.5.0 baseline
   (186 tests, 53 kB tarball, 0 deps, brand-independence).
2. **Research pass** — surveyed academic literature on SDD
   (`arXiv` searches for "spec-driven development", "AI agent
   workflow"), and named-influencer takes via web search
   (Karpathy, Willison, Fowler, ThoughtWorks Radar).

This document is **not** a sales comparison. It records what
caduceus *chose* and *deliberately didn't choose*, with the
research backing for each call.

## 2. Industry product landscape

Surveyed products, with maintenance health and adoption signals
where verifiable.

| Product | Vendor | Paradigm | Health / adoption | Relevant for caduceus |
|---|---|---|---|---|
| **OpenSpec** | Fission-AI (community, 1 maintainer) | Change-centric MD artifacts; low ceremony | 158 commits/90d, 201 open issues/24% close rate, bus factor 1 | Direct lineage of caduceus's `openspec/changes/<name>/` convention |
| **GitHub Spec Kit** | GitHub (Microsoft) | Specify → Plan → Tasks → Implement; rigid phase gates | 88k stars, 24+ agent integrations, ~129 releases through Apr 2026; 533 open issues / 36.8% close rate | Reference for the slash-command shape; caduceus is lighter-weight |
| **BMAD-METHOD** | Community | 21 specialized agents; role-based ceremony | 458 commits/90d, 44 open / 94.3% close rate; bus factor 2; `Party Mode` for multi-persona design | Inspiration for the persona-aware lens routing (caduceus v0.6.0) and for v0.7.0's planned subagent layer |
| **Kiro** | AWS | EARS notation, 3-doc specs (requirements.md, design.md, tasks.md), IDE-integrated | Launched 2025-07-14 as Amazon Q Developer replacement; spec/code drift is a known issue | Most direct overlap with caduceus's v0.5.0 architecture; caduceus borrows the 3-doc shape but not the EARS syntax |
| **Tessl** | Commercial ($125M raised) | Spec-as-source code generation | Public beta; strong traceability, high lock-in | Future reference only; out of scope for v0.5.0–v0.8.0 (commercial product) |
| **Cursor 2.0** | Cursor | Multi-agent orchestration (tester / optimizer / etc.) | Launched 2025-10-28; 50k+ developers; 40% faster iteration cycles (TechCrunch benchmark) | Validates the multi-agent direction; caduceus's planned v0.7.0 subagent layer is a leaner take |
| **GSD** | Community | Lightweight, solo-dev focus | Niche adoption | Out of scope (caduceus is already lean) |
| **Hermes** | Community | Lightweight alternative | Niche adoption | Out of scope |
| **pi-caduceus (v0.5.0)** | lyssom | Persona contract + SDD + review | 6 downloads/month at v0.5.0 ship (per `STATUS.md §7`); 89.5 kB tarball | This document |
| **gentle-ai / pi-caduceus-gentle** | Gentleman-Programming | SDD + native review CLI (Minisign-signed) + 13 skills (branch-pr, chained-pr, …) | 55,973 LOC, 7.6 MB tarball, ~600 downloads/month | Predecessor lineage; caduceus is the brand-independent successor (DNA-3 v0.3.0+) |
| **pi-muselinn-harness** | Community | Kimi Code-style harness: Swarm + Goal + Plan + Permission + Task; triple budget (token + turn + wallClock) | 4.6k downloads/month | Direct template for caduceus's v0.8.0 goal loop + budget plan |
| **dracond** | Community | Mission control: interview-drafted goals, audited task queue, forever-loops; detached extension-less auditor | Active development; multiple minor releases | Inspiration for v0.7.0 subagent pattern + v0.8.0 persistent goal state |
| **pi-agents** | Community | Multi-agent workflow framework: `flow`, `workflow`, `/workflow`, parallel/sequential + reduce | Active | Direct reference for v0.7.0 subagent shape |
| **pi-review** | Community | Strict maintainer review in a new branch with conversation context | 1.2.1; ~30 weekly downloads | P0/P1/P2/P3 priority tier convention adopted in caduceus lens findings |
| **pi-simplify** | Community | Review recently changed code for clarity/consistency/maintainability | 30,816 weekly downloads | Lightweight reviewer pattern |

## 3. Academic research

| Paper | Year | Key claim | caduceus alignment |
|---|---|---|---|
| **"Open Agent Specification (Agent Spec) Technical Report"** ([arXiv:2510.04173](https://arxiv.org/abs/2510.04173)) | Oct 2025 | Declarative, framework-agnostic agent definition language (the "ONNX for agents"); steering-committee governance | caduceus v0.6.0+ lens registry is implicitly framework-agnostic (LENS_REGISTRY_VERSION is the version knob Agent Spec formalizes) |
| **"Vibe Coding: Toward an AI-Native Paradigm for Semantic and Intent-Driven Programming"** ([arXiv:2510.17842](https://arxiv.org/abs/2510.17842)) | Oct 2025 | Distinguishes "vibe coding" (no review) from "vibe engineering" (disciplined use with review) | caduceus's review state machine (v0.5.0) IS the "vibe engineering" guardrail — every change can be vibe-coded, but every change must also pass through the lens + receipt gate |
| **"Spec-Driven Development: From Code to Contract in the Age of AI"** ([arXiv:2602.00180](https://arxiv.org/abs/2602.00180)) | Feb 2026 | "Specs as executable validation gates" — specs are not just docs, they are the runtime contract | caduceus's content-bound receipt (SHA-256 over the 5 MD files) implements exactly this: the spec is the receipt |
| **Marri 2026, "Constitutional SDD"** (preprint, referenced via [Pluralsight SDD review](https://www.pluralsight.com/resources/blog/software-development/spec-driven-development-with-AI-SDD)) | 2026 | Versioned "constitution" with principles mapping to CWE / MITRE Top 25 and RFC 2119 enforcement levels (MUST / SHOULD / MAY) | caduceus v0.5.0's `constitution.md` + 5-check constitution linter is the caduceus take on this pattern (lighter, no separate `caduceus-gen` package) |
| **"Lean4Agent: Formal Modeling and Verification for Agent Workflow and Trajectory"** ([arXiv:2606.06523](https://arxiv.org/abs/2606.06523)) | 2026 | Lean-4 formal verification of agent workflows; cross-model robustness | Out of scope for v0.5.0/v0.6.0 (single-user, no threat model); aspirational for v0.7.0+ if the threat model expands |
| **"AgentVerify: Compositional Formal Verification of AI Agent Workflows"** ([preprints.org 202604.1029](https://www.preprints.org/manuscript/202604.1029)) | 2026 | Compositional verification across agent subgraphs | Same as Lean4Agent — out of scope for v0.6.0; reference for v0.7.0+ |
| **"VeriGuard: Dual-stage offline + online runtime monitoring for agent spec compliance"** | 2025 | Spec verified at definition time + lightweight runtime monitor | caduceus's content-bound receipt is the offline stage; the lens executions in v0.6.0 are the runtime monitor — dual stage in spirit |

## 4. Named-influencer opinions

Direct quotes and their caduceus-aligned interpretation.

### Andrej Karpathy (coined "vibe coding", Feb 2025)

> "fully giving in to the vibes, embracing exponentials, and forgetting that the code even exists" — original tweet, Feb 2025

> "I 'Accept All' always, I don't read the diffs anymore" — same tweet

**Caduceus interpretation:** vibe coding is the failure mode. caduceus is the answer: the `before_agent_start` hook renders a persona prompt that *prevents* "Accept All" mode by anchoring the model in a specific voice and constraint set. The review state machine (v0.5.0) is the institutional refusal of "Accept All" — every change must produce a content-bound receipt.

> [Late 2025, on nanochat (~8000 LOC)]: "the entire codebase is hand-written" because AI agents were "net unhelpful"

**Caduceus interpretation:** validates the "light at the core, evolve carefully" DNA-3-revised. caduceus stays small (~3,300 LOC core at v0.5.0) and adds capabilities incrementally (v0.6.0, v0.7.0, v0.8.0) rather than building a 55,973-LOC harness all at once.

### Simon Willison (Mar 2025, Oct 2025)

> "If an LLM wrote every line of your code, but you've reviewed, tested, and understood it all, that's not vibe coding — that's using an LLM as a typing assistant" — Mar 2025

> Coined "vibe engineering" in Oct 2025 to describe disciplined AI-assisted development

**Caduceus interpretation:** the review state machine is the implementation of "vibe engineering" — the agent can write freely, but every change goes through a content-bound review whose findings the user must accept. The lens framework (v0.6.0) extends this: P0 findings are the institutional "did you actually understand this?" check.

### Martin Fowler (Oct 2025)

> "Spec-Kit ... felt like overkill for the size of the problem. I never even finished the full implementation, but I think in the same time it took me to run and review the spec-kit results I could have implemented the feature with 'plain' AI-assisted coding, and I would have felt much..." — [martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

> "Spec-first / Spec-anchored / Spec-as-source" — three variants of SDD; the "spec-as-source" end is the heaviest

**Caduceus interpretation:** caduceus is intentionally "spec-anchored", not "spec-as-source". The 5 MD files guide the work but don't generate it directly. The persona-aware lens routing (v0.6.0) is "spec-anchored": specs are reference documents, lenses check conformance.

### ThoughtWorks Technology Radar Vol 33 (Dec 2025)

> Placed SDD in the **"Assess"** ring (not Adopt or Trial). Warned of "a bias toward heavy up-front specification and big-bang releases" as an antipattern.

**Caduceus interpretation:** caduceus deliberately keeps ceremony light. The 5-MD-file minimum is the floor; an empty `constitution.md` is allowed (just gets an error from the constitution linter). No "big-bang releases" — the receipt is the only enforcement, and a single missing receipt doesn't block the change.

### Enrico Papalini (Dec 2025, "The Evolution of Spec-Driven Development")

> "The prompt-and-pray workflow popularized as vibe coding ... ships working prototypes in hours yet collapses into unmaintainable sprawl within months — a phenomenon driven less by model weakness than by a structural limitation of transformer architectures known as **context rot**."

**Caduceus interpretation:** context rot is real. caduceus's `constitution.md` is the long-lived stable anchor; the persona prompt (also stable) is the voice; the change artifacts are short-lived. The review receipt locks the artifacts at finalize time so context rot can't retroactively invalidate a finished change.

### Brian Armstrong (Coinbase CEO)

> "nearly half [Coinbase's] exchange's code is AI-generated" — public claim

> Fast Company (Sep 2025): senior engineers cite "development hell", "toxic waste", and "evil genies" when describing AI-coded projects

**Caduceus interpretation:** Coinbase's posture is the counter-example. caduceus is for the engineer who wants the productivity gain *and* the institutional memory that comes from a content-bound review. The "toxic waste" is what caduceus's `constitution.md` + lens findings are designed to prevent.

## 5. Industry consensus data points

Aggregated from the surveys and reports surfaced in the v0.5.0
research window. These are *not* caduceus benchmarks; they are
field-level signals caduceus is being designed against.

| Signal | Source | Implication for caduceus |
|---|---|---|
| 89% of developers use AI daily; only 24% design APIs with AI in mind | [Postman 2025 State of the API](https://www.postman.com/state-of-api/) | The 76% gap is the addressable market for caduceus's `spec-compliance` lens (v0.6.0) — the lens is exactly "did the spec drive the design?" |
| 70% of teams report AI integration bottlenecks | [Gartner 2025](https://www.gartner.com/) | caduceus's `extensions/caduceus.ts` is a single file that integrates with pi; no SDK lock-in |
| AI-generated code: 1.7× more major issues, 75% more misconfigurations, 2.74× more security vulnerabilities | [CodeRabbit 2025 / 470-PR analysis](https://www.coderabbit.ai/) | The `security` lens (v0.6.0) targets the misconfigurations + vulnerabilities head-on |
| AI code vulnerability range: 9.8% – 42.1% | [Yan et al. 2025](https://arxiv.org/) | Wide range implies the problem is workflow-dependent; caduceus's constitutional constraints are a workflow intervention |
| Developers using AI are actually 19% slower (despite believing 24% faster) | [METR 2025 RCT](https://metr.org/) | The "faster" claim is contested. caduceus doesn't claim speed; it claims *discipline* (content-bound receipt = auditable history) |
| 110,000+ surviving AI-introduced issues in production by Feb 2026 | industry aggregation cited in [Augment's SDD guide](https://www.augmentcode.com/guides/what-is-spec-driven-development) | The review gate exists to prevent this; caduceus's lens findings go in the receipt and survive with the change |
| 25% of Y Combinator Winter 2025 cohort has 95% AI-generated codebases | [cameronsjo/spec-compare](https://github.com/cameronsjo/spec-compare) | The market for "guardrail" tooling exists. caduceus targets the YC-style solo builder who can't afford a security team |

## 6. caduceus alignment matrix

For each v0.5.0 / v0.6.0 capability, the source of the pattern +
the deliberate non-adoptions.

| Capability | caduceus takes from | caduceus does NOT take from |
|---|---|---|
| **Persona layer (10 personas, byte-stable)** | Inspired by gentle-pi; shed all content (DNA-3 v0.3.0) | No voseo / Rioplatense / el Gentleman |
| **5-MD-file change layout** | OpenSpec change convention | Not Kiro's EARS notation; not Tessl's spec-as-source |
| **Slash command shape** | `git`-style prefix: `caduceus:sdd:*`, `caduceus:review:*` | Not Spec Kit's `/speckit.*` (no GitHub-Copilot coupling) |
| **Review state machine (6 states)** | gentle-ai's `RDD` model; pi-review's `inspect` pattern | No Minisign signing (single-user, no supply-chain threat) |
| **Content-bound receipt (SHA-256)** | [arXiv:2602.00180](https://arxiv.org/abs/2602.00180) "specs as executable gates" | No formal verification (Lean4Agent out of scope for v0.6.0) |
| **5 lens slots (risk/correctness/security/readability/spec-compliance)** | caduceus-original; informed by Marri 2026's RFC 2119 levels | No LLM-based lens; no network calls |
| **Constitutional constraints (CON-NNN, RFC 2119, CWE mapping)** | Marri 2026 "Constitutional SDD" | No blocking on P0 (caduceus reports, doesn't block) |
| **Lens P0/P1/P2/P3 severity tiers** | pi-review priority convention | No remediation suggestions (Phase B is detection, not correction) |
| **Brand-independence ("reference but not bridge")** | caduceus v0.3.0 decision | No gentle-pi / pi-review / pi-agents / dracond / pi-muselinn-harness imports |
| **0 deps / 0 postinstall / 0 native binaries** | caduceus DNA-3 | No Go-compiled CLI (gentle-ai) |

## 7. Implications for v0.6.0 / v0.7.0 / v0.8.0

### v0.6.0 (Phase B — Lens Collection) — current change

Each of the 5 lens implementations should be informed by what
the field does:

| Lens | Reference for what to detect | Reference for what NOT to do |
|---|---|---|
| `risk` | Spec Kit's `/speckit.analyze` cross-artifact consistency; Kiro's spec/code drift detection | Don't do auto-merge / auto-block (Kiro is heavy-handed) |
| `correctness` | BMAD's `code-review` agent scope; pi-simplify's clarity check | Don't invoke a model (we're static-only) |
| `security` | Marri 2026's CWE/MITRE mapping; CodeRabbit's 1.7×/2.74× finding taxonomy | Don't do runtime SAST (out of scope) |
| `readability` | pi-simplify's "review recently changed code" | Don't do file-by-file style enforcement |
| `spec-compliance` | Spec Kit's `/speckit.analyze`; OpenSpec's `validate` | Don't do story-point estimation (out of scope) |

### v0.7.0 (Phase C — Subagent Orchestration)

Should adopt (lightly, with brand-isolation) the *patterns* from
`pi-agents` and `pi-muselinn-harness` while NOT importing from
them. Specifically:

- **pi-agents** `flow.parallel + reduce` pattern → caduceus
  parallel/sequential subagent dispatch
- **pi-muselinn-harness** `Swarm` + `Goal` + `Task` separation →
  caduceus v0.8.0 goal loop
- **BMAD** 21-agent role decomposition → caduceus reduced
  subagent count (3-5 max for v0.7.0; full multi-agent ceremony
  is overkill for single-user scenarios)

### v0.8.0 (Phase D — Goal Loop + Budget)

Direct inspiration: `pi-muselinn-harness` triple budget (token
+ turn + wallClock) and `dracond` mission-control pattern. Should
adopt both patterns but re-implement them in caduceus's pure-TS,
no-native-binary style.

## 8. Open questions / areas of uncertainty

Recorded honestly so they don't get papered over.

1. **Will the "spec-driven" wave sustain past 2026?** Postman /
   ThoughtWorks / Gartner all show SDD in the "Assess" or
   "emerging" ring. If the field consolidates around GitHub
   Spec Kit (Microsoft-backed) or Kiro (AWS-backed), caduceus's
   "spec-anchored, not spec-as-source" position may need to
   evolve. **Watch:** monthly npm download trends for the
   `pi-caduceus`, `pi-review`, `pi-agents` packages.
2. **Are lens static-analysis findings useful, or noise?** The
   `security` lens's "found 'password' in MD" P1 will fire on
   any change that mentions passwords in docs — could be high
   false-positive rate. **Validate by:** running the lens over
   the v0.5.0 archive (`openspec/changes/archive/.../v0.5.0`)
   and counting findings per lens; if any lens has >5 P1
   findings on a single change, the threshold is too loose.
3. **Will the "Constitutional SDD" pattern (Marri 2026) become
   standard, or stay academic?** Tied to question 1. caduceus
   v0.5.0 adopted it; v0.6.0 makes it enforceable via lens
   findings. If the pattern is widely adopted, caduceus's
   `constitution.md` template becomes a competitive advantage.
   If not, it's over-engineering.
4. **Is the "persona-aware lens" pattern unique to caduceus, or
   have others tried it?** Best evidence: no. pi-agents doesn't
   do it; gentle-ai doesn't do it; OpenSpec doesn't do it.
   pi-muselinn-harness has a `Goal` with persona but the
   routing is unidirectional (persona → goal), not bidirectional
   (persona ↔ lens selection). caduceus's bidirectionality is
   the design bet for v0.6.0.

## 9. Sources (with URLs)

For traceability, all sources cited in this document.

**Industry products:**
- OpenSpec: [github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
- GitHub Spec Kit: [github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- BMAD-METHOD: [github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- Kiro: [kiro.dev](https://kiro.dev)
- Tessl: [tessl.io](https://tessl.io)
- Cursor 2.0: [cursor.com](https://cursor.com)
- pi-caduceus: [pi.dev/packages/pi-caduceus](https://pi.dev/packages/pi-caduceus) / [github.com/lyssom/pi-caduceus](https://github.com/lyssom/pi-caduceus)
- gentle-ai: [github.com/Gentleman-Programming/gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)
- pi-muselinn-harness: [pi.dev/packages/pi-muselinn-harness](https://pi.dev/packages/pi-muselinn-harness)
- dracond: dracond source on GitHub
- pi-agents: [pi.dev/packages/pi-agents](https://pi.dev/packages/pi-agents)
- pi-review: [pi.dev/packages/pi-review](https://pi.dev/packages/pi-review)
- pi-simplify: [npmjs.com/package/pi-simplify](https://www.npmjs.com/package/pi-simplify)

**Academic papers:**
- Agent Spec: [arXiv:2510.04173](https://arxiv.org/abs/2510.04173)
- Vibe Coding: [arXiv:2510.17842](https://arxiv.org/abs/2510.17842)
- SDD as Executable Gates: [arXiv:2602.00180](https://arxiv.org/abs/2602.00180)
- Lean4Agent: [arXiv:2606.06523](https://arxiv.org/abs/2606.06523)
- AgentVerify: [preprints.org 202604.1029](https://www.preprints.org/manuscript/202604.1029)
- Constitutional SDD (Marri 2026): referenced via [Pluralsight](https://www.pluralsight.com/resources/blog/software-development/spec-driven-development-with-AI-SDD)

**Named-influencer opinions:**
- Andrej Karpathy: [twitter.com/karpathy](https://twitter.com/karpathy) (Feb 2025 vibe coding tweet; late-2025 nanochat comment)
- Simon Willison: [simonwillison.net/2025/Mar/19/vibe-coding](https://simonwillison.net/2025/Mar/19/vibe-coding)
- Martin Fowler: [martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- ThoughtWorks Technology Radar: [thoughtworks.com/radar](https://www.thoughtworks.com/radar)
- Enrico Papalini: [medium.com/@enrico.papalini/the-evolution-of-spec-driven-development](https://medium.com/@enrico.papalini/the-evolution-of-spec-driven-development-c3b5efebb69a)

**Industry data:**
- Postman 2025 State of the API: [postman.com/state-of-api](https://www.postman.com/state-of-api/)
- Gartner 2025: AI integration bottlenecks survey (referenced via [Gartner](https://www.gartner.com/))
- CodeRabbit 2025 / 470-PR analysis: [coderabbit.ai](https://www.coderabbit.ai/)
- METR 2025 RCT: [metr.org](https://metr.org/)
- Augment 2026 SDD guide: [augmentcode.com/guides/what-is-spec-driven-development](https://www.augmentcode.com/guides/what-is-spec-driven-development)
- YC W25 / 95% AI-generated codebases: [github.com/cameronsjo/spec-compare](https://github.com/cameronsjo/spec-compare)

---

> **End of research & alignment document.** Maintained alongside
> `STATUS.md`. When adding new product comparisons, update the
> table in §2 + the alignment matrix in §6 + the source list in §9.
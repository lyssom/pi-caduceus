# Security Policy

## Supported Versions

| Version | Supported           |
|---------|---------------------|
| 0.6.x   | ✅ active           |
| 0.5.x   | ✅ security backports only |
| 0.4.x   | ❌ end of life      |
| < 0.4   | ❌ end of life      |

## Reporting a Vulnerability

**Please do NOT file a public issue** for suspected security
vulnerabilities.

Email **569810240@qq.com** (maintainer: lyssom) with:

- Subject line: `[caduceus-security] <one-line summary>`
- Description: impact, steps to reproduce, affected versions
- Disclosure deadline: 90 days from report (per the pi ecosystem norm)

You will receive an acknowledgment within **3 business days**.
A coordinated disclosure timeline will be negotiated; we aim to
publish a fix within **30 days** for high-severity issues.

## Scope

The pi-caduceus package is **pure TypeScript with 0 runtime
dependencies** (verified by `scripts/verify-package.mjs` check 7).
The supply-chain surface is small:

- `@earendil-works/pi-coding-agent` — peer dep, **optional**; the
  package is `no-op` outside pi's runtime
- `node:fs`, `node:crypto`, `node:path`, `node:os`, `node:child_process`
  — Node.js standard library only

We do **not** ship native binaries. There is no `postinstall` hook.

## Threat Model

caduceus runs **inside** the user's pi session, with the same
trust boundary as pi itself. Concerns:

- **Persona prompt injection** — A maliciously-crafted persona.md
  could include system-prompt override language. Mitigation: the
  persona file is **appended** to pi's existing system prompt (not
  replaced) by default; users can opt into `replace` mode but
  that's an explicit decision.
- **Slash-command handler bugs** — A handler that mishandles user
  input could trigger unintended state transitions. Mitigation: the
  review state machine has explicit `CaduceusReviewError` codes for
  every invalid transition.
- **Filesystem scope** — Lens implementations read the 5 MD
  artifacts under `openspec/changes/<name>/`. They do not write.
  They do not call out to network or process APIs. The
  `scripts/verify-package.mjs` check 16 enforces this.

## Best Practices for Users

1. **Review personas before installing them.** `caduceus:lint` is
   cheap; run it on any persona file you drop into
   `~/.pi/agent/caduceus/personas/`.
2. **Keep receipts.** caduceus content-bound receipts (SHA-256 over
   the 5 MD files) are your audit trail. Archive them with your
   change.
3. **Use `append` mode by default.** `replace` mode is for
   advanced/experimental personas; `append` keeps pi's built-in
   safety rails intact.
4. **Pin versions in CI.** `pi install npm:pi-caduceus@0.6.2` not
   `latest`.
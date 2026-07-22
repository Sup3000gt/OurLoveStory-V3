# Phase 3A Dependency Audit

Audit date: 2026-07-22

Commands run:

- `npm.cmd audit --omit=dev`: passed with 0 vulnerabilities.
- `npm.cmd audit`: 4 high severity findings.
- `npm.cmd outdated`: snapshot recorded below; dependencies were not changed.

## High findings

All four findings are the same transitive `sharp <0.35.0` advisory chain:

| CVE | Severity | Chain | Runtime impact | Remediation and risk |
| --- | --- | --- | --- | --- |
| CVE-2026-33327 | high | `@cloudflare/vite-plugin` / `wrangler` → `miniflare` → `sharp` | dev/build tooling only; not in production dependencies | npm only offered `npm audit fix --force`, which changes Miniflare with breaking-change risk; do not apply automatically |
| CVE-2026-33328 | high | same | dev/build tooling only | same; investigate an upstream compatible Miniflare/sharp release before changing the lockfile |
| CVE-2026-35590 | high | same | dev/build tooling only | same |
| CVE-2026-35591 | high | same | dev/build tooling only | same |

The audit output reported a forced fix that would install `miniflare@4.20250508.2`; this is not an approved non-breaking upgrade path for the pinned `miniflare@4.20260714.0`, so no fix was run.

## Outdated snapshot

The following packages had newer versions available. No upgrade was included in Phase 3A: `@clerk/backend`, `@clerk/react`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `@tanstack/react-query`, `@types/node`, `@vitejs/plugin-react`, `jsdom`, `lucide-react`, `miniflare`, `react`, `react-dom`, `typescript`, `vite`, `vitest`, and `wrangler`.

## Decision

Production dependency audit is clean. The full-audit findings remain an accepted dev-tooling follow-up requiring a separately tested dependency change; `npm audit fix --force` was not run.

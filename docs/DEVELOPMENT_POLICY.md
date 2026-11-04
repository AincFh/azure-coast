# AZURE COAST — Development and release policy

This repository is an **internal development project**, not a completed game.

## Branches
- `main`: tested integration branch; not a production release.
- `feature/*`: scoped development work; PR review before merge.
- `fix/*`: regressions and correctness fixes.

## Required checks
1. `npm run check`
2. `npm test`
3. `node scripts/release-gate.mjs` (its output must be evaluated; a script exit code alone is not a release approval)
4. Browser E2E, 375/768/1024/1440 responsive screenshots, keyboard/touch and performance checks before any release.
5. Asset provenance and license review before importing third-party assets.

## Release policy
Do not label a build complete or publish a release unless the core gameplay loop, UI, performance, assets, persistence, accessibility and browser checks have documented PASS evidence. Unverified checks remain BLOCKED.

## Security
Never commit API tokens, private keys, production secrets or personally identifying data. Use GitHub Actions secrets when required.

# AZURE COAST — Development agent instructions

## Objective
Build a cohesive, polished, fully playable coastal-city browser game and official website. Do not treat isolated feature additions or green unit tests as a finished product.

## Repository workflow
- Keep `main` as a tested integration branch, not a release designation.
- Prefer small reviewable `feature/*` and `fix/*` branches and focused pull requests.
- Run `npm run check` and `npm test` after source changes.
- Do not mark a release ready while `node scripts/release-gate.mjs` is failing or browser evidence is missing.
- Preserve existing working save data and game controls when changing data schemas or gameplay.

## Source and asset rules
- Never commit secrets, credentials, private user data, generated build archives, or large unreviewed binaries.
- Track third-party model/texture/audio origin, license, attribution and redistribution terms before importing.
- Placeholder art or procedural meshes must be described as such; never report them as shipped high-quality assets.
- Avoid dependency bloat and dead links; keep local setup reproducible.

## Quality bar
- Deliver coherent end-to-end loops: start → play → progress → save → resume.
- Verify desktop and mobile interaction, keyboard and touch access, screen sizes 375/768/1024/1440, loading errors and real WebGL behaviour.
- Assess browser console, visual correctness, framerate and loading behaviour before marking a feature done.
- Tests prove only what they exercise; distinguish PASS, FAIL and BLOCKED explicitly.
- Prioritize real 3D quality and gameplay completeness over additional marketing pages or cosmetic status reports.

## Acceptance
See `MASTER_DEVELOPMENT_BRIEF.md`, `docs/DEVELOPMENT_POLICY.md` and `INTERNAL_RELEASE_GATE.json` for current acceptance criteria. Do not create a public release until all requirements are evidenced and approved.

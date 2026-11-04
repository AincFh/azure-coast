# Phase 6 — CSS layout stabilization

## Changes
- Added `public/layout-fixes.css`, loaded after `styles.css` and `experience.css`, to stabilize site navigation, grid min-width, card overflow, hero typography, footer and mobile controls.
- Added `public/explore-fixes.css`, loaded after `explore.css`, to fix the exploration console's grid overflow, breakpoint transition, map HUD and mobile toolbar spacing.
- Introduced early navigation collapse at 1300px rather than squeezing seven links into the header.
- Adjusted 1350px/850px/580px console layout breakpoints, flexible columns and small-screen map legends.
- Added layout contract tests to verify stylesheets are loaded and responsive rules are present.

## Verification
- Node tests: 22/22 pass.
- JavaScript syntax checks: pass.
- HTTP checks on isolated port 8099: homepage, exploration page, and both CSS assets all returned 200. Port 8080 was occupied by an unrelated uvicorn service, so initial probes there returned 404.
- Attempted actual Chromium mobile screenshot: process timed out after 15 seconds; screenshot was not produced. Thus visual/browser acceptance remains **unverified**.

## Known limits
- These are targeted CSS patches, not a full redesign or visual sign-off.
- The 3D runtime still relies on remotely loaded Three.js and has not passed GPU browser verification.
- No claim of AAA quality or multi-GB assets.

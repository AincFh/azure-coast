# AZURE COAST — Rendering optimization (internal development)

## Implemented
- Road paint (two shapes) is emitted into Three.js `InstancedMesh` batches instead of one Mesh per mark.
- Building facade window geometry (two orientations, four shared materials) is likewise instanced.
- Instance transforms are retained and written to each instance matrix; all existing world positions and colors are preserved.
- Geometry is allocated once per shape/material batch rather than once per facade pane.

## Verification
- `npm test`: 50/50 PASS (includes two new structural regression tests).
- `npm run check`: PASS.
- Actual WebGL frame timing and browser screenshots: NOT VERIFIED.

## Limits
- This is a rendering bottleneck fix, not a complete game or proof of target frame rate.
- Other scene objects still use individual meshes and need profiling/LOD.
- `frustumCulled=false` on these initial batches favors correctness over culling; spatial batching is a follow-up.
- This is an internal build; no product release claim.

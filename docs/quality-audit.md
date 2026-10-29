# VOIDRUN quality project — v0.17.0 baseline

Baseline: `c7494c83de848df9ad71a7a4260db34c49028256`. Preserve the v0.16.0 pinned page, saves, all progression/content, camera modes, and parry rules.

## Evidence and priorities

| Finding | Evidence | Action |
| --- | --- | --- |
| Damage precedes the sword wind-up | `Game.attack` applies damage immediately, then `beginSwordStroke` starts at t=0; `swordSwing` winds up until t=.18 | Anticipate ready poses before an automatic attack; start the actual stroke at contact without delaying/removing damage |
| Defeated targets vanish | `hitEnemy` removes/recycles the visual immediately | Bounded cosmetic corpse/collapse pool, independent of targets and rewards |
| Monsters read as toys up close | Captured third/first-person images; rounded spherical torso/cheeks, broad circular eyes, low material contrast | Rework anatomical contours, brows/jaws/limbs and silhouettes; preserve shared material batches |
| Flat horizon in close views | Scene background is a solid fog color; environment HDR is reflection-only | Procedural sky/horizon and distant silhouettes, no runtime service or unlicensed assets |
| Regions mainly recolor the same scenery | `RegionSystem` tints terrain/grass and adds 48 crystals/rings/cracks; forest has no independent scenery | Fixed regional instanced scenery and surface response, grounded on existing terrain |
| Sound lacks identity and mixing | One oscillator envelope for most events; only mute, no background/effect buses | Original procedural transients, regional soundscape, separate buses, voice/rate limits and cleanup |
| UI text/touch controls are too small | Existing HUD uses 8–10px type; many coarse-pointer controls are 27px high | Consistent readable surfaces/labels, larger coarse-pointer targets and responsive information hierarchy |
| No middle graphics tier | Only low/high exist | Central low/medium/high profiles, bounded effects and environment detail |
| Vertex workload dominates the software render fixture | 160 actors: 174 draw calls, 547,896 triangles; CPU median 6.3ms but RAF median 916.7ms under SwiftShader | Screen-size monster LOD with stable silhouettes, cached geometry and equivalent CPU reference path; measure again |

## Retain

GPU instancing, local licensed PBR/HDR assets, sculpted hero topology, frame-rate-independent gait, parry hit-stop/counter controls, collision-aware camera, all regional gameplay/combos/mutations, inventory comparison, permanent branching upgrades, camp/side-area restoration, and save migration already have useful tests. Improve their presentation and integration rather than replacing the systems.

## Baseline method

Run `BASE_URL=http://127.0.0.1:5183 BENCH_OUTPUT=/workspace/artifacts/voidrun-quality/before node scripts/quality-benchmark.mjs` against an immutable baseline build. Same camera/seed/size is used after the changes. Screenshots cover three camera modes, five regions and mobile. Metrics include 12 warmup frames and 60 sampled RAF frames at a 960×540 backing buffer, high quality, 160 fixed actors; four reset/GC samples check retained resources.

Observed renderer: ANGLE Vulkan **SwiftShader software rasterizer**, not a physical GPU. CPU timing is simulation + render submission; RAF timing includes software rasterization and scheduling. These results cannot establish desktop/mobile hardware FPS. Baseline geometry reset samples: 184/185/185/185, textures 15, post-GC JS heap 30.81/30.84/30.92/30.92 MB. No browser errors. Raw reports and PNGs are under `/workspace/artifacts/voidrun-quality/before/`.

## Delivery sequence

1. Diagnosis and reproducible benchmark.
2. Combat presentation, weapon poses, hit/death and readable magic feedback.
3. Model/material and regional world/lighting improvements.
4. UI, mobile and camera polish.
5. Procedural audio/mix and controls.
6. Screen-size LOD, resource/performance regression checks, comparison images and final report.

Each stage is committed independently. Final measurements, screenshots, tests, tradeoffs and remaining limitations are recorded in [quality-report.md](quality-report.md).

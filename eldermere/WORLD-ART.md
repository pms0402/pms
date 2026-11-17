# 0.7 — A coherent, inhabited valley

This is a graphics and world-composition pass on the existing ELDERMERE game. It adds no separate project, new save namespace or new progression system. Existing 0.6.1 tool slots, right-click/Z tools, left-click interaction, touch movement and fishing-only minigame are retained. The published site is not changed by this draft.

## Art

Thirteen original sheets contain 200 animation/object/terrain cells. `pixel-atlas.js` loads and extracts actual game sprites, with consistent density 2, stable bounds across animation frames, hard alpha and median-cut palettes. Buildings use at most 128 colors, most sprites 96, terrain 64. The high-resolution sources are intentionally rendered onto a discrete pixel grid, not drawn as large illustrations. Old greenhouse/windmill artwork passes through the same palette treatment.

- Player: four directions × four walk poses; attack/work use real body poses plus the existing weapon/tool motion.
- Six villagers: distinct faces, hair, silhouettes and work clothing, four-direction stride poses with dedicated side and rear frames. Their actual movement determines the frame and facing; stationary villagers stop stepping.
- Wolf, slime, bat, guardian and three farm animals: four frames each. Six late-game enemy/boss designs have alternate frames; boss casting uses its attack pose.
- Five ores, coal, stone, blue iron, depleted rubble, stumps, herbs and mushrooms have distinct material shapes.
- Oak, pine, apple tree, shrubs, undergrowth and rocks replace flat primitive silhouettes. All six crops use authored growth-stage sprites.
- Role-specific store, smithy, inn, cottage, warehouse, barn, mine entrance and shed, plus benches, lamps, signs, supports, walls, beds, shelves, counters, chests, work facilities and noticeboards are used in the world.

## World composition

`world-composition.js` is the shared street plan. The existing well and starting plaza remain the centre. Paved approach paths connect the store, smithy, inn and house. A northern residential lane, western home, eastern goods yard/warehouse and southern barn define neighbourhoods. Lamps, planters, seats, supplies, garden fences with explicit gaps and a trough are placed at destinations rather than scattered across the street centre. A prospectors' camp and shale ridge define the highland mining approach.

New roads are visible to terrain and the minimap. Resource trees that blocked new streets are moved to their edges while retaining their IDs. Protected original starter resources remain. Two northern wolf homes are moved back into the woods, away from the new residential fronts. Buildings fade when the player is behind their roof silhouette.

`terrain.js` draws authored material textures into 768-world-unit chunks, each no larger than 1536 pixels. Mirrored supertiles provide variation and continuous seams. Low-resolution material masks blend grass, woodland litter, dirt, paving, farmland, shore, marsh, shale and water. Door approaches use the buildings' own stone steps, not duplicate flat bars. The fields include separate established NPC crops and the player's existing functional plots; irrigation edges and perimeter fencing make them read as farms.

Mining nodes keep their permanent IDs, tier requirements, depletion/respawn timers and saved states. Their positions are now authored irregular mineral clusters instead of a display grid. Mine floors, natural rock walls, roof supports, haulage frames with physical posts, rail sleepers, metal rail highlights and lanterns separate the mine from the village. Deeper layers retain distinct blue pools/lighting. Indoor shelves and work facilities use the same art pipeline; wood, plaster, woven rugs and brick use separate authored material tiles.

## Verification

`npm test` covers saved progression, exact resource conservation, crafting, trade, farming and enemy routing. `test:art` checks actual sprite density/palettes/alpha, directional variation, collision-index agreement, bounded terrain chunks, connected new streets, real mouse mining/depletion and a mobile viewport. It walks through the village, woods, farm and mine. Only the mature crop and deep-mine screenshots use explicitly staged visual fixtures; player money and equipment are not granted for connectivity or basic mining.

The existing `test:controls`, `test:valley`, `test:life`, combat and website checks exercise the retained game. Dynamic-resource navigation in the test helper replans when a harvested tree regrows during a long walk. The isolated weapon fixture uses the clear main street rather than firing through a newly placed public bench.

Screenshots are written to `test-results/visual-*.png`. Original source sheets and their provenance are recorded in `assets/LICENSE.md`. The existing schema v5 is unchanged.

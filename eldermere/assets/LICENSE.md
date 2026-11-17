# Artwork and audio provenance

All game-specific sprites, terrain textures, UI icons, the ELDERMERE emblem and synthesized sound effects were authored for this project in this change. No third-party game art, music, fonts or sprite packs were copied or downloaded.

- Pixel art source: `../src/art.js`, `../src/world.js`.
- Rendered sample atlas: `sprites-preview.png` (generated from the same source).
- Vector brand mark: `emblem.svg`.
- Audio source: Web Audio oscillator synthesis in `../src/main.js`.
- Text uses the browser's available system fonts; no font files are distributed.

These original assets are provided under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/ . They may be used, modified and redistributed without attribution. This notice applies to the assets and audio, not to unrelated files in the parent VOIDRUN project.

Version 0.2 adds original mining veins, tools, furnace/anvil/cookfire sprites, crops,
worker NPCs, furniture, weapon/armor overlays, item icons and work sound synthesis.
Sources: `../src/life-art.js`, `../src/life-world.js`, `../src/main.js`.
The same CC0 asset dedication above applies to these additions.

Version 0.3 portrait atlas: `portraits/characters.png` was generated specifically
for ELDERMERE with OpenAI image generation from original character descriptions.
It contains the player, Rowan, Mira, Bram, Elin, Doran, Sera and the Star Guardian.
It is an original AI-assisted illustration, not a third-party sprite pack or
an extracted image from another game. The original generated file is retained
under `/workspace/generated_images/` in the development environment.

Version 0.3 high-density world sprites were authored in `../src/illustration.js`.
The same CC0 asset dedication applies to the original artwork additions.


## Valley Days original illustration atlases (0.6)

`world/structures.png`, `world/nature.png`, `world/props.png` are original images generated for ELDERMERE during this development session, with alpha transparency. They depict original fantasy buildings, trees, gardens and work facilities; no third-party videogame sprites are included. The game extracts their individual cells with Canvas and retains all original source files. The original generated files also remain under `/workspace/generated_images/`.

## Living World art (0.7)

The following original AI-assisted sheets were generated for ELDERMERE from original descriptions and this project's own reference artwork: `world/hero.png`, `villagers.png`, `villager_motion.png`, `fauna.png`, `rift.png`, `resources.png`, `forest.png`, `architecture.png`, `details.png`, `crops.png`, `terrain.png`, `civic.png`, `interiors.png`. They contain 200 animation, object and terrain cells in total. No third-party game assets were extracted. Source images remain under `/workspace/generated_images/`. The same original-asset dedication applies.

These source images are compiled at runtime by `../src/pixel-atlas.js`: uniform two authored pixels per world unit, per-sheet limited palettes (64 for terrain, 96 for most sprites, 128 for buildings), thresholded alpha and stable animation bounds. This is an image-assisted art pipeline; it does not claim every source pixel was manually painted.

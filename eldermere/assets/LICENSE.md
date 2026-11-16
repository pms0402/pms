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

# Asset provenance

All visual game assets in this directory were created specifically for **Echoes of the Seventh Bell** during this task using OpenAI image generation. No photographs, sprites from the referenced games, downloaded game art, stock packs or third-party music were used. The linked reference articles in the conversation were not imported as game assets.

| File | Source output | Use |
| --- | --- | --- |
| repairman.png | exec-74828ce7-6ba3-4f92-985d-dbdf0e7bbc98.png | Original bell repairman, 8×8 animation sheet |
| remnants.png | exec-7b81e666-e1ad-4be2-a00f-6109578c0b96.png | Three original enemies, 8×6 sheet |
| edran.png | exec-c4c0a47d-05b8-4bfd-964a-2783e100a958.png | Original dedicated Edran boss, 6×4 sheet |
| kingdom.png | exec-067eda07-4b1a-4217-a14d-ffdcbb807ffd.png | Distant kingdom panorama |
| ruins.png | exec-3485f680-a462-40e0-8e79-cdbbf48fa6d3.png | Transparent architectural parallax layer |
| masonry.png | exec-7c9ab9aa-8ffe-47c4-b596-476d225d7886.png | Ground source, first row of the 4×4 environment atlas |
| objects.png | exec-32b94b15-7ba8-4d84-84fb-d6c42eed5966.png | Same original environment sheet with background removed through the image tool |
| bell.svg | Authored in this task | Small original UI emblem |

Original generated outputs are retained in `/workspace/generated_images/`. Runtime code crops the explicit grid, rasterizes animation cells and disables interpolation. It does not use a photographic source or apply a photo-to-pixel effect. Alpha is thresholded for crisp sprite outlines. The source sheets are generated artwork, not represented as a manually hand-pixelled commercial pack.

The score and sound effects are authored in `src/audio.js` using Web Audio oscillators. There are no sampled recordings or external audio assets. Fonts are the player's installed system fonts.

The supplied world, characters and story belong to the user's project. This provenance note identifies the actual source rather than asserting an unrelated third-party asset license or exclusive ownership of generated images.

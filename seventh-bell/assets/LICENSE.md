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
| marie.png | exec-7e031a4a-9543-46bc-8bf4-9f317de1b94f.png | Original Silent Saint, 6×4 animation sheet |
| brag.png | exec-ce773159-c6f0-4115-ab33-c749a29e943c.png | Original Ashen Blacksmith, 6×4 animation sheet |
| cathedral.png | exec-75c6cfa7-d16a-4949-881b-e9de7846987b.png | Original cathedral panorama |
| foundry.png | exec-0ff42c70-4455-4b20-bcab-0e9fce11c52e.png | Original foundry city panorama |
| leonel.png | exec-7c2acedd-d5d7-43c5-a2bc-d721093395f8.png | Original archivist boss, 6×4 animation sheet |
| archive.png | exec-d45d0fc4-e74f-4a25-8174-8ccdc3eb5b6e.png | Original inverted archive panorama |
| archive-objects.png | exec-6356a1a1-c1a9-4c65-a5cc-0820154c2cc6.png | Original library props and floor, 4×2 atlas |
| services.png | exec-75cec696-8307-4451-b4b4-f99c20b019ab.png | Original regional workshop, cart, narrow barrier panel, sealed chest and equipment icons, 4×2 atlas |
| swordplay.png | exec-afd82ea7-8d7f-40af-a410-53cfb4428e92.png | Four eight-frame grounded sword sequences, 8×4 atlas |
| motion-extras.png | exec-0fbec55b-e4a4-475a-b21c-c3978020bf20.png | Air swordplay, braking, flask drinking and invocation, 8×4 atlas |
| echo-blade.png | exec-a4445d38-08a8-4c23-9989-3a23da7efcfc.png | Travelling spectral blade and impact, 4×2 atlas |
| arkein.png | exec-1a4faf34-56e6-4d1e-a047-bfaa768c45a5.png | Dedicated crownless king, 6×4 atlas; image-tool cleanup of exec-39bda410-1bd4-434a-9797-3de407408c90.png |
| palace.png | exec-793bca28-746f-45ea-9fa2-1d57e8d38b8e.png | Original ruined palace panorama |
| traps.png | exec-b3cccea2-4e2b-441f-851e-b993285f5abc.png | Animated spikes, pendulum, crusher, crossbow and royal machinery, 4×3 atlas |
| cut-light1.png | exec-f81b606a-7325-49cb-892d-d3c5ee49e9f4.png | Broad two-handed diagonal forehand with rear-shoulder preparation, 24 adult body drawings in a 6×4 atlas |
| cut-light2.png | exec-ea2f4c83-8bce-4342-97fc-8635f153c89b.png | Fixed side-view rising backhand, 24 adult body drawings in a 6×4 atlas |
| cut-light3.png | exec-bea37259-b327-4e5b-83ba-e0376e845f9f.png | Fixed side-view overhead finisher, 24 adult body drawings in a 6×4 atlas |
| cut-heavy.png | exec-c34bba55-ae95-4d7f-918b-8a39cab914d9.png | Fixed side-view charged overhead cut, 24 adult body drawings in a 6×4 atlas |
| cut-air.png | exec-28fc479a-7c37-4e51-b3b2-e4bbee11f924.png | Fixed side-view airborne broad cut, 24 adult body drawings in a 6×4 atlas |
| cut-thrust.png | exec-d52a0022-c7ac-481f-9575-9cb21d24747e.png | Dedicated elbow-back thrust preparation, long extension and recovery, 24 adult body drawings in a 6×4 atlas |
| cut-plunge.png | exec-1af29740-a3bf-4e34-8bd4-839a2cafdcee.png | Dedicated vertical plunge and landing recovery, 24 adult body drawings in a 6×4 atlas |
| cut-body.png | exec-572cf9d7-8978-4091-917e-1d40abae33a5.png | Original body-only downstroke, rising cut, finishing cut and ready stance, 8×4 atlas |
| steel-blade.png | exec-37f8d1be-46d6-4471-827f-70085738cbc6.png | Original separate steel sword, attached to the registered fist with constant blade length |
| tutor.png | exec-18fde72d-f3e6-4cb6-994b-2c9b4514d781.png | Original bell repair practice automaton, 6×4 animation atlas |
| bell.svg | Authored in this task | Small original UI emblem |

The six 0.9.0 attack sheets were edited with the image tool from the previous original sheets, preserving tall adult proportions and removing perspective turns. Each uses four anticipation, two impact and eighteen recovery drawings. The downward plunge holds its dive drawing until terrain contact. In 0.9.1 the first cut was replaced with a larger two-handed diagonal motion and thrust received its own 24-drawing sheet with a clear elbow-back chamber. Counter uses the first cut; anti-air uses the rising sequence. Steel is registered at length 48; rendered trails and collision use the same rigid rotating samples.

Original generated outputs are retained in `/workspace/generated_images/`. Runtime code crops the explicit grid, rasterizes animation cells and disables interpolation. It does not use a photographic source or apply a photo-to-pixel effect. Alpha is thresholded for crisp sprite outlines. The source sheets are generated artwork, not represented as a manually hand-pixelled commercial pack.

The score and sound effects are authored in `src/audio.js` using Web Audio oscillators. There are no sampled recordings or external audio assets. Fonts are the player's installed system fonts.

The supplied world, characters and story belong to the user's project. This provenance note identifies the actual source rather than asserting an unrelated third-party asset license or exclusive ownership of generated images.

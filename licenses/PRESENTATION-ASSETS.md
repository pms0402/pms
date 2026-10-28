# Sanctum presentation assets

The game serves all of these files locally. It makes no runtime requests to the original asset services.

## Grassy Cobblestone — Poly Haven (CC0)

- Original asset: https://polyhaven.com/a/grassy_cobblestone
- License: https://polyhaven.com/license — Creative Commons CC0 1.0 Universal.
- Retrieved from `pmndrs/drei`, commit `bf6f4addf47467d3885de272d94ca5127f6ef68f`, directory `.storybook/public/textures/grassy_cobble/`.
- Source files: `grassy_cobblestone_diff_2k.jpg`, `grassy_cobblestone_nor_gl_2k.jpg`, `grassy_cobblestone_rough_2k.jpg`, `grassy_cobblestone_ao_2k.jpg`.
- The diffuse texture was reduced to 1024px and lightly multiplied by its ambient occlusion map. The masonry variant was desaturated. The normal and roughness textures were reduced to 512px. All were encoded as WebP.

## Kiara 1 Dawn — HDRI Haven / Poly Haven (CC0)

- Original asset: https://polyhaven.com/a/kiara_1_dawn
- License: Creative Commons CC0 1.0 Universal.
- Retrieved from `pmndrs/drei-assets`, commit `456060a26bbeb8fdf79326f224b6d99b8bcce736`, file `hdri/kiara_1_dawn_1k.hdr`.
- Upstream attribution: https://github.com/pmndrs/drei-assets/blob/456060a26bbeb8fdf79326f224b6d99b8bcce736/README.md
- Reduced to 512 × 256 in Blender 4.3 while retaining floating point radiance, then saved as Radiance HDR.

## Game-authored assets

The soil color / packed normal-roughness maps, cloth, metal micro-normal, contact-shadow and sword-trail maps, ground mist, sculpted scenery and effect shaders were authored for VOIDRUN. They are not extracted from the reference game.

The CC0 legal text is also available locally in [MAKEHUMAN-CC0.txt](MAKEHUMAN-CC0.txt).

## Reproducing the optimized assets

Run `python scripts/bake-sanctum-surfaces.py --source-dir /path/to/upstream-jpgs` with Pillow, NumPy and SciPy installed. The source directory can retain the original file names. For the environment, run `blender -b --python scripts/bake-sanctum-environment.py -- /path/to/kiara_1_dawn_1k.hdr` using Blender 4.3 or later. The normal game build uses the committed output files and requires neither Python nor Blender.

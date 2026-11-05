# VOIDRUN authored silhouettes

`src/assets/sculpted-models.json` is generated from original modeling instructions in
[`scripts/bake-silhouettes.py`](../scripts/bake-silhouettes.py). No third party
monster, armor, weapon or scenery model was downloaded or copied for this update.
The existing anatomical protagonist head remains the MakeHuman CC0 adaptation
documented in [README.md](README.md) and [MAKEHUMAN-CC0.txt](MAKEHUMAN-CC0.txt).
Existing local surface and environment assets keep their existing attribution in
[PRESENTATION-ASSETS.md](PRESENTATION-ASSETS.md).

Reproduce with Blender 4.3 or later:

```sh
blender -b --python scripts/bake-silhouettes.py
```

The ordinary npm build and the game do not require Blender, external model APIs
or an asset CDN. The generated bind meshes are checked into the repository and
included in the standalone HTML.

Organic parts are voxel-unioned, relaxed and decimated offline. Armor and weapons
use authored cross sections and beveled closed contours. The export preserves
surface assignments and the game's existing articulation channels, with authored
attachment pivots for the new six-legged boss. Format 2 stores
little-endian base64 `Int16` positions at 0.0002 units, `Int16` normals at 0.0001,
and `Uint16` triangle indices. Runtime decoding occurs once per bind mesh; instances
share the resulting geometry. No Blender remeshing or procedural sculpting runs
in the browser.

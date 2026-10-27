# Character head topology

`src/assets/knight-head.json` is an adapted, cropped, smoothed and reduced head from the MakeHuman hm08 base mesh. Only the head is included. Armor, hair, clothing, equipment and their animation are created for this game.

- Source: https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj
- License: CC0 1.0 Universal, explicitly stated in the source mesh header (September 2020).
- Original copyright holders: Data Collection AB, Joel Palmius, Jonas Hauquier (2020).
- License text: [MAKEHUMAN-CC0.txt](MAKEHUMAN-CC0.txt).

The head was cropped at the neck, transformed to the game coordinate system, subdivided once, reduced to 28% of that result and supplied with smooth normals and subtle facial vertex colors. It is bundled locally, including in the standalone HTML; gameplay does not contact MakeHuman or GitHub for assets.

To reproduce the asset with Blender 4.3 or later: `blender -b --python scripts/bake-knight-head.py -- /path/to/MakeHuman/base.obj`. The ordinary game build uses the committed JSON and does not require Blender.

# Run with Blender 4.3+: blender -b --python scripts/bake-sanctum-environment.py -- /path/kiara_1_dawn_1k.hdr
import bpy,sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1: raise SystemExit('Pass the upstream HDR file after --')
image=bpy.data.images.load(str(Path(args[0]).resolve()))
image.scale(512,256)
image.file_format='HDR'
image.filepath_raw=str(Path(__file__).resolve().parents[1]/'src/assets/art/dawn-environment.hdr')
image.save()

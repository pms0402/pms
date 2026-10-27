# Offline authoring only; requires Blender 4.3+. See licenses/README.md for the CC0 source.
import bpy, json, math, sys
from pathlib import Path
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1:
 raise SystemExit('Usage: blender -b --python scripts/bake-knight-head.py -- /path/to/MakeHuman/base.obj')
root = Path(__file__).resolve().parents[1]
verts=[]; faces=[]; uv=[]; chosen=[]; group=''
for line in Path(args[0]).read_text().splitlines():
 if line.startswith('v '): verts.append(tuple(map(float,line.split()[1:4])))
 elif line.startswith('vt '): uv.append(tuple(map(float,line.split()[1:3])))
 elif line.startswith('g '): group=line[2:]
 elif line.startswith('f ') and group=='body':
  f=[int(v.split('/')[0])-1 for v in line.split()[1:]]
  if all(verts[i][1]>5.85 and abs(verts[i][0])<1.05 for i in f): chosen.append(f)
indices=sorted({i for f in chosen for i in f}); lookup={i:j for j,i in enumerate(indices)}
points=[(verts[i][0]*.131,(verts[i][1]-7.25)*.132,(verts[i][2]-.60)*.132) for i in indices]
mesh=bpy.data.meshes.new('Anatomical head'); mesh.from_pydata(points,[],[[lookup[i] for i in f] for f in chosen]);mesh.update()
obj=bpy.data.objects.new('head',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
modifier=obj.modifiers.new('Smooth anatomical topology','SUBSURF');modifier.levels=1;bpy.ops.object.modifier_apply(modifier=modifier.name)
modifier=obj.modifiers.new('Game mesh simplification','DECIMATE');modifier.ratio=.28;modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
mesh=obj.data;mesh.calc_loop_triangles()
pos=[]; normals=[]; colors=[]
for v in mesh.vertices:
 x,y,z=v.co; pos.extend(round(n,6) for n in v.co);normals.extend(round(n,6) for n in v.normal)
 lip=math.exp(-((y+.108)/.012)**2-(x/.047)**4)*max(0,min(1,(z-.083)*35))
 cheek=math.exp(-((abs(x)-.055)/.025)**2-((y+.035)/.043)**2)*max(0,min(1,(z-.035)*20))
 shade=1-.12*lip-.025*cheek
 colors.extend([round(shade,4),round(shade-.08*lip-.025*cheek,4),round(shade-.04*lip-.018*cheek,4)])
data={'positions':pos,'normals':normals,'colors':colors,'indices':[i for f in mesh.loop_triangles for i in f.vertices]}
(root / 'src/assets/knight-head.json').write_text(json.dumps(data,separators=(',',':')))
print('HEAD',len(mesh.vertices),'vertices',len(mesh.loop_triangles),'triangles',[(min(v.co[j] for v in mesh.vertices),max(v.co[j] for v in mesh.vertices)) for j in range(3)])

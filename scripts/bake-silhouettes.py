"""Original VOIDRUN meshes. Offline Blender authoring; no downloaded models.
Run: blender -b --python scripts/bake-silhouettes.py
Y is up and +Z is forward, matching the game's animation pivots.
Organic surfaces are voxel-unioned, relaxed and retopologized before export.
Armor/cloth use designed cross sections and closed, beveled outlines.
"""
import bpy, bmesh, math, json, base64, struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ASSETS={}
def select(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
def apply(obj,mod):
    select(obj);bpy.ops.object.modifier_apply(modifier=mod.name)
def ell(c,r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=c)
    o=bpy.context.object;o.scale=r;return o
def join(parts):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    o=parts[0]
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);return o
def organic(parts,voxel=.035):
    o=join(parts);m=o.modifiers.new('Continuous sculpt surface','REMESH');m.mode='VOXEL';m.voxel_size=voxel;apply(o,m)
    m=o.modifiers.new('Relax anatomy','SMOOTH');m.factor=.65;m.iterations=4;apply(o,m)
    m=o.modifiers.new('Retopology','DECIMATE');m.ratio=.27;apply(o,m)
    for f in o.data.polygons:f.use_smooth=True
    return o
def mesh(name,points,faces,smooth=True):
    g=bpy.data.meshes.new(name);g.from_pydata(points,[],faces);g.update();o=bpy.data.objects.new(name,g);bpy.context.collection.objects.link(o)
    bm=bmesh.new();bm.from_mesh(g);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(g);bm.free()
    for f in g.polygons:f.use_smooth=smooth
    return o
def sweep(points,radii,sides=8):
    vs=[];fs=[]
    for j,p in enumerate(points):
        p=Vector(p);t=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
        a=t.cross(Vector((0,0,1)))
        if a.length<.01:a=t.cross(Vector((1,0,0)))
        a.normalize();b=t.cross(a).normalized();r=radii[j] if isinstance(radii,list) else radii
        for k in range(sides):
            q=p+r*(a*math.cos(k*math.tau/sides)+b*math.sin(k*math.tau/sides));vs.append(tuple(q))
    for j in range(len(points)-1):
        for k in range(sides):a=j*sides+k;b=j*sides+(k+1)%sides;fs.append((a,b,b+sides,a+sides))
    fs.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))])
    return mesh('Tapered curved anatomy',vs,fs)
def loft(rows,sides=12,square=.8):
    vs=[];fs=[]
    for y,rx,rz,cx,cz in rows:
        for k in range(sides):
            a=k*math.tau/sides;s=math.sin(a);c=math.cos(a)
            vs.append((cx+math.copysign(abs(s)**square,s)*rx,y,cz+math.copysign(abs(c)**square,c)*rz))
    for j in range(len(rows)-1):
        for k in range(sides):a=j*sides+k;b=j*sides+(k+1)%sides;fs.append((a,a+sides,b+sides,b))
    fs.extend([tuple(range(sides)),tuple(reversed([(len(rows)-1)*sides+k for k in range(sides)]))])
    return mesh('Tailored contour',vs,fs)
def plate(outline,z,depth=.04):
    n=len(outline);vs=[(x,y,z+d) for d in [-depth/2,depth/2] for x,y in outline];fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    fs.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    o=mesh('Forged plate',vs,fs,False);m=o.modifiers.new('Forged edges','BEVEL');m.width=min(.015,depth*.22);m.segments=2;apply(o,m);return o
def cut(o,c,r):
    cutter=ell(c,r);select(cutter);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    m=o.modifiers.new('Carved socket','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=cutter;apply(o,m);bpy.data.objects.remove(cutter,do_unlink=True);return o
def start():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def save(asset):
    buckets={}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        key=(o.get('surface','skin'),o.get('joint',0));buckets.setdefault(key,[]).append(o)
    result=[]
    for (surface,joint),parts in buckets.items():
        o=organic(parts,.022 if joint==1 else .04) if surface=='skin' and len(parts)>1 else join(parts)
        g=o.data;g.calc_loop_triangles();p=[];n=[];idx=[];lookup={}
        for f in g.loop_triangles:
            if f.area<1e-10 or f.normal.length<.5:continue
            for l in f.loops:
                v=g.vertices[g.loops[l].vertex_index];normal=g.corner_normals[l].vector
                if normal.length<.5:normal=f.normal
                co=tuple(round(a*5000) for a in v.co);no=tuple(round(a*10000) for a in normal);key=co+no
                if key not in lookup:lookup[key]=len(p)//3;p.extend(co);n.extend(no)
                idx.append(lookup[key])
        record={'surface':surface,'joint':joint,'p':p,'n':n,'i':idx}
        if asset=='boss_brood' and joint in range(2,8):
            side=-1 if joint%2==0 else 1;k=(joint-2)//2
            record['pivot']=[side*.39,1.0,-.1-k*.22]
        result.append(record)
    ASSETS[asset]=result
    print('BAKED',asset,sum(len(a['i'])//3 for a in result),'triangles',flush=True)
def put(o,surface='skin',joint=0):o['surface']=surface;o['joint']=joint;return o
def flesh(parts,j=0,v=.035):return put(organic([ell(c,r) for c,r in parts],v),'skin',j)
def horn(points,radii,j=1,surface='bone'):return put(sweep(points,radii),surface,j)
def eyes(y,z,x=.12,r=.045):
    for s in [-1,1]:
        socket=put(ell((s*x,y,z),(.065,r*.65,.018)),'dark',1);socket.rotation_euler.z=s*.2
        eye=put(ell((s*x,y,z+.013),(r*.60,r*.24,.012)),'eye',1);eye.rotation_euler.z=s*.2
def claws(hand,s,y,z,j):
    for k in range(3):
        x=hand+s*(k-1)*.045
        horn([(x,y,z),(x+s*.025,y-.1,z+.09),(x+s*.018,y-.2,z+.08)],[.032,.02,.001],j)
def humanoid(bulk=1,brute=False):
    b=bulk
    flesh([((0,.78,-.04),(.30*b,.41,.24*b)),((0,1.02,-.065),(.37*b,.22,.26*b)),((0,.43,0),(.24*b,.20,.21)),((0,1.17,.06),(.16,.20,.16))])
    for s in [-1,1]:
        j=2+(s>0);x=s*.34*b
        flesh([((x,1.01,0),(.20*b,.24,.21)),((s*.50*b,.78,.04),(.15*b,.26,.17)),((s*.56*b,.53,.15),(.16*b,.23,.15)),((s*.57*b,.35,.25),(.14*b,.13,.13))],j)
        claws(s*.57*b,s,.32,.27,j)
        j=4+(s>0)
        flesh([((s*.17*b,.39,-.015),(.13*b,.20,.14)),((s*.21*b,.19,.03),(.095*b,.18,.105)),((s*.22*b,.075,.13),(.14*b,.07,.23))],j,.025)
        for k in [-1,0,1]:horn([(s*.22*b+k*.055,.09,.27),(s*.22*b+k*.06,.055,.37)],[.027,.001],j)
    if brute:
        for s in [-1,1]:
            put(plate([(s*.28,1.22),(s*.47,1.47),(s*.85,1.23),(s*.89,1.04),(s*.50,1.10)],.01,.32),'armor',2+(s>0))
        for k in range(3):put(plate([(-.25,.86-k*.14),(0,.91-k*.14),(.25,.86-k*.14),(.20,.72-k*.14),(-.20,.72-k*.14)],.29,.05),'armor')
def head(y=1.35,z=.13,scale=1,goblin=False):
    q=scale
    anatomy=[((0,y,z),(.24*q,.30*q,.23*q)),((0,y-.15*q,z+.13*q),(.22*q,.12*q,.17*q)),((0,y-.03*q,z+.19*q),(.09*q,.14*q,.10*q))]
    for s in [-1,1]:
        anatomy.extend([((s*.135*q,y+.11*q,z+.19*q),(.12*q,.06*q,.09*q)),((s*.18*q,y-.045*q,z+.12*q),(.105*q,.09*q,.12*q))])
    o=flesh(anatomy,1,.024*q)
    for s in [-1,1]:cut(o,(s*.12*q,y+.035*q,z+.205*q),(.07*q,.04*q,.075*q))
    eyes(y+.035*q,z+.23*q,.12*q,.04*q)
    put(plate([(-.17*q,y-.1*q),(.17*q,y-.1*q),(.13*q,y-.20*q),(-.11*q,y-.22*q)],z+.276*q,.012),'dark',1)
    for s in [-1,1]:
        horn([(s*.13*q,y-.19*q,z+.30*q),(s*.16*q,y-.04*q,z+.34*q)],[.036*q,.001],1)
        if goblin:horn([(s*.20,y+.06,z-.02),(s*.37,y+.10,z-.06),(s*.50,y+.31,z-.06)],[.12,.095,.001],1,'skin')
def quadruped(boar=False):
    b=1.2 if boar else 1
    flesh([((0,.61,-.18),(.31*b,.32*b,.59)),((0,.67,.25),(.35*b,.36*b,.36)),((0,.79,.43),(.24*b,.30,.28))])
    for s in [-1,1]:
        for z,j0 in [(-.43,6),(.35,4)]:
            j=j0+(s>0);x=s*.25*b
            flesh([((x,.47,z),(.12*b,.22,.14)),((x,.25,z+.10),(.075*b,.16,.09)),((x,.11,z+.02),(.065*b,.12,.08)),((x,.065,z+.17),(.12*b,.065,.20))],j,.025)
            for k in [-1,0,1]:horn([(x+k*.04,.065,z+.28),(x+k*.05,.04,z+.36)],[.022,.001],j)
    flesh([((0,.79,.52),(.23*b,.25,.29)),((0,.67,.83),(.16*b,.115,.28)),((0,.55,.83),(.14*b,.065,.22))],1,.023)
    put(ell((0,.67,1.08),(.14*b,.065,.05)),'dark',1);eyes(.83,.75,.16*b,.036)
    for s in [-1,1]:
        horn([(s*.15,.99,.40),(s*.23,1.25,.34),(s*.27,1.31,.25)],[.11,.045,.001],1,'skin')
        if boar:horn([(s*.23,.50,.88),(s*.43,.59,1.0),(s*.46,.85,1.03),(s*.38,.97,1.0)],[.095,.075,.04,.001],1)
        else:
            for k in range(4):horn([(s*.14,.65,.78+k*.055),(s*.12,.50,.79+k*.055)],[.026,.001],1)
    horn([(0,.69,-.62),(.08,.86,-.91),(.24,.89,-1.17),(.30,.71,-1.38)],[.12,.105,.07,.001],8,'skin')
    for k in range(6):
        z=-.55+k*.19;horn([(0,.86,z),(.03,1.03+(5-k)*.035,z-.12),(0,1.10+(5-k)*.035,z-.20)],[.13,.085,.001],0,'armor')

for kind in range(10):
    start()
    if kind in [0,2,4]:
        humanoid(1.45 if kind in [2,4] else 1,kind in [2,4]);head(1.48 if kind in [2,4] else 1.31,.15,1.2 if kind in [2,4] else 1,kind==0)
        if kind==0:
            put(plate([(-.22,.48),(.24,.48),(.18,.02),(.05,.13),(-.16,.03)],.20,.035),'cloth')
            put(plate([(-.32,1.19),(-.49,1.25),(-.65,1.06),(-.56,.9),(-.28,1.02)],.04,.22),'armor',2)
        else:
            for s in [-1,1]:horn([(s*.22,1.65,.10),(s*.40,1.89,.06),(s*.61,2.07,-.13),(s*.66,2.03,-.3)],[.13,.10,.04,.001],1)
        if kind==4:
            for s in [-1,1]:
                horn([(s*.35,1.2,-.07),(s*.86,1.63,-.22),(s*1.15,1.70,-.45)],[.22,.14,.001],2+(s>0),'armor')
            horn([(0,1.77,0),(0,2.20,-.12),(.08,2.52,-.30)],[.16,.10,.001],1)
            put(plate([(-.18,1.13),(0,1.38),(.18,1.13),(0,.93)],.38,.08),'glow')
    elif kind in [1,5]:quadruped(kind==5)
    elif kind in [3,9]:
        put(loft([(.10,.54,.37,0,-.06),(.32,.43,.32,.04,-.03),(.67,.29,.21,0,0),(1.05,.27,.21,0,0),(1.20,.36,.22,0,0)],14,.7),'cloth')
        # Open, angular cowl with a carved face aperture, not a spherical head.
        hood=put(loft([(1.18,.29,.25,0,0),(1.40,.35,.27,0,-.03),(1.61,.23,.22,0,-.08),(1.82,.04,.08,0,-.16)],12,.7),'cloth',1)
        cut(hood,(0,1.39,.26),(.23,.26,.28));head(1.4,.0,.68)
        for s in [-1,1]:
            j=2+(s>0);put(sweep([(s*.27,1.13,0),(s*.47,.95,.19),(s*.53,.78,.27)],[.14,.12,.08]),'cloth',j)
            flesh([((s*.53,.79,.26),(.075,.10,.075))],j,.018);claws(s*.53,s,.79,.27,j)
        horn([(.66,.06,.22),(.64,.80,.22),(.74,1.6,.22),(.58,1.95,.25),(.74,2.12,.25)],[.05,.045,.04,.035,.005],3,'wood')
        put(plate([(.58,2.04),(.68,2.26),(.83,2.21),(.88,2.02),(.70,1.91)],.25,.14),'glow',3)
        if kind==9:
            for s in [-1,1]:horn([(s*.2,1.63,-.06),(s*.40,1.92,-.1),(s*.32,2.17,-.16)],[.08,.06,.001],1)
    elif kind==6:
        flesh([((0,.58,-.2),(.43,.43,.6)),((0,.46,.42),(.23,.21,.28))],0)
        for s in [-1,1]:
            put(loft([(.38,.20,.38,s*.20,-.15),(.64,.25,.54,s*.23,-.15),(.93,.16,.39,s*.17,-.20),(1.03,.02,.19,s*.08,-.19)]),'armor')
            for z,j0 in [(-.4,6),(0,4),(.37,2)]:
                horn([(s*.31,.50,z),(s*.68,.50,z+.07),(s*.83,.24,z+.14),(s*.85,.025,z+.25)],[.075,.065,.04,.005],j0+(s>0),'armor')
            horn([(s*.12,.54,.56),(s*.24,.91,.69),(s*.31,1.02,.86)],[.025,.016,.002],1,'dark')
        eyes(.52,.67,.15,.04);put(ell((0,.90,-.10),(.14,.12,.3)),'glow')
    elif kind==7:
        o=flesh([((0,.5,-.1),(.53,.45,.51)),((-.38,.22,.06),(.27,.23,.33)),((.40,.24,.08),(.29,.26,.34)),((0,.24,.35),(.35,.2,.28))],0,.035)
        cut(o,(0,.48,.40),(.30,.24,.30));put(ell((0,.49,.30),(.24,.20,.14)),'dark')
        for k in range(10):
            a=k*math.tau/10;x=math.sin(a)*.27;y=.48+math.cos(a)*.19
            horn([(x,y,.52),(x*.75,.48+(y-.48)*.7,.60)],[.035,.001],0)
        for s in [-1,1]:put(ell((s*.23,.78,.28),(.08,.06,.05)),'eye')
        horn([(-.4,.3,-.2),(-.70,.20,-.42),(-.82,.13,-.20)],[.16,.09,.005],0,'skin')
    elif kind==8:
        horn([(0,.45,0),(0,.82,-.02),(0,1.22,.02)],[.065,.075,.055],0)
        skull=put(organic([ell((0,1.49,.04),(.23,.28,.20)),ell((0,1.3,.15),(.16,.10,.12))],.024),'bone',1)
        for s in [-1,1]:cut(skull,(s*.09,1.52,.22),(.08,.082,.10));put(ell((s*.09,1.52,.19),(.05,.04,.02)),'eye',1)
        cut(skull,(0,1.35,.23),(.12,.05,.10))
        for s in [-1,1]:
            for k in range(4):horn([(0,1.17-k*.11,.02),(s*.20,1.19-k*.11,.09),(s*.23,1.11-k*.11,.21),(s*.07,1.06-k*.11,.26)],[.03,.027,.02,.013],0)
            j=2+(s>0);horn([(s*.20,1.15,0),(s*.40,.92,.17),(s*.57,1.03,.37)],[.055,.045,.03],j)
            j=4+(s>0);horn([(s*.12,.5,0),(s*.19,.28,-.03),(s*.19,.06,.07),(s*.20,.05,.22)],[.065,.05,.035,.025],j)
        horn([(.65,.50,.29),(.70,.75,.53),(.72,1.15,.63),(.68,1.58,.31)],[.035,.045,.045,.02],3,'wood')
        horn([(.65,.50,.29),(.68,1.58,.31)],[.007,.007],3,'dark')
    save('monster_'+str(kind))

# Forged protagonist armor uses a planned hard silhouette, not lathed cylinders.
for name,rows in {
 'hero_cuirass':[(1.07,.175,.12,0,0),(1.23,.18,.14,0,0),(1.39,.225,.16,0,0),(1.59,.29,.18,0,-.015),(1.73,.28,.14,0,0),(1.84,.14,.10,0,0)],
 'hero_upperarm':[(.01,.085,.085,0,0),(-.11,.095,.085,0,0),(-.22,.070,.070,0,0),(-.32,.056,.060,0,0)],
 'hero_forearm':[(.025,.07,.07,0,0),(-.08,.09,.08,0,0),(-.20,.065,.062,0,0),(-.30,.047,.05,0,0)],
 'hero_thigh':[(0,.105,.10,0,0),(-.12,.115,.105,0,-.01),(-.29,.09,.084,0,0),(-.47,.064,.067,0,0)],
 'hero_shin':[(0,.067,.067,0,0),(-.13,.086,.082,0,-.014),(-.30,.058,.061,0,-.01),(-.53,.044,.052,0,0)],
 'hero_boot':[(.004,.055,.145,0,.065),(.025,.062,.17,0,.07),(.06,.055,.15,0,.05),(.10,.045,.075,0,0),(.14,.041,.055,0,0)],
}.items():
    start();put(loft(rows,16,.65),'armor');save(name)

for name,sections in {
    'weapon_longsword':[(0,.34,0),(.12,.48,0),(.27,.34,0),(.80,.25,0),(.96,.10,0),(1.04,.001,0)],
    'weapon_cleaver':[(0,.42,0),(.13,.80,0),(.26,.61,0),(.36,.67,0),(.79,.60,0),(.99,.18,.12),(1.03,.001,.15)],
    'weapon_saber':[(0,.30,0),(.18,.37,-.03),(.44,.33,.02),(.72,.28,.22),(.93,.17,.43),(1.03,.001,.56)],
}.items():
    start();vs=[];fs=[]
    for z,w,shift in sections:vs.extend([(shift-w,0,z),(shift,.36,z),(shift+w,0,z),(shift,-.22,z)])
    for j in range(len(sections)-1):
        for k in range(4):a=j*4+k;b=j*4+(k+1)%4;fs.append((a,b,b+4,a+4))
    fs.extend([(3,2,1,0),tuple((len(sections)-1)*4+k for k in range(4))])
    put(mesh(name,vs,fs,False),'steel');save(name)

# Each boss has its own full outline and equipment, generated at the base rig scale.
for kind in ['warden','artillery','plague','brood','storm','reaper']:
    start()
    if kind=='brood':
        flesh([((0,.84,-.28),(.66,.55,.76)),((0,1.02,-.65),(.54,.47,.54)),((0,.75,.40),(.39,.3,.36))])
        put(loft([(.64,.53,.57,0,-.42),(1.02,.64,.72,0,-.44),(1.45,.28,.47,0,-.48),(1.62,.03,.15,0,-.42)],12,.7),'armor')
        eyes(.88,.71,.19,.05)
        for s in [-1,1]:
            horn([(s*.19,.72,.63),(s*.41,.61,.90),(s*.36,.54,1.1),(s*.13,.60,1.14)],[.10,.085,.055,.002],1)
            for k in range(2):horn([(s*.16,.68,.73+k*.12),(s*.12,.54,.78+k*.12)],[.05,.002],1)
    elif kind=='reaper':
        put(loft([(.10,.62,.40,0,-.10),(.52,.44,.30,0,-.05),(1.04,.29,.21,0,0),(1.31,.36,.25,0,-.05),(1.45,.20,.20,0,-.05)],14,.65),'cloth')
        cowl=put(loft([(1.25,.32,.27,0,-.02),(1.58,.35,.29,0,-.05),(1.88,.20,.24,0,-.1),(2.10,.02,.06,0,-.17)],12,.6),'cloth',1)
        cut(cowl,(0,1.54,.24),(.26,.31,.28))
        skull=put(organic([ell((0,1.55,.05),(.23,.29,.19)),ell((0,1.34,.16),(.16,.08,.12))],.025),'bone',1)
        for s in [-1,1]:
            cut(skull,(s*.085,1.57,.21),(.065,.06,.09))
            put(ell((s*.085,1.57,.22),(.055,.050,.018)),'dark',1)
            put(ell((s*.085,1.57,.24),(.018,.010,.012)),'eye',1)
            j=2+(s>0)
            put(sweep([(s*.30,1.30,0),(s*.5,1.03,.06),(s*.57,.72,.22)],[.12,.10,.065]),'cloth',j)
            put(organic([ell((s*.57,.70,.23),(.08,.10,.07))],.018),'bone',j);claws(s*.57,s,.69,.27,j)
        cut(skull,(0,1.45,.23),(.03,.055,.08))
        cut(skull,(0,1.37,.25),(.13,.045,.09));put(ell((0,1.37,.24),(.12,.033,.015)),'dark',1)
        for k in range(5):
            x=(k-2)*.04;put(plate([(x-.014,1.39),(x+.014,1.39),(x+.012,1.35),(x-.012,1.35)],.259,.018),'bone',1)
    else:
        humanoid(1.85 if kind=='artillery' else 1.3 if kind=='plague' else 1.55,True)
        head(1.38 if kind=='artillery' else 1.58,.32 if kind=='artillery' else .12,.95 if kind=='artillery' else 1.05)
        if kind=='warden':
            for s in [-1,1]:put(plate([(s*.025,1.98),(s*.20,1.90),(s*.22,1.65),(s*.13,1.55),(s*.11,1.73),(s*.025,1.78)],.35,.08),'armor',1)
        elif kind=='storm':
            put(plate([(0,2.05),(-.19,1.89),(-.12,1.68),(0,1.58),(.12,1.68),(.19,1.89)],.35,.11),'armor',1)
    for s in [-1,1]:
        if kind not in ['brood','reaper']:
            horn([(s*.25,1.72,.02),(s*.48,2.02,-.02),(s*.62,2.27,-.18),(s*.56,2.40,-.32)],[.15,.12,.07,.001],1)
        if kind=='warden':
            for k in range(3):horn([(s*.48,1.22,-.05-k*.1),(s*(.88+k*.08),1.6-k*.06,-.15-k*.1),(s*(1.1+k*.08),1.71-k*.05,-.3-k*.1)],[.18,.09,.001],2+(s>0),'armor')
        elif kind=='artillery':
            # Tapered, ribbed shoulder cannons with open bores.
            cannon=put(loft([(.72,.20,.40,s*.72,.25),(1.04,.24,.48,s*.72,.25),(1.29,.17,.43,s*.72,.25)],10,.6),'armor',2+(s>0))
            cut(cannon,(s*.72,1.06,.70),(.13,.15,.28))
            put(ell((s*.72,1.06,.65),(.105,.105,.02)),'glow',2+(s>0))
            horn([(s*.5,1.1,-.22),(s*.78,1.48,-.31),(s*.92,1.68,-.25)],[.18,.12,.001],2+(s>0),'armor')
        elif kind=='plague':
            flesh([((s*.36,1.13,-.29),(.28,.30,.24)),((s*.18,.82,-.38),(.25,.27,.23))])
            horn([(s*.3,1.4,-.31),(s*.55,1.89,-.42),(s*.42,2.25,-.38)],[.12,.10,.001],0,'wood')
            for k in range(3):horn([(s*.32,1.53+k*.14,-.36),(s*(.65+k*.12),1.8+k*.16,-.3)],[.07,.001],0,'wood')
        elif kind=='brood':
            for k in range(3):horn([(s*.39,1.00,-.1-k*.22),(s*.95,1.20,-.13-k*.2),(s*1.21,.68,-.08-k*.25),(s*1.18,.08,.04-k*.25)],[.14,.11,.065,.001],2+2*k+(s>0),'armor')
        elif kind=='storm':
            # Swept, solid wing plates leave visible gaps between the fingers.
            for k in range(4):put(plate([(s*.35,1.18),(s*(1.1+k*.18),1.3+k*.22),(s*(.84+k*.14),1.0+k*.14),(s*.46,.97)],-.27-k*.06,.08),'armor')
            horn([(s*.16,1.85,-.1),(s*.33,2.26,-.16),(s*.26,2.60,-.21)],[.12,.07,.001],1,'armor')
        elif kind=='reaper':
            put(plate([(s*.15,1.65),(s*.45,1.72),(s*.8,.4),(s*.52,.13),(s*.38,.45),(s*.23,.05)],-.28,.06),'cloth')
    if kind=='reaper':
        horn([(.91,.08,.10),(.91,1.2,.10),(.91,2.50,.10)],[.045,.045,.04],3,'wood')
        put(plate([(.91,2.53),(.61,2.68),(-.08,2.60),(-.68,2.25),(-.28,2.39),(.43,2.43),(.91,2.38)],.1,.06),'bone',3)
    save('boss_'+kind)

start()
parts=[ell((0,2,0),(1.55,1.1,.65))]
for k in range(8):
    a=k*math.tau/8;s=math.sin(a);c=math.cos(a)
    parts.append(sweep([(s*1.1,2+c*.7,0),(s*1.85,2+c*1.1,-.3),(s*2.35,2+c*1.4,-.15),(s*2.55+c*.2,2+c*1.4,.20)],[.29,.21,.12,.005],9))
o=put(organic(parts,.09),'skin');cut(o,(0,2,.59),(.86,.66,.72))
put(ell((0,2,.50),(.75,.58,.18)),'dark');put(ell((0,2,.66),(.45,.46,.13)),'eye');put(ell((0,2,.78),(.10,.37,.025)),'dark')
for k in range(12):
    a=k*math.tau/12;x=math.sin(a)*1.10;y=2+math.cos(a)*.82
    horn([(x,y,.39),(x*1.2,2+(y-2)*1.25,.5),(x*1.35,2+(y-2)*1.45,.25)],[.14,.095,.001],0)
save('hidden_observer')
start();humanoid(2.45,True);head(1.5,.12,1.6)
for s in [-1,1]:
    for k in range(3):horn([(s*.5,1.05,-.15-k*.22),(s*1.22,1.37,-.2-k*.25),(s*1.5,.55,-.1-k*.25),(s*1.52,.03,.2-k*.25)],[.18,.14,.07,.003],0,'armor')
    horn([(s*.28,1.8,-.1),(s*.65,2.25,-.22),(s*.77,2.4,-.52)],[.17,.1,.002],1)
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.scale=(1.5,1.9,1.5)
save('hidden_primordial')

start()
stone=loft([(-.18,.8,.65,0,0),(.05,1.05,.80,-.08,0),(.48,.93,.71,.09,-.08),(.85,.52,.59,.01,-.02),(1.0,.25,.25,.1,0)],8,.55)
for v in stone.data.vertices:
    x,y,z=v.co;v.co.x+=.11*math.sin(y*9+z*4);v.co.z+=.10*math.cos(y*7+x*5)
put(stone,'stone');save('world_rock')
start()
parts=[sweep([(0,-.1,0),(-.25,1.0,.1),(.1,2.4,-.05),(-.2,4,.15),(.2,5.8,-.2)],[.55,.35,.26,.16,.01],10)]
for s in [-1,1]:
    parts.append(sweep([(0,.3,0),(s*.7,.10,.2),(s*1.2,.02,.65)],[.25,.13,.01],8))
    parts.append(sweep([(-.1,2,.1),(s*.9,3,.2),(s*1.8,3.9,-.3),(s*2.3,4.5,-.5)],[.22,.15,.08,.005],8))
    parts.append(sweep([(s*.8,3,.2),(s*1.25,4.3,.7),(s*1.15,5.1,.8)],[.11,.065,.003],8))
    parts.append(sweep([(s*1.4,3.7,-.1),(s*2.2,3.8,.9),(s*2.65,4.1,1.1)],[.08,.05,.003],8))
put(organic(parts,.075),'wood');save('world_tree')
start()
for x,z,h,r in [(0,0,3.4,.57),(.64,.18,2.0,.36),(-.54,-.1,1.4,.31)]:
    o=loft([(0,r,r,x,z),(h*.18,r*.98,r*.95,x,z),(h*.72,r*.82,r*.9,x+.12,z),(h,r*.69,r*.76,x+.05,z-.08)],6,.95)
    for v in o.data.vertices:
        if v.co.y>h*.9:v.co.y+=v.co.x*.26+v.co.z*.19
    put(o,'stone')
save('world_basalt')
start()
for x,z,h,r,lean in [(0,0,3.1,.46,-.15),(.55,.1,1.75,.3,.4),(-.49,-.1,1.45,.26,-.5)]:
    put(loft([(0,r*.8,r*.7,x,z),(h*.3,r,r*.7,x+lean*.3,z),(h*.75,r*.7,r*.65,x+lean,z),(h,r*.02,r*.01,x+lean*.8,z-.14)],5,.8),'ice')
save('world_ice')
start()
for x,h,w in [(0,.85,.64),(.6,.53,.42)]:
    put(sweep([(x,0,0),(x-.06,h*.6,.03),(x,h,0)],[.13,.08,.06],8),'toxin')
    # Ridged, fluted shelf caps have pointed overhangs and recessed undersides.
    put(loft([(h-.08,w*.30,w*.30,x,0),(h,w,w*.72,x,0),(h+.18,w*.82,w*.60,x-.04,0),(h+.3,w*.08,w*.07,x-.08,0)],12,.7),'toxin')
save('world_fungus')
start()
put(loft([(0,.90,.76,0,0),(.25,.83,.69,0,0),(.4,.54,.45,0,0),(.8,.41,.36,0,0),(2.9,.32,.3,0,0),(3.15,.58,.47,0,0),(3.45,.42,.39,0,0)],8,.4),'stone')
for s in [-1,1]:
    put(plate([(s*.28,.3),(s*.70,.3),(s*.66,.8),(s*.37,2.5)],.06,.7),'stone')
    horn([(s*.22,3.35,0),(s*.36,3.8,0),(s*.18,4.25,0)],[.14,.10,.005],0,'stone')
put(plate([(-.18,3.28),(-.36,3.9),(0,4.35),(.36,3.9),(.18,3.28)],.15,.20),'stone')
save('world_ruin')
start()
for s in [-1,1]:
    put(loft([(0,.34,.34,s*1.55,0),(.25,.42,.41,s*1.55,0),(2.45,.25,.3,s*1.55,0),(2.7,.34,.34,s*1.55,0)],6,.65),'stone')
    put(plate([(s*1.8,2.3),(s*1.8,3.0),(s*.7,4.1),(s*.45,3.85),(s*1.30,2.7)],0,.5),'stone')
put(plate([(-.30,3.92),(.12,4.22),(.45,4.01),(.22,3.76)],-.12,.5),'stone')
save('world_voidarch')

for records in ASSETS.values():
    for record in records:
        for key,code in [('p','h'),('n','h'),('i','H')]:
            values=record[key]
            record[key]=base64.b64encode(struct.pack('<'+str(len(values))+code,*values)).decode('ascii')
output={'format':2,'scale':.0002,'normalScale':.0001,'author':'VOIDRUN original Blender silhouette collection','meshes':ASSETS}
dest=ROOT/'src/assets/sculpted-models.json';dest.write_text(json.dumps(output,separators=(',',':')))
print('WROTE',dest,dest.stat().st_size,flush=True)

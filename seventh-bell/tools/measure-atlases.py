# Read-only PNG measurement; writes registration metadata, never image pixels.
from PIL import Image
from pathlib import Path
import json
out={}
root=Path(__file__).resolve().parents[1]
bosses=['edran','marie','brag','leonel','arkein','neris','carillon']
ids=[n+'-motion' for n in bosses]+['foes-'+str(n) for n in range(1,8)]+['edran-unshielded','arkein-uncloaked','journey-objects']+['foes-'+str(n)+'-gait' for n in range(1,8)]+[n+'-gait' for n in bosses+['choirghost','spearman','royalmage','echocopy']]
for id in ids:
 im=Image.open(root/'assets'/f'{id}.png');w,h=im.size;a=im.getchannel('A');px=a.load();ys=[sum(px[x,y]>=150 for x in range(w))>=8 for y in range(h)];bands=[];start=None;last=-100
 for y,on in enumerate(ys):
  if on:
   if start is None:start=y
   elif y-last>8:bands.append((start,last+1));start=y
   last=y
 if start is not None:bands.append((start,last+1))
 expected=12 if id.startswith('foes-') and id.endswith('-gait') else (8 if id in ['edran-gait','arkein-gait'] else 4) if id.endswith('-gait') else 4 if id=='journey-objects' else 6 if id.endswith(('unshielded','uncloaked')) else 9
 assert len(bands)==expected,(id,bands)
 cells=[];maxhalf=0;maxheight=0
 for row,(top,bot) in enumerate(bands):
  top=max(0,top-3);bot=min(h,bot+3);counts=[sum(px[x,y]>=150 for y in range(top,bot)) for x in range(w)];bounds=[0]
  for k in range(1,6):
   center=k*w/6;left=max(bounds[-1]+10,int(center-w/6*.3));right=min(w-1,int(center+w/6*.3));gaps=[];s=None
   for x in range(left,right):
    if counts[x]<=1:
     if s is None:s=x
    elif s is not None:gaps.append((s,x));s=None
   if s is not None:gaps.append((s,right))
   if gaps:
    lo,hi=max(gaps,key=lambda g:(g[1]-g[0])*.8-abs((g[0]+g[1])/2-center)*.2);split=round((lo+hi)/2)
   else:split=min(range(left,right),key=lambda x:counts[x]*5+abs(x-center)*.1)
   bounds.append(split)
  bounds.append(w)
  cols=[]
  for col in range(6):
   lo,hi=bounds[col],bounds[col+1];nonempty=[x for x in range(lo,hi) if counts[x]>=2];sx=max(lo,min(nonempty)-2);ex=min(hi,max(nonempty)+3);center=(col+.5)*w/6;maxhalf=max(maxhalf,center-sx,ex-center);cols.append([sx,top,ex-sx,bot-top,center]);maxheight=max(maxheight,bot-top)
  cells.append(cols)
 # Store a scale measured in destination pixels per original source pixel.
 size=192 if id.endswith(('-motion','unshielded','uncloaked')) or id in [n+'-gait' for n in bosses] else 128;scale=min((size-20)/(2*maxhalf),(size-18)/maxheight)
 out[id]={'scale':scale,'bottom':size-10,'cells':cells}
 print(id,'rows',len(bands),'scale',round(scale,3),'max span',round(maxhalf*2),maxheight)
(root/'src/atlas-layout.js').write_text('// Source atlas row/column gutters measured from opaque pixels, not assumed grid spacing.\nexport const ATLAS_LAYOUT='+json.dumps(out,separators=(',',':'))+';\n')

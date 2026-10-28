# Offline art authoring only; no Python dependency is needed to build or play the game.
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps, ImageChops
import numpy as np
import argparse
parser=argparse.ArgumentParser(description='Bake local sanctum PBR surfaces; requires Pillow, NumPy and SciPy.')
parser.add_argument('--source-dir',type=Path,required=True,help='Directory containing the four upstream grassy_cobblestone JPG maps.')
args=parser.parse_args()
out=Path(__file__).resolve().parents[1]/'src/assets/art'
out.mkdir(parents=True,exist_ok=True)
def source(kind):
 path=args.source_dir/('grassy_cobblestone_'+kind+'_2k.jpg')
 return path if path.exists() else args.source_dir/(kind+'.jpg')
diff=Image.open(source('diff')).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
ao=Image.open(source('ao')).convert('L').resize((1024,1024),Image.Resampling.LANCZOS)
shade=Image.eval(ao,lambda x:round(180+x*75/255)).convert('RGB')
diff=ImageChops.multiply(diff,shade);diff.save(out/'courtyard-color.webp',quality=87,method=6)
ImageEnhance.Color(diff).enhance(.23).save(out/'masonry-color.webp',quality=87,method=6)
Image.open(source('nor_gl')).resize((512,512),Image.Resampling.LANCZOS).save(out/'courtyard-normal.webp',quality=95,method=6)
Image.open(source('rough')).convert('L').resize((512,512),Image.Resampling.LANCZOS).save(out/'courtyard-roughness.webp',quality=91,method=6)
print([(p.name,p.stat().st_size) for p in out.iterdir()])

from pathlib import Path
import numpy as np
from scipy.ndimage import zoom, gaussian_filter
from PIL import Image
n=512;rng=np.random.default_rng(3418)
def field(size):
 a=rng.random((size,size));return zoom(a,n/size,order=2,mode='grid-wrap')[:n,:n]
large=field(12);grain=field(128);fine=field(256)
height=large*.25+grain*.45+fine*.30
z,x=np.mgrid[:n,:n]
for _ in range(240):
 cx,cy=rng.uniform(0,n,2);rx,ry=rng.uniform(1.0,3.0,2);dist=((x-cx)/rx)**2+((z-cy)/ry)**2;height+=np.maximum(0,1-dist)*rng.uniform(.08,.20)
base=np.zeros((n,n,3));noise=(height-.5)*22
for i,c in enumerate([83,77,65]):base[:,:,i]=c+noise
moss=np.clip((field(10)-.5)*2.2,0,1)
base=base*(1-moss[:,:,None]*.25)+np.array([54,66,47])*moss[:,:,None]*.25
Image.fromarray(np.uint8(np.clip(base,0,255))).save(out/'soil-color.webp',quality=88,method=6)
dz,dx=np.gradient(gaussian_filter(height,.55));normal=np.stack([-dx*2.5,np.ones((n,n)),-dz*2.5],axis=-1);normal/=np.linalg.norm(normal,axis=-1)[:,:,None]
# Tangent axes on the ground are X/Z. Pack roughness in alpha.
rgba=np.zeros((n,n,4),dtype=np.uint8);rgba[:,:,0]=np.uint8((normal[:,:,0]*.5+.5)*255);rgba[:,:,1]=np.uint8((normal[:,:,2]*.5+.5)*255);rgba[:,:,2]=np.uint8((normal[:,:,1]*.5+.5)*255);rgba[:,:,3]=np.uint8(205+large*45)
Image.fromarray(rgba).save(out/'soil-surface.webp',lossless=True,method=6)

from PIL import Image,ImageFilter,ImageDraw
import numpy as np
from pathlib import Path
p=Path(__file__).parent
rng=np.random.default_rng(4821);n=768
v=np.zeros((n,n),float)
for size,weight in [(3,.28),(9,.20),(25,.16),(90,.10),(768,.09)]:
 a=Image.fromarray((rng.random((size,size))*255).astype('uint8')).resize((n,n),Image.Resampling.BICUBIC)
 v+=np.asarray(a)/255*weight
v=np.clip(v+.08,0,1)
height=Image.fromarray((v*255).astype('uint8'));d=ImageDraw.Draw(height)
for i in range(12):
 x,y=rng.integers(0,n,2);points=[(int(x),int(y))]
 for j in range(int(rng.integers(3,10))):
  x+=rng.integers(-30,31);y+=rng.integers(6,40);points.append((int(x),int(y)))
 d.line(points,fill=28,width=1)
height=height.filter(ImageFilter.GaussianBlur(.35));height.save(p/'stone-height.png')
a=np.asarray(height)/255
for name,col in [('limestone',(186,182,157)),('slate',(106,133,148))]:
 rgb=np.clip(np.stack([a*.70+.43]*3,axis=2)*np.array(col),0,255).astype('uint8')
 Image.fromarray(rgb).save(p/(name+'.jpg'),quality=92)
# Original tiny ground-cover atlas is procedural; no third-party visual assets.

from PIL import Image,ImageDraw,ImageEnhance,ImageFilter
import numpy as np,math,random,json
from scipy.ndimage import distance_transform_edt, gaussian_filter
from pathlib import Path
from terrain_detail import render_tiles
s=json.load(open('art/sector.json')); W,H=s['width'],s['height']; random.seed(78341); rng=np.random.default_rng(453); U=random.uniform

# Unbroken ground fragments from the original battlefield painting.
atlas=Image.open('art/battlefield.webp').convert('RGB').resize((1500,1000))
patches=[(615,28,1040,315),(505,216,980,573),(830,175,1140,532),(54,46,299,365),(20,740,395,989),(619,736,1120,984),(1237,100,1470,433)]
ground=Image.new('RGB',(W,H),(68,65,56))
for y in range(-300,H,175):
 for x in range(-310,W,185):
  p=atlas.crop(random.choice(patches)).resize((430,390))
  if random.choice([True,False]):p=p.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  m=Image.new('L',p.size); md=ImageDraw.Draw(m); md.rounded_rectangle((21,21,408,368),radius=60,fill=255);m=m.filter(ImageFilter.GaussianBlur(20))
  ground.paste(p,(x+random.randint(-15,15),y+random.randint(-15,15)),m)
ground=ImageEnhance.Brightness(ground).enhance(1.33)
mask=Image.new('L',(W,H)); m=ImageDraw.Draw(mask)
floor=ground.copy(); d=ImageDraw.Draw(floor)
def pts(x,y,a,coords): return [(x+u*math.cos(a)-v*math.sin(a),y+u*math.sin(a)+v*math.cos(a)) for u,v in coords]
def color(c,v):return tuple(round(max(0,min(255,n+v))) for n in c)
def rect(x,y,a,w,h,c):d.polygon(pts(x,y,a,[(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]), fill=c)
def stroke(x,y,a,coords,fill,width): d.line(pts(x,y,a,coords),fill=fill,width=width)
def dot(x,y,rx,ry,c):d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=c)
def board(x,y,a,length,wide):
 c=color((104,90,68),U(-20,21));rect(x,y,a,wide,length,c)
 for j in range(15):
  xx=U(-wide*.45,wide*.45); yy=U(-length*.46,length*.45)
  stroke(x,y,a,[(xx,yy),(xx+U(-1,1),min(length*.47,yy+U(3,36)))],color(c,U(-33,33)),1)
 for yy in [-length*.4,length*.4]:
  px,py=pts(x,y,a,[(0,yy)])[0];dot(px,py,1.3,1.3,(49,46,41))
woodImage=atlas.crop((445,637,1090,700))
plank=np.asarray(woodImage)
def painted_segment(x,y,xx,yy):
 dx,dy=xx-x,yy-y; ln=math.hypot(dx,dy); ca=dx/ln;sa=dy/ln
 left=max(0,int(min(x,xx)-64));top=max(0,int(min(y,yy)-64))
 right=min(W,int(max(x,xx)+65));bottom=min(H,int(max(y,yy)+65))
 gy,gx=np.mgrid[top:bottom,left:right];along=(gx-x)*ca+(gy-y)*sa;across=(gy-y)*ca-(gx-x)*sa
 r=np.hypot(along-np.clip(along,0,ln),across)
 # Edges carry mud, occasional broken ends and shallow tracks.
 edge=48+1.6*np.sin(along*.14)+1.15*np.cos(along*.055)
 weight=np.clip((edge-r)/8,0,1)*.91
 u=(along*.92+random.randrange(600)).astype(int)%plank.shape[1]
 v=np.clip(((across+49)*.63+1.8*np.sin(along*.017)).astype(int),0,plank.shape[0]-1)
 patch=np.asarray(floor.crop((left,top,right,bottom)),dtype=float)
 result=patch*(1-weight[...,None])+np.clip(plank[v,u]*1.37,0,255)*weight[...,None]
 floor.paste(Image.fromarray(result.astype('uint8')),(left,top))
for path in s['paths']:
 path=[tuple(p) for p in path]
 m.line(path,fill=255,width=123,joint='curve')
 for x,y in path:m.ellipse((x-61,y-61,x+61,y+61),fill=255)
 for (x,y),(xx,yy) in zip(path,path[1:]):
  a=math.atan2(yy-y,xx-x);ln=math.hypot(xx-x,yy-y)
  for t in np.arange(0,ln,10):
   bx=x+t*math.cos(a);by=y+t*math.sin(a)
   board(bx,by,a+U(-.018,.018),U(82,94),U(8.6,10))
for path in s['paths']:
 for (x,y),(xx,yy) in zip(path,path[1:]):painted_segment(x,y,xx,yy)
for room in s['rooms']:
 x,y,w,h=[room[k] for k in ('x','y','w','h')];box=(x-w//2,y-h//2,x+w//2,y+h//2)
 m.rounded_rectangle(box,radius=12,fill=255)
 for xx in range(box[0]+5,box[2],10):
  for yy in range(box[1]+18,box[3],37):board(xx,yy,0,35,9)
 # Use the trench floor painting for the weathered rooms.
 rw=box[2]-box[0]-8;rh=box[3]-box[1]-8
 tex=Image.new('RGB',(rw,rh))
 for yy in range(0,rh,48):
  offset=random.randint(0,380)
  strip=woodImage.crop((offset,0,offset+rw,63)).resize((rw,48))
  tex.paste(strip,(0,yy))
 inside=floor.crop((box[0]+4,box[1]+4,box[2]-4,box[3]-4))
 floor.paste(Image.blend(inside,ImageEnhance.Brightness(tex).enhance(1.36),.78),(box[0]+4,box[1]+4))
# Continuous berm tops are painted from the same boundary used by navigation.
area=np.asarray(mask)>0; dist=distance_transform_edt(~area)-distance_transform_edt(area)
r=np.asarray(floor).copy();source=np.asarray(ground); shoulder=np.exp(-((dist-7)/12)**2)
r=np.clip(r+shoulder[:,:,None]*np.array([28,21,11]),0,255).astype('uint8')
floor=Image.fromarray(r);d=ImageDraw.Draw(floor)
candidates=np.column_stack(np.where((dist>=1)&(dist<2.2)));rng.shuffle(candidates); grid=set()
bag_positions=[]
for yy,xx in candidates:
 xx=int(xx);yy=int(yy);gx,gy=xx//11,yy//11
 if (gx,gy) in grid:continue
 grid.add((gx,gy))
 if random.random()<.19:continue
 ny=float(dist[min(H-1,yy+2),xx]-dist[max(0,yy-2),xx]);nx=float(dist[yy,min(W-1,xx+2)]-dist[yy,max(0,xx-2)])
 a=math.atan2(ny,nx)+math.pi/2+U(-.27,.27); offset=U(1,11);x=xx+math.cos(a-math.pi/2)*offset;y=yy+math.sin(a-math.pi/2)*offset
 bag_positions.append((x,y,a))
 outline=[(-9,-3),(-6,-6),(5,-6),(9,-3),(8,4),(4,6),(-5,5),(-9,3)]
 c=color((127,115,86),U(-23,16))
 d.polygon(pts(x,y+2,a,outline),fill=(47,43,35));d.polygon(pts(x,y,a,outline),fill=c)
 stroke(x,y,a,[(-7,-2),(-4,-4),(5,-4)],color(c,23),1);stroke(x,y,a,[(-6,3),(3,4),(6,2)],color(c,-31),1)
 for j in range(13):
  u,v=pts(x,y,a,[(U(-6,6),U(-3,3))])[0];d.point((u,v),fill=color(c,U(-33,26)))
 # Lay weathered burlap fibres and tied seams over the shape.
 tile=atlas.crop((448,619,475,636)).resize((21,15)).convert('RGBA')
 am=Image.new('L',tile.size);ImageDraw.Draw(am).rounded_rectangle((0,1,20,13),radius=4,fill=224)
 tile.putalpha(am.filter(ImageFilter.GaussianBlur(.7)))
 tile=tile.rotate(-math.degrees(a),resample=Image.Resampling.BICUBIC,expand=True)
 floor.paste(tile,(round(x-tile.width/2),round(y-tile.height/2)),tile)
def smear(x,y,rx,ry,wet):
 layer=Image.new('RGBA',(int(rx*2+8),int(ry*2+8)));ld=ImageDraw.Draw(layer)
 for i in range(240):
  a=U(0,math.tau);rr=math.sqrt(random.random());xx=rx+4+math.cos(a)*rx*rr;yy=ry+4+math.sin(a)*ry*rr
  rad=U(2,12)
  ld.ellipse((xx-rad,yy-rad*.55,xx+rad,yy+rad*.55),fill=(*color((66,79,76) if wet else (83,68,53),U(-12,12)),int(150*(1-rr*.45))))
 floor.paste(layer,(round(x-rx-4),round(y-ry-4)),layer)
for i,(x,y,rx,ry) in enumerate(s['water']):
 box=(x-rx-5,y-ry-5,x+rx+5,y+ry+5);before=floor.crop(box)
 smear(x,y,rx,ry,True)
 after=floor.crop(box).convert('RGBA')
 change=np.max(np.abs(np.asarray(before,dtype='int16')-np.asarray(after,dtype='int16')[:,:,:3]),axis=-1)
 after.putalpha(Image.fromarray(np.clip(change*26,0,255).astype('uint8')))
 after.save('dist/pool-'+str(i)+'.webp',quality=91)
 floor.paste(before,box)
for zone in s['mud']:smear(*zone,False)
high=distance_transform_edt(~area)
Image.fromarray(np.clip(high[::2,::2],0,255).astype('uint8')).save('dist/surface-height.png')
for kind,x,y,w,h in s['props']:
 box=(x-w//2,y-h//2,x+w//2,y+h//2);m.rectangle(box,fill=0)
render_tiles(s,floor,dist,bag_positions)
floor.save('dist/sector.webp',quality=92,method=5)
# 2-unit navigation samples encode maximum clearance before touching an obstacle.
clearance=distance_transform_edt(np.asarray(mask)>0)
Image.fromarray(np.clip(clearance[::2,::2],0,255).astype('uint8')).save('dist/clearance.png')

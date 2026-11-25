"""Render the walkable painting at two texels per world unit without changing navigation."""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, map_coordinates

TILE = 450
DENSITY = 2
LANCZOS = Image.Resampling.LANCZOS

def mirrored(v, n):
    return np.abs((v+n-1)%(2*n-2)-(n-1))

def render_tiles(sector, painting, signed_distance, bags):
    materials=Image.open('art/materials.webp').convert('RGB')
    half=materials.width//2
    timber=np.asarray(materials.crop((1,1,half-2,half-2)),dtype=np.float32)
    earth=np.asarray(materials.crop((2,half+3,half-2,2*half-2)),dtype=np.float32)
    detail=earth-gaussian_filter(earth,(3,3,0))
    bag=materials.crop((half+7,round(.052*materials.height),materials.width-9,round(.448*materials.height))).convert('RGBA')
    w,h=bag.size
    alpha=Image.new('L',(w,h))
    shape=[(.025,.23),(.044,.11),(.14,.054),(.33,.04),(.57,.069),(.85,.045),(.94,.13),(.977,.3),(.976,.69),(.962,.86),(.91,.95),(.65,.96),(.42,.94),(.2,.957),(.066,.91),(.033,.75),(.017,.48)]
    ImageDraw.Draw(alpha).polygon([(round(x*w),round(y*h)) for x,y in shape],fill=255)
    bag.putalpha(alpha.filter(ImageFilter.GaussianBlur(1.8)))
    torn=Image.open('dist/details/sacking.webp').convert('RGBA')
    path_segments=[]
    for path in sector['paths']:
        for (x,y),(xx,yy) in zip(path,path[1:]):
            dx,dy=xx-x,yy-y
            length=math.hypot(dx,dy)
            path_segments.append((x,y,xx,yy,length,dx/length,dy/length))
    directory=Path('dist/terrain')
    directory.mkdir(exist_ok=True)
    for row in range(math.ceil(sector['height']/TILE)):
        for col in range(math.ceil(sector['width']/TILE)):
            left,top=col*TILE,row*TILE
            size=TILE*DENSITY
            xx=(left+np.arange(size,dtype=np.float32)/DENSITY)[None,:]
            yy=(top+np.arange(size,dtype=np.float32)/DENSITY)[:,None]
            rgb=np.asarray(painting.crop((left,top,left+TILE,top+TILE)).resize((size,size),LANCZOS),dtype=np.float32).copy()
            distance=signed_distance[yy.astype('int32'),xx.astype('int32')]
            u=mirrored(xx*2.6+13*np.sin(yy*.007),earth.shape[1]).astype('int32')
            v=mirrored(yy*2.6+11*np.sin(xx*.009),earth.shape[0]).astype('int32')
            soil=np.clip((distance+4)/9,0,1)[:,:,None]
            # Larger clods come from the painted map; the inset material supplies their fine edges and grit.
            rgb=rgb*(1-soil*.24)+soil*(earth[v,u]*.26+detail[v,u]*.95)
            def wood(u,v,opacity):
                nonlocal rgb
                u=mirrored(u,timber.shape[1]);v=mirrored(v,timber.shape[0])
                u,v=np.broadcast_arrays(u,v)
                coords=np.stack([v,u])
                values=np.stack([map_coordinates(timber[:,:,c],coords,order=1,prefilter=False) for c in range(3)],axis=2)
                rgb=rgb*(1-opacity[:,:,None])+values*opacity[:,:,None]*.90
            for i,(x,y,ex,ey,length,ca,sa) in enumerate(path_segments):
                if max(x,ex)+60<left or min(x,ex)-60>left+TILE or max(y,ey)+60<top or min(y,ey)-60>top+TILE:continue
                along=(xx-x)*ca+(yy-y)*sa
                across=(yy-y)*ca-(xx-x)*sa
                edge=47+2*np.sin(along*.073+i)
                weight=np.clip((edge-np.abs(across))/6,0,1)*np.clip((along+4)/7,0,1)*np.clip((length-along+4)/7,0,1)
                wood(along*5.9+i*91,across*4.5+i*13,weight*.76)
            for room in sector['rooms']:
                x,y,w,h=(room[k] for k in ['x','y','w','h'])
                edge=np.minimum(w/2-np.abs(xx-x),h/2-np.abs(yy-y))
                if edge.max()<=2:continue
                wood(xx*5.3,yy*3.5,np.clip((edge-2)/5,0,1)*.76)
            tile=Image.fromarray(np.clip(rgb,0,255).astype('uint8'))
            for idx,(bx,by,angle) in enumerate(bags):
                if not left-22<bx<left+TILE+22 or not top-22<by<top+TILE+22:continue
                width=round((23+3*math.sin(idx*4.12))*DENSITY)
                height=round((13+1.9*math.cos(idx*.69))*DENSITY)
                cloth=torn if idx%5!=1 else bag
                stamp=cloth.resize((width,height),LANCZOS)
                # Dirt staining tempers the burlap while preserving folds, seam and fraying.
                shade=.74+.16*math.sin(idx*2.65)
                tint=Image.new('RGBA',stamp.size)
                tint.paste(tuple(round(c*shade) for c in (77,68,50))+(255,),(0,0,*stamp.size))
                pixels=Image.blend(stamp.convert('RGB'),tint.convert('RGB'),.17)
                pixels.putalpha(stamp.getchannel('A'));stamp=pixels
                if idx%2:stamp=stamp.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                stamp=stamp.rotate(-math.degrees(angle),Image.Resampling.BICUBIC,expand=True)
                px=round((bx-left)*DENSITY-stamp.width/2)
                py=round((by-top)*DENSITY-stamp.height/2)
                tile.paste(stamp,(px,py),stamp)
            tile.save(directory/f'{row}-{col}.webp',quality=94,method=4)

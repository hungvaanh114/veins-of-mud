"""Bake a looping, wind-distorted emission sheet and eight soot density sprites."""
from PIL import Image
from scipy.ndimage import map_coordinates
import numpy as np
from math import pi

plates = Image.open('art/fire-plates.webp').convert('RGB')
half = plates.width // 2
cell = 144
frames = 64
y, x = np.mgrid[0:cell, 0:cell].astype(np.float32)
source = []
for row in range(2):
    for col in range(2):
        crop = plates.crop((col*half,row*half,(col+1)*half,(row+1)*half))
        source.append(np.asarray(crop.resize((cell,cell),Image.Resampling.LANCZOS),dtype=np.float32))
sheet = Image.new('RGB',(cell*8,cell*8))
for frame in range(frames):
    t = frame / frames
    phase = 2*pi*t
    # A projected fire curls around the burning wood in the XY plane.
    nx=(x-cell*.5)/cell
    ny=(y-cell*.5)/cell
    radius=np.hypot(nx,ny)
    phase_field=phase*3 + 9*radius
    curl=.13*np.sin(phase_field+.065*x)*np.cos(.047*y-phase*2)
    sx=x-(y-cell*.5)*curl+3.4*np.sin(y*.09+x*.04-phase*4)
    sy=y+(x-cell*.5)*curl+3.0*np.sin(x*.09-y*.047+phase*3)
    index = int(4*t)
    mix = (4*t-index)
    # Local advection lets neighboring folds of flame change at different times.
    mix = np.clip(mix+np.sin(x*.05+y*.079-phase*2)*.15*np.sin(pi*mix),0,1)
    mix = mix*mix*(3-2*mix)
    emission = np.zeros((cell,cell,3),dtype=np.float32)
    for j, weight in [(index,1-mix),((index+1)%4,mix)]:
        for channel in range(3):
            sample=map_coordinates(source[j][:,:,channel],[sy,sx],order=1,mode='constant',prefilter=False)
            emission[:,:,channel]+=sample*weight
    emission *= (1+.075*np.sin(phase*7)+.045*np.sin(phase*11))
    sheet.paste(Image.fromarray(np.clip(emission,0,255).astype('uint8')),((frame%8)*cell,(frame//8)*cell))
sheet.save('dist/details/flames.webp',quality=94,method=6)

rng=np.random.default_rng(2197)
size=100
y,x=np.mgrid[-1:1:complex(size),-1:1:complex(size)]
smoke=Image.new('RGBA',(size*4,size*2))
for i in range(8):
    noise=np.zeros((size,size))
    for frequency,weight in [(4,.48),(9,.28),(19,.16),(35,.08)]:
        seed=Image.fromarray(rng.integers(0,255,(frequency,frequency),dtype=np.uint8))
        noise+=np.asarray(seed.resize((size,size),Image.Resampling.BICUBIC))/255*weight
    density=np.clip((1-np.hypot(x,y)**1.6+(noise-.54)*1.6)*noise,0,1)
    density*=np.clip((1-np.hypot(x,y))*4,0,1)
    c=44+noise*86
    rgba=np.stack([c,c*.98,c*.96,density*225],axis=2).astype('uint8')
    smoke.paste(Image.fromarray(rgba),((i%4)*size,(i//4)*size))
smoke.save('dist/details/smoke.webp',quality=91,method=6)

# Local dust and spray share the turbulent alpha field but scatter different colors.
pixels=np.asarray(smoke).astype(float)
density=pixels[:,:,0]
for name, tones, opacity in [('soil',(1.06,.89,.69),1.13),('mist',(1.3,1.44,1.48),.86)]:
    colored=np.stack([density*t for t in tones]+[pixels[:,:,3]*opacity],axis=2)
    Image.fromarray(np.clip(colored,0,255).astype('uint8')).save('dist/details/'+name+'.webp',quality=91,method=5)

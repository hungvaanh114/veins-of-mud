'use strict';

const skyChoice=document.querySelector('#sky');
const sky={day:0,night:0,bright:0,dim:1,blood:0};
const litParts={},coolParts={};
const beamReach=295,beamWidth=240,beamBack=38;
let beamTexture,heroWarmth=0;
const samplePath=document.createElement('canvas').getContext('2d');

function advanceSky(dt){
 const blend=1-Math.exp(-dt*2.8);
 for(const mode of Object.keys(sky))sky[mode]+=(Number(skyChoice.value===mode)-sky[mode])*blend;
}

function edgeFade(v){
 const n=clamp(v,0,1);
 return n*n*(3-2*n);
}

// The painted albedo stays in the original joint registration. Only light and material response change.
function gradePart(name,source,warm){
 const layer=document.createElement('canvas');
 layer.width=source.naturalWidth;layer.height=source.naturalHeight;
 const g=layer.getContext('2d');g.drawImage(source,0,0);
 const im=g.getImageData(0,0,layer.width,layer.height);
 const pixels=im.data,original=new Uint8ClampedArray(pixels),w=layer.width;
 const metal=name==='helmet';
 for(let y=0;y<layer.height;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,alpha=original[i+3];if(!alpha)continue;
  const r=original[i],green=original[i+1],b=original[i+2];
  const l=.27*r+.55*green+.18*b;
  const shift=metal?9:5;
  const neighbour=(Math.max(0,y-shift)*w+Math.max(0,x-shift))*4+3;
  const edge=Math.max(0,(alpha-original[neighbour])/255);
  const gun=name==='right'&&y<layer.height*.17;
  const spec=metal?Math.exp(-(((x/w-.47)/.115)**2+((y/layer.height-.345)/.079)**2)):0;
  const cloth=(name==='left'||name==='right')&&y>layer.height*.17;
  const key=warm?1:0;
  const exposure=metal?.88+key*.50:.84+key*.40;
  const level=l*exposure+(metal?6:1)+spec*(18+key*26)+edge*((metal||gun?50:22)+key*22);
  const saturation=warm?.77:.38;
  pixels[i]=level+(r-l)*saturation+key*(metal?9:5)-(cloth?6:0);
  pixels[i+1]=level+(green-l)*saturation+(cloth?3:0);
  pixels[i+2]=level+(b-l)*saturation+(warm?-9:8)+(cloth?9:0);
 }
 g.putImageData(im,0,0);return layer;
}

function prepareIllumination(){
 for(const [name,part] of Object.entries(playerParts)){
  coolParts[name]=gradePart(name,part,false);litParts[name]=gradePart(name,part,true);
 }
 // Cache the falloff at map resolution. Rotate the same texture for both light and colour.
 beamTexture=document.createElement('canvas');
 beamTexture.width=beamWidth*2;beamTexture.height=beamReach+beamBack;
 const g=beamTexture.getContext('2d'),im=g.createImageData(beamTexture.width,beamTexture.height);
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){
  const dx=x-beamWidth,forward=beamReach-y,d=Math.hypot(dx,forward);
  const aperture=Math.abs(Math.atan2(dx,forward));
  const cone=edgeFade((1.00-aperture)/.27);
  const distance=edgeFade((beamReach-d)/129);
  const shape=cone*distance*(.94+.06*Math.cos(aperture*6));
  const spill=edgeFade(1-d/49)*.77;
  const i=(y*im.width+x)*4;
  im.data[i]=245;im.data[i+1]=184+Math.round(16*spill);im.data[i+2]=119;
  im.data[i+3]=Math.round(255*Math.max(shape,spill));
 }
 g.putImageData(im,0,0);
}

function drawSkyLight(){
 const cover=1-weather.cloud*.62-weather.rain*.38;
 const sun=sky.day*cover,blood=sky.blood*cover,moon=(sky.bright+.42*sky.dim)*cover;
 const {cx,cy,scale}=viewport,w=screenWidth/scale,h=screenHeight/scale;
 ctx.save();
 if(sky.day>.004){
  ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(232,215,169,'+(sky.day*(.11+.13*cover))+')';
  ctx.fillRect(cx-w/2,cy-h/2,w,h);
 }
 if(blood>.004){
  ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgba(225,105,116,'+blood*.51+')';ctx.fillRect(cx-w/2,cy-h/2,w,h);
  ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(182,51,49,'+blood*.30+')';ctx.fillRect(cx-w/2,cy-h/2,w,h);
 }
 if(sky.dim>.01){
  ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(91,115,121,'+sky.dim*.10+')';ctx.fillRect(cx-w/2,cy-h/2,w,h);
 }
 ctx.restore();
 return {sun,blood,moon};
}

function waterSkyGlints(time,skyLight){
 const {sun,blood,moon}=skyLight;
 const strength=sun*.75+moon*.53+blood*.79;
 if(strength<.02)return;
 const color=blood>moon&&blood>sun?'219,99,86':sun>moon?'219,215,180':'183,208,217';
 for(const [x,y,rx,ry] of sector.water){
  if(!withinView(x,y,rx+20))continue;
  ctx.save();ctx.translate(x,y);ctx.scale(1,.55);
  lightDisk(ctx,-rx*.13,0,24*pumpLevel,'rgba('+color+','+strength*.64+')');ctx.restore();
  for(let i=0;i<8;i++){
   const xx=x+Math.cos(i*2.399+time*.00043)*rx*.29*pumpLevel,yy=y+Math.sin(i*2.399)*ry*.41*pumpLevel;
   stroke([[xx-2,yy],[xx+2.8+1.5*Math.sin(time*.002+i),yy]],'rgba('+color+','+strength*.7+')',.78);
  }
 }
}

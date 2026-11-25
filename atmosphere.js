'use strict';

// Both layers repeat seamlessly in world coordinates, independent of camera motion.
const mistSheet=document.createElement('canvas');
const airMask=document.createElement('canvas'),softScene=document.createElement('canvas');
const air=airMask.getContext('2d'),soft=softScene.getContext('2d');
let mistPattern,windTime=0;
function prepareMist(){
 const w=192;mistSheet.width=mistSheet.height=w;
 const g=mistSheet.getContext('2d'),img=g.createImageData(w,w);
 const random=sequence(0x912d76),octaves=[3,7,15,37].map(n=>({n,grid:Array.from({length:n*n},random)}));
 function sample(o,x,y){
  const px=x*o.n/w,py=y*o.n/w,ix=Math.floor(px),iy=Math.floor(py),tx=edgeFade(px-ix),ty=edgeFade(py-iy);
  const p=(a,b)=>o.grid[(b%o.n)*o.n+(a%o.n)];
  return (p(ix,iy)*(1-tx)+p(ix+1,iy)*tx)*(1-ty)+(p(ix,iy+1)*(1-tx)+p(ix+1,iy+1)*tx)*ty;
 }
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){
  const warpedX=x+9+8*Math.sin(y/w*turn),warpedY=y+8+7*Math.cos(x/w*turn);
  const n=sample(octaves[0],warpedX,warpedY)*.49+sample(octaves[1],warpedX,warpedY)*.30+
   sample(octaves[2],warpedX,warpedY)*.15+sample(octaves[3],x,y)*.06;
  const i=(y*w+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=255;img.data[i+3]=Math.round(255*edgeFade((n-.26)/.5));
 }
 g.putImageData(img,0,0);mistPattern=air.createPattern(mistSheet,'repeat');
}
function driftLayer(left,top,w,h,x,y,sx,sy,opacity){
 air.save();air.globalAlpha=opacity;air.translate(x,y);air.scale(sx,sy);air.fillStyle=mistPattern;
 air.fillRect((left-x)/sx,(top-y)/sy,w/sx,h/sy);air.restore();
}
function drawAir(){
 const k=.39,w=Math.max(1,Math.ceil(screenWidth*k)),h=Math.max(1,Math.ceil(screenHeight*k));
 if(airMask.width!==w||airMask.height!==h){airMask.width=softScene.width=w;airMask.height=softScene.height=h;}
 const {cx,cy,scale}=viewport,sx=w/screenWidth,sy=h/screenHeight,ww=screenWidth/scale,hh=screenHeight/scale;
 const left=cx-ww*.5,top=cy-hh*.5;
 air.setTransform(1,0,0,1,0,0);air.globalCompositeOperation='source-over';air.clearRect(0,0,w,h);
 air.setTransform(sx*scale,0,0,sy*scale,-left*sx*scale,-top*sy*scale);
 const mist=weather.fog,wet=weather.rain,damp=weather.cloud,t=windTime;
 driftLayer(left,top,ww,hh,t*5,t*1.4,2.3,1.12,.36+mist*.42);
 driftLayer(left,top,ww,hh,136+t*11,48+t*.45,1.28,.69,.14+.26*mist+.08*wet);
 // Allow the air to catch the beam, while reserving crisp edges around the moving figure.
 air.globalCompositeOperation='destination-out';
 const r=lampOn?85:60;
 const clear=air.createRadialGradient(player.x,player.y,25,player.x,player.y,r);
 clear.addColorStop(0,'#000');clear.addColorStop(1,'transparent');air.fillStyle=clear;
 air.fillRect(player.x-r,player.y-r,r*2,r*2);
 if(lampOn){
  const lamp=lanternPosition(),outline=lightContour('lantern',lamp.x,lamp.y,beamReach);
  air.save();air.clip(outline);air.translate(lamp.x,lamp.y);air.rotate(player.angle);air.globalAlpha=.77;
  air.drawImage(beamTexture,-beamWidth,-beamReach);air.restore();
 }
 air.setTransform(1,0,0,1,0,0);
 // Downsampling produces a soft optical layer. The moving density map limits it to fog banks.
 soft.setTransform(1,0,0,1,0,0);soft.globalCompositeOperation='copy';soft.imageSmoothingEnabled=true;
 soft.drawImage(canvas,0,0,w,h);soft.globalCompositeOperation='destination-in';soft.drawImage(airMask,0,0);
 air.globalCompositeOperation='source-in';
 const red=Math.round(103+sky.day*38+sky.blood*49);
 const green=Math.round(122+sky.day*25-sky.blood*57),blue=Math.round(124+sky.day*12-sky.blood*62);
 air.fillStyle='rgb('+red+','+green+','+blue+')';air.fillRect(0,0,w,h);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=.12+.57*mist+.17*wet+.1*damp;ctx.drawImage(softScene,0,0,canvas.width,canvas.height);
 ctx.globalAlpha=.035+.39*mist+.14*wet+.10*damp+.08*sky.dim;ctx.drawImage(airMask,0,0,canvas.width,canvas.height);ctx.restore();
}
function drawLingeringSmoke(){
 for(const c of craters){
  const age=windTime-c.struckAt;
  if(!Number.isFinite(age)||age<1.3||age>19||!withinView(c.x,c.y,c.r*2))continue;
  const envelope=Math.min(1,(age-1.3)/2,(19-age)/6);
  for(let i=0;i<5;i++){
   const p=(age*.19+i/5)%1,a=c.phase+i*2.39;
   const x=c.x+c.r*.23*Math.cos(a)+p*(18+age*1.7),y=c.y+c.r*.15*Math.sin(a)-p*(9+age*.3);
   const safe=.38+.62*edgeFade((Math.hypot(player.x-x,player.y-y)-15)/62);
   drawDust(x,y,(10+p*25)*(c.r/103),a,Math.sin(p*Math.PI)*envelope*safe*.32,'soot');
  }
 }
}

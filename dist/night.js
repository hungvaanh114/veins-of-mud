'use strict';
const shade = document.createElement('canvas');
const mask = shade.getContext('2d');
const fires=sector.fires;
let lampOn = true;
let boomAt = -10000;
let nextShell = 0;
let shellSite = [spawn.x,spawn.y];
let shellIndex = 0;
let audioCtx;
let audioBus;
let localFireGain;
let localPumpGain;
let weatherAudio;
let noise;
let soundEnabled = false;
const lampButton = document.querySelector('#lamp');
const audioButton = document.querySelector('#audio');

function toggleLamp(){
 lampOn = !lampOn;
 lampButton.textContent = lampOn ? 'Tắt đèn' : 'Bật đèn';
 lampButton.setAttribute('aria-pressed',lampOn);
}
lampButton.onclick = toggleLamp;

audioButton.onclick = async () => {
 try {
  if (!audioCtx) {
   audioCtx = new AudioContext();
   audioBus = audioCtx.createGain();
   audioBus.connect(audioCtx.destination);
   noise = audioCtx.createBuffer(1,audioCtx.sampleRate*4,audioCtx.sampleRate);
   const samples = noise.getChannelData(0);
   for (let i=0;i<samples.length;i++) samples[i] = Math.random()*2-1;
   const rain=audioCtx.createBufferSource(),tone=audioCtx.createBiquadFilter(),rainLevel=audioCtx.createGain();
   rain.buffer=noise;rain.loop=true;tone.type='bandpass';tone.frequency.value=1650;tone.Q.value=.55;
   weatherAudio=rainLevel.gain;rainLevel.gain.value=.008+weather.rain*.06;rain.connect(tone).connect(rainLevel).connect(audioBus);rain.start();
   const crackle=audioCtx.createBufferSource(),fireTone=audioCtx.createBiquadFilter();
   localFireGain=audioCtx.createGain();localFireGain.gain.value=0;
   crackle.buffer=noise;crackle.loop=true;fireTone.type='lowpass';fireTone.frequency.value=890;
   crackle.connect(fireTone).connect(localFireGain).connect(audioBus);crackle.start(0,.8);
   const motor=audioCtx.createOscillator();motor.type='triangle';motor.frequency.value=57;
   localPumpGain=audioCtx.createGain();localPumpGain.gain.value=0;
   motor.connect(localPumpGain).connect(audioBus);motor.start();
  }
  await audioCtx.resume();
  soundEnabled = !soundEnabled;
  audioBus.gain.setTargetAtTime(soundEnabled ? .7 : 0,audioCtx.currentTime,.03);
  audioButton.textContent = soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh';
  audioButton.setAttribute('aria-pressed',soundEnabled);
  if(soundEnabled) nextShell = performance.now()+900;
 } catch {
  audioButton.textContent = 'Thử bật âm thanh';
 }
};

function playShell(x){
 if(!soundEnabled) return;
 const at = audioCtx.currentTime;
 const distanceGain=clamp(1-Math.hypot(shellSite[0]-player.x,shellSite[1]-player.y)/1650,.15,1);
 const pan = audioCtx.createStereoPanner();
 pan.pan.value = clamp((x-player.x)/440,-.8,.8);
 pan.connect(audioBus);

 const whistle = audioCtx.createOscillator();
 const whistleGain = audioCtx.createGain();
 whistle.type = 'triangle';
 whistle.frequency.setValueAtTime(855,at);
 whistle.frequency.exponentialRampToValueAtTime(128,at+.61);
 whistleGain.gain.setValueAtTime(.001,at);
 whistleGain.gain.exponentialRampToValueAtTime(.097,at+.39);
 whistleGain.gain.exponentialRampToValueAtTime(.001,at+.62);
 whistle.connect(whistleGain).connect(pan);
 whistle.start(at);
 whistle.stop(at+.63);

 for(const [offset,level,cutoff] of [[0,.25,260],[.58,.82,610],[.76,.23,190]]){
  const start = at+offset;
  const burst = audioCtx.createBufferSource();
  const low = audioCtx.createBiquadFilter();
  const envelope = audioCtx.createGain();
  burst.buffer = noise;
  low.type = 'lowpass';
  low.frequency.setValueAtTime(cutoff,start);
  low.frequency.exponentialRampToValueAtTime(61,start+1.35);
  envelope.gain.setValueAtTime(level*distanceGain,start);
  envelope.gain.exponentialRampToValueAtTime(.001,start+1.4);
  burst.connect(low).connect(envelope).connect(pan);
  burst.start(start,Math.random(),1.45);
  burst.onended = () => {if(offset===.76)pan.disconnect();};
 }
}
function updateShells(time){
 if(!nextShell) nextShell=time+3000;
 if(time<nextShell) return;
 shellSite=impactSite(shellIndex===0||Math.random()<.77,shellIndex===0);
 shellIndex++;
 boomAt=time+580;
 nextShell=time+range(6900,11700);
 playShell(shellSite[0]);
}
function lightDisk(target,x,y,r,color){
 const light=target.createRadialGradient(x,y,0,x,y,r);
 light.addColorStop(0,color);
 light.addColorStop(1,'transparent');
 target.fillStyle=light;
 target.fillRect(x-r,y-r,r*2,r*2);
}
// Paint each emitter in world coordinates, using its own line of sight.
const sightCache=new Map();
// Occupancy at navigation resolution avoids checking every prop against every light ray.
let shadowObstacles,shadowRevision=-1;
function refreshShadowGrid(){
 if(shadowRevision===brokenRevision)return;
 const w=hitMap.width,h=hitMap.height;
 if(!shadowObstacles)shadowObstacles=new Uint8Array(w*h);else shadowObstacles.fill(0);
 function raster(x,y,bx,by,inside,material){
  for(let iy=clamp(Math.floor(y/2),0,h-1);iy<=Math.min(h-1,Math.ceil(by/2));iy++)
   for(let ix=clamp(Math.floor(x/2),0,w-1);ix<=Math.min(w-1,Math.ceil(bx/2));ix++)
    if(inside(ix*2,iy*2))shadowObstacles[iy*w+ix]=material;
 }
 for(const [,x,y,pw,ph] of sector.props)raster(x-pw/2,y-ph/2,x+pw/2,y+ph/2,()=>true,1);
 for(const o of debris)if(!o.broken)raster(o.x-13,o.y-13,o.x+13,o.y+13,(x,y)=>(x-o.x)**2+(y-o.y)**2<169,2);
 for(const f of fences)raster(Math.min(f[0],f[2])-2,Math.min(f[1],f[3])-2,Math.max(f[0],f[2])+2,Math.max(f[1],f[3])+2,
  (x,y)=>segmentGap(x,y,...f)<2&&(Math.floor((x+y)*.21)%4===0),2);
 for(const t of deadTrees)raster(t.x-t.r,t.y-t.r,t.x+t.r,t.y+t.r,(x,y)=>(x-t.x)**2+(y-t.y)**2<t.r*t.r,2);
 shadowRevision=brokenRevision;
}
function lightContour(key,x,y,reach){
 const tag=[Math.round(x/2),Math.round(y/2),reach,brokenRevision].join('/');
 const cached=sightCache.get(key);
 if(cached&&cached.tag===tag)return cached.path;
 const path=new Path2D();
 refreshShadowGrid();
 const w=hitMap.width,origin=Math.round(y*.5)*w+Math.round(x*.5);
 const onLand=upland[origin]>0,insideProp=shadowObstacles[origin]===1;
 const level=onLand?upland:clearance;
 for(let i=0;i<152;i++){
  const a=i*Math.PI*2/152,dx=Math.cos(a),dy=Math.sin(a);
  let distance=reach;
  let exitedProp=!insideProp;
  for(let t=3;t<reach;t+=3){
   const px=x+t*dx,py=y+t*dy,idx=Math.round(py*.5)*w+Math.round(px*.5),solid=shadowObstacles[idx];
   if(!solid)exitedProp=true;
   if((level[idx]===0&&(onLand||exitedProp))||solid===2||(exitedProp&&solid===1)){distance=t;break;}
  }
  const xx=x+dx*distance,yy=y+dy*distance;
  if(i)path.lineTo(xx,yy);else path.moveTo(xx,yy);
 }
 path.closePath();sightCache.set(key,{tag,path});return path;
}
function lanternPosition(){
 const a=player.angle;
 return {x:player.x-14*Math.cos(a)+2*Math.sin(a),y:player.y-14*Math.sin(a)-2*Math.cos(a)};
}
function paintDarkness(time,scale,cx,cy){
 const density=Math.min(1,ratio)*.78;
 const mw=Math.ceil(screenWidth*density),mh=Math.ceil(screenHeight*density);
 if(shade.width!==mw||shade.height!==mh){shade.width=mw;shade.height=mh;}
 mask.setTransform(1,0,0,1,0,0);mask.globalCompositeOperation='source-over';
 mask.clearRect(0,0,mw,mh);
 const cover=weather.cloud*.08+weather.rain*.044+weather.fog*.028;
 const veil=clamp(sky.night*.92+sky.dim*.805+sky.bright*.57+sky.blood*.63+sky.day*.035+cover,0,.955);
 const darkRed=Math.round(7+sky.blood*37),darkGreen=Math.round(12-sky.blood*5);
 mask.fillStyle='rgba('+darkRed+','+darkGreen+',16,'+veil+')';mask.fillRect(0,0,mw,mh);
 // Vignette follows Lukas when the camera stops at a map boundary.
 const px=(screenWidth/2+(player.x-cx)*scale)*density,py=(screenHeight/2+(player.y-cy)*scale)*density;
 const diagonal=Math.hypot(mw,mh),v=mask.createRadialGradient(px,py,diagonal*.12,px,py,diagonal*.68);
 v.addColorStop(0,'transparent');v.addColorStop(.52,'rgba(2,5,7,'+(.08*(1-sky.day))+')');
 v.addColorStop(1,'rgba(2,5,7,'+(.43*(1-sky.day))+')');
 mask.fillStyle=v;mask.fillRect(0,0,mw,mh);
 heroWarmth=0;
 mask.setTransform(density*scale,0,0,density*scale,density*(screenWidth/2-cx*scale),density*(screenHeight/2-cy*scale));
 mask.globalCompositeOperation='destination-out';
 const light=(key,x,y,r,strength,color,direction)=>{
  if(Math.abs(x-cx)>screenWidth/(2*scale)+r||Math.abs(y-cy)>screenHeight/(2*scale)+r||strength<.015)return;
  const outline=lightContour(key,x,y,r);
  mask.save();mask.clip(outline);mask.translate(x,y);
  ctx.save();ctx.clip(outline);ctx.translate(x,y);
  if(direction!==undefined){
   mask.rotate(direction);ctx.rotate(direction);
   mask.globalAlpha=strength;mask.drawImage(beamTexture,-beamWidth,-beamReach);
   ctx.globalCompositeOperation='screen';ctx.globalAlpha=.23*(1-sky.day*.83);
   ctx.drawImage(beamTexture,-beamWidth,-beamReach);
  }else {
   lightDisk(mask,0,0,r,'rgba(0,0,0,'+strength+')');
   lightDisk(ctx,0,0,r,'rgba('+color+','+(strength*(key==='near'?.17:.31)*(1-sky.day*.57))+')');
   const distance=Math.hypot(player.x-x,player.y-y);
   if(key!=='near'&&distance<r&&samplePath.isPointInPath(outline,player.x,player.y)){
    heroWarmth=Math.max(heroWarmth,(1-distance/r)*strength*.9);
   }
  }
  ctx.restore();mask.restore();
 };
 const lamp=lanternPosition();
 light('near',player.x,player.y,lampOn?83:53,lampOn?.85:.43,lampOn?'214,182,135':'111,141,150');
 if(lampOn)light('lantern',lamp.x,lamp.y,beamReach,1,'245,186,122',player.angle);
 fires.forEach(([x,y,size],i)=>light('fire'+i,x,y,Math.round(126*size),fireBeat(time,x,y),'255,145,63'));
 if(stations[2].opened){const [,x,y]=sector.props[7];light('infirmary',x,y,122,.84,'255,207,133');}
 if(stations[3].opened){const [,x,y]=sector.props[8];light('stove',x,y,109,.76+.1*Math.sin(time*.007),'255,135,62');}
 for(const b of plumes)if(b.age<.68)light('blast'+Number(b.big),b.x,b.y,Math.round(b.r*2.65),Math.exp(-b.age*8.8),'255,190,108');
 if(traces.length){const t=traces[traces.length-1];light('muzzle',t.ox,t.oy,86,Math.max(0,1-t.age*15),'255,208,117');}
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=.39*(1-sky.blood)*(1-sky.day);ctx.globalCompositeOperation='color';ctx.drawImage(shade,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;
 ctx.globalCompositeOperation='source-over';ctx.drawImage(shade,0,0,canvas.width,canvas.height);ctx.restore();
}
function drawHallucinations(time){
 ctx.save();
 if(lampOn){
  ctx.translate(player.x,player.y);ctx.rotate(player.angle);
  ctx.beginPath();ctx.rect(-1000,-1000,2000,2000);ctx.ellipse(0,-98,104,173,0,0,Math.PI*2);
  ctx.clip('evenodd');
  ctx.rotate(-player.angle);ctx.translate(-player.x,-player.y);
 } else {
  ctx.beginPath();ctx.rect(-100,-100,world.width+200,world.height+200);
  ctx.ellipse(player.x,player.y,29,29,0,0,Math.PI*2);ctx.clip('evenodd');
 }
 for(let i=0;i<13;i++){
  const [x,y]=fallen[i];
  const phase=(time*.00042+i*.347)%1;
  const opacity=Math.sin(phase*Math.PI)**6;
  const px=x+Math.sin(phase*6.28)*12;
  const py=y+Math.sin(time*.002+i)*5;
  ctx.save();ctx.translate(px,py);ctx.rotate(i*2.399+Math.sin(time*.001+i)*.28);
  ellipse(0,0,11+phase*13,4+phase*7,`rgba(72,91,114,${opacity*.15})`);
  ellipse(-2,0,6,3.5,`rgba(18,12,29,${opacity*.65})`);
  ellipse(4,-1,3,2.8,`rgba(83,60,91,${opacity*.19})`);
  ctx.restore();
 }
 ctx.restore();
}
const fallenArt=[0,1].map(index=>{
 const img=new Image();img.src=gameImageURL('fallen-'+index+'.webp');return img;
});
const puddleArt=sector.water.map((_,i)=>{const img=new Image();img.src=gameImageURL('pool-'+i+'.webp');return img;});
function drawFallen(x,y,angle,variant){
 const img=fallenArt[variant%2];
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 const w=56*img.naturalWidth/img.naturalHeight;
 ellipse(1,1,w*.46,25,'#0e101344');
 ctx.drawImage(img,-w/2,-28,w,56);
 ctx.restore();
}
const pools=sector.water;
const tatters=sector.fabric;
function drawGroundMotion(time){
 for(const [x,y,r] of pools){
  for(let i=0;i<5;i++){
   if(i>=Math.ceil(weather.rain*5))continue;
   const p=(time*.00071+i*.273)%1;
   const dx=Math.cos(i*2.4)*r*.68*pumpLevel,dy=Math.sin(i*2.4)*r*.32*pumpLevel;
   ctx.beginPath();ctx.ellipse(x+dx,y+dy,1+p*9*pumpLevel,1+p*5*pumpLevel,.1,0,Math.PI*2);
   ctx.strokeStyle=`rgba(174,194,186,${(1-p)*.28})`;
   ctx.lineWidth=.62;ctx.stroke();
  }
 }
 for(const [x,y,a] of tatters){
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  const near=clamp(1-Math.hypot(player.x-x,player.y-y)/70,0,1);
  const wind=Math.sin(time*.006+x)*1.9+near*(4+Math.sin(player.gait)*player.moving*4);
  ctx.beginPath();ctx.moveTo(-6,0);
  ctx.quadraticCurveTo(-1,wind-3,7,wind-1);
  ctx.lineTo(6,3+wind);ctx.lineTo(-6,4);ctx.closePath();
  ctx.fillStyle='#8f866c';ctx.fill();ctx.restore();
 }

}
function drawRain(time){
 ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.beginPath();
 for(let i=0;i<Math.round(weather.rain*157);i++){
  const x=(i*159.7+time*.29)%screenWidth;
  const y=(i*103.3+time*.64)%screenHeight;
  ctx.moveTo(x,y);ctx.lineTo(x+3+i%5,y+8+i%8);
 }
 ctx.strokeStyle='rgba(173,190,209,'+(.07+.14*weather.rain)+')';ctx.lineWidth=.75;ctx.stroke();
 ctx.restore();
}

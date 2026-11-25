'use strict';
const canvas = document.querySelector('#view');
const ctx = canvas.getContext('2d', { alpha: false });
const palette = document.querySelector('#palette');
const world = {width:sector.width,height:sector.height};
const map = new Image();
map.src = gameImageURL('sector.webp');
const hitMap = new Image();
let clearance;
let ready = false;
hitMap.src = gameImageURL('clearance.png');
const playerParts = {};
for(const part of ['bootL','bootR','coat','left','right','helmet']){
 const image=new Image();
 image.src=gameImageURL('lukas-'+part+'.webp');
 playerParts[part]=image;
}
const fallen = sector.fallen;
const spawn = {x:910,y:930};
const player = {...spawn, angle:Math.PI/2, gait:0, moving:0};
const camera = {...spawn};
const input = new Set();
const footprints = [];
const keys = {w:'up',a:'left',s:'down',d:'right',arrowup:'up',arrowdown:'down',arrowleft:'left',arrowright:'right',shift:'run'};
let grayscale = false;
let lastTime;
let lastStep = 0;
let ratio = 1;
let screenWidth = 1;
let screenHeight = 1;

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function roomFor(px,py,radius){
 if(!clearance||px<radius||py<radius||px>=world.width-radius||py>=world.height-radius)return false;
 const i=Math.round(py/2)*hitMap.width+Math.round(px/2);
 return (player.level===1?upland[i]:clearance[i])>=radius+2&&!trunkAt(px,py,radius);
}
function blocked(x,y,angle=player.angle){
 if(!roomFor(x,y,17)||fenceDistance(x,y)<21||rubbleSolid(x,y))return true;
 const sine=Math.sin(angle),cosine=Math.cos(angle);
 for(const [side,front,r] of [[7,-17,6],[8,-27,3],[-13,1,5],[1,13,5]]){
  const xx=x+side*cosine-front*sine,yy=y+side*sine+front*cosine;
  if(!roomFor(xx,yy,r)||fenceDistance(xx,yy)<r+3)return true;
 }
 return false;
}
function togglePalette(){
 grayscale=!grayscale;
 canvas.style.filter=grayscale?'grayscale(1)':'none';
 palette.textContent=grayscale?'Hiện màu':'Đơn sắc';
 palette.setAttribute('aria-pressed',grayscale);
}
palette.onclick=togglePalette;
document.querySelector('#reset').onclick=()=>{
 Object.assign(player,spawn,{angle:Math.PI/2,gait:0,moving:0,level:0});
 climb=null;
 resetFooting();
 Object.assign(camera,spawn);
 footprints.length=0;
 lastStep=0;
 wetBoots=0; particles.length=0;
};
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(e.code==='Space'||key==='j'){
  e.preventDefault();
  if(ready&&!mapOpen&&!e.repeat){if(key==='j')fireWeapon();else tryClimb();}
  return;
 }
 if(e.repeat && ['m','e','f'].includes(key))return;
 if(key==='m'||(key==='escape'&&mapOpen)){toggleFieldMap();return;}
 if(mapOpen)return;
 if(key==='e')useStation();
 if(key==='f')toggleLamp();
 if(Object.hasOwn(keys,key)){
  e.preventDefault();
  input.add(keys[key]);
 }
});
window.addEventListener('keyup',e=>input.delete(keys[e.key.toLowerCase()]));
window.addEventListener('blur',()=>input.clear());
for(const button of document.querySelectorAll('[data-key]')){
 const key=button.dataset.key;
 button.addEventListener('pointerdown',e=>{
  e.preventDefault();
  button.setPointerCapture(e.pointerId);
  input.add(key);
 });
 button.addEventListener('lostpointercapture',()=>input.delete(key));
}

function ellipse(x,y,rx,ry,color,angle=0){
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
}
function stroke(points,color,width){
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(const p of points.slice(1))ctx.lineTo(...p);
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
}
function drawPlayer(time){
 const stride=Math.sin(player.gait)*player.moving;
 const idle=Math.sin(time*.0025)*.4;
 const lift=footing.height+footing.bob;
 ctx.save();ctx.translate(player.x,player.y);
 ctx.save();ctx.translate(2.4+lift*.11,4+lift*.14);ctx.rotate(player.angle);ctx.scale(1,.76);
 const contact=ctx.createRadialGradient(0,0,5,0,0,27);contact.addColorStop(0,'rgba(5,7,7,.88)');contact.addColorStop(.62,'rgba(4,7,8,.66)');contact.addColorStop(1,'transparent');
 ctx.fillStyle=contact;ctx.fillRect(-27,-27,54,54);ctx.restore();
 ctx.translate(0,-lift*.44);ctx.rotate(player.angle+footing.roll);
 const heightScale=1+clamp(lift,-23,14)*.006;
 ctx.scale(heightScale,heightScale);
 const arc=climb?Math.sin(Math.PI*climb.t):0;
 ctx.scale(1+arc*.15,1+arc*.15);
 ctx.translate(0,gunKick*1.6);

 const warm=clamp((lampOn?.83:0)+sky.day*.63+sky.blood*.13+heroWarmth,0,1);
 function part(name,dx=0,dy=0,stretch=1){
  ctx.drawImage(warm>=.997?litParts[name]:coolParts[name],-24+dx,-29+dy,48,53*stretch);
  if(warm>.003&&warm<.997){ctx.globalAlpha=warm;ctx.drawImage(litParts[name],-24+dx,-29+dy,48,53*stretch);ctx.globalAlpha=1;}
 }
 part('bootL',0,stride*4-footing.left*.2);part('bootR',0,-stride*4-footing.right*.2);
 part('coat',0,idle,1+player.moving*.035);
 part('left',stride*.4,idle-stride*.85);
 part('right',0,idle+stride*.55+gunKick*4);
 part('helmet',stride*.28,idle-.5);
 ctx.restore();
}
function recallFootprint(){
 const side=lastStep%2?6:-6;
 const x=player.x+Math.cos(player.angle)*side,y=player.y+Math.sin(player.angle)*side;
 const surface=surfaceAt(x,y);
 leaveImprint(x,y,player.angle,surface);
 if(surface==='water')wetBoots=9;
 footprints.push({x,y,age:0,angle:player.angle,wet:wetBoots>0,mud:surface==='mud'});
 if(footprints.length>70)footprints.shift();
 wetBoots=Math.max(0,wetBoots-1);
 stepEffects(x,y,surface,input.has('run'));

}
function update(dt){
 if(climb){advanceClimb(dt);return;}
 const x=Number(input.has('right'))-Number(input.has('left'));
 const y=Number(input.has('down'))-Number(input.has('up'));
 const moving=Boolean(x||y);
 let step=0;
 if(moving){
  const ground=surfaceAt(player.x,player.y);
  const speed=(input.has('run')?185:115)*(ground==='water'?.77:ground==='mud'?.85:1);
  const d=dt*speed*(1-Math.min(.21,footing.support*.022))/Math.hypot(x,y);
  const oldX=player.x,oldY=player.y;
  const heading=Math.atan2(y,x)+Math.PI/2;
  const turn=player.angle+Math.atan2(Math.sin(heading-player.angle),Math.cos(heading-player.angle))*Math.min(1,dt*17);
  if(!blocked(player.x,player.y,turn))player.angle=turn;
  if(!blocked(player.x+x*d,player.y))player.x+=x*d;
  if(!blocked(player.x,player.y+y*d))player.y+=y*d;
  step=Math.hypot(player.x-oldX,player.y-oldY);
  contactPlayer(player.x-oldX,player.y-oldY,dt);
  player.gait+=step*.125;

  const foot=Math.floor(player.gait/Math.PI);
  if(foot!==lastStep){lastStep=foot;recallFootprint();}
 }
 player.moving+=(Number(step>.01)-player.moving)*Math.min(1,dt*13);
 camera.x+=(player.x-camera.x)*Math.min(1,dt*8);
 camera.y+=(player.y-camera.y)*Math.min(1,dt*8);
 for(const print of footprints)print.age+=dt;
}
function resize(){
 const rect=canvas.getBoundingClientRect();
 screenWidth=Math.max(1,rect.width);screenHeight=Math.max(1,rect.height);
 ratio=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(screenWidth*ratio);canvas.height=Math.round(screenHeight*ratio);
}
new ResizeObserver(resize).observe(canvas);
resize();
function render(time){
 ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.fillStyle='#231e18';ctx.fillRect(0,0,screenWidth,screenHeight);
 const motion=motionPreference.matches?0:1;
 const scale=Math.max(1.35,Math.min(2.2,screenWidth/680),screenHeight/580)*(1+motion*footing.cameraZ*.0017);
 const shake=screenImpulse(time);
 const cx=clamp(camera.x+shake[0],screenWidth/scale/2,world.width-screenWidth/scale/2);
 const cy=clamp(camera.y+shake[1]-motion*footing.cameraZ*.48,screenHeight/scale/2,world.height-screenHeight/scale/2);
 Object.assign(viewport,{cx,cy,scale});
 ctx.translate(screenWidth/2,screenHeight/2);ctx.scale(scale,scale);ctx.translate(-cx,-cy);
 ctx.drawImage(map,0,0,world.width,world.height);
 drawDetailedTerrain(cx,cy,screenWidth/(2*scale),screenHeight/(2*scale));
 drawBattleGround(time);drawTreeLayer(time,true);
 for(const p of footprints){
  const alpha=Math.max(0,(p.wet?.76:p.mud?.6:.17)*(1-p.age/(p.wet?9:5)));
  if(alpha)ellipse(p.x,p.y,2.6,4.3,p.wet?`rgba(67,84,84,${alpha})`:`rgba(39,29,19,${alpha})`,p.angle);
 }
 drawStationObjects(time);
 drawWeatherGround(time);
 drawGroundMotion(time);
 drawLooseItems();
 for(let i=0;i<fallen.length;i++)drawCasualty(i,time);
 for(const fire of fires)drawFireBed(time,...fire);

 drawStepEffects(time);
 drawTreeLayer(time,false);drawFragments();drawHallucinations(time);
 paintDarkness(time,scale,cx,cy);
 drawAir();drawLingeringSmoke();
 drawPlayer(time);drawShots(time);drawPassingRound();drawSky(time);
 for(const fire of fires){drawFire(time,...fire);drawSmoke(time,...fire);}
 if(stations[3].opened){const [,x,y]=sector.props[8];drawFire(time,x,y,.46);drawSmoke(time,x,y,.5);}
 drawBlastClouds();
 drawRain(time);
 drawShockOverlay();
 updateHud();

}
function tick(time){
 const elapsed=lastTime===undefined?0:Math.min(.18,(time-lastTime)/1000);
 lastTime=time;
 if(ready&&!mapOpen){
  const steps=Math.max(1,Math.ceil(elapsed/.025)),dt=elapsed/steps;
  for(let i=0;i<steps;i++){
   update(dt);advanceLooseObjects(dt,time);updateFooting(dt);advanceBattle(dt,time);updateEffects(dt);
  }
  updateShells(time);render(time);
 }
 requestAnimationFrame(tick);
}

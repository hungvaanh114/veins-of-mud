'use strict';

const craters=[], plumes=[];
const craterArt=['loam','clay','splinters','char'];
const groundMasks=[];
const turn=Math.PI*2;
const range=(low,high)=>low+(high-low)*Math.random();
function sequence(seed){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
}
function makeCrater(x,y,r,seed,variant,shallow=false){
 const roll=sequence(seed);
 return {x,y,r,seed,variant,level:levelAt(x,y),angle:(roll()-.5)*2.3,aspect:.74+roll()*.25,
  phase:roll()*turn,depth:shallow?Math.min(13,r*.24):Math.min(36,r*.29),fresh:!shallow};
}
function prepareDamage(){
 for(const data of [clearance,upland]){
  const canvas=document.createElement('canvas');canvas.width=hitMap.width;canvas.height=hitMap.height;
  const g=canvas.getContext('2d'),img=g.createImageData(canvas.width,canvas.height);
  for(let i=0;i<data.length;i++)img.data[i*4+3]=clamp((data[i]-2)*52,0,255);
  g.putImageData(img,0,0);groundMasks.push(canvas);
 }
 initialCraters.forEach((old,i)=>Object.assign(old,makeCrater(old.x,old.y,old.r,26791+i*190231,i%4,true)));
}
function impactSite(near=true,first=false){
 const anchor=near?player:sector.rooms[Math.floor(Math.random()*sector.rooms.length)];
 const half=Math.max(78,Math.min(230,screenWidth/(viewport.scale||1)*.36,screenHeight/(viewport.scale||1)*.36));
 for(let attempt=0;attempt<30;attempt++){
  const a=range(0,turn),d=first?range(half*.55,half*.93):near?range(half*.25,half*1.22):range(85,370);
  const x=clamp(anchor.x+Math.cos(a)*d,75,world.width-75);
  const y=clamp(anchor.y+Math.sin(a)*d,75,world.height-75);
  const i=Math.round(y/2)*hitMap.width+Math.round(x/2);
  if(Math.max(clearance[i],upland[i])>19&&!craters.slice(-5).some(c=>Math.hypot(c.x-x,c.y-y)<c.r*.55))return [x,y];
 }
 return [anchor.x,anchor.y];
}
// Compose each scar once. The layer mask keeps sandbag lips, walls and furniture visible.
function scarTile(m){
 const scale=m.r<75?2:1.5,half=Math.ceil(m.r*1.49);
 const tile=document.createElement('canvas');tile.width=tile.height=Math.ceil(half*2*scale);
 const g=tile.getContext('2d'),roll=sequence(m.seed);
 g.scale(scale,scale);g.translate(half,half);g.save();g.rotate(m.angle);g.scale(1,m.aspect);
 const sprite=detailArt[craterArt[m.variant]],rad=m.r;
 g.globalAlpha=m.fresh?1:.83;
 g.drawImage(sprite,-rad,-rad,rad*2,rad*2);
 // Clods land in a few lobes. Small cutouts come from the actual earth at the rim.
 const lobes=Array.from({length:4+Math.floor(roll()*3)},()=>roll()*turn);
 for(let i=0;i<(m.fresh?105:38);i++){
  const a=lobes[i%lobes.length]+(roll()-.5)*.9,d=rad*(.85+roll()*.56);
  const size=rad*(.008+.038*roll()**2),xx=Math.cos(a)*d,yy=Math.sin(a)*d;
  g.save();g.translate(xx,yy);g.rotate(roll()*turn);
  g.fillStyle='rgba(14,13,10,.41)';g.beginPath();g.ellipse(1,1.4,size*1.14,size*.7,0,0,turn);g.fill();
  g.beginPath();g.moveTo(-size,-size*.1);g.lineTo(-size*.37,-size*.76);g.lineTo(size*.63,-size*.52);g.lineTo(size,size*.25);g.lineTo(-size*.33,size*.72);g.closePath();g.clip();
  const bx=sprite.naturalWidth*(.25+.45*roll()),by=sprite.naturalHeight*(.15+.1*roll());
  g.drawImage(sprite,bx,by,9,9,-size,-size,2*size,2*size);g.restore();
 }
 g.restore();
 g.globalAlpha=1;g.globalCompositeOperation='destination-in';
 g.drawImage(groundMasks[m.level],-m.x,-m.y,world.width,world.height);
 return {tile,half};
}
function drawScars(){
 for(const group of [initialCraters,craters])for(const m of group){
  if(!withinView(m.x,m.y,m.r*1.5))continue;
  if(!m.stamp)m.stamp=scarTile(m);
  const {tile,half}=m.stamp;ctx.drawImage(tile,m.x-half,m.y-half,half*2,half*2);
 }
}
function withinView(x,y,padding){
 return Math.abs(x-viewport.cx)<screenWidth/(2*viewport.scale)+padding&&Math.abs(y-viewport.cy)<screenHeight/(2*viewport.scale)+padding;
}
function startImpact(x,y,big){
 const r=big?range(148,193):range(83,125);
 const surface=surfaceAt(x,y,levelAt(x,y));
 const variant=surface==='wood'?2:surface==='water'?1:surface==='mud'?(Math.random()<.5?0:1):Math.floor(range(0,4));
 const seed=Math.floor(Math.random()*4294967296);
 const c=makeCrater(x,y,r,seed,variant);c.struckAt=windTime;
 for(const t of deadTrees)if(Math.hypot(x-t.x,y-t.y)<r*1.45)t.sway=1;
 craters.push(c);if(craters.length>28)craters.shift();
 const wet=surface==='water',roll=sequence(seed);
 const jets=Array.from({length:big?19:13},(_,i)=>({
  a:i*(turn/(big?19:13))+(roll()-.5)*.52,reach:.35+roll()*.89,
  width:.15+roll()*.38,phase:roll()*7,delay:roll()*.16,life:2.2+roll()*2.4
 }));
 plumes.push({x,y,r,wet,age:0,seed,jets,big});if(plumes.length>6)plumes.shift();
 pushBlastObjects(x,y,r);
 for(const obj of debris)if(!obj.broken&&Math.hypot(x-obj.x,y-obj.y)<r+20)shatter(obj);
 const distance=Math.hypot(player.x-x,player.y-y);
 shock=Math.max(shock,clamp(1-distance/730,.06,1)*(big?1:.83));
 for(let i=0;i<(big?116:79);i++){
  const jet=jets[i%jets.length],a=jet.a+(roll()-.5)*.62,v=r*(.39+roll()*1.26)*jet.reach;
  const kind=wet&&i%3?'spray':i%13===0?'ember':surface==='wood'&&i%3===1?'wood':'earth';
  spawnBit(x+(roll()-.5)*11,y+(roll()-.5)*11,Math.cos(a)*v,Math.sin(a)*v,1,42+roll()*130,kind,.92+roll()*1.03);
 }
 for(const [px,py] of sector.water)if(Math.hypot(px-x,py-y)<r*1.85)
  for(let i=0;i<5;i++)emit('ring',px+(roll()-.5)*32,py+(roll()-.5)*23,0,0,.9+i*.14);
 scatterCrows(x,y,r*5);
 if(big)soundBurst('bomb',clamp(1-distance/1300,.15,.8));
}
function advancePlumes(dt){
 for(let i=plumes.length-1;i>=0;i--){plumes[i].age+=dt;if(plumes[i].age>5)plumes.splice(i,1);}
}
function drawBlastClouds(){
 for(const b of plumes){
  if(!withinView(b.x,b.y,b.r*2.4))continue;
  const t=b.age,wind=burnMotion(t*1000,b.x,b.y);
  drawImpactFlame(t,b.x,b.y,b.r*(b.big?1.55:1.27));
  for(const jet of b.jets){
   const age=t-jet.delay;if(age<0||age>jet.life)continue;
   const dx=Math.cos(jet.a),dy=Math.sin(jet.a),ease=1-Math.exp(-age*2.3);
   const x=b.x+b.r*dx*jet.reach*ease+age*age*(2.8+wind);
   const y=b.y+b.r*dy*jet.reach*ease+age*age*.95;
   const radius=b.r*jet.width*(.36+ease*.84+age*.29);
   const opacity=(1-age/jet.life)**1.3*Math.min(1,age*15+.22);
   // Dense jets at contact, warm ash in the middle and cold soot along the wake.
   drawDust(x,y,radius,jet.phase,opacity*(b.wet?.57:.81),b.wet?'mist':'soil');
   if(age<1.25)drawDust(b.x+(x-b.x)*.48,b.y+(y-b.y)*.48,radius*.78,jet.phase+3,opacity*.54,'soil');
   if(age>.33)drawDust(x+age*7,y-age*2,radius*1.24,jet.phase+1,opacity*.52);
  }
  if(t<.67){
   const f=t/.67,reach=b.r*(.13+1.4*Math.sqrt(f));
   for(const jet of b.jets){
    const dist=reach*(.85+.14*Math.sin(jet.phase));
    const x=b.x+Math.cos(jet.a)*dist,y=b.y+Math.sin(jet.a)*dist;
    ctx.save();ctx.translate(x,y);ctx.rotate(jet.a+Math.PI*.5);ctx.scale(1,.34);
    drawDust(0,0,b.r*(.09+.15*f),jet.phase+2,(1-f)**1.6*.53,b.wet?'mist':'soil');ctx.restore();
   }
  }
 }
}

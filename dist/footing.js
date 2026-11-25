'use strict';

// Distances and elevations share the map's units. A low object can support a boot
// and receive a horizontal impulse without becoming an impassable wall.
const looseItems = [
 ['plank',957,931,1.33],['crate',1046,923,-.4],['plank',1036,950,.32],
 ['crate',394,1187,.72],['plank',590,1099,1.14],['plank',1457,795,.46],
 ['crate',1420,755,.2],['plank',1886,1312,-.45],['crate',2203,1296,.56],
 ['plank',460,534,.74],['crate',759,989,-.23],['plank',1170,959,.6]
].map(([kind,x,y,a])=>({kind,x,y,a}));
const initialCraters = [
 [1127,1025,44],[848,773,55],[1548,663,61],[2095,963,48],[556,940,37],
 [935,930,28],[1681,1358,33]
].map(([x,y,r],i)=>({x,y,r,seed:i*2.399,type:'crater'}));
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
const footing={height:0,speed:0,roll:0,bob:0,cameraZ:0,cameraSpeed:0,impact:0,support:0,left:0,right:0};
const viewport={cx:spawn.x,cy:spawn.y,scale:1};
const fallenRestAngles=bodies.map(o=>o.a);
let mobileObjects=[];
const dragTracks=[];
function setupFooting(){
 // Small pieces of personal kit and torn sacks lie along accessible approaches.
 const gear=['tin-helmet','flask','sacking','stake'];
 for(let i=0;i<sector.paths.length;i++){
  const path=sector.paths[i];
  for(let j=1;j<path.length;j+=2){
   const [ax,ay]=path[j-1],[bx,by]=path[j],a=Math.atan2(by-ay,bx-ax);
   const offset=((i+j)%2?1:-1)*(16+(i*3+j)%11),kind=gear[(i*3+j+(j>>1))%4];
   looseItems.push({kind,x:ax*.41+bx*.59-Math.sin(a)*offset,y:ay*.41+by*.59+Math.cos(a)*offset,a:i+j*2.39});
  }
 }
 const all=[...bodies,...looseItems];
 for(const [i,o] of all.entries()){
  o.kind=o.kind||'body';
  const body=o.kind==='body',board=o.kind==='plank';
  Object.assign(o,{homeX:o.x,homeY:o.y,vx:0,vy:0,spin:0,touch:0,travel:0,
   rx:body?9:board?5:9,ry:body?22:board?19:11,
   mass:body?6:board?1.7:1.1,rise:body?8.7:board?3.8:4.8,
   level:levelAt(o.x,o.y),order:i});
 }
 const sizes={'tin-helmet':[6,7,1.1,4.8],'flask':[4.4,6,.7,2.6],'sacking':[9,14,4.2,6.3],'stake':[3.8,12,1.3,2.5]};
 for(const o of looseItems){
  if(sizes[o.kind])[o.rx,o.ry,o.mass,o.rise]=sizes[o.kind];
 }
 mobileObjects=all.filter(o=>o.kind==='body'||validPose(o,o.x,o.y,o.a));
 for(let i=looseItems.length-1;i>=0;i--)if(!mobileObjects.includes(looseItems[i]))looseItems.splice(i,1);
 resetFooting();
}
function levelAt(x,y){
 const i=Math.round(y/2)*hitMap.width+Math.round(x/2);
 return upland[i]>0?1:0;
}
function resetFooting(){
 for(const key of Object.keys(footing))footing[key]=0;
}
function objectProfile(o,x,y){
 const dx=x-o.x,dy=y-o.y;
 if(Math.abs(dx)>37||Math.abs(dy)>37)return 2;
 const c=Math.cos(o.a),s=Math.sin(o.a);
 return Math.hypot((dx*c+dy*s)/(o.rx+5),(-dx*s+dy*c)/(o.ry+5));
}
function craterHeight(c,x,y){
 if(c.level!==player.level)return 0;
 const dx=(x-c.x)/c.r,dy=(y-c.y)/c.r;
 if(Math.abs(dx)>1.15||Math.abs(dy)>1.15)return 0;
 const co=Math.cos(c.angle),si=Math.sin(c.angle);
 const u=dx*co+dy*si,v=(-dx*si+dy*co)/c.aspect;
 const a=Math.atan2(v,u),r=Math.hypot(u,v)/(1+.045*Math.sin(a*3+c.phase)+.03*Math.cos(a*5-c.phase));
 const bowl=Math.max(0,1-(r/.81)**2);
 const rim=Math.max(0,1-Math.abs(r-.79)/.23);
 return -c.depth*bowl*bowl+Math.min(6,c.r*.08)*rim*rim;
}
function soilHeight(x,y){
 let height=player.level===1?1.45*Math.sin(x*.038)*Math.cos(y*.031):0;
 for(const [xx,yy,rx,ry] of sector.mud){
  const t=1-((x-xx)/rx)**2-((y-yy)/ry)**2;
  if(t>0)height-=4.5*t*t;
 }
 for(const c of initialCraters)height+=craterHeight(c,x,y);
 for(const c of craters)height+=craterHeight(c,x,y);
 return Math.max(-23,height);
}
function heightAtFoot(x,y){
 let surface=0;
 for(const o of mobileObjects){
  if(o.level!==player.level)continue;
  const p=objectProfile(o,x,y);
  if(p<1)surface=Math.max(surface,o.rise*(1-p*p));
 }
 return {height:soilHeight(x,y)+surface,surface};
}
function contactPlayer(dx,dy,dt){
 if(dt<=0)return;
 const distance=Math.hypot(dx,dy);
 if(distance<.001)return;
 const nx=dx/distance,ny=dy/distance;
 for(const o of mobileObjects){
  if(player.level!==o.level)continue;
  const p=objectProfile(o,player.x,player.y);
  if(p>=1.28)continue;
  const strength=Math.min(1,1.28-p);
  const impulse=distance*strength*(o.kind==='body'?3.3:8.4)/o.mass;
  o.vx+=nx*impulse;o.vy+=ny*impulse;
  const armX=player.x-o.x,armY=player.y-o.y;
  o.spin+=(armX*ny-armY*nx)*impulse/(o.ry*o.ry*.7);
  if(o.touch<=0){
   footing.impact=Math.max(footing.impact,(o.kind==='body'?1.2:1.7)*(input.has('run')?1.4:1));
   foley(['body','sacking'].includes(o.kind)?'mud':['tin-helmet','flask','stake'].includes(o.kind)?'metal':'wood',input.has('run')?.105:.068);
  }
  o.touch=.24;
 }
}
function validPose(o,x,y,a){
 // Four support samples track each elongated item while it slides or rotates.
 const c=Math.cos(a),s=Math.sin(a),level=o.level?upland:clearance;
 for(const [side,along] of [[0,0],[0,o.ry*.77],[0,-o.ry*.77],[o.rx*.68,0],[-o.rx*.68,0]]){
  const xx=x+side*c-along*s,yy=y+side*s+along*c;
  if(xx<4||yy<4||xx>world.width-4||yy>world.height-4)return false;
  const i=Math.round(yy/2)*hitMap.width+Math.round(xx/2);
  if(level[i]<3||trunkAt(xx,yy,2)||fenceDistance(xx,yy)<4||debris.some(d=>!d.broken&&Math.hypot(d.x-xx,d.y-yy)<14))return false;
 }
 return true;
}
function solveContact(a,b){
 if(a.level!==b.level)return;
 if(Math.abs(a.x-b.x)>52||Math.abs(a.y-b.y)>52)return;
 // Each shape is a capsule. Find the closest points on the two centre segments.
 const sax=-Math.sin(a.a),say=Math.cos(a.a),sbx=-Math.sin(b.a),sby=Math.cos(b.a);
 const la=a.ry-a.rx,lb=b.ry-b.rx,dx=b.x-a.x,dy=b.y-a.y,dot=sax*sbx+say*sby;
 const den=1-dot*dot;
 let ta=den>.0001?clamp(((dx*sax+dy*say)-dot*(dx*sbx+dy*sby))/den,-la,la):0;
 const tb=clamp(ta*dot-dx*sbx-dy*sby,-lb,lb);
 ta=clamp(dx*sax+dy*say+tb*dot,-la,la);
 const px=dx+sbx*tb-sax*ta,py=dy+sby*tb-say*ta;
 const gap=Math.hypot(px,py),penetration=a.rx+b.rx-gap;
 if(penetration<=0)return;
 const fallback=Math.hypot(dx,dy);
 const nx=gap>.01?px/gap:fallback?dx/fallback:1;
 const ny=gap>.01?py/gap:fallback?dy/fallback:0;
 const ia=1/a.mass,ib=1/b.mass,correction=Math.min(3,penetration*.7)/(ia+ib);
 const ax=a.x-nx*correction*ia,ay=a.y-ny*correction*ia;
 const bx=b.x+nx*correction*ib,by=b.y+ny*correction*ib;
 if(validPose(a,ax,ay,a.a)){a.x=ax;a.y=ay;}
 if(validPose(b,bx,by,b.a)){b.x=bx;b.y=by;}
 const approach=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
 if(approach<=0)return;
 const impulse=approach*1.06/(ia+ib);
 a.vx-=nx*impulse*ia;a.vy-=ny*impulse*ia;b.vx+=nx*impulse*ib;b.vy+=ny*impulse*ib;
 a.spin-=(sax*ny-say*nx)*ta*impulse*ia/(a.ry*a.ry);
 b.spin+=(sbx*ny-sby*nx)*tb*impulse*ib/(b.ry*b.ry);
}
function advanceLooseObjects(dt,time){
 if(dt<=0)return;
 for(const o of mobileObjects){
  o.touch=Math.max(0,o.touch-dt);
  if(o.alive&&o.shift<24){
   const effort=Math.max(0,Math.sin(time*.0008+o.order)-.55)*dt*1.4;
   o.shift+=effort;o.vx+=Math.sin(o.a)*effort*6;o.vy-=Math.cos(o.a)*effort*6;
  }
  const active=Math.abs(o.vx)+Math.abs(o.vy)+Math.abs(o.spin)*9;
  o.active=active>.08;if(!o.active)continue;
  const oldX=o.x,oldY=o.y;
  const drag=Math.exp(-dt*(o.kind==='body'?7:4.7));
  o.vx=clamp(o.vx*drag,-98,98);o.vy=clamp(o.vy*drag,-98,98);o.spin=clamp(o.spin*drag,-3,3);
  const xx=o.x+o.vx*dt,yy=o.y+o.vy*dt,a=o.a+o.spin*dt;
  if(validPose(o,xx,o.y,o.a))o.x=xx;else o.vx=0;
  if(validPose(o,o.x,yy,o.a))o.y=yy;else o.vy=0;
  if(validPose(o,o.x,o.y,a))o.a=a;else o.spin=0;
  o.travel+=Math.hypot(o.x-oldX,o.y-oldY);
  if(o.travel>=6){
   o.travel=0;
   const surface=surfaceAt(o.x,o.y,o.level);
   if(surface==='water')emit('ring',o.x,o.y,0,0,.70);
   else if(surface!=='wood'){
    dragTracks.push({x:o.x,y:o.y,a:Math.atan2(o.vy,o.vx),width:o.kind==='body'?2.3:1.2,age:0});
    if(dragTracks.length>100)dragTracks.shift();
   }
  }
 }
 for(let i=0;i<mobileObjects.length;i++)for(let j=i+1;j<mobileObjects.length;j++){
  const a=mobileObjects[i],b=mobileObjects[j];if(a.active||b.active)solveContact(a,b);
 }
 for(let i=dragTracks.length-1;i>=0;i--){
  dragTracks[i].age+=dt;
  if(dragTracks[i].age>18)dragTracks.splice(i,1);
 }
 for(let i=0;i<bodies.length;i++){
  const b=bodies[i];fallen[i][0]=b.x;fallen[i][1]=b.y;fallen[i][2]=b.a;
 }
}
function updateFooting(dt){
 const c=Math.cos(player.angle),s=Math.sin(player.angle),stride=Math.sin(player.gait)*3*player.moving;
 const left=heightAtFoot(player.x-c*5+s*stride,player.y-s*5-c*stride);
 const right=heightAtFoot(player.x+c*5-s*stride,player.y+s*5+c*stride);
 const target=(left.height+right.height)*.5;
 footing.support=(left.surface+right.surface)*.5;
 footing.speed+=((target-footing.height)*150-footing.speed*19)*dt;
 footing.height+=footing.speed*dt;
 footing.roll+=(clamp((right.height-left.height)*.014,-.09,.09)-footing.roll)*(1-Math.exp(-dt*18));
 footing.left=left.surface;footing.right=right.surface;
 const bob=(1-Math.cos(player.gait*2))*.5*player.moving*(input.has('run')?1.2:.55);
 footing.bob+=(bob-footing.bob)*(1-Math.exp(-dt*25));
 footing.impact*=Math.exp(-dt*9);
 const targetZ=(player.level?12:0)+footing.height*.6+footing.bob*.55+footing.impact;
 footing.cameraSpeed+=((targetZ-footing.cameraZ)*53-footing.cameraSpeed*11)*dt;
 footing.cameraZ+=footing.cameraSpeed*dt;
}
function pushBlastObjects(x,y,r){
 for(const o of mobileObjects){
  const dx=o.x-x,dy=o.y-y,distance=Math.hypot(dx,dy);
  if(distance>r*1.65)continue;
  const impulse=(1-distance/(r*1.65))*138/Math.sqrt(o.mass);
  o.vx+=dx/(distance||1)*impulse;o.vy+=dy/(distance||1)*impulse;
  o.spin+=Math.sin(o.order*4+dx)*impulse*.035;
 }
}
function drawLooseItems(){
 for(const t of dragTracks){
  const dx=Math.cos(t.a)*3.8,dy=Math.sin(t.a)*3.8,alpha=Math.min(.54,(18-t.age)*.05);
  stroke([[t.x-dx,t.y-dy],[t.x+dx,t.y+dy]],'rgba(42,35,29,'+alpha+')',t.width);
 }
 for(const o of looseItems){
  ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.a);
  ellipse(1.4,2.1,o.rx+1,o.ry,'#171a1875');
  ctx.rotate(Math.sin(o.touch*Math.PI/.24)*.035);
  const sprite=o.kind==='plank'?(o.order%2?'board':'slats'):o.kind==='crate'?(o.order%2?'box':'case'):o.kind;
  if(o.kind==='sacking'){ctx.rotate(Math.PI/2);drawProp(sprite,0,0,o.ry*2.12,o.rx*2.12);}
  else drawProp(sprite,0,0,o.rx*2.12,o.ry*2.12);
  ctx.restore();
 }
}

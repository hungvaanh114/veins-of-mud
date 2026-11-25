'use strict';
const surfaceHeight=new Image();surfaceHeight.src=gameImageURL('surface-height.png');
let brokenRevision=0;
let upland,climb=null,gunKick=0,shock=0,lastShot=-10000,lastBlast=-1;
player.level=0;
const traces=[],bits=[],marks=[],mudPrints=[];
const grassLayer=document.createElement('canvas');
const fences=[[611,694,572,802],[1764,997,1860,1050],[1008,218,1175,191]];
const debris=[
 [1204,752,0.18],[1183,766,-.34],[1507,899,.68],[591,1082,-.2],[725,970,.38],
 [2234,591,-.56],[2143,1312,.28],[850,531,.55],[461,569,-.2],[1477,1065,.21],
 [1864,1137,.72],[2064,459,.1],[1242,741,.68],[1925,619,-.5]
].map(([x,y,a],i)=>({x,y,a,i,broken:false}));
const flight={next:13000,age:-1,x:0,y:0,targetX:0,targetY:0,dropped:false};
const birds=Array.from({length:8},(_,i)=>({i,phase:'away',clock:i*2+1,x:0,y:0,wing:0,target:0}));
const bodies=fallen.map(([x,y,a],i)=>({x,y,a,alive:[0,5,11,15].includes(i),shift:0}));
const weatherChoice=document.querySelector('#weather');
const weather={age:0,clear:1,rain:0,cloud:0,fog:0};
function advanceWeather(dt){
 weather.age+=dt;
 const selected=weatherChoice.value==='auto'?['clear','rain','cloud','fog'][Math.floor(weather.age/34)%4]:weatherChoice.value;
 const blend=1-Math.exp(-dt*(weatherChoice.value==='auto'?.68:1.7));
 for(const key of ['clear','rain','cloud','fog'])weather[key]+=(Number(key===selected)-weather[key])*blend;
 if(soundEnabled&&weatherAudio)weatherAudio.value=.007+.075*weather.rain+.011*weather.cloud;
}
function drawWeatherGround(time){
 const ambient=drawSkyLight();waterSkyGlints(time,ambient);
 if(weather.cloud>.02){
  for(let i=0;i<12;i++){
   const x=(i*357+time*.009)%(world.width+280)-140,y=(i*193)%world.height;
   lightDisk(ctx,x,y,210,'rgba(12,17,26,'+weather.cloud*.36+')');
  }
 }
}
function segmentGap(x,y,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
 return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
function fenceDistance(x,y){
 return Math.min(...fences.map(f=>segmentGap(x,y,...f)));
}
function rubbleSolid(x,y){
 return debris.some(d=>!d.broken&&Math.hypot(x-d.x,y-d.y)<29);
}
function grassAt(x,y){
 return Math.sin(x*.014+Math.cos(y*.016)*2)+Math.sin(y*.027)+Math.sin((x+y)*.009)>.7;
}
function prepareGrass(){
 grassLayer.width=world.width;grassLayer.height=world.height;
 const g=grassLayer.getContext('2d');let seed=181;
 const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<55000;i++){
  const x=rand()*world.width,y=rand()*world.height,idx=(y/2|0)*hitMap.width+(x/2|0);
  if(upland[idx]<6||!grassAt(x,y))continue;
  const reach=2+rand()*6;
  g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+reach*.2,y-2,x+reach,y-3);g.strokeStyle=i%3?'#7980648a':'#a8976a7a';g.lineWidth=.8+rand();g.stroke();
 }
}
function tryClimb(){
 if(!ready||mapOpen||climb)return;
 const next=1-player.level;
 // Probe the facing direction first and nearby angles for a reachable lip.
 for(const turn of [0,-.28,.28,-.56,.56,-.9,.9]){
  const a=player.angle+turn,dx=Math.sin(a),dy=-Math.cos(a);
  let crossed=false;
  for(let n=3;n<=83;n+=3){
   const x=player.x+dx*n,y=player.y+dy*n;
   if(x<24||y<24||x>=world.width-24||y>=world.height-24||fenceDistance(x,y)<23||rubbleSolid(x,y)||trunkAt(x,y,5))break;
   const i=Math.round(y/2)*hitMap.width+Math.round(x/2);
   if(!upland[i]&&!clearance[i]&&n>12){
    // Furniture is solid even at a trench crossing.
    if(sector.props.some(([,px,py,w,h])=>Math.abs(x-px)<=w/2+8&&Math.abs(y-py)<=h/2+8))break;
   }
   const dest=next?upland[i]:clearance[i];
   if(dest>0)crossed=true;
   if(!crossed||dest<31)continue;
   player.level=next;const clear=!blocked(x,y,a);player.level=1-next;
   if(clear){
    climb={x:player.x,y:player.y,toX:x,toY:y,level:next,t:0};
    player.angle=a;foley('mud',.18);return;
   }
  }
 }
}
function advanceClimb(dt){
 const c=climb;c.t=Math.min(1,c.t+dt/.48);
 const t=c.t*c.t*(3-2*c.t);
 player.x=c.x+(c.toX-c.x)*t;player.y=c.y+(c.toY-c.y)*t;
 camera.x+=(player.x-camera.x)*Math.min(1,dt*8);camera.y+=(player.y-camera.y)*Math.min(1,dt*8);
 if(c.t===1){
  player.level=c.level;climb=null;footing.impact=c.level?1.6:3.2;shock=Math.max(shock,.12);
  stepEffects(player.x,player.y,surfaceAt(player.x,player.y),true);
 }
}
function spawnBit(x,y,vx,vy,z,vz,kind,life){
 const spin=Math.random()*7;
 bits.push({x,y,vx,vy,z,vz,kind,life,age:0,spin,size:.8+Math.random()*(kind==='earth'?4:2.7),landed:false});
 if(bits.length>440)bits.shift();
}
function mark(x,y,r,type,angle=0){
 marks.push({x,y,r,type,angle,seed:Math.random()*7});
 if(marks.length>120)marks.shift();
}
function leaveImprint(x,y,a,surface){
 if(surface==='wood'||surface==='water')return;
 mudPrints.push({x,y,a,surface,age:0});
 if(mudPrints.length>125)mudPrints.shift();
}
function soundBurst(kind,level){
 if(!soundEnabled)return;
 const at=audioCtx.currentTime,src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),env=audioCtx.createGain();
 src.buffer=noise;filter.type='lowpass';const shot=kind==='shot';
 filter.frequency.setValueAtTime(shot?5400:1100,at);filter.frequency.exponentialRampToValueAtTime(shot?290:75,at+(shot?.13:1.08));
 env.gain.setValueAtTime(level,at);env.gain.exponentialRampToValueAtTime(.001,at+(shot?.25:1.25));
 src.connect(filter).connect(env).connect(audioBus);src.start(at,Math.random(),shot?.28:1.3);
}
function fireWeapon(){
 if(!ready||climb||mapOpen)return;
 const time=performance.now();if(time-lastShot<260)return;
 lastShot=time;gunKick=1;shock=Math.max(shock,.24);
 const a=player.angle,dx=Math.sin(a),dy=-Math.cos(a),ox=player.x+dx*27+Math.cos(a)*8,oy=player.y+dy*27+Math.sin(a)*8;
 let x=ox,y=oy,material='earth';
 for(let n=0;n<510;n+=3){
  x=ox+dx*n;y=oy+dy*n;
  if(x<2||x>=world.width-2||y<2||y>=world.height-2)break;
  if(trunkAt(x,y)){material='wood';break;}
  if(fenceDistance(x,y)<2.8){material='metal';break;}
  const object=debris.find(o=>!o.broken&&Math.hypot(x-o.x,y-o.y)<13);
  if(object){shatter(object);material='wood';break;}
  const prop=sector.props.find(([,px,py,w,h])=>Math.abs(x-px)<w/2&&Math.abs(y-py)<h/2);
  if(prop){material=['pump','radio','stove','coil'].includes(prop[0])?'metal':'wood';break;}
  const idx=Math.round(y/2)*hitMap.width+Math.round(x/2);
  if(!player.level&&upland[idx]>0){material='earth';break;}
 }
 traces.push({ox,oy,x,y,age:0,a});
 mark(x,y,3.3,'hit',a);soundBurst('shot',.44);
 for(let i=0;i<12;i++)spawnBit(x,y,(Math.random()-.5)*85,(Math.random()-.5)*85,1,24+Math.random()*65,material,.5);
 for(let i=0;i<3;i++)spawnBit(ox,oy,dx*18+10,dy*18,2,9,'smoke',.6);
 scatterCrows(player.x,player.y,440);
}
function shatter(obj){
 obj.broken=true;brokenRevision++;
 for(let i=0;i<13;i++)spawnBit(obj.x,obj.y,(Math.random()-.5)*130,(Math.random()-.5)*130,4,40+Math.random()*80,'wood',.9);
}
function explode(x,y,big){
 startImpact(x,y,big);
}
function scatterCrows(x,y,r){
 for(const b of birds)if(b.phase!=='away'&&Math.hypot(x-b.x,y-b.y)<r){b.phase='flee';b.clock=1.7;}
}
function advanceBattle(dt,time){
 advanceWeather(dt);advanceSky(dt);advanceFrontline(dt);windTime+=dt;
 gunKick=Math.max(0,gunKick-dt*9);shock=Math.max(0,shock-dt*1.55);
 const fxFilter=screenFilters();if(canvas.style.filter!==fxFilter)canvas.style.filter=fxFilter;
 if(time>=boomAt&&boomAt>0&&lastBlast!==boomAt){lastBlast=boomAt;explode(...shellSite,false);}
 for(let i=bits.length-1;i>=0;i--){
  const b=bits[i];b.age+=dt;
  if(b.age>b.life){bits.splice(i,1);continue;}
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.kind==='smoke'){b.z+=dt*9;b.x+=dt*8;}
  else{
   b.vz-=dt*195;b.z=Math.max(0,b.z+b.vz*dt);
   if(!b.z){
    if(!b.landed&&b.vz<0){
     b.landed=true;
     if(b.kind==='spray'&&b.spin>5.6)emit('ring',b.x,b.y,0,0,.55);
     if(b.kind==='earth'&&b.size>3.8){b.vz=-b.vz*.17;b.spin+=1;}
    }
    const damping=Math.exp(-dt*13);b.vx*=damping;b.vy*=damping;
   }
  }
 }
 for(let i=traces.length-1;i>=0;i--){traces[i].age+=dt;if(traces[i].age>.14)traces.splice(i,1);}
 for(const m of mudPrints)m.age+=dt;
 advanceAircraft(dt,time);advancePlumes(dt);
 for(const b of birds){
  b.clock-=dt;b.wing+=dt*11;
  if(b.phase==='away'&&b.clock<=0){
   b.target=(b.target+3+b.i)%fallen.length;
   const [xx,yy]=fallen[b.target];b.x=xx-170;b.y=yy-95;b.phase='approach';b.clock=3.2;
  }else if(b.phase==='approach'){
   const [xx,yy]=fallen[b.target];b.x+=(xx-b.x)*dt*1.3;b.y+=(yy-b.y)*dt*1.3;
   if(b.clock<0){b.phase='feed';b.clock=5+b.i*.4;}
  }else if(b.phase==='feed'){
   if(b.clock<0||Math.hypot(player.x-b.x,player.y-b.y)<76){b.phase='flee';b.clock=1.7;}
  }else if(b.phase==='flee'){
   b.x+=dt*130;b.y-=dt*94;if(b.clock<0){b.phase='away';b.clock=8+b.i;}
  }
 }
}
function screenImpulse(t){
 const k=window.matchMedia('(prefers-reduced-motion: reduce)').matches?.15:1;
 return [Math.sin(t*.095)*shock*5*k,Math.cos(t*.112)*shock*3.8*k];
}
function drawBattleGround(time){
 ctx.drawImage(grassLayer,0,0);drawScars();
 for(const [x,y,bx,by] of fences){
  const length=Math.hypot(bx-x,by-y),a=Math.atan2(by-y,bx-x);
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  stroke([[0,-5],[length,-5]],'#a19c847f',1.2);stroke([[0,5],[length,5]],'#413f34',1.6);
  for(let u=0;u<length-5;u+=5)stroke([[u,0],[u+2.5,-5],[u+5,0],[u+2.5,5],[u,0]],'#b7b7a096',.86);
  for(let u=0;u<length;u+=24){
   ellipse(u+.8,1,3.6,3.2,'#262823');ellipse(u,0,2.7,2.7,'#74654d');
   stroke([[u-1.4,-1],[u+.4,-1.5]],'#b1a48a',.7);
  }
  ctx.restore();
 }
 for(const obj of debris){
  ctx.save();ctx.translate(obj.x,obj.y);ctx.rotate(obj.a);
  if(!obj.broken){
   drawProp(obj.i%2?'case':'box',0,0,31,25);
  }else{
   for(let i=0;i<5;i++){ctx.save();ctx.translate(Math.sin(i*4+obj.i)*17,Math.cos(i*3)*13);ctx.rotate(i*2.39+obj.i);drawProp(i%2?'board':'slats',0,0,3+i%3,8+i*1.3);ctx.restore();}
  }
  ctx.restore();
 }
 for(const m of marks)ellipse(m.x,m.y,m.r,m.r*.69,'#211d18cc',m.angle);
 for(const p of mudPrints){
  if(p.age>28)continue;ctx.save();ctx.globalAlpha=Math.min(.85,(28-p.age)/8);
  ellipse(p.x+1,p.y+1,2.9,5.4,'#ae967c78',p.a);ellipse(p.x,p.y,2.5,4.9,'#292a22ce',p.a);ctx.restore();
 }
 // Narrow windblown dust trails skim the ground between gusts.
 for(let i=0;i<170;i++){
  const x=(i*337.31)%world.width,y=(i*189.43)%world.height;
  if(!grassAt(x,y)||upland[(Math.floor(y/2)*hitMap.width+Math.floor(x/2))]<7)continue;
  const gust=3+3*Math.sin(time*.0022+i*.81);
  stroke([[x,y],[x+1,y-3],[x+gust,y-6]],'#8f907678',.85);
 }
 for(let i=0;i<10;i++){
  const x=(i*329+time*.023)%world.width,y=(i*223+Math.sin(time*.001+i)*4)%world.height;
  stroke([[x,y],[x+9,y-1],[x+21,y]],'#afa99131',.7);
 }
}
function drawCasualty(i,time){
 const b=bodies[i],p=time*.001;
 const wave=b.alive?Math.max(0,Math.sin(p*.56+i))**6:0;
 const slide=b.alive?3.4*Math.sin(p*.25+i):0;
 const x=b.x+slide*Math.sin(b.a),y=b.y-slide*Math.cos(b.a);
 ctx.save();ctx.translate(b.homeX,b.homeY);ctx.rotate(fallenRestAngles[i]);
 for(let k=0;k<4;k++){const size=1-Math.exp(-Math.max(1,time*.00012+i*.25));ellipse(-2+k*2,2+k,3+k*size,2+k*.8*size,'#562a29a6',.32);}
 ctx.restore();
 ctx.save();ctx.translate(x+wave*1.1,y);
 const compression=Math.min(1,b.touch/.24);
 ctx.scale(1+compression*.045,1-compression*.035);
 drawFallen(0,0,b.a+wave*.055,i);ctx.restore();
}
function drawShots(time){
 for(const t of traces){
  const alpha=1-t.age/.14;
  const start=clamp(t.age*5.3,0,.8),sx=t.ox+(t.x-t.ox)*start,sy=t.oy+(t.y-t.oy)*start;
  stroke([[sx,sy],[t.x,t.y]],'rgba(231,166,83,'+(alpha*.58)+')',1.7);
  stroke([[(sx+t.x)*.5,(sy+t.y)*.5],[t.x,t.y]],'rgba(255,231,178,'+(alpha*.89)+')',.64);
  if(t.age<.075){
   lightDisk(ctx,t.ox,t.oy,45,'#ffae414c');ctx.save();ctx.translate(t.ox,t.oy);ctx.rotate(t.a);
   const w=9+alpha*6,h=14+alpha*15,sheet=detailArt.flames,cell=sheet.naturalWidth/8;
   const f=Math.floor(t.age*420)%32;ctx.globalCompositeOperation='screen';
   ctx.drawImage(sheet,f%8*cell,Math.floor(f/8)*cell,cell,cell,-w/2,-h+2,w,h);ctx.restore();
  }
 }
}
function drawFragments(){
 for(const b of bits){
  const t=b.age/b.life;
  if(b.kind==='smoke'){drawDust(b.x,b.y-b.z,7+t*26,b.spin,(1-t)*.48);continue;}
  const air=b.z*.002,xx=b.x+(b.x-viewport.cx)*air,yy=b.y+(b.y-viewport.cy)*air;
  ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*4);
  const r=b.size;
  if(b.z>3&&r>1.5)ellipse(b.x+b.z*.11,b.y+b.z*.075,r*(1+air),r*.57,'rgba(18,17,14,'+(.37/(1+air*5))+')',b.spin);
  ctx.translate(xx,yy);ctx.rotate(b.spin+b.age*(b.landed?0:4.2));
  if(b.kind==='earth'||b.kind==='wood'){
   const wood=b.kind==='wood',img=wood?detailArt.board:detailArt.loam;
   if(wood)ctx.drawImage(img,-r*.5,-r*2,r,r*4);
   else{
    ctx.beginPath();ctx.moveTo(-r,.1*r);ctx.lineTo(-r*.36,-r*.9);ctx.lineTo(r*.74,-r*.52);ctx.lineTo(r,r*.27);ctx.lineTo(-r*.35,r*.75);ctx.closePath();ctx.clip();
    ctx.drawImage(img,Math.floor(70+b.spin*28),46,12,13,-r,-r,2*r,2*r);
   }
  }else if(b.kind==='spray'){
   ellipse(0,0,r*.46,r*.9,'#9cb0afb2');ellipse(-r*.11,-r*.31,r*.17,r*.29,'#dfebe7c9');
  }else{
   const hot=b.kind==='ember';stroke([[0,-r*1.6],[0,r*.65]],hot?'#e38a49':'#efbb70',r*.7);
   ellipse(0,-r*.5,r*.35,r*.55,'#ffdd96');
  }
  ctx.restore();
 }
}
function drawSky(time){
 for(const b of birds){
  if(b.phase==='away')continue;
  const feed=b.phase==='feed',wing=feed?1.5:3+Math.sin(b.wing)*4.5;
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(.54);
  ellipse(0,feed?Math.sin(time*.009)*.8:0,2.6,4.7,'#15191b');
  stroke([[-8,-wing],[-4,0],[0,1],[4,0],[8,-wing]],'#171a1a',feed?1.6:2.1);ctx.restore();
 }
 drawAircraft(time);
}
function drawShockOverlay(){
 if(shock<.14)return;
 ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.fillStyle='rgba(170,155,123,'+(shock*.10)+')';ctx.fillRect(0,0,screenWidth,screenHeight);ctx.restore();
}
const screenFilters=()=>[(grayscale?'grayscale(1)':''),(shock>.3?'blur('+Math.min(1,shock*.8).toFixed(1)+'px)':'')].filter(Boolean).join(' ')||'none';

canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='mouse'||e.button!==0||!ready||mapOpen||climb)return;
 const rect=canvas.getBoundingClientRect();
 const {cx,cy,scale}=viewport;
 const a=Math.atan2((e.clientY-rect.top-screenHeight/2)/scale+cy-player.y,(e.clientX-rect.left-screenWidth/2)/scale+cx-player.x)+Math.PI/2;
 if(!blocked(player.x,player.y,a))player.angle=a;
 fireWeapon();
});
document.querySelector('#touchFire').onclick=fireWeapon;
document.querySelector('#touchClimb').onclick=tryClimb;

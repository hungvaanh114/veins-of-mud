'use strict';
const stations=[
 {prop:'supply',index:0,name:'Kho tiếp tế',off:'Mở hòm tiếp tế',on:'Đóng hòm',opened:false},
 {prop:'radio',index:3,name:'Trạm điện báo',off:'Nối máy điện báo',on:'Ngắt điện báo',opened:false},
 {prop:'medical',index:7,name:'Trạm cứu thương',off:'Thắp đèn trạm',on:'Tắt đèn trạm',opened:false},
 {prop:'stove',index:8,name:'Hầm trú ẩn',off:'Nhóm bếp sưởi',on:'Dập bếp',opened:false},
 {prop:'pump',index:10,name:'Trạm bơm',off:'Khởi động bơm',on:'Ngừng bơm',opened:false}
];
const particles=[];
let wetBoots=0;
let mapOpen=false;
let currentStation=null;
let pumpLevel=1;
const chart=document.querySelector('#chart');
const chartCanvas=document.querySelector('#chartCanvas');
const act=document.querySelector('#action');
const mapButton=document.querySelector('#mapButton');
function surfaceAt(x,y,level=player.level){
 for(const [xx,yy,rx,ry] of sector.water){
  if(((x-xx)/(rx*pumpLevel))**2+((y-yy)/(ry*pumpLevel))**2<1)return 'water';
 }
 for(const [xx,yy,rx,ry] of sector.mud){
  if(((x-xx)/rx)**2+((y-yy)/ry)**2<1)return 'mud';
 }
 return level===1?(grassAt(x,y)?'grass':'earth'):'wood';
}
function emit(kind,x,y,vx,vy,life){
 particles.push({kind,x,y,vx,vy,life,age:0});
 if(particles.length>190)particles.shift();
}
function foley(kind,level=.13){
 if(!soundEnabled||audioCtx.state!=='running')return;
 const at=audioCtx.currentTime;
 const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
 const water=kind==='water',metal=kind==='metal',mud=kind==='mud';
 const leafy=kind==='grass',earth=kind==='earth';
 const duration=water?.19:metal?.24:leafy?.2:mud?.14:.105;
 source.buffer=noise;filter.type=water||leafy?'highpass':'lowpass';filter.frequency.value=water?580:leafy?1460:metal?1820:mud?270:earth?710:400;
 gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(level,at+.009);
 gain.gain.exponentialRampToValueAtTime(.001,at+duration);
 source.connect(filter).connect(gain).connect(audioBus);
 source.start(at,Math.random(),duration);
 if(kind==='wood'||metal){
  const oscillator=audioCtx.createOscillator(),envelope=audioCtx.createGain();
  oscillator.frequency.setValueAtTime(metal?670:108,at);oscillator.frequency.exponentialRampToValueAtTime(metal?410:62,at+duration);
  envelope.gain.setValueAtTime(level*.46,at);envelope.gain.exponentialRampToValueAtTime(.001,at+duration);
  oscillator.connect(envelope).connect(audioBus);oscillator.start(at);oscillator.stop(at+duration);
 }
}
function stepEffects(x,y,surface,run){
 foley(surface,run?.24:.14);
 if(surface==='wood') return;
 const water=surface==='water';
 if(water)emit('ring',x,y,0,0,.81);
 for(let i=0;i<(run?10:5);i++){
  const a=Math.random()*Math.PI*2,s=(run?54:36)*(.4+Math.random());
  emit(water?'drop':surface,x,y,Math.cos(a)*s,Math.sin(a)*s,.25+Math.random()*.39);
 }
}
function updateEffects(dt){
 if(soundEnabled){
  const distances=fires.map(([x,y])=>Math.hypot(x-player.x,y-player.y));
  const stove=sector.props[8],pump=sector.props[10];
  if(stations[3].opened)distances.push(Math.hypot(stove[1]-player.x,stove[2]-player.y));
  const heat=clamp(1-Math.min(...distances)/290,0,1);
  localFireGain.gain.value=.15*heat*(.8+.2*Math.sin(performance.now()*.019));
  localPumpGain.gain.value=stations[4].opened?.11*clamp(1-Math.hypot(pump[1]-player.x,pump[2]-player.y)/270,0,1):0;
 }
 const target=stations[4].opened?.32:1;
 pumpLevel+=(target-pumpLevel)*Math.min(1,dt*.52);
 for(let i=particles.length-1;i>=0;i--){
  const p=particles[i];p.age+=dt;
  if(p.age>=p.life){particles.splice(i,1);continue;}
  p.x+=p.vx*dt;p.y+=p.vy*dt;
 }
}
function drawStepEffects(){
 ctx.save();
 for(const p of particles){
  const t=p.age/p.life;ctx.globalAlpha=1-t;
  if(p.kind==='ring'){
   const a=p.x*.37+p.y*.09;
   ctx.lineWidth=.65+.5*(1-t);
   for(let i=0;i<2;i++){
    ctx.beginPath();ctx.ellipse(p.x,p.y,(2+t*16)*(1-i*.19),(1.5+t*10)*(1-i*.19),.04,a+i*3,a+i*3+1.65+t*.7);
    ctx.strokeStyle=i?'rgba(72,84,82,.59)':'rgba(180,201,192,.55)';ctx.stroke();
   }
  }else{
   const arc=Math.sin(t*Math.PI);
   ellipse(p.x,p.y-arc*7,p.kind==='drop'?1.5:2.1,p.kind==='drop'?1.1:1.5,p.kind==='drop'?'#bdcdd0':p.kind==='grass'?'#969875':p.kind==='earth'?'#a69170':'#73604b');
  }
 }
 ctx.restore();
}
function drawStationObjects(time){
 // Reflections fade while the sump pump drains the flooded duckboards.
 for(const [index,pool] of sector.water.entries()){
  const [x,y,rx,ry]=pool;
  const w=(rx+5)*2*pumpLevel,h=(ry+5)*2*pumpLevel;
  ctx.drawImage(puddleArt[index],x-w/2,y-h/2,w,h);
  ctx.save();ctx.translate(x,y);ctx.scale(rx/ry,1);
  lightDisk(ctx,0,0,ry,'rgba(55,42,28,'+((1-pumpLevel)*.92)+')');
  lightDisk(ctx,0,0,ry*pumpLevel,'rgba(112,153,153,.36)');ctx.restore();
  // Firelight breaks into short highlights along the ripples closest to a burning bank.
  for(const [fx,fy,size] of fires){
   const dx=fx-x,dy=fy-y,d=Math.hypot(dx,dy);
   if(d>Math.max(rx,ry)+100||!withinView(x,y,rx+20))continue;
   const a=Math.atan2(dy/ry,dx/rx);
   for(let n=0;n<11;n++){
    const bend=a+Math.sin(n*4.7+time*.0017)*.29,reach=.45+.44*Math.sin(n*3.7)**2;
    const xx=x+Math.cos(bend)*rx*reach*pumpLevel,yy=y+Math.sin(bend)*ry*reach*pumpLevel;
    const pulse=.13+.2*Math.sin(time*.0029+n*2.5)**2;
    stroke([[xx-2,yy+.4],[xx,yy],[xx+1.7+n%3,yy+.2]],'rgba(219,145,77,'+(pulse*size)+')',.62+n%2*.45);
   }
  }
  for(let i=0;i<5;i++){
   const phase=i*2.399;
   const xx=x+Math.cos(phase)*rx*pumpLevel*.6,yy=y+Math.sin(phase)*ry*pumpLevel*.6;
   stroke([[xx,yy],[xx+3+Math.sin(time*.002+i)*2,yy-.7]],'#9fae9e88',.65);
  }
 }
 for(const prop of sector.props)drawProp(...prop);
 for(const st of stations){
  const [,x,y,w,h]=sector.props[st.index];
  const glow=st.opened||Math.hypot(x-player.x,y-player.y)<95;
  if(glow)lightDisk(ctx,x,y,35,st.opened?'#e5ad5463':'#b9c8a944');
  if(st.prop==='supply'&&st.opened){
   drawProp('debris',x,y,w,h);
   for(let i=0;i<3;i++)ellipse(x-9+i*7,y+1,2.3,4.1,i%2?'#aa9270':'#717862',-.18);
  }else if(st.prop==='radio'&&st.opened){
   const t=(time*.00075)%1;ctx.beginPath();ctx.arc(x,y,9+t*26,0,Math.PI*2);ctx.strokeStyle=`rgba(143,196,162,${.5*(1-t)})`;ctx.stroke();
   ellipse(x+16,y-2,2,2,Math.sin(time*.02)>.1?'#dbb568':'#607161');
  }else if(st.prop==='medical'&&st.opened){lightDisk(ctx,x,y,120,'#ffc37a90');ellipse(x,y,3.3,3.3,'#ffe4a4');}
  else if(st.prop==='stove'&&st.opened){lightDisk(ctx,x,y,13,'#dc732d85');}
  else if(st.prop==='pump'&&st.opened){
   const a=time*.013;stroke([[x-Math.cos(a)*14,y-Math.sin(a)*14],[x+Math.cos(a)*14,y+Math.sin(a)*14]],'#b9b5a0',3);
   lightDisk(ctx,x+14,y,15,'#a4d6ab55');
  }
 }
}
function stationNear(){
 let best=null,nearest=76;
 for(const station of stations){
  const [,x,y]=sector.props[station.index],d=Math.hypot(player.x-x,player.y-y);
  if(d<nearest){best=station;nearest=d;}
 }
 return best;
}
function useStation(){
 if(!ready||mapOpen)return;
 const station=stationNear();if(!station)return;
 station.opened=!station.opened;foley('metal',.27);
 if(station.prop==='radio'&&station.opened&&soundEnabled){
  for(const offset of [0,.14,.47,.68]){
   const at=audioCtx.currentTime+offset,bip=audioCtx.createOscillator(),gain=audioCtx.createGain();
   bip.frequency.value=610;gain.gain.setValueAtTime(.04,at);gain.gain.exponentialRampToValueAtTime(.001,at+.1);
   bip.connect(gain).connect(audioBus);bip.start(at);bip.stop(at+.11);
  }
 }
 updateHud();
}
act.onclick=useStation;
const areaText=document.querySelector('#area');
function updateHud(){
 currentStation=stationNear();
 act.hidden=!currentStation;
 if(currentStation)act.textContent='E · '+(currentStation.opened?currentStation.on:currentStation.off);
 let room=sector.rooms.find(r=>Math.abs(player.x-r.x)<r.w*.7&&Math.abs(player.y-r.y)<r.h*.75);
 const label=player.level===1?'Mặt đất · Vùng pháo kích':room?room.name:'Hào liên lạc';
 if(areaText.textContent!==label)areaText.textContent=label;
}
function drawChart(){
 const rect=chartCanvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
 chartCanvas.width=Math.round(rect.width*dpr);chartCanvas.height=Math.round(rect.height*dpr);
 const c=chartCanvas.getContext('2d');c.scale(dpr,dpr);
 const w=rect.width,h=rect.height,scale=Math.min(w/(world.width+80),h/(world.height+60));
 c.translate((w-world.width*scale)/2,(h-world.height*scale)/2);c.scale(scale,scale);
 c.lineCap='round';c.lineJoin='round';
 for(const path of sector.paths){
  c.beginPath();path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=27;c.strokeStyle='#988d71';c.stroke();
 }
 for(const [x,y,bx,by] of fences){
  c.beginPath();c.moveTo(x,y);c.lineTo(bx,by);c.strokeStyle='#c08269';c.lineWidth=9;c.stroke();
 }
 for(const room of sector.rooms){
  c.fillStyle='#c4b292';c.fillRect(room.x-45,room.y-32,90,64);
  c.fillStyle='#efe4c7';c.textAlign=room.x>world.width*.8?'right':room.x<world.width*.2?'left':'center';c.font=(Math.max(12,Math.min(16,w/34))/scale)+'px system-ui';c.fillText(room.name,room.x,room.y-60);
 }
 c.beginPath();c.arc(player.x,player.y,8/scale,0,Math.PI*2);c.fillStyle='#e8a44c';c.fill();
 c.beginPath();c.arc(player.x,player.y,11/scale,0,Math.PI*2);c.lineWidth=1/scale;c.strokeStyle='#fff1c4';c.stroke();
}
function toggleFieldMap(){
 if(!ready)return;
 mapOpen=!mapOpen;input.clear();chart.hidden=!mapOpen;act.hidden=true;
 mapButton.setAttribute('aria-pressed',mapOpen);
 if(mapOpen){drawChart();document.querySelector('#closeMap').focus();}
 else{mapButton.focus();lastTime=undefined;}
}
mapButton.onclick=toggleFieldMap;
document.querySelector('#closeMap').onclick=toggleFieldMap;
window.addEventListener('resize',()=>{if(mapOpen)drawChart();});
async function startSector(){
 const curtain=document.querySelector('#loading');
 try{
  const images=[map,hitMap,surfaceHeight,...Object.values(playerParts),...Object.values(detailArt),...fallenArt,...puddleArt];
  await Promise.all(images.map(async image=>{
   try { await image.decode(); }
   catch { const name=image.src.startsWith('data:')?'trong bản ngoại tuyến':decodeURIComponent(image.src.split('/').pop());throw new Error('Không đọc được ảnh '+name+'.'); }
  }));
  const maskCanvas=document.createElement('canvas');maskCanvas.width=hitMap.width;maskCanvas.height=hitMap.height;
  const reader=maskCanvas.getContext('2d');reader.drawImage(hitMap,0,0);
  const data=reader.getImageData(0,0,hitMap.width,hitMap.height).data;
  clearance=new Uint8Array(hitMap.width*hitMap.height);
  for(let i=0;i<clearance.length;i++)clearance[i]=data[i*4];
  reader.clearRect(0,0,hitMap.width,hitMap.height);reader.drawImage(surfaceHeight,0,0);
  const land=reader.getImageData(0,0,hitMap.width,hitMap.height).data;
  upland=new Uint8Array(clearance.length);
  for(let i=0;i<upland.length;i++)upland[i]=land[i*4];
  prepareGrass();prepareDamage();setupFooting();prepareTrees();prepareIllumination();prepareMist();ready=true;curtain.hidden=true;requestAnimationFrame(tick);
 }catch(error){
  console.error('Khởi động chiến trường:',error);
  curtain.textContent='Không mở được chiến trường. '+(error.name==='SecurityError'?'Hãy mở CHOI-GAME.html từ thư mục đã giải nén.':error.message);
 }
}
if(!openPortableEdition)startSector();

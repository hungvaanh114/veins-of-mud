'use strict';

const treePositions=[
 [763,885,0,181],[1036,1038,1,197],[683,907,2,93],[1158,675,3,176],
 [530,502,0,171],[404,842,2,94],[713,530,1,198],[905,267,3,150],
 [1485,561,2,117],[1287,1147,0,209],[1694,662,3,197],[1969,893,1,168],
 [2088,521,2,91],[2312,806,0,173],[2535,1103,3,154],[2138,1187,1,178],
 [1715,1500,0,219],[1435,1528,2,103],[1049,1297,3,188],[684,1219,0,156],
 [489,907,2,95],[197,1049,1,192]
];
const deadTrees=treePositions.map(([x,y,type,size],i)=>({x,y,type,size,angle:i*2.39,r:size*(type===2?.109:.067),sway:0}));
const treeShadows=[];
function prepareTrees(){
 for(let i=0;i<4;i++){
  const img=detailArt['dead-tree-'+i],shadow=document.createElement('canvas');
  shadow.width=img.naturalWidth;shadow.height=img.naturalHeight;
  const g=shadow.getContext('2d');g.drawImage(img,0,0);g.globalCompositeOperation='source-in';
  g.fillStyle='#0a1011';g.fillRect(0,0,shadow.width,shadow.height);treeShadows.push(shadow);
 }
}
function trunkAt(x,y,padding=0){
 return deadTrees.find(t=>Math.abs(t.x-x)<t.r+padding&&Math.abs(t.y-y)<t.r+padding&&
  (x-t.x)**2+(y-t.y)**2<(t.r+padding)**2);
}
function drawTreeLayer(time,shadow){
 for(const t of deadTrees){
  if(!withinView(t.x,t.y,t.size*.68))continue;
  const d=Math.hypot(t.x-player.x,t.y-player.y),near=clamp(1-d/(t.size*.44),0,1);
  const wind=(.7+weather.rain*.55)*Math.sin(time*.0011+t.angle)*.006;
  const angle=t.angle+wind+t.sway*Math.sin(t.sway*18)*.044;
  ctx.save();
  if(shadow){
   const fromLamp=lampOn?clamp(1-d/180,0,1):0;
   ctx.translate(t.x+10+sky.day*12+(t.x-player.x)/(d||1)*fromLamp*17,t.y+11+sky.day*7+(t.y-player.y)/(d||1)*fromLamp*17);
   ctx.rotate(angle);ctx.globalAlpha=.36+sky.day*.23+fromLamp*.15;
   ctx.drawImage(treeShadows[t.type],-t.size*.5,-t.size*.5,t.size,t.size);
  }else{
   ctx.translate(t.x,t.y);ctx.rotate(angle);ctx.globalAlpha=1-near*.54;
   ctx.drawImage(detailArt['dead-tree-'+t.type],-t.size*.5,-t.size*.5,t.size,t.size);
  }
  ctx.restore();
 }
}

let nextPass=5.5,passingRound=null;
function passSound(pan,travel){
 if(!soundEnabled||audioCtx.state!=='running')return;
 const at=audioCtx.currentTime,src=audioCtx.createBufferSource(),band=audioCtx.createBiquadFilter();
 const gain=audioCtx.createGain(),panner=audioCtx.createStereoPanner();
 src.buffer=noise;band.type='bandpass';band.Q.value=3.8;
 band.frequency.setValueAtTime(4400,at);band.frequency.exponentialRampToValueAtTime(790,at+.19);
 gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.24,at+.039);
 gain.gain.exponentialRampToValueAtTime(.001,at+.22);
 panner.pan.setValueAtTime(clamp(pan-travel*.52,-.96,.96),at);
 panner.pan.linearRampToValueAtTime(clamp(pan+travel*.52,-.96,.96),at+.16);
 src.connect(band).connect(gain).connect(panner).connect(audioBus);
 src.onended=()=>{src.disconnect();band.disconnect();gain.disconnect();panner.disconnect();};
 src.start(at,Math.random(),.23);
}
function advanceFrontline(dt){
 for(const t of deadTrees)t.sway=Math.max(0,t.sway-dt*.88);
 if(!passingRound){
  nextPass-=dt;if(nextPass>0)return;
  nextPass=range(11,24);
  const a=range(0,turn),dx=Math.cos(a),dy=Math.sin(a),side=(Math.random()<.5?-1:1)*range(32,58);
  passingRound={x:player.x-dy*side,y:player.y+dx*side,dx,dy,age:0,speed:range(1110,1480),heard:false};
 }
 const b=passingRound;b.age+=dt;
 if(!b.heard&&b.age>=.19){
  b.heard=true;
  const gap=Math.hypot(player.x-b.x,player.y-b.y);
  if(gap<124){passSound(clamp((b.x-player.x)/59,-.85,.85),b.dx);shock=Math.max(shock,.13*(1-gap/150));}
 }
 if(b.age>.57)passingRound=null;
}
function drawPassingRound(){
 const b=passingRound;if(!b)return;
 const front=(b.age-.24)*b.speed,tail=front-67;
 const x=b.x+b.dx*front,y=b.y+b.dy*front,xx=b.x+b.dx*tail,yy=b.y+b.dy*tail;
 const opacity=Math.min(1,b.age*14,Math.max(0,(.57-b.age)*9));
 ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=opacity;
 const glint=ctx.createLinearGradient(xx,yy,x,y);
 glint.addColorStop(0,'rgba(218,171,111,0)');glint.addColorStop(.78,'rgba(234,188,131,.55)');glint.addColorStop(1,'#fff1cc');
 stroke([[xx,yy],[x,y]],glint,1.05);
 stroke([[x-b.dx*8,y-b.dy*8],[x,y]],'#ffdda3',1.4);ctx.restore();
}

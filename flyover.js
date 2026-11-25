'use strict';

// Render one large, penumbral shadow to a transparent stamp, then translate it over the terrain.
let aircraftShadow, propellerSignal, engineGain;
function aircraftStamp(){
 const img=document.createElement('canvas');img.width=448;img.height=496;
 const c=img.getContext('2d');c.translate(224,248);c.fillStyle='#13171a';c.strokeStyle='#13171a';
 function shape(points){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
 }
 // Staggered wings, scalloped tips, twin nacelles and a narrow tail in plan view.
 for(const sign of [-1,1]){
  c.save();c.scale(1,sign);
  shape([[-8,4],[-8,174],[-17,183],[-43,182],[-49,177],[-45,126],[-44,47],[-48,12]]);
  shape([[38,6],[35,166],[28,190],[17,195],[-1,193],[-7,188],[-3,124],[-3,36],[-6,9]]);
  shape([[-111,2],[-117,43],[-126,55],[-139,54],[-142,47],[-137,11],[-149,4]]);
  c.beginPath();c.ellipse(6,46,38,9,0,0,turn);c.fill();
  c.fillRect(39,44,5,4);c.fillRect(43,22,2.5,49);
  for(const off of [70,139]){
   c.lineWidth=1.8;c.beginPath();c.moveTo(-28,off-8);c.lineTo(20,off+8);c.stroke();
  }c.restore();
 }
 c.beginPath();c.moveTo(84,0);c.bezierCurveTo(80,-9,55,-13,15,-10);c.quadraticCurveTo(-59,-7,-147,-3);
 c.lineTo(-152,0);c.lineTo(-147,3);c.quadraticCurveTo(-59,7,15,10);c.bezierCurveTo(55,13,80,9,84,0);c.fill();
 const soft=document.createElement('canvas');soft.width=img.width;soft.height=img.height;
 const g=soft.getContext('2d');g.filter='blur(6px)';g.globalAlpha=.74;g.drawImage(img,0,0);
 g.filter='blur(1.5px)';g.globalAlpha=.47;g.drawImage(img,0,0);return soft;
}
function beginFlyover(){
 const [x,y]=impactSite(true);
 Object.assign(flight,{age:0,targetX:x,targetY:y,heading:range(0,turn),speed:range(235,307),size:range(.78,.99),dropped:false});
}
function advanceAircraft(dt,time){
 if(flight.age<0&&time>flight.next)beginFlyover();
 if(flight.age>=0){
  flight.age+=dt;
  const along=(flight.age-4.45)*flight.speed;
  flight.x=flight.targetX+Math.cos(flight.heading)*along;flight.y=flight.targetY+Math.sin(flight.heading)*along;
  if(flight.age>=4.45&&!flight.dropped){flight.dropped=true;explode(flight.targetX,flight.targetY,true);}
  if(flight.age>8.7){flight.age=-1;flight.next=time+range(22000,40000);}
 }
 if(!soundEnabled)return;
 if(!engineGain){
  engineGain=audioCtx.createGain();engineGain.gain.value=0;
  const low=audioCtx.createBiquadFilter();low.type='lowpass';low.frequency.value=260;
  propellerSignal=audioCtx.createOscillator();propellerSignal.type='sawtooth';propellerSignal.frequency.value=42;
  propellerSignal.connect(low).connect(engineGain).connect(audioBus);propellerSignal.start();
 }
 const audible=flight.age>=0?Math.max(0,1-Math.hypot(player.x-flight.x,player.y-flight.y)/1100):0;
 propellerSignal.frequency.setTargetAtTime(34+11*audible+3*Math.sin(flight.age*.6),audioCtx.currentTime,.15);
 engineGain.gain.setTargetAtTime(audible*.12*(.85+.15*Math.sin(flight.age*28)),audioCtx.currentTime,.07);
}
function drawAircraft(time){
 if(flight.age<0)return;
 if(!aircraftShadow)aircraftShadow=aircraftStamp();
 const {x,y,age,heading,size,targetX,targetY}=flight;
 ctx.save();ctx.translate(x,y);ctx.rotate(heading);ctx.scale(size,size);
 ctx.globalAlpha=.6+sky.day*.29+sky.bright*.22+sky.blood*.10;
 ctx.drawImage(aircraftShadow,-224,-248);ctx.restore();
 if(age>3.4&&age<4.45){
  const t=(age-3.4)/1.05,travel=(1-t)*93;
  const xx=targetX-Math.cos(heading)*travel,yy=targetY-Math.sin(heading)*travel;
  ctx.save();ctx.translate(xx,yy);ctx.rotate(heading);
  const sz=1.35-.72*t;ctx.scale(sz,sz);
  ellipse(4*(1-t),5*(1-t),7,3,'#17181975');
  ellipse(0,0,7,2.6,'#24241e');stroke([[-8,-2.6],[-4,0],[-8,2.6]],'#747061',1.2);
  stroke([[1,-1.4],[4,-.8]],'#c6b299',.8);ctx.restore();
 }
}

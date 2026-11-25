'use strict';

// Stream native-detail terrain in camera-sized pieces; retain the sector painting during tile loads.
const tileSize=450;
const terrainTiles=new Map();
function drawDetailedTerrain(cx,cy,halfWidth,halfHeight){
 const left=Math.max(0,Math.floor((cx-halfWidth)/tileSize));
 const top=Math.max(0,Math.floor((cy-halfHeight)/tileSize));
 const right=Math.min(Math.ceil(world.width/tileSize)-1,Math.floor((cx+halfWidth)/tileSize));
 const bottom=Math.min(Math.ceil(world.height/tileSize)-1,Math.floor((cy+halfHeight)/tileSize));
 for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
  const key=row+'-'+col;
  let image=terrainTiles.get(key);
  if(!image){
   image=new Image();image.decoding='async';image.src=gameImageURL('terrain/'+key+'.webp');terrainTiles.set(key,image);
  }
  if(terrainTiles.size>14){
   for(const oldKey of terrainTiles.keys()){
    const [oldRow,oldCol]=oldKey.split('-').map(Number);
    if(oldRow<top-1||oldRow>bottom+1||oldCol<left-1||oldCol>right+1){
     terrainTiles.delete(oldKey);
     if(terrainTiles.size<=14)break;
    }
   }
  }
  if(image.complete&&image.naturalWidth)ctx.drawImage(image,col*tileSize,row*tileSize,tileSize,tileSize);
 }
}
const detailArt={};
for(const name of ['supply','radio','coil','cot','medical','stove','pump','debris','embers','flames','smoke','soil','mist','loam','clay','splinters','char','board','slats','box','case','tin-helmet','sacking','stake','flask','dead-tree-0','dead-tree-1','dead-tree-2','dead-tree-3','soot']){
 const image=new Image();image.src=gameImageURL('details/'+name+'.webp');detailArt[name]=image;
}
function drawProp(kind,x,y,w,h){
 const sprite=detailArt[kind];
 ctx.drawImage(sprite,x-w/2,y-h/2,w,h);
}
function fireBeat(time,x,y){
 const t=time*.001;
 return .82+.072*Math.sin(t*8.1+x*.2)+.064*Math.sin(t*12.35+y*.19)+.039*Math.sin(t*21.65+x+y);
}
function burnMotion(time,x,y){
 const t=time*.001;
 return Math.sin(t*.91+x*.029)*.55+Math.sin(t*1.7+y*.036)*.24+Math.sin(t*.31)*.33;
}
function fireVisible(x,y){
 return Math.abs(x-camera.x)<screenWidth/2+235&&Math.abs(y-camera.y)<screenHeight/2+235;
}
function drawFireBed(time,x,y,s){
 if(!fireVisible(x,y))return;
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(x)*.6);
 // Unburnt ends anchor the incandescent areas to an irregular fuel footprint.
 for(let i=0;i<3;i++){
  ctx.save();ctx.rotate(i*.94+.21*Math.sin(i+x));
  ctx.translate((i-1)*6*s,Math.sin(i*2)*3*s);drawProp(i===1?'slats':'board',0,0,10*s,(56-i*4)*s);ctx.restore();
 }
 drawProp('embers',0,0,47*s,37*s);
 ctx.globalCompositeOperation='screen';
 lightDisk(ctx,0,0,21*s,'rgba(177,44,8,'+(.17*fireBeat(time,x,y))+')');ctx.restore();
}
// The flipbook contains a cyclic deformation of four isolated flame plates.
// Offset different fires in time and in the wind field so they burn independently.
function drawFire(time,x,y,s){
 if(!fireVisible(x,y))return;
 const frame=Math.floor(time*.022+x*.31+y*.07)%64;
 const flicker=fireBeat(time,x,y),wind=burnMotion(time,x,y);
 const size=58*s;
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(x)*2.7);ctx.globalCompositeOperation='screen';
 const sprite=detailArt.flames,cell=sprite.naturalWidth/8;
 ctx.scale(1+wind*.035,1-wind*.026);
 const spread=.84+.15*Math.sin(x*.31);
 for(let i=0;i<3;i++){
  const f=(frame+17*i)%64,ux=[-5,7,-12][i]*s,uy=[1,-6,7][i]*s;
  const w=size*[.66,.44,.30][i]*spread,h=size*[.47,.32,.27][i];
  ctx.save();ctx.translate(ux,uy);ctx.rotate(i*1.47+x*.013+wind*.05);
  ctx.globalAlpha=(.81+.14*Math.sin(time*.008+i*3+x))*(1-weather.rain*.17);
  ctx.drawImage(sprite,f%8*cell,Math.floor(f/8)*cell,cell,cell,-w/2,-h/2,w,h);ctx.restore();
 }
 ctx.restore();
 // Hot fragments detach from the fuel, dim to red and drift with the same gust as the smoke.
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<12;i++){
  const p=(time*(.00043+.00005*(i%4))+i*.389+x*.017)%1;
  const a=i*2.399+y*.12;
  const sx=x+s*(Math.cos(a)*(10+11*p)+p*(19+wind*16)+Math.sin(p*5+a)*4);
  const sy=y+s*(Math.sin(a)*(11+9*p)+p*(5+wind*6));
  const fade=Math.sin(p*Math.PI)*(1-p);
  stroke([[sx,sy],[sx-s*.8*(1+wind),sy+s*(1.2+p)]],'rgba(255,'+Math.round(85+90*flicker)+',48,'+fade+')',s*(.55+.65*(1-p)));
 }
 ctx.restore();
}
function drawSmoke(time,x,y,s){
 if(!fireVisible(x,y))return;
 const sheet=detailArt.soot,cell=sheet.naturalWidth/4;
 const wind=burnMotion(time,x,y);
 for(let i=0;i<7;i++){
  const p=(time*(.00018+i*.000004)+i/7+x*.003)%1;
  const wobble=Math.sin(i*2.4+p*5+y);
  const xx=x+s*(p*(42+24*wind)+p*p*31+wobble*4);
  const yy=y+s*(p*(8+18*wind)+p*wobble*6);
  const size=s*(8+53*p);
  ctx.save();ctx.translate(xx,yy);ctx.rotate(i*2.12+p*.64);ctx.globalAlpha=Math.sin(p*Math.PI)*(.39-.13*p)*(1+.18*weather.rain);
  const f=(i+Math.floor(x))%8;
  ctx.drawImage(sheet,(f%4)*cell,Math.floor(f/4)*cell,cell,cell,-size/2,-size/2,size,size);
  ctx.restore();
 }
}
// A pressure flash rolls out of the impact before the dirt plume rises.
function drawImpactFlame(age,x,y,radius){
 if(age<0||age>.31||!fireVisible(x,y))return;
 const progress=age/.31;
 const sprite=detailArt.flames,cell=sprite.naturalWidth/8;
 const frame=Math.floor(12+progress*38);
 ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='screen';
 for(let i=0;i<3;i++){
  const size=radius*(.45+.78*Math.sqrt(progress))*(1-i*.1);
  ctx.save();ctx.rotate(i*2.14+x*.05);
  ctx.globalAlpha=(1-progress)**1.5*(.9-i*.13);
  ctx.drawImage(sprite,(frame%8)*cell,Math.floor(frame/8)*cell,cell,cell,-size*.5,-size*.5,size,size);
  ctx.restore();
 }
 ctx.restore();
}
function drawDust(x,y,r,pattern,opacity,material='smoke'){
 const sheet=detailArt[material],cell=sheet.naturalWidth/4;
 const frame=Math.abs(Math.floor(pattern))%8;
 ctx.save();ctx.translate(x,y);ctx.rotate(pattern*.73);ctx.globalAlpha=opacity;
 ctx.drawImage(sheet,frame%4*cell,Math.floor(frame/4)*cell,cell,cell,-r,-r,2*r,2*r);
 ctx.restore();
}

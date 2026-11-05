import {CITY_STOPS,roadRoute} from './journey.mjs';
export const MAP_EXTENT=680;
export function mapTransform(width,height){
 const scale=Math.min((width-48)/(MAP_EXTENT*2),(height-48)/(MAP_EXTENT*2));
 return {scale,point:(p)=>({x:width/2+p.x*scale,y:height/2+p.z*scale})};
}
export function drawCityMap(ctx,width,height,{player,heading=0,target,stops=[],stage=0}={}){
 const {scale,point}=mapTransform(width,height);
 ctx.clearRect(0,0,width,height);
 const grd=ctx.createLinearGradient(0,0,width,height);
 grd.addColorStop(0,'#0d2635');grd.addColorStop(1,'#183e4c');
 ctx.fillStyle=grd;ctx.fillRect(0,0,width,height);
 // Water and coastline follow the same orientation as the 3D beach.
 const shore=point({x:0,z:-430}).y;
 ctx.fillStyle='#174a61';ctx.fillRect(0,0,width,Math.max(0,shore));
 ctx.fillStyle='#927e5e';ctx.fillRect(0,shore-4,width,13);
 ctx.lineWidth=Math.max(1,scale*5);ctx.strokeStyle='rgba(215,235,219,.10)';
 for(let grid=-600;grid<=600;grid+=100){
  const x=point({x:grid,z:0}).x,y=point({x:0,z:grid}).y;
  ctx.beginPath();ctx.moveTo(x,point({x:0,z:-400}).y);ctx.lineTo(x,height);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();
 }
 if(player&&target){
  const route=roadRoute(player,target);
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const [color,size] of [['rgba(3,18,27,.65)',10],['#67e6cf',4]]){
   ctx.beginPath();route.forEach((p,i)=>{const v=point(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});
   ctx.strokeStyle=color;ctx.lineWidth=size;ctx.stroke();
  }
 }
 if(stops.length>1){
  ctx.beginPath();stops.slice(stage).forEach((stop,i)=>{const p=point(stop);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});
  ctx.strokeStyle='rgba(235,191,129,.48)';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.stroke();ctx.setLineDash([]);
 }
 const hits=[];
 for(const stop of CITY_STOPS){
  const p=point(stop),active=target?.id===stop.id;
  ctx.beginPath();ctx.arc(p.x,p.y,active?8:6,0,Math.PI*2);
  ctx.fillStyle=active?'#f9d3a0':stop.accent;ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#061c2a';ctx.stroke();
  ctx.fillStyle='#eaf8fa';ctx.font=`${Math.max(11,Math.min(15,width/65))}px system-ui`;
  ctx.textAlign='center';ctx.fillText(stop.name,p.x,Math.max(16,p.y-15));
  hits.push({id:stop.id,x:p.x,y:p.y});
 }
 if(player){
  const p=point(player);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-heading);
  ctx.fillStyle='#fff';ctx.strokeStyle='#092c3b';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(-8,10);ctx.lineTo(0,6);ctx.lineTo(8,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
 return hits;
}
export function nearestMapStop(hits,x,y,radius=24){
 return hits.map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).filter(p=>p.d<=radius).sort((a,b)=>a.d-b.d)[0]?.id||null;
}

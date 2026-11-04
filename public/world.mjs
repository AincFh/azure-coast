// Deterministic, bounded, streamable district generation. Pure module, tested without WebGL.
export const TILE_SIZE=240;
export const ACTIVE_RADIUS=2;
export const DISTRICTS=['Coral Bay','Marina Vista','Sunset Hills','Civic Center','Old Harbor','Palm Estates','West Dunes','Airport Quarter'];
export function hash(x,z,s=0){let h=(Math.imul(x,374761393)+Math.imul(z,668265263)+Math.imul(s+1,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
export const tileKey=(x,z)=>`${x}:${z}`;
export function districtAt(x,z){return DISTRICTS[Math.floor(hash(Math.floor(x/4),Math.floor(z/4),18)*DISTRICTS.length)]}
export function generateTile(tx,tz){const objects=[];const baseX=tx*TILE_SIZE,baseZ=tz*TILE_SIZE;const coastal=tz<=-3;for(let i=0;i<24;i++){const gx=i%6,gz=Math.floor(i/6),x=baseX+gx*40+20,z=baseZ+gz*60+30;const r=hash(tx*31+i,tz*17-i);if(coastal){if(r>.34)objects.push({kind:'palm',x,z,height:8+r*7});continue}if(gx===0||gz===0){if(r>.5)objects.push({kind:'palm',x,z,height:8+r*6});continue}objects.push({kind:'building',x,z,width:18+r*12,depth:20+hash(tx+i,tz)*13,height:12+Math.pow(r,2)*115,color:Math.floor(hash(tx+i,tz-i,9)*4)})}return {tx,tz,key:tileKey(tx,tz),name:districtAt(tx,tz),coastal,objects}}
export function desiredTiles(x,z,radius=ACTIVE_RADIUS){const cx=Math.floor(x/TILE_SIZE),cz=Math.floor(z/TILE_SIZE),keys=[];for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)keys.push([cx+dx,cz+dz]);return keys}
export function updateTiles(loaded,x,z,create,dispose,radius=ACTIVE_RADIUS){const targets=desiredTiles(x,z,radius),wanted=new Set(targets.map(([a,b])=>tileKey(a,b)));for(const [key,obj] of loaded)if(!wanted.has(key)){dispose(obj,key);loaded.delete(key)}for(const [a,b] of targets){const key=tileKey(a,b);if(!loaded.has(key))loaded.set(key,create(generateTile(a,b)))}return loaded.size}
export function pedestrianStep(p,controls,dt){const speed=controls.sprint?9:5;const dx=(Number(!!controls.right)-Number(!!controls.left)),dz=(Number(!!controls.back)-Number(!!controls.forward));const len=Math.hypot(dx,dz)||1;return {x:p.x+dx/len*speed*dt,z:p.z+dz/len*speed*dt,heading:dx||dz?Math.atan2(-dx,-dz):p.heading}}
export function canEnterVehicle(player,vehicle,maxDistance=12){return Math.hypot(player.x-vehicle.x,player.z-vehicle.z)<=maxDistance}

/** Renderer-independent restoration safeguards. Never spawn a player inside a building. */
import {intersectsBuilding,nearbyObstacles} from './physics.mjs';
export const WORLD_LIMIT=640;
export function safeSpawn(point,radius=1,obstacleAt=nearbyObstacles){
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return null;
  const x=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,point.x));
  const z=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,point.z));
  const free=(px,pz)=>Math.abs(px)<=WORLD_LIMIT&&Math.abs(pz)<=WORLD_LIMIT&&!intersectsBuilding(px,pz,radius,obstacleAt(px,pz));
  if(free(x,z))return {x,z};
  // Stable outward search: nearest feasible location, deterministic across reloads.
  for(let distance=radius*2;distance<=48;distance+=radius*2){
    const count=Math.max(16,Math.ceil(2*Math.PI*distance/(radius*2)));
    for(let i=0;i<count;i++){
      const angle=2*Math.PI*i/count;
      const px=x+Math.cos(angle)*distance,pz=z+Math.sin(angle)*distance;
      if(free(px,pz))return {x:px,z:pz};
    }
  }
  return null;
}
export function sanitizeProgress(raw,missionCount){
  const value=raw&&typeof raw==='object'?raw:{};
  const finite=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
  return {
    stage:Math.floor(finite(value.stage,missionCount)),
    credits:Math.floor(finite(value.credits,1e9)),
    distance:finite(value.distance,1e9),
    bestSpeed:finite(value.bestSpeed,1000),
    damage:finite(value.damage,100)
  };
}

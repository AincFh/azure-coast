/** Deterministic, renderer-independent driving and mission state. */
export const ROUTE = Object.freeze([
 {id:'marina',name:'滨海大道',x:0,z:-290,reward:1200},
 {id:'harbor',name:'游艇港',x:305,z:-390,reward:1800},
 {id:'downtown',name:'市中心',x:300,z:210,reward:2400},
 {id:'cliff',name:'山崖观景台',x:-310,z:310,reward:3000},
 {id:'return',name:'海滨终点',x:0,z:12,reward:5000}
]);
export function createProgress(data={}){return {stage:Math.max(0,Math.min(ROUTE.length,Number(data.stage)||0)),credits:Math.max(0,Number(data.credits)||0),distance:Math.max(0,Number(data.distance)||0),bestSpeed:Math.max(0,Number(data.bestSpeed)||0),damage:Math.max(0,Math.min(100,Number(data.damage)||0))}}
export function advanceMission(progress,x,z,radius=14){const m=ROUTE[progress.stage];if(!m||Math.hypot(x-m.x,z-m.z)>radius)return {progress,completed:null};return {progress:{...progress,stage:progress.stage+1,credits:progress.credits+m.reward},completed:m}}
/**
 * Three coherent road conditions. Rain affects longitudinal grip, braking and
 * cornering; overcast has a small effect on road grip. Clear weather preserves
 * the existing steering and driving model exactly.
 *
 * These are game-specific handling coefficients, not real vehicle ABS data.
 */
export const ROAD_HANDLING=Object.freeze({
 clear:Object.freeze({label:'干燥路面',acceleration:1,braking:1,steering:1}),
 overcast:Object.freeze({label:'微湿路面',acceleration:.96,braking:.94,steering:.96}),
 rain:Object.freeze({label:'雨天湿滑',acceleration:.72,braking:.69,steering:.72})
});
export function roadHandling(weather='clear'){
 return Object.prototype.hasOwnProperty.call(ROAD_HANDLING,weather)?ROAD_HANDLING[weather]:ROAD_HANDLING.clear;
}
/** Approximate braking distance in world metres at the current world speed.
 * Driver reaction time is intentionally excluded. */
export function estimatedStoppingDistance(speed,weather='clear',baseBrake=1){
 const velocity=Number.isFinite(speed)?Math.max(0,Math.min(107,Math.abs(speed))):0;
 const factor=Number.isFinite(baseBrake)?Math.max(.7,Math.min(1.3,baseBrake)):1;
 const decel=35*factor*roadHandling(weather).braking;
 return Math.min(1000,Math.round(velocity*velocity/(2*decel)));
}
export function stepVehicle(state,input,dt,tuning={}){
 const t=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
 const throttle=Number(!!input.forward)-Number(!!input.reverse);
 const acceleration=Number.isFinite(tuning.acceleration)?
  Math.max(.65,Math.min(2.8,tuning.acceleration)):1;
 const brake=Number.isFinite(tuning.braking)?Math.max(.7,Math.min(1.3,tuning.braking)):1;
 const maxSpeed=Number.isFinite(tuning.maxSpeed)?Math.max(3,Math.min(107,tuning.maxSpeed)):49;
 const responsiveness=Number.isFinite(tuning.steering)?Math.max(.6,Math.min(1.8,tuning.steering)):1;
 const surface=roadHandling(tuning.weather);
 const decelerating=throttle!==0&&Math.abs(state.speed)>.2&&
  Math.sign(throttle)!==Math.sign(state.speed);
 // Traction controls acceleration, while reduced wet braking lengthens the
 // stopping zone. No changes to speed caps or gas/fuel consumption contracts.
 const grip=decelerating?surface.braking:surface.acceleration;
 let speed=state.speed+
  throttle*(throttle>0?27:35*(state.speed>0?brake:1))*acceleration*grip*t;
 speed-=Math.sign(speed)*Math.min(Math.abs(speed),3.4*t);
 speed=Math.max(-16,Math.min(maxSpeed,speed));
 if(!throttle)speed*=Math.pow(.987,t*60);
 const steering=Number(!!input.left)-Number(!!input.right);
 const heading=state.heading+steering*t*speed*.016*responsiveness*surface.steering;
 return {speed,heading,x:state.x-Math.sin(heading)*speed*t,
  z:state.z-Math.cos(heading)*speed*t};
}
export function collisionDamage(speed){return Math.min(28,Math.max(4,Math.round(Math.abs(speed)*.55)))}

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
export function stepVehicle(state,input,dt){const t=Math.max(0,Math.min(.05,dt));const throttle=Number(!!input.forward)-Number(!!input.reverse);let speed=state.speed+throttle*(throttle>0?27:35)*t;speed-=Math.sign(speed)*Math.min(Math.abs(speed),3.4*t);speed=Math.max(-16,Math.min(49,speed));if(!throttle)speed*=Math.pow(.987,t*60);const steering=(Number(!!input.left)-Number(!!input.right));const heading=state.heading+steering*t*speed*.016;return {speed,heading,x:state.x-Math.sin(heading)*speed*t,z:state.z-Math.cos(heading)*speed*t}}
export function collisionDamage(speed){return Math.min(28,Math.max(4,Math.round(Math.abs(speed)*.55)))}

/** Deterministic environment state shared by UI and renderer. */
export const WEATHER=['clear','overcast','rain'];
export function normalizeEnvironment(raw={}){
 const hour=Number.isFinite(raw.hour)?Math.max(0,Math.min(23,Math.floor(raw.hour))):16;
 return {hour,weather:WEATHER.includes(raw.weather)?raw.weather:'clear',autoCycle:raw.autoCycle===true};
}
export function environmentLighting(input){
 const {hour,weather}=normalizeEnvironment(input);
 const solar=Math.max(0,Math.sin((hour-6)/12*Math.PI));
 const cloud=weather==='clear'?1:weather==='overcast'?.67:.42;
 return {sunIntensity:.18+2.55*solar*cloud,ambientIntensity:.36+1.45*solar*cloud,exposure:.63+.57*solar*cloud,fogDensity:weather==='rain'?.004:weather==='overcast'?.0028:.0018,headlights:solar<.3||weather==='rain',sky:solar<.12?0x14253b:weather==='rain'?0x6a7d88:weather==='overcast'?0x9baab2:0x8bc6d3};
}
export function findSafeExit(car,heading,obstacles,radius=.7){
 const offsets=[[5,0],[-5,0],[0,7],[0,-7],[8,0],[-8,0]];
 for(const [dx,dz] of offsets){const x=car.x+dx*Math.cos(heading)+dz*Math.sin(heading),z=car.z-dx*Math.sin(heading)+dz*Math.cos(heading);
 if(!obstacles.some(b=>{const cx=Math.max(b.x-b.width/2,Math.min(x,b.x+b.width/2)),cz=Math.max(b.z-b.depth/2,Math.min(z,b.z+b.depth/2));return (x-cx)**2+(z-cz)**2<radius**2}))return {x,z};}
 return null;
}

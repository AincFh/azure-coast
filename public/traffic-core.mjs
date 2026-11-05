/**
 * AZURE COAST — deterministic ambient road traffic.
 * Pure simulation: the renderer is a replaceable InstancedMesh adapter.
 * Road lanes are 4 metres from the centreline, with 100 m junction spacing.
 */
export const TRAFFIC_GRID=100;
export const TRAFFIC_LIMIT=645;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const trafficHash=(id,seed=0)=>{
 let n=Math.imul((id|0)+9007,374761393)^Math.imul((seed|0)+17,668265263);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
};
export function trafficPosition(car){
 return car.axis==='z'?{x:car.road*TRAFFIC_GRID+car.dir*4,z:car.coord}:
  {x:car.coord,z:car.road*TRAFFIC_GRID-car.dir*4};
}
export function createTrafficAgents(count=42){
 const amount=clamp(Number.isFinite(count)?Math.floor(count):0,0,90);
 return Array.from({length:amount},(_,id)=>{
  const axis=id%4<2?'z':'x',road=((id*7)%11)-5,dir=id%2?1:-1;
  let coord=-570+trafficHash(id,13)*1140;
  if(road===0&&Math.abs(coord)<90)coord+=dir*105;
  return {id,axis,road,dir,coord,speed:4+trafficHash(id,17)*6,
   cruise:8+trafficHash(id,19)*7,odometer:0};
 });
}
const positiveMod=(x,n)=>((x%n)+n)%n;
export function signalIsGreen(axis,road,cross,seconds){
 const offset=positiveMod(Math.abs(road*11+cross*7),5)*2;
 const phase=positiveMod(seconds+offset,32);
 // A two-second all-red clearance interval separates each direction.
 return axis==='z'?phase<14:phase>=16&&phase<30;
}
export function nextJunction(agent){
 const step=agent.dir;
 return step>0
  ?Math.ceil((agent.coord+.001)/TRAFFIC_GRID)*TRAFFIC_GRID
  :Math.floor((agent.coord-.001)/TRAFFIC_GRID)*TRAFFIC_GRID;
}
export function trafficTargetSpeed(agent,cars,timeSeconds,player=null){
 let target=agent.cruise;
 const junction=nextJunction(agent),stop=junction-agent.dir*12;
 const remaining=agent.dir*(stop-agent.coord);
 if(remaining>=0&&remaining<48&&!signalIsGreen(agent.axis,agent.road,Math.round(junction/100),timeSeconds))
  target=Math.min(target,Math.max(0,Math.sqrt(2*6*remaining)-.4));
 // Adaptive cruise control: a moving vehicle never drives through the one ahead.
 for(const other of cars){
  if(other.id===agent.id||other.axis!==agent.axis||other.road!==agent.road||other.dir!==agent.dir)continue;
  const gap=agent.dir*(other.coord-agent.coord);
  if(gap>0&&gap<47)target=Math.min(target,Math.max(0,(gap-11)*.65));
 }
 if(player&&Number.isFinite(player.x)&&Number.isFinite(player.z)){
  const lane=agent.axis==='z'?agent.road*100+agent.dir*4:agent.road*100-agent.dir*4;
  const lateral=agent.axis==='z'?Math.abs(player.x-lane):Math.abs(player.z-lane);
  const longitudinal=agent.axis==='z'?player.z:player.x;
  const gap=agent.dir*(longitudinal-agent.coord);
  if(lateral<4.3&&gap>0&&gap<35)
   target=Math.min(target,Math.max(0,(gap-13)*.7));
 }
 return clamp(target,0,25);
}
export function tickTraffic(cars,dt,timeSeconds,player=null){
 const t=clamp(Number.isFinite(dt)?dt:0,0,.06);
 if(!t)return cars.map(c=>({...c}));
 return cars.map(agent=>{
  const target=trafficTargetSpeed(agent,cars,timeSeconds,player);
  const acceleration=target>agent.speed?3.2:9;
  let speed=agent.speed+clamp(target-agent.speed,-acceleration*t,acceleration*t);
  // Hard safety clamp is needed when a fast agent starts close behind a
  // stopped vehicle: comfortable braking alone cannot prevent overlap.
  let travel=Math.max(0,speed)*t;
  for(const other of cars){
   if(other.id===agent.id||other.axis!==agent.axis||other.road!==agent.road||other.dir!==agent.dir)continue;
   const gap=agent.dir*(other.coord-agent.coord);
   if(gap>0&&gap<18)travel=Math.min(travel,Math.max(0,gap-8));
  }
  if(player&&Number.isFinite(player.x)&&Number.isFinite(player.z)){
   const pos=trafficPosition(agent),lateral=agent.axis==='z'?Math.abs(player.x-pos.x):Math.abs(player.z-pos.z);
   const forward=agent.dir*((agent.axis==='z'?player.z:player.x)-agent.coord);
   if(lateral<4.3&&forward>0&&forward<22)
    travel=Math.min(travel,Math.max(0,forward-12));
  }
  speed=Math.min(speed,travel/t);
  let coord=agent.coord+agent.dir*travel;
  if(coord>TRAFFIC_LIMIT)coord=-TRAFFIC_LIMIT;
  if(coord< -TRAFFIC_LIMIT)coord=TRAFFIC_LIMIT;
  return {...agent,coord,speed:Math.max(0,speed),odometer:agent.odometer+Math.max(0,speed)*t};
 });
}
export function trafficMetrics(cars){
 if(!cars.length)return {cars:0,moving:0,stopped:0,meanSpeed:0};
 const moving=cars.filter(c=>c.speed>.7).length;
 return {cars:cars.length,moving,stopped:cars.length-moving,
  meanSpeed:Math.round(cars.reduce((sum,c)=>sum+c.speed,0)/cars.length*3.6)};
}

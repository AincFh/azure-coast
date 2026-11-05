/**
 * Six distinguishable, original procedural 3D vehicle bodies.
 * A car really changes mesh, wheelbase, silhouette and lighting when selected.
 * Front = -Z; the existing playable-world collision envelope is preserved.
 */
import {createSportsCar} from './vehicle-art.mjs';
import {fleetVehicle,STARTER_ID} from './fleet.mjs';
const presets={
 solstice:{length:7.45,width:3.85,base:1.00,roof:2.57,hood:2.60,tail:2.23,topFront:-.85,topRear:1.12,tire:.73,tread:2.39},
 vantage:{length:7.20,width:3.62,base:1.10,roof:2.73,hood:2.33,tail:2.33,topFront:-.82,topRear:1.31,tire:.74,tread:2.31},
 tide:{length:7.53,width:3.61,base:1.09,roof:2.76,hood:2.26,tail:2.39,topFront:-1.02,topRear:1.52,tire:.72,tread:2.45},
 atlas:{length:8.1,width:4.08,base:1.45,roof:3.54,hood:2.58,tail:2.37,topFront:-1.35,topRear:2.30,tire:.89,tread:2.68},
 retro:{length:7.52,width:3.72,base:1.38,roof:2.83,hood:2.92,tail:2.52,topFront:-.72,topRear:1.51,tire:.82,tread:2.43},
 comet:{length:7.88,width:4.11,base:.92,roof:2.33,hood:2.73,tail:2.26,topFront:-1.00,topRear:1.18,tire:.72,tread:2.67}
};
function cabinGeometry(THREE,width,bottom,top,zFront,zRear,topFront,topRear,roofWidth){
 const g=new THREE.BufferGeometry(),w=width/2,tw=roofWidth/2;
 const a=[
  [-w,bottom,zFront],[w,bottom,zFront],[w,bottom,zRear],[-w,bottom,zRear],
  [-tw,top,topFront],[tw,top,topFront],[tw,top,topRear],[-tw,top,topRear]
 ];
 const faces=[
  0,1,5,0,5,4, 1,2,6,1,6,5, 2,3,7,2,7,6,
  3,0,4,3,4,7, 4,5,6,4,6,7
 ];
 g.setAttribute('position',new THREE.Float32BufferAttribute(a.flat(),3));
 g.setIndex(faces);g.computeVertexNormals();return g;
}
export function createFleetCar(THREE,id){
 if(!id||id===STARTER_ID)return createSportsCar(THREE);
 const spec=presets[id],carData=fleetVehicle(id);
 if(!spec||!carData)return createSportsCar(THREE);
 const car=new THREE.Group();car.name='AZURE / '+carData.name;
 const mat=(hex,r=.48,m=.35)=>new THREE.MeshStandardMaterial({color:hex,roughness:r,metalness:m});
 const paint=mat(parseInt(carData.color.slice(1),16),.31,.69);
 const contrast=mat(id==='retro'?0xe6dac5:0x192b35,.46,.55);
 const dark=mat(0x0c1824,.72,.18);
 const glass=mat(id==='atlas'?0x2d4d59:0x1a3e4e,.16,.45);
 glass.side=THREE.DoubleSide;
 const wheelMat=mat(0x12191e,.98,.03),rim=mat(0xc4ced0,.22,.92);
 const white=new THREE.MeshBasicMaterial({color:0xe8faff,toneMapped:false});
 const red=new THREE.MeshBasicMaterial({color:0xff344c,toneMapped:false});
 const amber=new THREE.MeshBasicMaterial({color:0xffba64,toneMapped:false});
 const L=spec.length/2,W=spec.width/2;
 const box=(w,h,d,m,x,y,z)=>{
  const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  obj.position.set(x,y,z);obj.castShadow=true;car.add(obj);return obj;
 };
 const disk=(radius,thick,m,x,y,z)=>{
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,thick,20),m);
  obj.position.set(x,y,z);obj.rotation.z=Math.PI/2;car.add(obj);return obj;
 };
 // Deep sculpting and body-specific hood/roof profiles, not identical scaled cars.
 const shellGeom=new THREE.BoxGeometry(spec.width,1.04,spec.length,4,2,8);
 const v=shellGeom.attributes.position;
 for(let i=0;i<v.count;i++){
  let x=v.getX(i),y=v.getY(i),z=v.getZ(i);
  if(id==='comet'||id==='solstice'){
   if(z< -1.7)x*=.89;
   if(z>2.5)x*=.98;
   if(y>.15&&z< -1.5)y-=.11*(Math.abs(z)-1.5);
  }else if(id==='retro'){
   if(z< -2.2)x*=.97;
  }else if(id==='tide'){
   if(z< -2.8)x*=.87;
   if(y>.1&&z< -2.4)y-=.05*(Math.abs(z)-2.4);
  }else if(id==='atlas'){
   if(z< -2)x*=.98;
  }else if(id==='vantage'){
   if(z< -2)x*=.93;
  }
  v.setXYZ(i,x,y,z);
 }
 shellGeom.computeVertexNormals();
 const shell=new THREE.Mesh(shellGeom,paint);
 shell.position.y=spec.base;shell.castShadow=true;car.add(shell);
 const roofWidth=spec.width*(id==='atlas'?.82:id==='retro'?.77:.68);
 const cabinG=cabinGeometry(THREE,spec.width*.87,spec.base+.49,spec.roof,
  -spec.hood,spec.tail,spec.topFront,spec.topRear,roofWidth);
 const cabin=new THREE.Mesh(cabinG,glass);cabin.castShadow=true;car.add(cabin);
 box(roofWidth,.11,spec.topRear-spec.topFront+.15,paint,0,spec.roof+.02,(spec.topRear+spec.topFront)/2);
 box(spec.width*.90,.23,.35,contrast,0,spec.base-.4,-L+.1);
 box(spec.width*.89,.23,.35,contrast,0,spec.base-.36,L-.1);
 box(spec.width*.79,.26,.10,dark,0,spec.base-.13,-L-.04);
 box(spec.width*.83,.14,.07,contrast,0,spec.base+.58,L+.02);
 const wheels=[],tireGeom=new THREE.CylinderGeometry(spec.tire,spec.tire,.39,22);
 const rimGeom=new THREE.CylinderGeometry(spec.tire*.61,spec.tire*.61,.42,18);
 for(const side of [-1,1]){
  for(const z of [-spec.tread,spec.tread]){
   const wheel=new THREE.Group();wheel.position.set(side*(W+.03),spec.tire+.1,z);
   const tire=new THREE.Mesh(tireGeom,wheelMat);tire.rotation.z=Math.PI/2;wheel.add(tire);
   const hub=new THREE.Mesh(rimGeom,rim);hub.rotation.z=Math.PI/2;wheel.add(hub);
   const badge=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.48,12),contrast);
   badge.rotation.z=Math.PI/2;wheel.add(badge);
   car.add(wheel);wheels.push(wheel);
  }
  box(.15,.12,2.6,contrast,side*(W-.04),spec.base+.35,.18);
  box(.23,.14,.42,rim,side*(W+.035),spec.base+.23,.47); // door handle
  box(.48,.23,.38,paint,side*(W-.04),spec.base+.88,-1.42); // wing mirrors
  box(.55,.18,.08,white,side*(W-.50),spec.base+.24,-L-.04);
  box(.59,.20,.08,red,side*(W-.52),spec.base+.20,L+.04);
 }
 const headlights=[];
 for(const x of [-W+.74,W-.74]){
  const headlight=new THREE.SpotLight(0xd7efff,42,72,.43,.65,1);
  headlight.position.set(x,spec.base+.29,-L);
  headlight.target.position.set(x,0,-25);
  car.add(headlight);car.add(headlight.target);headlights.push(headlight);
 }
 if(id==='atlas'){
  // Raised SUV, roof rack, steps, bumper protection and rugged spare wheel.
  for(const side of [-1,1]){
   box(.12,.22,4.6,contrast,side*(roofWidth/2-.12),spec.roof+.19,.4);
   box(.31,.19,5.5,contrast,side*(W-.2),.70,.1);
  }
  for(const z of [-.75,1.1])box(roofWidth,.18,.26,rim,0,spec.roof+.31,z);
  disk(.91,.28,wheelMat,0,1.44,L+.18);
  disk(.50,.31,rim,0,1.44,L+.2);
  box(spec.width*.68,.38,.15,contrast,0,1.01,-L-.12);
 }else if(id==='retro'){
  // Tall square bonnet, chrome fender caps and four separate circular lights.
  box(spec.width*.85,.12,2.7,contrast,0,spec.base+.57,-2.18);
  for(const x of [-1.25,-.44,.44,1.25]){
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.24,12,10),white);
   lamp.position.set(x,spec.base+.16,-L-.10);car.add(lamp);
  }
  box(spec.width*.74,.10,.16,rim,0,spec.base-.16,-L-.1);
  for(const side of [-1,1])box(.18,.20,1.7,rim,side*(W+.02),spec.base+.24,2.20);
 }else if(id==='tide'){
  // EV: full-width daytime running light, low drag underbody, closed grille.
  box(spec.width*.78,.09,.1,white,0,spec.base+.27,-L-.09);
  box(spec.width*.82,.09,.1,red,0,spec.base+.33,L+.1);
  box(spec.width*.68,.26,.18,paint,0,spec.base+.02,-L-.10);
  box(roofWidth*.6,.06,1.4,contrast,0,spec.roof+.10,.14);
 }else if(id==='vantage'){
  // Grand-touring coupe: long hood, separate front intakes and trunk lip.
  for(const x of [-1.1,1.1])box(.72,.19,.16,dark,x,spec.base-.20,-L-.15);
  box(spec.width*.78,.12,.53,paint,0,spec.base+.55,L-.05);
  box(roofWidth*.75,.12,1.6,contrast,0,spec.roof+.09,.1);
 }else if(id==='comet'){
  // Hypercar: dropped nose, side aero ducts, floating rear wing and diffuser.
  for(const side of [-1,1]){
   box(.23,.18,2.2,contrast,side*(W-.16),spec.base-.32,1.1);
   box(.22,.51,.40,contrast,side*1.44,spec.base+.83,L-.48);
  }
  box(spec.width*.87,.13,.68,contrast,0,spec.base+.95,L-.13);
  box(spec.width*.55,.16,1.1,dark,0,spec.base+.57,-L+.24);
  box(spec.width*.85,.07,.14,white,0,spec.base+.28,-L-.10);
 }else if(id==='solstice'){
  // V10 supercar: split air intakes, sculpted shoulder and dramatic wing.
  for(const x of [-1.13,1.13])box(.74,.20,.12,dark,x,spec.base-.21,-L-.10);
  for(const side of [-1,1])box(.38,.38,1.2,contrast,side*(W-.14),spec.base+.12,.3);
  box(spec.width*.75,.11,.55,paint,0,spec.base+.79,L-.06);
  box(spec.width*.8,.08,.14,red,0,spec.base+.40,L+.11);
 }
 return {car,headlights,wheels,dimensions:{width:spec.width,length:spec.length,height:spec.roof},
  updateWheels:distance=>{for(const wheel of wheels)wheel.rotation.x-=distance/spec.tire},
  setPaint:hex=>{if(Number.isInteger(hex)&&hex>=0&&hex<=0xffffff)paint.color.setHex(hex)}};
}
/** Dispose per-model GPU resources on a parked-vehicle swap. */
export function releaseFleetCar(car){
 if(!car)return;
 const geometries=new Set(),materials=new Set();
 car.traverse(node=>{
  if(node.geometry)geometries.add(node.geometry);
  if(node.material){
   for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);
  }
 });
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
}

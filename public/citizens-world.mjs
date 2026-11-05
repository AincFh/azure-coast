import {
 createCitizens,tickCitizens,nearestCitizen,CITIZEN_COUNT
} from './citizens-core.mjs';

/** One living city, eight GPU draw calls for the entire visible crowd. */
export function createCitizenWorld(THREE,scene,{count=CITIZEN_COUNT}={}){
 let residents=createCitizens(count),lastTick=-Infinity,elapsed=0,lastDraw=-Infinity;
 const mat=(color,roughness=.82)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.02});
 const base={
  skin:mat(0xffffff),hair:mat(0xffffff),shirt:mat(0xffffff),
  trousers:mat(0xffffff),feet:mat(0x17222a),
  bag:mat(0xffffff),glass:mat(0x223c47)
 };
 const geometry={
  head:new THREE.SphereGeometry(.48,9,7),
  hair:new THREE.SphereGeometry(.49,9,7),
  body:new THREE.BoxGeometry(1.17,1.35,.66),
  arms:new THREE.BoxGeometry(.32,1.22,.35),
  legs:new THREE.BoxGeometry(.42,1.05,.43),
  bag:new THREE.BoxGeometry(.55,.85,.22),
  shoes:new THREE.BoxGeometry(.5,.25,.66)
 };
 const n=residents.length,parts=[
  {name:'body',geo:geometry.body,material:base.shirt},
  {name:'head',geo:geometry.head,material:base.skin},
  {name:'hair',geo:geometry.hair,material:base.hair},
  {name:'leftArm',geo:geometry.arms,material:base.shirt},
  {name:'rightArm',geo:geometry.arms,material:base.shirt},
  {name:'leftLeg',geo:geometry.legs,material:base.trousers},
  {name:'rightLeg',geo:geometry.legs,material:base.trousers},
  {name:'leftShoe',geo:geometry.shoes,material:base.feet},
  {name:'rightShoe',geo:geometry.shoes,material:base.feet},
  {name:'bag',geo:geometry.bag,material:base.bag}
 ];
 const meshes={};
 for(const part of parts){
  const m=new THREE.InstancedMesh(part.geo,part.material,n);
  m.name='AZURE living citizen '+part.name;
  m.frustumCulled=false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);meshes[part.name]=m;
 }
 const skinColors=[0xc68d6c,0xe1b18c,0xa76d58,0xd69e76,0x986b56,0xe1bb9f];
 const clothing=[0x5f7e89,0xc3b9a9,0x9d6a72,0x7d9b8b,0xdbc09c,0x56778d,0x934f54,0x707b86];
 const pants=[0x213c56,0x434e57,0x3b3b4b,0x8e7c66,0x304c62];
 const bags=[0x8d6e5a,0x314959,0x96907e,0x726252];
 for(let i=0;i<n;i++){
  const c=residents[i];
  const color=(m,v)=>m.setColorAt(i,new THREE.Color(v));
  color(meshes.body,clothing[c.look%clothing.length]);
  color(meshes.leftArm,clothing[c.look%clothing.length]);
  color(meshes.rightArm,clothing[c.look%clothing.length]);
  color(meshes.head,skinColors[c.id%skinColors.length]);
  color(meshes.hair,[0x19272c,0x3d302b,0x5f4939,0x2c3038][c.id%4]);
  color(meshes.leftLeg,pants[c.id%pants.length]);
  color(meshes.rightLeg,pants[c.id%pants.length]);
  color(meshes.bag,bags[c.id%bags.length]);
 }
 for(const mesh of Object.values(meshes))
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 const root=new THREE.Object3D(),child=new THREE.Object3D(),worldMatrix=new THREE.Matrix4();
 function instance(name,index,x,y,z,w,h,d,rotation=0,visible=true){
  child.position.set(x,y,z);child.rotation.set(rotation,0,0);
  child.scale.set(visible?w:0,visible?h:0,visible?d:0);
  child.updateMatrix();worldMatrix.multiplyMatrices(root.matrix,child.matrix);
  meshes[name].setMatrixAt(index,worldMatrix);
 }
 function render(point){
  const eye=point||{x:0,z:0};
  for(const c of residents){
   const near=c.visible&&Math.hypot(c.x-eye.x,c.z-eye.z)<165;
   root.position.set(c.x,.04,c.z);root.rotation.set(0,c.heading,0);
   root.scale.set(1,1,1);root.updateMatrix();
   const swing=near&&c.speed>.05?Math.sin(c.walk*6+c.id)*Math.min(.52,c.speed*.24):0;
   instance('body',c.id,0,1.55,0,1,1,1,0,near);
   instance('head',c.id,0,2.66,0,1,1,1,0,near);
   instance('hair',c.id,0,2.92,-.055,1,.48,1,0,near);
   instance('leftArm',c.id,-.74,1.63,0,1,1,1,swing,near);
   instance('rightArm',c.id,.74,1.63,0,1,1,1,-swing,near);
   instance('leftLeg',c.id,-.3,.69,0,1,1,1,-swing,near);
   instance('rightLeg',c.id,.3,.69,0,1,1,1,swing,near);
   instance('leftShoe',c.id,-.3,.13,-.14,1,1,1,0,near);
   instance('rightShoe',c.id,.3,.13,-.14,1,1,1,0,near);
   instance('bag',c.id,-.74,1.10,.40,1,1,1,0,near&&c.id%4===0);
  }
  for(const mesh of Object.values(meshes))mesh.instanceMatrix.needsUpdate=true;
 }
 render({x:0,z:0});
 function update(dt,now,{player,traffic=[],hour=16,weather='clear',active=true}={}){
  if(!active)return;
  elapsed=Math.min(.5,elapsed+Math.max(0,Number.isFinite(dt)?dt:0));
  if(elapsed>=.09){
   residents=tickCitizens(residents,elapsed,now/1000,{hour,weather,traffic,player});
   elapsed=0;
  }
  if(now-lastDraw>=110){
   render(player?.position);lastDraw=now;
  }
 }
 return {
  update,nearby:point=>nearestCitizen(residents,point),
  people:()=>residents,metrics:(point)=>{
   const nearby=residents.filter(p=>p.visible&&point&&Math.hypot(p.x-point.x,p.z-point.z)<130);
   return {total:residents.length,active:residents.filter(p=>p.visible).length,nearby:nearby.length,
    walking:nearby.filter(p=>p.speed>.3).length,waiting:nearby.filter(p=>p.speed<=.3).length};
  },
  dispose(){
   for(const mesh of Object.values(meshes)){scene.remove(mesh);mesh.dispose?.()}
   for(const geo of Object.values(geometry))geo.dispose();
   for(const material of Object.values(base))material.dispose();
  }
 };
}

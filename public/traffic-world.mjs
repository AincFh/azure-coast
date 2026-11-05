import {
 createTrafficAgents,trafficPosition,tickTraffic,trafficMetrics,signalIsGreen
} from './traffic-core.mjs';

/** Batched real-time visual adapter: road AI runs independently of Three.js. */
export function createTrafficWorld(THREE,scene,count=45){
 let agents=createTrafficAgents(count),lastDraw=-Infinity,accumulator=0,signalSecond=-1;
 const bodyColors=[0x385469,0x9c4951,0xaeb2b0,0x27343f,0xcfbd9d,0x4a7776,0x867b8f];
 const paint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.48,metalness:.42});
 const glass=new THREE.MeshStandardMaterial({color:0x193440,roughness:.16,metalness:.43});
 const rubber=new THREE.MeshStandardMaterial({color:0x1c2428,roughness:.95});
 const white=new THREE.MeshBasicMaterial({color:0xe9f4ea}),red=new THREE.MeshBasicMaterial({color:0xf45b56});
 const steel=new THREE.MeshStandardMaterial({color:0x465b63,roughness:.55,metalness:.46});
 const light=new THREE.MeshBasicMaterial({color:0xffffff});
 const create=(geo,mat,n)=>{
  const mesh=new THREE.InstancedMesh(geo,mat,n);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);return mesh;
 };
 const n=agents.length;
 const body=create(new THREE.BoxGeometry(3.2,1.1,5.7),paint,n);
 const cabin=create(new THREE.BoxGeometry(2.75,.93,2.9),glass,n);
 const tail=create(new THREE.BoxGeometry(2.5,.16,.12),red,n);
 const front=create(new THREE.BoxGeometry(2.7,.16,.12),white,n);
 const tires=create(new THREE.CylinderGeometry(.57,.57,.32,12),rubber,n*4);
 const root=new THREE.Object3D(),part=new THREE.Object3D(),matrix=new THREE.Matrix4();
 function set(mesh,index,position,yaw,offset,scale,roll=0){
  root.position.set(position.x,.1,position.z);root.rotation.set(0,yaw,0);root.scale.set(1,1,1);root.updateMatrix();
  part.position.set(...offset);part.rotation.set(0,0,roll);part.scale.set(...scale);part.updateMatrix();
  matrix.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(index,matrix);
 }
 for(let i=0;i<n;i++)body.setColorAt(i,new THREE.Color(bodyColors[i%bodyColors.length]));
 if(body.instanceColor)body.instanceColor.needsUpdate=true;
 const poles=[],bulbs=[];
 for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
  poles.push({road:i,cross:j,x:i*100+12,z:j*100+12});
 }
 const pole=create(new THREE.CylinderGeometry(.12,.17,5.5,6),steel,poles.length);
 const lampZ=create(new THREE.BoxGeometry(.55,.65,.36),light,poles.length);
 const lampX=create(new THREE.BoxGeometry(.55,.65,.36),light,poles.length);
 const poleRoot=new THREE.Object3D();
 poles.forEach((o,i)=>{
  poleRoot.position.set(o.x,2.75,o.z);poleRoot.rotation.set(0,0,0);poleRoot.scale.set(1,1,1);poleRoot.updateMatrix();pole.setMatrixAt(i,poleRoot.matrix);
  poleRoot.position.set(o.x,5.05,o.z+.35);poleRoot.updateMatrix();lampZ.setMatrixAt(i,poleRoot.matrix);
  poleRoot.position.set(o.x+.35,5.05,o.z);poleRoot.updateMatrix();lampX.setMatrixAt(i,poleRoot.matrix);
 });pole.instanceMatrix.needsUpdate=true;lampZ.instanceMatrix.needsUpdate=true;lampX.instanceMatrix.needsUpdate=true;
 function updateSignals(seconds){
  const whole=Math.floor(seconds);if(signalSecond===whole)return;signalSecond=whole;
  poles.forEach((p,i)=>{
   lampZ.setColorAt(i,new THREE.Color(signalIsGreen('z',p.road,p.cross,seconds)?0x72efaa:0xf36f59));
   lampX.setColorAt(i,new THREE.Color(signalIsGreen('x',p.road,p.cross,seconds)?0x72efaa:0xf36f59));
  });
  if(lampZ.instanceColor)lampZ.instanceColor.needsUpdate=true;
  if(lampX.instanceColor)lampX.instanceColor.needsUpdate=true;
 }
 function renderCars(){
  for(let i=0;i<agents.length;i++){
   const car=agents[i],position=trafficPosition(car);
   const yaw=car.axis==='z'?(car.dir>0?Math.PI:0):(car.dir>0?-Math.PI/2:Math.PI/2);
   set(body,i,position,yaw,[0,1.04,0],[1,1,1]);
   set(cabin,i,position,yaw,[0,2.03,-.34],[1,1,1]);
   set(tail,i,position,yaw,[0,1.17,2.86],[1,1,1]);
   set(front,i,position,yaw,[0,1.18,-2.86],[1,1,1]);
   for(let j=0;j<4;j++){
    const x=j%2?1.63:-1.63,z=j<2?-1.83:1.83;
    set(tires,i*4+j,position,yaw,[x,.7,z],[1,1,1],Math.PI/2);
   }
  }
  for(const mesh of [body,cabin,tail,front,tires])mesh.instanceMatrix.needsUpdate=true;
 }
 renderCars();updateSignals(0);
 return {
  update(dt,now,player,enabled=true){
   if(!enabled)return;
   accumulator+=Math.max(0,Math.min(dt,.05));
   if(accumulator<.05)return;
   const step=accumulator;accumulator=0;
   agents=tickTraffic(agents,step,now*.001,player);
   renderCars();updateSignals(now*.001);lastDraw=now;
  },
  nearbyPlayer(point,radius=5){
   for(const car of agents){const p=trafficPosition(car);
    if(Math.hypot(p.x-point.x,p.z-point.z)<radius)return true;
   }
   return false;
  },
  stats:()=>trafficMetrics(agents),
  getAgentPositions:()=>agents.map(trafficPosition),
  count:agents.length
 };
}

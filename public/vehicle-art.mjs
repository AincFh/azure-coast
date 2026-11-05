/**
 * Detailed original sport-coupe model for the playable vehicle.
 * No external assets. Front is -Z; dimensions preserve collision envelope.
 */
export const coupeDimensions=Object.freeze({width:3.8,length:7.2,wheelbase:4.7});
export function createSportsCar(THREE){
 const car=new THREE.Group();car.name='AZURE / COAST — GT';
 const material=(hex,roughness=.5,metalness=.15)=>new THREE.MeshStandardMaterial({color:hex,roughness,metalness});
 const paint=material(0xdcb282,.26,.71),trim=material(0x132633,.3,.58);
 const rubber=material(0x101820,.93,.01),rim=material(0xc3c9c6,.23,.88);
 const glass=material(0x1b4050,.13,.36),interior=material(0x0c1925,.85,.04);
 const lightWhite=new THREE.MeshBasicMaterial({color:0xe1f9ff,toneMapped:false});
 const lightRed=new THREE.MeshBasicMaterial({color:0xff4151,toneMapped:false});
 const mk=(w,h,d,mat,x,y,z)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);mesh.castShadow=true;car.add(mesh);return mesh;
 };
 const chassisGeometry=new THREE.BoxGeometry(3.8,1.05,7.2,4,2,6);
 const positions=chassisGeometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  let x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  if(z< -2.5)x*=.94;
  if(z>2.65)x*=.98;
  if(y>0&&z< -2.2)y-=.07*(Math.abs(z)-2.2);
  positions.setXYZ(i,x,y,z);
 }
 positions.needsUpdate=true;chassisGeometry.computeVertexNormals();
 const shell=new THREE.Mesh(chassisGeometry,paint);shell.position.y=1.23;shell.castShadow=true;car.add(shell);
 // Lower aero kit, rear fascia, door shoulders, tapered hood and grille.
 mk(3.65,.19,6.75,trim,0,.65,0);
 mk(3.1,.34,.13,interior,0,.98,-3.61);
 mk(2.75,.09,.16,rim,0,.91,-3.71);
 mk(3.6,.15,.7,trim,0,.75,3.35);
 mk(3.48,.12,.17,trim,0,1.53,3.52);
 const cabinGeometry=new THREE.BufferGeometry();
 const v=[
  [-1.69,1.73,-2.08],[1.69,1.73,-2.08],[1.62,1.73,1.91],[-1.62,1.73,1.91],
  [-1.25,2.75,-.93],[1.25,2.75,-.93],[1.23,2.75,1.22],[-1.23,2.75,1.22]
 ].flat();
 cabinGeometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
 const faces=[0,1,5,0,5,4, 3,7,6,3,6,2, 0,4,7,0,7,3, 1,2,6,1,6,5, 4,5,6,4,6,7];
 cabinGeometry.setIndex(faces);cabinGeometry.computeVertexNormals();
 const cabin=new THREE.Mesh(cabinGeometry,glass);
 cabin.material.side=THREE.DoubleSide;cabin.castShadow=true;car.add(cabin);
 mk(2.65,.13,2.2,paint,0,2.77,.15);
 mk(2.85,.1,1.16,trim,0,1.71,-1.74);
 mk(2.87,.1,1.12,trim,0,1.72,1.64);
 // Car's body lines, door handles, mirror shells and aerodynamic skirt.
 for(const side of [-1,1]){
  mk(.11,.14,2.9,trim,side*1.86,1.46,-.15);
  mk(.34,.16,.52,rim,side*1.86,1.44,.35);
  mk(.58,.25,.48,paint,side*1.85,2.09,-1.67);
  mk(.12,.5,3.2,paint,side*1.66,1.77,.13);
 }
 // Wheel geometry is shared within this model; only four animated meshes.
 const wheels=[];
 const tireGeom=new THREE.CylinderGeometry(.74,.74,.42,20);
 const hubGeom=new THREE.CylinderGeometry(.46,.46,.46,16);
 const hubMetal=material(0x9eb3bc,.26,.84);
 for(const x of [-1.9,1.9])for(const z of [-2.32,2.32]){
  const wheelPivot=new THREE.Group();wheelPivot.position.set(x,.83,z);
  const tire=new THREE.Mesh(tireGeom,rubber);tire.rotation.z=Math.PI/2;wheelPivot.add(tire);
  const hub=new THREE.Mesh(hubGeom,hubMetal);hub.rotation.z=Math.PI/2;wheelPivot.add(hub);
  const center=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.49,12),trim);
  center.rotation.z=Math.PI/2;wheelPivot.add(center);
  car.add(wheelPivot);wheels.push(wheelPivot);
 }
 // Physically distinct headlights, tail lights, brake-strip and spoiler.
 for(const side of [-1,1]){
  mk(.85,.22,.095,lightWhite,side*1.19,1.37,-3.65);
  mk(1.03,.23,.09,lightRed,side*1.19,1.35,3.65);
  mk(.08,.13,.75,rim,side*1.79,1.19,-2.52);
 }
 mk(3.5,.11,.1,lightRed,0,1.42,3.68);
 mk(3.3,.12,.55,paint,0,2.01,3.39);
 for(const x of [-1.25,1.25])mk(.16,.42,.65,trim,x,1.78,3.43);
 mk(.18,.13,.3,rim,-.66,.77,3.68);mk(.18,.13,.3,rim,.66,.77,3.68);
 const headlights=[];
 for(const x of [-1.12,1.12]){
  const lamp=new THREE.SpotLight(0xc8e9ff,58,85,.4,.6,1);
  lamp.position.set(x,1.42,-3.55);lamp.target.position.set(x,0,-27);
  car.add(lamp);car.add(lamp.target);headlights.push(lamp);
 }
 return {car,headlights,wheels,
  updateWheels:(distance)=>wheels.forEach(w=>w.rotation.x-=distance/.74)};
}

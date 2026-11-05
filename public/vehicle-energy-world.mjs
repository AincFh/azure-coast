/**
 * Lightweight, self-authored charging plaza meshes. Each fuel station listed
 * in the deterministic domain model has a corresponding visible world object.
 * Geometry is shared; no external image or 3D asset license is required.
 */
import {ENERGY_STATIONS} from './vehicle-energy.mjs';

export function installEnergyStations(THREE,scene){
 const root=new THREE.Group();root.name='Azure Coast | Roadside Energy Stations';
 const shell=new THREE.MeshStandardMaterial({color:0x133442,roughness:.45,metalness:.3});
 const teal=new THREE.MeshStandardMaterial({color:0x4ce0d7,roughness:.38,metalness:.15,emissive:0x166c68,emissiveIntensity:.25});
 const white=new THREE.MeshStandardMaterial({color:0xdcece5,roughness:.68});
 const dark=new THREE.MeshStandardMaterial({color:0x152a32,roughness:.7});
 const mesh=(parent,w,h,d,material,x,y,z)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;
  parent.add(m);return m;
 };
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d');
 if(ctx){
  ctx.fillStyle='#103643';ctx.fillRect(0,0,512,128);
  ctx.fillStyle='#65ebd4';ctx.fillRect(0,0,512,8);
  ctx.fillStyle='#f2fcf6';ctx.font='bold 46px system-ui, sans-serif';
  ctx.textAlign='center';ctx.fillText('A / C   ENERGY',256,82);
 }
 const signTexture=new THREE.CanvasTexture(canvas);
 signTexture.colorSpace=THREE.SRGBColorSpace;
 const signMaterial=new THREE.MeshBasicMaterial({map:signTexture,side:THREE.DoubleSide});
 for(const station of ENERGY_STATIONS){
  const g=new THREE.Group();g.name=station.name;g.position.set(station.x,0,station.z);
  // A compact road-front service island: raised pad, two charging posts, arch.
  mesh(g,15,.4,9,dark,0,.16,0);
  for(const x of [-4,4]){
   mesh(g,.7,5.8,.7,shell,x,3.2,-3.5);
   mesh(g,2.25,2.8,1.4,white,x,1.6,.65);
   mesh(g,2.05,1.35,1.5,teal,x,2.35,.65);
   mesh(g,1.25,.18,.1,dark,x,2.45,1.44);
  }
  mesh(g,13,.65,9.5,shell,0,6.5,0);
  mesh(g,12.7,.16,.3,teal,0,6.1,4.75);
  mesh(g,.55,8,.55,shell,8,4.2,0);
  mesh(g,3.2,2,.16,signMaterial,8,8.5,.2);
  mesh(g,3.4,.14,.25,teal,8,9.6,.2);
  // Non-shadowing guide ring marks the actual refuel radius on arrival.
  const ring=new THREE.Mesh(new THREE.RingGeometry(7.0,7.18,48),new THREE.MeshBasicMaterial({
   color:0x5bded6,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false
  }));
  ring.rotation.x=-Math.PI/2;ring.position.y=.42;g.add(ring);
  root.add(g);
 }
 scene.add(root);
 return root;
}

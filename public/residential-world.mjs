/**
 * Separate real-time 3D residential scene, drawn by the existing WebGLRenderer.
 * No screenshots, iframe or static room illustration. Furniture geometry and the
 * character rig are genuine scene objects and reflect persistent inventory.
 */
import {RESIDENCES,RESIDENCE_SLOTS,FURNITURE} from './housing.mjs';
import {createCharacter} from './character-art.mjs';

export function createResidentialWorld(THREE,cityScene){
 const material=(color,roughness=.72,metalness=.08)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const bronze=material(0xc69d73,.43,.56),ink=material(0x203b43,.5,.29),cream=material(0xefebe2,.87),
      wood=material(0x9c775a,.78),leaf=material(0x537e5a,.86),glass=material(0x80c1c9,.2,.55);
 const signs=[];
 for(const residence of RESIDENCES){
  const sign=new THREE.Group();sign.position.set(residence.x,.04,residence.z);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.5,.5,20),bronze);
  pedestal.position.y=.3;sign.add(pedestal);
  const column=new THREE.Mesh(new THREE.BoxGeometry(2.25,3.3,.48),ink);
  column.position.y=2.13;sign.add(column);
  const address=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.55,.1),cream);
  address.position.set(0,2.6,.32);sign.add(address);
  const small=new THREE.Mesh(new THREE.BoxGeometry(1.8,.16,.12),bronze);
  small.position.set(0,3.48,.34);sign.add(small);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2.7,.2,.75),bronze);
  roof.position.y=3.95;sign.add(roof);
  const beacon=new THREE.Mesh(new THREE.TorusGeometry(2.15,.12,7,32),
   new THREE.MeshBasicMaterial({color:0xe7d5ab}));
  beacon.rotation.x=Math.PI/2;beacon.position.y=.18;sign.add(beacon);
  cityScene.add(sign);signs.push(sign);
 }
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x203744);
 const camera=new THREE.PerspectiveCamera(58,window.innerWidth/window.innerHeight,.1,115);
 scene.add(new THREE.HemisphereLight(0xf4f3df,0x5a6878,2.1));
 const sun=new THREE.DirectionalLight(0xffe7c3,3.1);
 sun.position.set(-12,23,14);sun.castShadow=false;scene.add(sun);
 const room=new THREE.Group(),inventory=new THREE.Group();room.add(inventory);scene.add(room);
 const avatarRig=createCharacter(THREE),avatar=avatarRig.avatar;scene.add(avatar);
 const pal={
  coastal:{floor:0xc69d77,wall:0xe0d8c9,accent:0x85b5ad,background:0x77b9c9},
  industrial:{floor:0x8f6e59,wall:0xc2b8a6,accent:0x877e75,background:0x638596},
  resort:{floor:0xd8b48b,wall:0xf1e7d5,accent:0x8ebdb3,background:0x86b9c9},
  modern:{floor:0xa7aba8,wall:0xe7e7e3,accent:0x7b9eae,background:0x7b9eaf}
 };
 const shared={
  frame:ink,wood,metal:bronze,fabric:material(0xb5b9ae,.95),cushion:material(0xb59e8a,.92),
  clay:material(0xb9a38b,.9),leaf,display:new THREE.MeshBasicMaterial({color:0x263d4f}),
  light:new THREE.MeshBasicMaterial({color:0xffe6b8}),linen:cream,glass
 };
 let currentProperty=null,selection=-1;
 const rect=(parent,w,h,d,mat,x,y,z,rot=0)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);mesh.rotation.y=rot;mesh.receiveShadow=false;parent.add(mesh);return mesh;
 };
 const cylinder=(parent,top,bottom,h,mat,x,y,z,segments=12)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,segments),mat);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 };
 const clearGroup=group=>{
  for(const object of [...group.children]){
   group.remove(object);
   object.traverse(child=>{if(child.geometry)child.geometry.dispose()});
  }
 };
 function makeRoom(property){
  currentProperty=property;
  for(const object of [...room.children])if(object!==inventory){
   room.remove(object);object.traverse(child=>{if(child.geometry)child.geometry.dispose()});
  }
  const colors=pal[property.style]||pal.coastal;
  scene.background.setHex(colors.background);
  const floorMat=material(colors.floor,.85),wallMat=material(colors.wall,.9),accent=material(colors.accent,.67);
  rect(room,28,.4,24,floorMat,0,-.2,0);
  // A dollhouse cutaway: remove the near wall so the user sees the real interior.
  rect(room,28,7,.5,wallMat,0,3.5,-12);
  for(const side of [-1,1]){
   rect(room,.45,7,24,wallMat,side*14,3.5,0);
   rect(room,.55,.28,24,accent,side*13.77,2.2,0);
   rect(room,.6,.22,24,bronze,side*13.73,6.95,0);
  }
  rect(room,28,.22,.7,bronze,0,7,-12);
  // 3D glass windows across the rear wall, and a horizon beyond the interior.
  for(const x of [-9,0,9]){
   rect(room,5.8,3.25,.13,glass,x,4,-11.66);
   rect(room,5.95,.15,.19,bronze,x,2.3,-11.56);
   rect(room,.13,3.4,.2,ink,x,4,-11.50);
  }
  rect(room,2.5,2.6,.38,ink,-11.2,1.5,-11.3);
  rect(room,2.1,2.1,.16,accent,-11.2,1.62,-11.02);
  // Kitchen strip, countertop, shelves, dining features and doorway.
  rect(room,10,2,2.3,shared.frame,7,1,-9.4);
  rect(room,10,.25,2.6,wood,7,2.14,-9.4);
  rect(room,7.8,.18,.44,bronze,7,4.3,-11.1);
  for(const x of [4.1,6.9,9.7])rect(room,2,1.25,.7,cream,x,3.6,-11);
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.09,16),shared.metal);
  basin.position.set(7.3,2.31,-9.4);room.add(basin);
  rect(room,2.8,.5,1.7,ink,-9,3.1,-10.6);
  rect(room,4,.3,2.4,wood,-10.6,.15,8.3);
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(11,7.5),
   new THREE.MeshStandardMaterial({color:colors.accent,roughness:1,side:THREE.DoubleSide}));
  rug.rotation.x=-Math.PI/2;rug.position.set(0,.03,-.15);room.add(rug);
  // The floor is truly composed of 3D planks rather than a flat color image.
  const plankMat=material(colors.floor,.78);
  const geometry=new THREE.BoxGeometry(1.94,.038,3.82);
  const planks=new THREE.InstancedMesh(geometry,plankMat,14*6);
  const transform=new THREE.Object3D();
  for(let x=0;x<14;x++)for(let z=0;z<6;z++){
   transform.position.set(-13+x*2,.045,-10+z*4);transform.scale.set(1,1,1);transform.rotation.set(0,0,0);
   transform.updateMatrix();planks.setMatrixAt(x*6+z,transform.matrix);
  }
  planks.instanceMatrix.needsUpdate=true;room.add(planks);
  // Ceiling fixtures have real geometry but no dozens of realtime lights.
  for(const x of [-7,7]){
   cylinder(room,.07,.07,1.05,bronze,x,6.2,1.5,8);
   cylinder(room,1.35,.45,.55,cream,x,5.55,1.5,16);
   cylinder(room,.42,.42,.1,shared.light,x,5.25,1.5,16);
  }
  selection=-1;
 }
 function model(entry){
  const group=new THREE.Group(),m=shared,item=entry.item;
  const b=(w,h,d,mt,x,y,z)=>rect(group,w,h,d,mt,x,y,z);
  const c=(top,bottom,h,mt,x,y,z,n)=>cylinder(group,top,bottom,h,mt,x,y,z,n);
  if(item==='sofa'){
   b(3.8,.7,1.75,m.fabric,0,.59,0);
   b(3.9,1.05,.4,m.cushion,0,1.14,.8);
   for(const side of [-1,1])b(.45,.85,1.7,m.cushion,side*1.78,1.05,0);
   for(const dx of [-1.35,-.45,.45,1.35])b(.76,.18,1.35,m.linen,dx,1.02,-.12);
  }else if(item==='bed'){
   b(3.45,.6,4.05,m.wood,0,.4,0);
   b(3.2,.35,3.85,m.linen,0,.85,0);
   b(3.4,1.65,.24,m.fabric,0,1.18,1.99);
   for(const dx of [-.8,.8])b(1.25,.22,.65,m.cushion,dx,1.15,1.3);
   b(3.05,.13,1.8,m.cushion,0,1.08,-.75);
  }else if(item==='table'){
   b(3.55,.23,2.3,m.wood,0,1.55,0);
   for(const dx of [-1.4,1.4])for(const dz of [-.86,.86])b(.17,1.45,.17,m.frame,dx,.78,dz);
   c(.38,.4,.08,m.clay,.6,1.73,0,16);
  }else if(item==='desk'){
   b(3.65,.22,1.65,m.wood,0,1.56,0);
   for(const dx of [-1.55,1.55])b(.18,1.4,1.4,m.frame,dx,.78,0);
   b(1.5,.85,.12,m.display,0,2.05,-.5);
   b(1.65,.12,.4,m.metal,0,1.63,.45);
   b(.9,.08,.39,m.frame,0,1.62,.82);
  }else if(item==='plant'){
   c(.8,.5,1.1,m.clay,0,.58,0,14);
   c(.72,.6,.13,m.wood,0,1.15,0,14);
   for(let i=0;i<7;i++){
    const leafMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.8,1),m.leaf);
    leafMesh.position.set(Math.cos(i*2.4)*.56,1.75+i*.14,Math.sin(i*2.4)*.56);
    leafMesh.scale.set(.8,1.1,.62);group.add(leafMesh);
   }
  }else if(item==='lamp'){
   c(.5,.55,.15,m.metal,0,.09,0,12);
   c(.09,.09,3.35,m.frame,0,1.68,0,10);
   c(.78,.36,.95,m.linen,0,3.32,0,14);
   c(.46,.46,.12,m.light,0,2.87,0,14);
  }else if(item==='shelf'){
   for(const dx of [-1.5,1.5])b(.13,3.9,.86,m.wood,dx,2.04,0);
   for(const y of [.35,1.28,2.2,3.1,4])b(3.2,.13,.95,m.wood,0,y,0);
   for(let n=0;n<15;n++){
    const color=[m.fabric,m.clay,m.frame,m.linen][n%4];
    b(.16+(n%3)*.1,.4+(n%4)*.12,.65,color,-1.25+(n%5)*.52,.66+Math.floor(n/5)*.91,0);
   }
  }else if(item==='television'){
   b(3.7,.3,1.05,m.wood,0,.77,0);
   b(.25,1.65,.15,m.frame,0,1.73,-.1);
   b(3.85,2.2,.16,m.frame,0,2.47,-.1);
   b(3.5,1.93,.07,m.display,0,2.47,-.21);
   b(3.1,.12,.05,m.metal,0,1.54,-.24);
  }else if(item==='chair'){
   b(1.6,.28,1.6,m.fabric,0,1.13,0);
   b(1.55,1.35,.26,m.cushion,0,1.82,.7);
   for(const dx of [-.62,.62])for(const dz of [-.62,.62])
    b(.12,1.1,.12,m.wood,dx,.55,dz);
   for(const dx of [-.78,.78])b(.14,.16,1.45,m.wood,dx,1.53,0);
  }
  const slot=RESIDENCE_SLOTS[entry.slot];
  group.position.set(slot.x,.04,slot.z);
  group.rotation.y=entry.rotation*Math.PI/2;
  group.userData.slot=entry.slot;
  return group;
 }
 function applyFurniture(entries){
  clearGroup(inventory);
  for(const entry of entries)inventory.add(model(entry));
  setSelection(selection);
 }
 function setSelection(slot){
  selection=slot;
  inventory.children.forEach(group=>{
   group.traverse(obj=>{
    if(!obj.isMesh||!obj.material||!obj.material.emissive)return;
    // No material mutation here: furniture shares meshes/materials.
   });
   group.scale.setScalar(group.userData.slot===slot?1.045:1);
  });
 }
 function atCanvas(event,canvas){
  const rect=canvas.getBoundingClientRect();
  const mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,
    -((event.clientY-rect.top)/rect.height)*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(inventory.children,true);
  for(const hit of hits){
   let parent=hit.object;
   while(parent&&parent!==inventory){
    if(Number.isInteger(parent.userData.slot))return parent.userData.slot;
    parent=parent.parent;
   }
  }
  return null;
 }
 function update(position,t,moving,sprinting=false){
  avatar.position.set(position.x,.1,position.z);
  avatar.rotation.y=position.heading||0;
  avatarRig.animate(t,moving,sprinting);
  const look=new THREE.Vector3(position.x*.32,1.45,position.z*.25-2);
  const target=new THREE.Vector3(position.x*.4,8.6,position.z*.32+14.5);
  camera.position.lerp(target,.18);camera.lookAt(look);
 }
 function setAspect(width,height){camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix()}
 function render(renderer){renderer.render(scene,camera)}
 return {makeRoom,applyFurniture,update,render,setAspect,setSelection,atCanvas,
  getAvatar:()=>avatar,scene,camera};
}

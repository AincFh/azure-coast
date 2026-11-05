/** Original rigged pedestrian representation for the playable character. */
export const characterDimensions=Object.freeze({height:3.6,collisionRadius:.7});
export function createCharacter(THREE){
 const avatar=new THREE.Group();
 const mat=(color,roughness=.84)=>new THREE.MeshStandardMaterial({color,roughness});
 const skin=mat(0xb98264),skinLight=mat(0xc99372),hair=mat(0x18222a);
 const jacket=mat(0xede5d6),jacketDark=mat(0x304652),jeans=mat(0x263e5b),shoe=mat(0x121e2b);
 const mk=(geometry,material,parent,x,y,z)=>{
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const torso=new THREE.Group();torso.position.y=1.28;avatar.add(torso);
 mk(new THREE.CapsuleGeometry(.47,.8,5,10),jacket,torso,0,.92,0);
 mk(new THREE.BoxGeometry(.82,.12,.1),jacketDark,torso,0,1.39,-.45);
 const neck=mk(new THREE.CylinderGeometry(.15,.16,.31,10),skin,torso,0,1.88,0);
 const headGroup=new THREE.Group();headGroup.position.set(0,2.09,0);torso.add(headGroup);
 mk(new THREE.SphereGeometry(.38,16,12),skinLight,headGroup,0,.27,0);
 mk(new THREE.SphereGeometry(.385,16,10,0,Math.PI*2,0,Math.PI*.38),hair,headGroup,0,.39,0);
 mk(new THREE.BoxGeometry(.22,.06,.04),hair,headGroup,0,.27,-.37);
 // Anatomical joints swing as groups: they do not translate independently.
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const shoulder=new THREE.Group();shoulder.position.set(side*.56,1.55,0);torso.add(shoulder);
  const upper=mk(new THREE.CapsuleGeometry(.19,.56,4,8),jacket,shoulder,0,-.48,0);
  upper.rotation.z=side*.08;
  mk(new THREE.SphereGeometry(.18,8,6),skin,shoulder,0,-1.03,0);
  arms.push(shoulder);
  const hip=new THREE.Group();hip.position.set(side*.27,1.23,0);avatar.add(hip);
  mk(new THREE.CapsuleGeometry(.21,.65,4,8),jeans,hip,0,-.57,0);
  const boot=mk(new THREE.BoxGeometry(.43,.27,.72),shoe,hip,0,-1.21,-.12);
  legs.push(hip);
 }
 const pelvis=mk(new THREE.BoxGeometry(.92,.42,.6),jacketDark,avatar,0,1.35,0);
 let phase=0;
 function animate(time,moving=false,sprinting=false){
  const pace=sprinting?11:7.6;
  const stride=moving?(sprinting?.7:.43):.035;
  phase=moving?time*pace:time*1.35;
  legs[0].rotation.x=Math.sin(phase)*stride;
  legs[1].rotation.x=-Math.sin(phase)*stride;
  arms[0].rotation.x=-Math.sin(phase)*stride*.76;
  arms[1].rotation.x=Math.sin(phase)*stride*.76;
  torso.position.y=1.28+(moving?Math.abs(Math.sin(phase))*.07:Math.sin(phase)*.017);
  torso.rotation.z=moving?Math.sin(phase*.5)*.025:0;
  headGroup.rotation.y=Math.sin(time*.6)*.03;
 }
 return {avatar,animate};
}

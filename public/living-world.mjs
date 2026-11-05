import {SHOPS} from './living-core.mjs';
/**
 * Three distinct 3D service landmarks with original procedural architecture.
 * Counters are visible in the playable city, not isolated website cards.
 */
export function createLivingWorld(THREE,scene){
 const mat=(color,roughness=.73,metalness=.13)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const cream=mat(0xe6e0d5),ink=mat(0x193c47,.4,.36),bronze=mat(0xcba77d,.43,.49),
  sea=mat(0x87c3b4,.58),petrol=mat(0xecc487,.48),
  metal=mat(0x53636b,.43,.66),glass=mat(0x80a9b6,.14,.49);
 const roots=[];
 const box=(root,w,h,d,m,x,y,z)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z);mesh.receiveShadow=false;root.add(mesh);return mesh;
 };
 const cylinder=(root,r,h,m,x,y,z)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),m);
  mesh.position.set(x,y,z);root.add(mesh);return mesh;
 };
 for(const [i,shop] of SHOPS.entries()){
  const root=new THREE.Group();root.name='AZURE retail / '+shop.id;
  root.position.set(shop.x,.04,shop.z);
  // On-road landmarks are deliberate walk-up stations, not blocking collision
  // buildings or accidental inaccessible interiors.
  const hue=shop.id==='cafe'?bronze:shop.id==='market'?sea:petrol;
  box(root,5.9,.4,5.8,ink,0,.16,0);
  for(const x of [-2.7,2.7])for(const z of [-2.5,2.5]){
   box(root,.2,3.5,.2,metal,x,2.1,z);
  }
  box(root,6.5,.33,6.5,hue,0,3.92,0);
  box(root,6.5,.20,.7,cream,0,3.93,-3);
  box(root,5.2,1.05,.23,ink,0,3.34,-3.26);
  box(root,4.85,.18,.25,hue,0,3.72,-3.4);
  box(root,4.55,.20,.25,hue,0,3.15,-3.4);
  box(root,5.0,.20,2.1,hue,0,1.75,-1);
  box(root,4.9,1.1,.48,ink,0,.86,-1.75);
  box(root,3.9,1.15,.25,glass,0,2.5,2.6);
  for(const x of [-1.9,1.9]){
   cylinder(root,.21,1.4,bronze,x,.71,-1.8);
   box(root,.55,.13,.65,cream,x,1.51,-1.8);
  }
  if(shop.kind==='energy'){
   for(const x of [-1.75,1.75]){
    box(root,1.15,2.2,.95,cream,x,1.6,1.55);
    box(root,.92,.85,.12,glass,x,2,1.03);
    box(root,.43,.18,.13,sea,x,1.24,1.04);
    cylinder(root,.15,.43,metal,x+.45,.99,1);
   }
  }else{
   for(const x of [-1.7,-.6,.6,1.7]){
    cylinder(root,.22,.37,shop.id==='market'?sea:cream,x,1.99,-1.05);
   }
   box(root,2.6,1.7,.6,glass,0,1.1,2.10);
   box(root,2.5,.14,.65,bronze,0,2,2.1);
  }
  const marker=new THREE.Mesh(
   new THREE.TorusGeometry(3.4,.10,6,32),
   new THREE.MeshBasicMaterial({color:shop.kind==='energy'?0xffd0a0:0x8febd4})
  );
  marker.rotation.x=Math.PI/2;marker.position.y=.23;root.add(marker);
  roots.push(root);scene.add(root);
 }
 return {roots,dispose(){
  const materials=new Set(),geometries=new Set();
  for(const root of roots){
   scene.remove(root);root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);
    if(node.material)materials.add(node.material)});
  }
  for(const x of geometries)x.dispose();
  for(const x of materials)x.dispose();
 }};
}

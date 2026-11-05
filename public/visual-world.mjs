/**
 * AZURE COAST — procedural world art pass.
 * Instanced architecture, civic space and street furniture; animated sea, sky, rain.
 * The scene is entirely original geometry, without third-party asset licensing.
 */
export const visualHash=(x,z,s=0)=>{
 let h=Math.imul((x|0)+9029,374761393)^Math.imul((z|0)-103,668265263)^Math.imul(s+11,2246822519);
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
};
export function architectureStyle(x,z,h,r){
 const style=r<.24?'deco':r<.58?'glass':'residential';
 return {style,floors:Math.floor(h/5),step:style==='deco'?2:style==='glass'?3:4,
  rooftop:h>85,sign:visualHash(Math.floor(x),Math.floor(z),19)>.84&&Math.abs(x)<400&&Math.abs(z)<400};
}
export function streetPlan(radius=6){
 const result=[];
 for(let i=-radius;i<=radius;i++)for(let j=-radius;j<=radius;j++){
  const x=i*100,z=j*100;
  for(let k=-4;k<=4;k++){
   result.push({kind:'zebra',x:x+k*1.9,z:z+15,axis:'north'});
   result.push({kind:'zebra',x:x+15,z:z+k*1.9,axis:'east'});
  }
  if(Math.abs(i)<=4&&Math.abs(j)<=4){
   result.push({kind:'planter',x:x+13.6,z:z+44});
   result.push({kind:'planter',x:x-13.6,z:z+73});
   if((i+j)%3===0)result.push({kind:'bench',x:x+13.6,z:z+77});
  }
 }
 return result;
}
export function installVisualWorld(THREE,scene){
 const palette={
  trim:[0xb6c4bb,.4,.4],bronze:[0xa57d58,.35,.65],steel:[0x566f79,.3,.7],
  podium:[0x253c48,.66,.2],store:[0x183342,.22,.4],glass:[0x366b80,.22,.5],
  cream:[0xe1d3b7,.8,.08],brick:[0x94766a,.88,.1],awning:[0xbe6f51,.83,0],
  wood:[0x98785d,.84,.04],stone:[0xcac8b8,.92,.03],grass:[0x48856b,.95,0],
  foliage:[0x356d56,.9,0],crossing:[0xeae9df,.89,0],red:[0xc35143,.6,0]
 };
 const materials=new Map(Object.entries(palette).map(([k,v])=>[k,new THREE.MeshStandardMaterial({color:v[0],roughness:v[1],metalness:v[2]})]));
 const cube=new THREE.BoxGeometry(1,1,1),batch=new Map(),dummy=new THREE.Object3D();
 const q=(kind,x,y,z,w,h,d)=>{if(!batch.has(kind))batch.set(kind,[]);batch.get(kind).push([x,y,z,w,h,d])};
 const boats=[];
 function decorateBuilding({x,z,w,d,h,r}){
  const a=architectureStyle(x,z,h,r),res=a.style==='residential',edge=a.style==='deco'?'bronze':'steel';
  q(res?'brick':'podium',x,2.2,z,w+.6,4.4,d+.6);
  for(const side of [-1,1]){
   q('store',x,2.25,z+side*(d/2+.45),w*.78,3.4,.17);
   q('glass',x,2.1,z+side*(d/2+.55),w*.65,2.65,.1);
   q('awning',x,4.65,z+side*(d/2+.85),w*.64,.25,1.25);
  }
  for(const sx of [-1,1])for(const sz of [-1,1])
   q(edge,x+sx*(w/2+.07),h/2,z+sz*(d/2+.07),.27,h,.27);
  for(let floor=a.step;floor<a.floors;floor+=a.step){
   const y=floor*5+.1;
   q(res?'cream':edge,x,y,z+d/2+.19,w+.3,.2,.38);
   q(res?'cream':edge,x,y,z-d/2-.19,w+.3,.2,.38);
   if(res&&floor%2===0&&y<h-6){
    q('stone',x,y-.26,z+d/2+.87,w*.6,.18,1.7);
    q('steel',x,y+.52,z+d/2+1.67,w*.6,.1,.1);
   }
  }
  q('podium',x,h+.4,z,w+1,.8,d+1);
  q('stone',x,h+1.12,z,w*.74,.62,d*.7);
  if(a.rooftop){
   q('steel',x-w*.15,h+3,z+d*.18,2.4,3.7,3);
   if(r>.78)q('bronze',x,h+8,z,.28,10,.28);
  }
 }
 function renderBatches(){
  for(const [kind,instances] of batch){
   const mesh=new THREE.InstancedMesh(cube,materials.get(kind),instances.length);
   instances.forEach(([x,y,z,w,h,d],i)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(w,h,d);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;scene.add(mesh);
  }
  batch.clear();
 }
 function makePlaza(){
  // A walkable 80m civic garden in the previously blank central plot.
  q('stone',50,.035,50,76,.12,76);
  for(const x of [24,76])for(const z of [24,76]){
   q('podium',x,.35,z,19,.55,19);q('grass',x,.68,z,18,.12,18);
  }
  for(let x=22;x<=78;x+=8)q('cream',x,.2,50,3,.35,1.4);
  const fountain=new THREE.Group();fountain.position.set(50,.12,50);
  const stone=materials.get('stone');
  const pool=new THREE.Mesh(new THREE.CylinderGeometry(7.6,8.4,1,28),stone);pool.position.y=.5;fountain.add(pool);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(7,7,.14,28),
   new THREE.MeshStandardMaterial({color:0x65afb8,metalness:.45,roughness:.22}));
  water.position.y=1.08;fountain.add(water);
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.7,1.3,4,12),stone);pillar.position.y=3;fountain.add(pillar);
  const crown=new THREE.Mesh(new THREE.TorusGeometry(2.1,.28,8,28),stone);
  crown.rotation.x=Math.PI/2;crown.position.y=5;fountain.add(crown);scene.add(fountain);
 }
 function makeMarina(){
  q('wood',325,.65,-526,16,1,125);
  for(let z=-583;z<=-467;z+=4.2)q('cream',325,1.18,z,16,.08,.19);
  for(let z=-570;z<=-493;z+=26)for(const dir of [-1,1]){
   q('wood',325+dir*16,.55,z,16,.45,3);
   for(const x of [318,332])q('steel',x,1.45,z,.16,1.3,.16);
  }
  for(let i=0;i<6;i++){
   const boat=new THREE.Group(),color=[0xf1e6d8,0x8bc0c6,0xe9d5ae][i%3];
   const hull=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({color,roughness:.5}));
   hull.scale.set(2.6,.68,5.3);hull.position.y=.32;boat.add(hull);
   const cabin=new THREE.Mesh(new THREE.BoxGeometry(3.1,1.35,3.5),materials.get('store'));
   cabin.position.set(0,1.44,1);boat.add(cabin);
   const mast=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,9,6),materials.get('steel'));
   mast.position.y=4.5;boat.add(mast);
   const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(0,6.5);shape.lineTo(3.8,.8);shape.closePath();
   const sail=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xf1e8d3,side:THREE.DoubleSide}));
   sail.rotation.y=Math.PI/2;sail.position.y=1.9;boat.add(sail);
   boat.position.set(325+(i%2===0?-28:28),.06,-495-Math.floor(i/2)*30);
   scene.add(boat);boats.push(boat);
  }
  const house=new THREE.Group();house.position.set(-360,.15,-430);
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.2,3.3,24,14),materials.get('cream'));
  tower.position.y=12;house.add(tower);
  for(const y of [7,15,22]){const stripe=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.7,1.5,14),materials.get('red'));stripe.position.y=y;house.add(stripe)}
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,3,14),
   new THREE.MeshStandardMaterial({color:0xffdfad,emissive:0xffb66d,emissiveIntensity:1.6}));
  beacon.position.y=26.5;house.add(beacon);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(3.3,3.5,14),materials.get('podium'));
  cap.position.y=30;house.add(cap);scene.add(house);
 }
 function makeStreets(){
  const treeLocations=[];
  for(const p of streetPlan()){
   if(p.kind==='zebra')p.axis==='north'
    ?q('crossing',p.x,.068,p.z,1.22,.022,3.5)
    :q('crossing',p.x,.069,p.z,3.5,.022,1.22);
   if(p.kind==='planter'){
    q('podium',p.x,.51,p.z,2.2,.85,2.2);
    q('grass',p.x,1.05,p.z,1.83,.27,1.83);
    q('foliage',p.x,1.5,p.z,1.12,.8,1.12);
   }
   if(p.kind==='bench'){
    q('wood',p.x,1.15,p.z,1.5,.21,3.1);
    q('wood',p.x+.45,1.7,p.z,.15,1.1,3.1);
    for(const z of [-1.15,1.15])q('steel',p.x,.58,p.z+z,.16,1.1,.16);
   }
  }
  for(let i=-5;i<=5;i++)for(let j=-5;j<=5;j++){
   if(Math.abs(i)<=1&&Math.abs(j)<=1)continue;
   const x=i*100+13.6,z=j*100+53;
   q('wood',x,3.4,z,.48,6.8,.48);treeLocations.push([x,7.5,z,.9+visualHash(i,j)*.3]);
  }
  const foliageMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.8,1),materials.get('foliage'),treeLocations.length);
  treeLocations.forEach(([x,y,z,s],i)=>{
   dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(1.2*s,.86*s,1.2*s);
   dummy.updateMatrix();foliageMesh.setMatrixAt(i,dummy.matrix);
  });
  foliageMesh.instanceMatrix.needsUpdate=true;foliageMesh.frustumCulled=false;scene.add(foliageMesh);
 }
 const skyUniforms={horizon:{value:new THREE.Color(0xaccbc7)},zenith:{value:new THREE.Color(0x568da1)},sun:{value:.7}};
 const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,32,20),new THREE.ShaderMaterial({
  uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 dir;void main(){dir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 dir;uniform vec3 horizon,zenith;uniform float sun;void main(){vec3 d=normalize(dir);float t=smoothstep(0.,.95,clamp(d.y*.8+.08,0.,1.));vec3 color=mix(horizon,zenith,t);color+=vec3(1.,.66,.38)*pow(max(dot(d,normalize(vec3(.24,sun+.18,-.62))),0.),700.)*sun;gl_FragColor=vec4(color,1.);}'
 }));
 sky.renderOrder=-1000;scene.add(sky);
 let oceanUniforms=null;
 function attachOcean(ocean){
  oceanUniforms={time:{value:0},day:{value:.9},wet:{value:0}};
  ocean.material=new THREE.ShaderMaterial({
   uniforms:oceanUniforms,side:THREE.DoubleSide,
   vertexShader:'varying vec2 coord;uniform float time;void main(){coord=uv;vec3 v=position;v.z+=sin(v.x*.034+time*1.14)*.19+sin(v.y*.063-time*.87)*.13;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}',
   fragmentShader:'varying vec2 coord;uniform float time,day,wet;void main(){float waves=sin(coord.x*167.+time*1.8)*sin(coord.y*106.-time*1.3);float foam=pow(.5+.5*sin(coord.x*210.+sin(coord.y*47.+time)*3.+time),6.);vec3 deep=mix(vec3(.016,.07,.11),vec3(.03,.24,.32),day);vec3 shore=mix(vec3(.05,.11,.14),vec3(.09,.46,.50),day);vec3 color=mix(deep,shore,.44+.29*coord.y+.1*waves)+vec3(.12,.17,.17)*foam;gl_FragColor=vec4(mix(color,vec3(.2,.24,.27),wet*.2),1.);}'
  });
 }
 let rain=null,rainPosition=null;
 const drops=Array.from({length:350},(_,i)=>({x:(visualHash(i,2)-.5)*75,z:(visualHash(i,3)-.5)*75,y:visualHash(i,4)*37,velocity:20+visualHash(i,5)*13}));
 function makeRain(){
  const geom=new THREE.BufferGeometry();rainPosition=new Float32Array(drops.length*6);
  geom.setAttribute('position',new THREE.BufferAttribute(rainPosition,3));
  rain=new THREE.LineSegments(geom,new THREE.LineBasicMaterial({color:0xd2e5e9,transparent:true,opacity:.34,depthWrite:false}));
  rain.frustumCulled=false;rain.visible=false;scene.add(rain);
 }
 makeRain();
 function build(){makeStreets();makePlaza();makeMarina();renderBatches()}
 function applyEnvironment(environment,light){
  const daylight=Math.max(.02,Math.sin((environment.hour-6)*Math.PI/12));
  const grey=environment.weather!=='clear';
  skyUniforms.zenith.value.setHex(light.sky);
  skyUniforms.horizon.value.setHex(daylight<.15?0x36465e:grey?0x8e9eaa:0xb1d0ca);
  skyUniforms.sun.value=daylight*(grey?.4:1);
  if(oceanUniforms){oceanUniforms.day.value=daylight;oceanUniforms.wet.value=environment.weather==='rain'?1:0}
  rain.visible=environment.weather==='rain';
 }
 function update(now,player){
  const t=now*.001;
  sky.position.set(player.x||0,0,player.z||0);
  if(oceanUniforms)oceanUniforms.time.value=t;
  boats.forEach((boat,i)=>{boat.position.y=.08+Math.sin(t*1.7+i)*.13;boat.rotation.z=Math.sin(t*.75+i)*.02});
  if(rain.visible){
   rain.position.set(player.x||0,0,player.z||0);
   drops.forEach((drop,i)=>{
    const y=((drop.y-t*drop.velocity)%37+37)%37,k=i*6;
    rainPosition[k]=drop.x;rainPosition[k+1]=y;rainPosition[k+2]=drop.z;
    rainPosition[k+3]=drop.x+.4;rainPosition[k+4]=y+1.15;rainPosition[k+5]=drop.z+.1;
   });
   rain.geometry.attributes.position.needsUpdate=true;
  }
 }
 return {decorateBuilding,attachOcean,build,applyEnvironment,update};
}

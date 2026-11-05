import {TILE_SIZE,updateTiles,pedestrianStep,canEnterVehicle} from './world.mjs';
import {ROUTE,createProgress,advanceMission,stepVehicle,collisionDamage} from './simulation.mjs';
import {nearbyObstacles,moveWithCollision,restoreSession,SAVE_VERSION} from './physics.mjs';
import {normalizeEnvironment,environmentLighting,findSafeExit,WEATHER} from './environment.mjs';
import {safeSpawn,sanitizeProgress} from './session-safety.mjs';
import {setupJourneyUI} from './journey-client.mjs';
import {navigationHint} from './journey.mjs';
import {installVisualWorld} from './visual-world.mjs';
import {createSportsCar} from './vehicle-art.mjs';
import {createCharacter} from './character-art.mjs';
import {applySurfaceTextures} from './surface-materials.mjs';
import {setupCityActivities} from './activities-client.mjs';
import {restoreGarage,garageTuning} from './garage.mjs';
import {setupGarageUI} from './garage-client.mjs';
import {createTrafficWorld} from './traffic-world.mjs';
import {restoreHousing} from './housing.mjs';
import {setupHousing} from './housing-client.mjs';
import {createFleetCar,releaseFleetCar} from './fleet-art.mjs';
import {restoreFleet,fleetTuning,fleetVehicle} from './fleet.mjs';
import {setupFleetUI} from './fleet-client.mjs';
import {restoreAudioPreferences} from './audio-state.mjs';
import {createGameAudio} from './audio-world.mjs';
import {setupAudioPanel} from './audio-ui.mjs';
import {createCitizenWorld} from './citizens-world.mjs';
import {restoreSocial} from './citizens-core.mjs';
import {setupCitizenUI} from './citizens-ui.mjs';
import {makeLiving,restoreLiving,advanceLiving,canSprint} from './living-core.mjs';
import {createLivingWorld} from './living-world.mjs';
import {setupLivingUI} from './living-client.mjs';
import {cameraLayout,cameraInterpolationFactor} from './camera-rig.mjs';
import {createRenderQualityController} from './render-quality.mjs';
import {setupRenderQualityUI} from './render-quality-ui.mjs';

import * as THREE from './vendor/three/three.module.js';
// Software WebGL (used by headless browser QA) cannot draw full-size shadow maps
// at 1440px while accepting reliable mouse input. Keep production quality.
const softwareRenderer=/HeadlessChrome/i.test(navigator.userAgent);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8bc6d3);scene.fog=new THREE.FogExp2(0xb7d6cf,.0018);const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,1500);const renderer=new THREE.WebGLRenderer({antialias:!softwareRenderer,powerPreference:'high-performance'});renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;document.querySelector('#game').append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd3f1ff,0x617b6b,2.0));const moon=new THREE.DirectionalLight(0xffefc6,2.7);moon.position.set(-100,250,-120);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-100;moon.shadow.camera.right=100;moon.shadow.camera.top=100;moon.shadow.camera.bottom=-100;scene.add(moon);
const renderQuality=createRenderQualityController({
 renderer,light:moon,software:softwareRenderer,storage:window.localStorage,
 viewport:()=>({width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio||1}),
 hints:{deviceMemory:navigator.deviceMemory,cores:navigator.hardwareConcurrency,
  saveData:navigator.connection?.saveData===true}
});
// Read-only diagnostics endpoint for browser acceptance and local troubleshooting.
Object.defineProperty(window,'__AZURE_RENDER_DIAGNOSTICS__',{
 value:Object.freeze({snapshot:()=>renderQuality.snapshot()}),writable:false,configurable:false
});
const mat=(c,r=.75,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});const asphalt=mat(0x394e56,.88),concrete=mat(0xb1b6a5),sidewalk=mat(0xd1d0bc),buildingMats=[mat(0x9db9ba,.4,.4),mat(0xd6d5c6,.45,.25),mat(0x7b9fa6,.3,.5),mat(0xb5c2ba,.55,.2)];const box=(w,h,d,ma,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),ma);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o};// Static decorative geometry is batched by shape/material to keep WebGL draw calls bounded.
// Each batch retains independent transforms while sharing one geometry and one material.
const staticBatches=new Map();
function staticDetail(w,h,d,material,x,y,z){
  const key=`${w}/${h}/${d}/${material.uuid}`;
  let batch=staticBatches.get(key);
  if(!batch){batch={w,h,d,material,positions:[]};staticBatches.set(key,batch)}
  batch.positions.push([x,y,z]);
}
function flushStaticDetails(){
  const transform=new THREE.Object3D();
  for(const batch of staticBatches.values()){
    const geometry=new THREE.BoxGeometry(batch.w,batch.h,batch.d);
    const mesh=new THREE.InstancedMesh(geometry,batch.material,batch.positions.length);
    for(let i=0;i<batch.positions.length;i++){
      transform.position.set(...batch.positions[i]);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
    scene.add(mesh);
  }
  staticBatches.clear();
}
applySurfaceTextures(THREE,{asphalt,concrete,sidewalk,buildingMats});
const roadMark=mat(0xc1c2b0);const roadSpacing=100,world=700;box(world*2,.2,world*2,concrete,0,-.2,0);
for(let k=-6;k<=6;k++){box(20,.03,1400,asphalt,k*100,.02,0);box(1400,.03,20,asphalt,0,.025,k*100);for(let j=-68;j<69;j++){staticDetail(.17,.015,5,roadMark,k*100,.052,j*10);staticDetail(5,.015,.17,roadMark,j*10,.055,k*100)}box(2,.09,1400,sidewalk,k*100+12,.02,0);box(2,.09,1400,sidewalk,k*100-12,.02,0);box(1400,.09,2,sidewalk,0,.02,k*100+12);box(1400,.09,2,sidewalk,0,.02,k*100-12)}
const visuals=installVisualWorld(THREE,scene);
const winMat=[new THREE.MeshBasicMaterial({color:0x7dcbe8}),new THREE.MeshBasicMaterial({color:0xf9c58d}),new THREE.MeshBasicMaterial({color:0x83a6ad}),new THREE.MeshBasicMaterial({color:0x6b9b9e})];const rand=(x,z)=>{let v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v)};
for(let ix=-6;ix<6;ix++)for(let iz=-6;iz<6;iz++){if(Math.abs(ix)<1&&Math.abs(iz)<1)continue;for(let a=0;a<2;a++)for(let b=0;b<2;b++){const x=ix*100+31+a*37,z=iz*100+31+b*37;let r=rand(x,z),h=20+Math.pow(r,2)*150;if(Math.abs(ix)<3&&Math.abs(iz)<3)h+=35;const w=25+rand(z,x)*6,d=25+rand(x+3,z)*6;box(w,h,d,buildingMats[Math.floor(r*4)],x,h/2,z);visuals.decorateBuilding({x,z,w,d,h,r});if(r>.7){box(w+1,2,d+1,mat(0x131b27),x,h+1,z)}for(let side of [-1,1])for(let floor=1;floor<Math.floor(h/5);floor++){if(rand(x+floor,z)<.27)continue;for(let col=-2;col<=2;col++){const wm=winMat[Math.floor(rand(x+col*7+floor,z)*4)];const xx=x+col*(w/6);staticDetail(2.3,2.5,.13,wm,xx,floor*5,z+side*(d/2+.09));const zz=z+col*(d/6);staticDetail(.13,2.5,2.3,wm,x+side*(w/2+.09),floor*5,zz)}}if(r>.84){const sign=new THREE.MeshBasicMaterial({color:r>.93?0xf0c484:0x68b8be});box(w*.6,2,.2,sign,x,h*.62,z+d/2+.2)}}}
flushStaticDetails();
// street lighting and trees
for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){for(let s of [-1,1]){let x=i*100+s*14,z=j*100+20;box(.25,12,.25,mat(0x566577),x,6,z);box(3,.2,.3,mat(0x566577),x+s*1.4,12,z);const lamp=new THREE.PointLight(0xffca8a,12,32,2);lamp.position.set(x+s*2.6,11.5,z);if(Math.abs(i)<3&&Math.abs(j)<3)scene.add(lamp);box(.9,.1,.5,new THREE.MeshBasicMaterial({color:0xffd6a0}),x+s*2.6,11.8,z);}}
// glowing distant billboards
for(let i=0;i<30;i++){const x=(rand(i,3)-.5)*1000,z=(rand(i,4)-.5)*1000;if(Math.abs(x)<45||Math.abs(z)<45)continue;let h=45+rand(i,7)*85;const c=[0x22c7ff,0xff3d99,0xffa44b][i%3];const b=box(12,4,.3,new THREE.MeshBasicMaterial({color:c}),x,h,z);b.rotation.y=rand(i,6)*Math.PI}
// Coastal district: water plane, beach and procedural palm silhouettes
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1400,400),new THREE.MeshStandardMaterial({color:0x3a9fae,roughness:.22,metalness:.2,transparent:true,opacity:.94}));ocean.rotation.x=-Math.PI/2;ocean.position.set(-10,.12,-650);scene.add(ocean);
const sand=new THREE.Mesh(new THREE.PlaneGeometry(1400,95),mat(0xe5d4a9,.96));sand.rotation.x=-Math.PI/2;sand.position.set(0,.13,-430);scene.add(sand);
visuals.attachOcean(ocean);visuals.build();
const trunk=mat(0x8d7350),leaf=mat(0x3d7960);for(let i=0;i<48;i++){let x=-600+i*25,z=-375+(i%3)*11;const t=new THREE.Mesh(new THREE.CylinderGeometry(.27,.44,12,7),trunk);t.position.set(x,6,z);t.rotation.z=.08;scene.add(t);for(let j=0;j<7;j++){const f=new THREE.Mesh(new THREE.ConeGeometry(2.2,10,4),leaf);f.position.set(x+Math.sin(j*Math.PI*2/7)*3,12,z+Math.cos(j*Math.PI*2/7)*3);f.rotation.z=Math.sin(j*Math.PI*2/7)*1.1;f.rotation.x=Math.cos(j*Math.PI*2/7)*1.1;scene.add(f)}}
// Streamable outer city: independent tile scene graph, bounded active radius.
const streamed=new Map();let lastTileX=Infinity,lastTileZ=Infinity;
const tileMaterials=[mat(0xabc4bd,.5,.25),mat(0xe0d6c1,.7,.1),mat(0x829ea9,.4,.4),mat(0xc5b5a4,.6,.1)];
function buildTile(tile){const group=new THREE.Group();if(Math.abs(tile.tx)<=2&&Math.abs(tile.tz)<=2){scene.add(group);return group;}group.name=`DISTRICT ${tile.key} ${tile.name}`;const ground=new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE,TILE_SIZE),tile.coastal?mat(0xd9c99d):mat(0xa6b3a2));ground.rotation.x=-Math.PI/2;ground.position.set(tile.tx*TILE_SIZE+TILE_SIZE/2,-.1,tile.tz*TILE_SIZE+TILE_SIZE/2);group.add(ground);
const trunkMat=mat(0x927454),leafMat=mat(0x39795d);for(const o of tile.objects){if(o.kind==='building'){const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,o.depth),tileMaterials[o.color]);mesh.position.set(o.x,o.height/2,o.z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);const roof=new THREE.Mesh(new THREE.BoxGeometry(o.width+1,.7,o.depth+1),mat(0xd7d4c7));roof.position.set(o.x,o.height+.35,o.z);group.add(roof)}else{const stem=new THREE.Mesh(new THREE.CylinderGeometry(.18,.35,o.height,6),trunkMat);stem.position.set(o.x,o.height/2,o.z);group.add(stem);for(let j=0;j<5;j++){const frond=new THREE.Mesh(new THREE.ConeGeometry(1.3,6,3),leafMat);frond.position.set(o.x+Math.sin(j*1.256)*2,o.height,o.z+Math.cos(j*1.256)*2);frond.rotation.z=Math.sin(j*1.256)*.9;frond.rotation.x=Math.cos(j*1.256)*.9;group.add(frond)}}}scene.add(group);return group}
function releaseTile(group){scene.remove(group);group.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
function streamAt(x,z){const tx=Math.floor(x/TILE_SIZE),tz=Math.floor(z/TILE_SIZE);if(tx!==lastTileX||tz!==lastTileZ){updateTiles(streamed,x,z,buildTile,releaseTile,2);lastTileX=tx;lastTileZ=tz;document.querySelector('#stream').textContent=`${streamed.size} / ${TILE_SIZE}m tiles`}}
// Third-person walking and enter/exit vehicle.
const {avatar,animate:animateAvatar}=createCharacter(THREE);scene.add(avatar);avatar.position.set(8,.1,12);avatar.visible=false;let onFoot=false;
function switchMode(){if(!started||paused||activities.isOpen()||garageUI.isOpen()||housing.isOpen()||housing.inside()||fleetUI.isOpen()||audioUI.isOpen()||citizenUI.isOpen()||livingUI.isOpen())return;if(!onFoot){if(Math.abs(velocity)>3)return;const safe=findSafeExit(car.position,heading,nearbyObstacles(car.position.x,car.position.z));if(!safe)return;onFoot=true;avatar.position.set(safe.x,.1,safe.z);avatar.visible=true;car.visible=true;velocity=0}else{if(!canEnterVehicle(avatar.position,car.position))return;onFoot=false;avatar.visible=false}document.querySelector('#mode').textContent=onFoot?'步行探索 / ON FOOT':'车辆驾驶 / DRIVING';document.querySelector('#enterBtn').textContent=onFoot?'上车 E':'下车 E';saveSession()}
// car model
let vehicleRig=createSportsCar(THREE);
const car=new THREE.Group();car.name='Player Vehicle Root';car.add(vehicleRig.car);
scene.add(car);car.position.set(0,.15,12);
let headlights=vehicleRig.headlights;
const updateWheels=distance=>vehicleRig.updateWheels(distance);
const setPaint=hex=>vehicleRig.setPaint(hex);
function equipFleetVehicle(id){
 if(!fleetVehicle(id))return false;
 const old=vehicleRig;
 vehicleRig=createFleetCar(THREE,id);
 car.remove(old.car);car.add(vehicleRig.car);
 headlights=vehicleRig.headlights;releaseFleetCar(old.car);
 setPaint(garageTuning(garageProfile).paintHex);
 const display=document.getElementById('fleetCurrent');
 if(display)display.textContent=fleetVehicle(id).name;
 return true;
}
const trafficWorld=createTrafficWorld(THREE,scene,45);
const citizenWorld=createCitizenWorld(THREE,scene);
const livingWorld=createLivingWorld(THREE,scene);
// mission beacon
const beacon=new THREE.Group();const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,100,24,1,true),new THREE.MeshBasicMaterial({color:0x3ee8ff,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=50;beacon.add(beam);const ring=new THREE.Mesh(new THREE.TorusGeometry(4,.17,8,48),new THREE.MeshBasicMaterial({color:0x61f4ff}));ring.rotation.x=Math.PI/2;ring.position.y=.3;beacon.add(ring);beacon.position.set(0,0,-290);scene.add(beacon);
let progress,garageProfile,housingProfile,fleetProfile,audioProfile,socialProfile,livingProfile;
try{
 const raw=JSON.parse(localStorage.getItem("azure-coast-driving-v2")||"{}");
 progress=sanitizeProgress(raw,ROUTE.length);
 garageProfile=restoreGarage(raw.garage);
 housingProfile=restoreHousing(raw.housing);
 fleetProfile=restoreFleet(raw.fleet);
 audioProfile=restoreAudioPreferences(raw.audio);
 socialProfile=restoreSocial(raw.citizens);
 livingProfile=restoreLiving(raw.living);
}catch{progress=createProgress();garageProfile=restoreGarage(null);housingProfile=restoreHousing(null);fleetProfile=restoreFleet(null);audioProfile=restoreAudioPreferences(null);socialProfile=restoreSocial(null);livingProfile=makeLiving()}
equipFleetVehicle(fleetProfile.active);
const audioEngine=createGameAudio({win:window,preferences:audioProfile});
const audioUI=setupAudioPanel({
 getPreferences:()=>audioProfile,audio:audioEngine,clearControls:()=>clearControls(),
 onChange:preferences=>{audioProfile=preferences;persist()}
});
window.addEventListener('pagehide',()=>audioEngine.dispose());
function persist(){try{localStorage.setItem("azure-coast-driving-v2",JSON.stringify({...progress,garage:garageProfile,housing:housingProfile,fleet:fleetProfile,audio:audioProfile,citizens:socialProfile,living:livingProfile}))}catch{}}
function updateRoute(){const m=ROUTE[progress.stage];beacon.visible=!!m;if(m){beacon.position.set(m.x,0,m.z);document.querySelector("#objective").textContent=`${progress.stage+1}/${ROUTE.length} · ${m.name} · $${m.reward.toLocaleString()}`}else document.querySelector("#objective").textContent="全程完成 · 自由探索";document.querySelector("#credits").textContent=progress.credits.toLocaleString();document.querySelector("#condition").textContent=Math.max(0,100-progress.damage)+"%"}updateRoute();

const keys={};const clearControls=()=>{for(const k of Object.keys(keys))keys[k]=false};window.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden){clearControls();if(started&&!paused)togglePause()}});document.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if(e.repeat&&['e','c','h','r','p','m','f','g','j','b','i','k','q','u','escape'].includes(key))return;keys[key]=true;
if(audioUI.isOpen()||citizenUI.isOpen()||livingUI.isOpen()||renderQualityUI.isOpen()){keys[key]=false;return}
if(housing.inside()){
 if(key==='e'||e.key==='Escape'){if(housing.decorating())housing.closeDecorate();else housing.exit();return}
 if(key==='i'){housing.toggleDecorate();return}
 if(key==='p'){togglePause();return}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
 return;
}
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==='e'&&!e.repeat)switchMode();if(e.key.toLowerCase()==='c')view=(view+1)%3;if(e.key.toLowerCase()==='h')headlights.forEach(l=>l.visible=!l.visible);if(e.key.toLowerCase()==='r')reset();if(e.key==='Escape'&&livingUI.isOpen()){livingUI.close();return}
if(e.key==='Escape'&&citizenUI.isOpen()){citizenUI.close();return}
if(e.key==='Escape'&&fleetUI.isOpen()){fleetUI.close();return}
if(e.key==='Escape'&&housing.isOpen()){housing.close();return}
if(e.key==='Escape'&&garageUI.isOpen()){garageUI.close();return}
if(e.key==='Escape'&&activities.isOpen()){activities.close();return}
if(e.key==='Escape'&&navigation.isOpen()){navigation.closeMap();return}
if(key==='j'){if(fleetUI.isOpen())fleetUI.close();if(housing.isOpen())housing.close();if(garageUI.isOpen())garageUI.close();if(navigation.isOpen())navigation.closeMap();activities.toggle();return}
if(key==='g'){if(fleetUI.isOpen())fleetUI.close();if(housing.isOpen())housing.close();if(activities.isOpen())activities.close();if(navigation.isOpen())navigation.closeMap();garageUI.toggle();return}
if(key==='b'){if(fleetUI.isOpen())fleetUI.close();if(activities.isOpen())activities.close();if(garageUI.isOpen())garageUI.close();if(navigation.isOpen())navigation.closeMap();housing.toggle();return}
if(key==='k'){if(citizenUI.isOpen())citizenUI.close();if(housing.isOpen())housing.close();if(activities.isOpen())activities.close();if(garageUI.isOpen())garageUI.close();if(navigation.isOpen())navigation.closeMap();fleetUI.toggle();return}
if(key==='q'){if(livingUI.isOpen())livingUI.close();citizenUI.interact();return}
if(key==='u'){if(citizenUI.isOpen())citizenUI.close();livingUI.interact();return}
if(key==='f'){if(!activities.active()&&livingUI.access()&&(onFoot||Math.abs(velocity)<=3)){livingUI.interact();return}if(!activities.active()&&housing.canInteract()){housing.interact();return}if(!activities.active()&&fleetUI.access()){fleetUI.open();return}if(!activities.active()&&garageUI.access()){garageUI.open();return}if(!activities.active()&&onFoot&&citizenWorld.nearby(avatar.position)){citizenUI.interact();return}activities.interact();return}if(e.key.toLowerCase()==='p'||e.key==='Escape')togglePause();if(e.key.toLowerCase()==='m')toggleMap()});document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{keys[k]=true;b.setPointerCapture(e.pointerId)});b.addEventListener('pointerup',()=>keys[k]=false);b.addEventListener('pointercancel',()=>keys[k]=false)});let started=false,paused=false,view=0,velocity=0,heading=0,last=performance.now(),done=false,collisions=0,collisionCooldown=0;
const renderQualityUI=setupRenderQualityUI({doc:document,quality:renderQuality,
 getActive:()=>started&&!paused});
const SESSION_KEY='azure-coast-session-v3';
const ENV_KEY='azure-coast-environment-v1';
let environment;try{environment=normalizeEnvironment(JSON.parse(localStorage.getItem(ENV_KEY)||'{}'))}catch{environment=normalizeEnvironment()}
const environmentHour=document.querySelector('#environmentHour'),environmentWeather=document.querySelector('#environmentWeather'),environmentLabel=document.querySelector('#environmentLabel');
function applyEnvironment(){const light=environmentLighting(environment);moon.intensity=light.sunIntensity;scene.children.find(o=>o.isHemisphereLight).intensity=light.ambientIntensity;scene.background.setHex(light.sky);scene.fog.density=light.fogDensity;renderer.toneMappingExposure=light.exposure;visuals.applyEnvironment(environment,light);moon.position.set(Math.cos((environment.hour-6)/12*Math.PI)*160,Math.max(15,Math.sin((environment.hour-6)/12*Math.PI)*250),-110);headlights.forEach(l=>l.visible=light.headlights);environmentHour.value=String(environment.hour);environmentWeather.value=environment.weather;environmentLabel.textContent=`${String(environment.hour).padStart(2,'0')}:00 · ${ {clear:'晴朗',overcast:'多云',rain:'雨天'}[environment.weather]}`;try{localStorage.setItem(ENV_KEY,JSON.stringify(environment))}catch{}}
environmentHour.addEventListener('input',()=>{environment.hour=Number(environmentHour.value);applyEnvironment()});environmentWeather.addEventListener('change',()=>{environment.weather=environmentWeather.value;applyEnvironment()});applyEnvironment();
function saveSession(){if(window.__AZURE_SNAPSHOT_RESTORING)return;try{localStorage.setItem(SESSION_KEY,JSON.stringify({version:SAVE_VERSION,car:{x:car.position.x,z:car.position.z,heading},avatar:{x:avatar.position.x,z:avatar.position.z,heading:avatar.rotation.y},onFoot,view}))}catch{}}
try{const session=restoreSession(JSON.parse(localStorage.getItem(SESSION_KEY)||'null'));if(session){const safeCar=safeSpawn(session.car,2.3);if(!safeCar)throw Error("Unsafe saved vehicle position");car.position.x=safeCar.x;car.position.z=safeCar.z;heading=session.car.heading;car.rotation.y=heading;view=session.view;if(session.avatar){const safeAvatar=safeSpawn(session.avatar,.7);if(safeAvatar){avatar.position.x=safeAvatar.x;avatar.position.z=safeAvatar.z;avatar.rotation.y=session.avatar.heading}else session.avatar=null}onFoot=session.onFoot&&!!session.avatar;avatar.visible=onFoot;document.querySelector('#mode').textContent=onFoot?'步行探索 / ON FOOT':'车辆驾驶 / DRIVING';document.querySelector('#enterBtn').textContent=onFoot?'上车 E':'下车 E'}}catch{}
window.addEventListener('pagehide',saveSession);
function reset(){car.position.set(0,.15,12);velocity=0;heading=0;done=false;beacon.visible=true;updateRoute()}document.querySelector('#enterBtn').onclick=switchMode;document.querySelector('#begin').onclick=()=>{clearControls();audioEngine.start();started=true;paused=false;document.querySelector('#start').classList.add('hidden')};function togglePause(){if(!started)return;clearControls();navigation.closeMap();activities.close();garageUI.close();housing.close();fleetUI.close();audioUI.close();citizenUI.close();livingUI.close();renderQualityUI.close();if(housing.inside())housing.closeDecorate();paused=!paused;document.querySelector('#pause').classList.toggle('visible',paused)}function toggleMap(){if(housing.inside())return;if(livingUI.isOpen())livingUI.close();if(citizenUI.isOpen())citizenUI.close();if(fleetUI.isOpen())fleetUI.close();if(housing.isOpen())housing.close();if(activities.isOpen())activities.close();if(garageUI.isOpen())garageUI.close();navigation.toggleMap()}document.querySelector('#resume').onclick=()=>{audioEngine.start();togglePause()};document.querySelector('#restart').onclick=()=>{reset();togglePause()};document.querySelector('#repair').onclick=()=>{if(progress.credits>=600&&progress.damage>0){progress.credits-=600;progress.damage=0;persist();updateRoute();audioEngine.cue('purchase')}};document.querySelector('#pauseBtn').onclick=togglePause;document.querySelector('#cameraBtn').onclick=()=>view=(view+1)%3;const minimap=document.querySelector('#minimap'),ctx=minimap.getContext('2d');function drawMap(){ctx.fillStyle='#0a1c29';ctx.fillRect(0,0,220,220);ctx.save();ctx.translate(110,110);ctx.rotate(onFoot?avatar.rotation.y:heading);ctx.scale(.37,.37);ctx.strokeStyle='#567080';ctx.lineWidth=12;for(let i=-6;i<=6;i++){let x=i*100-(onFoot?avatar.position.x:car.position.x);let z=i*100-(onFoot?avatar.position.z:car.position.z);ctx.beginPath();ctx.moveTo(x,-800);ctx.lineTo(x,800);ctx.stroke();ctx.beginPath();ctx.moveTo(-800,z);ctx.lineTo(800,z);ctx.stroke()}const active=navigation.currentTarget()||(beacon.visible?beacon.position:null);if(active){ctx.fillStyle='#51e9ff';ctx.beginPath();ctx.arc(active.x-(onFoot?avatar.position.x:car.position.x),active.z-(onFoot?avatar.position.z:car.position.z),5,0,Math.PI*2);ctx.fill()}ctx.restore();ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(110,95);ctx.lineTo(102,122);ctx.lineTo(118,122);ctx.closePath();ctx.fill()}
const navigation=setupJourneyUI({
  getPosition:()=>onFoot?avatar.position:car.position,
  getHeading:()=>onFoot?avatar.rotation.y:heading,
  onMapOpen:()=>clearControls(),
  notify:(message)=>{
    const toast=document.querySelector('#toast');toast.textContent=message;
    toast.classList.add('show');clearTimeout(notifyTimer);
    notifyTimer=setTimeout(()=>toast.classList.remove('show'),3500);
  }
});
let notifyTimer;
const cityToast=message=>{
 const toast=document.querySelector('#toast');toast.textContent=message;
 toast.classList.add('show');clearTimeout(notifyTimer);
 notifyTimer=setTimeout(()=>toast.classList.remove('show'),3500);
};
const activities=setupCityActivities({
 THREE,scene,
 getPlayer:()=>({position:onFoot?avatar.position:car.position,
  mode:onFoot?'foot':'vehicle',speed:velocity,heading:onFoot?avatar.rotation.y:heading}),
 canPlay:()=>started&&!paused&&!navigation.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!housing.inside()&&!fleetUI.isOpen(),
 clearControls,
 notify:cityToast,
 onPayout:amount=>{progress.credits+=amount;persist();updateRoute()}
});
const garageUI=setupGarageUI({
 THREE,scene,
 getPlayer:()=>({position:onFoot?avatar.position:car.position,speed:velocity}),
 getGarage:()=>garageProfile,getCredits:()=>Math.floor(progress.credits),
 canPlay:()=>started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!housing.inside()&&!fleetUI.isOpen(),
 clearControls,notify:cityToast,
 onCommit:result=>{audioEngine.cue('purchase');garageProfile=result.state;progress.credits=result.balance;
  setPaint(garageTuning(garageProfile).paintHex);persist();updateRoute()}
});
const housing=setupHousing({
 THREE,cityScene:scene,renderer,
 getPlayer:()=>({position:onFoot?avatar.position:car.position,
  mode:onFoot?'foot':'vehicle',speed:velocity}),
 getHousing:()=>housingProfile,getCredits:()=>Math.floor(progress.credits),
 canPlay:()=>started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen()&&!fleetUI.isOpen(),
 clearControls,notify:cityToast,
 onCommit:result=>{audioEngine.cue('purchase');housingProfile=result.state;progress.credits=result.balance;persist();updateRoute()}
});
const fleetUI=setupFleetUI({
 THREE,scene,
 getPlayer:()=>({position:onFoot?avatar.position:car.position,speed:velocity,mode:onFoot?'foot':'vehicle'}),
 getFleet:()=>fleetProfile,getCredits:()=>Math.floor(progress.credits),
 canPlay:()=>started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!housing.inside(),
 clearControls,notify:cityToast,
 onCommit:result=>{
  audioEngine.cue('purchase');
  const oldId=fleetProfile.active;
  fleetProfile=result.state;progress.credits=result.balance;
  if(oldId!==fleetProfile.active){
   velocity=0;equipFleetVehicle(fleetProfile.active);applyEnvironment();
  }
  persist();updateRoute();
 }
});
const citizenUI=setupCitizenUI({
 world:citizenWorld,getState:()=>socialProfile,
 getPlayer:()=>({position:onFoot?avatar.position:car.position,mode:onFoot?'foot':'vehicle',speed:velocity}),
 getEnvironment:()=>environment,
 onCommit:newState=>{socialProfile=newState;persist()},
 canPlay:()=>started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&
  !garageUI.isOpen()&&!housing.isOpen()&&!housing.inside()&&!fleetUI.isOpen()&&!audioUI.isOpen(),
 notify:cityToast,clearControls
});
const livingUI=setupLivingUI({
 getPlayer:()=>({position:onFoot?avatar.position:car.position,mode:onFoot?'foot':'vehicle',speed:velocity}),
 getState:()=>livingProfile,getCredits:()=>Math.floor(progress.credits),
 getCarId:()=>fleetProfile.active,
 onCommit:result=>{
  audioEngine.cue('purchase');livingProfile=result.state;
  progress.credits=result.balance;persist();updateRoute();
 },
 canPlay:()=>started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&
  !garageUI.isOpen()&&!housing.isOpen()&&!housing.inside()&&
  !fleetUI.isOpen()&&!audioUI.isOpen()&&!citizenUI.isOpen(),
 clearControls,notify:cityToast
});
let lastVisualFrame=0,lastTrafficHudUpdate=-Infinity,cameraInitialized=false;
// Headless Chromium runs with CPU-based WebGL. Throttle its frame rate during
// functional checks without reducing the interactive frame rate for players.
const automatedRenderer=softwareRenderer;
function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;
if(housing.inside()){
 if(started&&!paused)livingProfile=advanceLiving(livingProfile,dt,{onFoot:true});
 const isMoving=!!(keys.w||keys.a||keys.s||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright);
 audioEngine.update({vehicleId:fleetProfile.active,velocity:0,onFoot:true,inside:true,
  moving:isMoving&&!housing.decorating(),sprinting:!!keys.shift,
  paused:paused||housing.decorating()||audioUI.isOpen(),active:started},now);
 housing.update(now,paused?0:dt,keys);
 const indoorBudget=paused||housing.decorating()?400:automatedRenderer?230:25;
 if(now-lastVisualFrame>=indoorBudget){housing.render();lastVisualFrame=now}
 return;
}
if(started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!fleetUI.isOpen()&&!audioUI.isOpen()&&!citizenUI.isOpen()&&!livingUI.isOpen()&&!document.body.classList.contains('mobile-actions-open')&&onFoot){const sprintAllowed=!!keys.shift&&canSprint(livingProfile);const beforeFoot={x:avatar.position.x,z:avatar.position.z};const p=pedestrianStep(avatar.position,{forward:keys.w||keys.arrowup,back:keys.s||keys.arrowdown,left:keys.a||keys.arrowleft,right:keys.d||keys.arrowright,sprint:sprintAllowed},dt);const walk=moveWithCollision(avatar.position,p,.7,nearbyObstacles(avatar.position.x,avatar.position.z));avatar.position.x=walk.x;avatar.position.z=walk.z;avatar.rotation.y=p.heading;livingProfile=advanceLiving(livingProfile,dt,{onFoot:true,moving:Math.hypot(walk.x-beforeFoot.x,walk.z-beforeFoot.z)>.01,sprinting:sprintAllowed,distance:Math.hypot(walk.x-beforeFoot.x,walk.z-beforeFoot.z)});document.querySelector('#speed').textContent=sprintAllowed?'RUN':'WALK';document.querySelector('#gear').textContent='EXPLORATION · E TO ENTER';}if(started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!fleetUI.isOpen()&&!audioUI.isOpen()&&!citizenUI.isOpen()&&!livingUI.isOpen()&&!document.body.classList.contains('mobile-actions-open')&&!onFoot){const prev={speed:velocity,heading,x:car.position.x,z:car.position.z};const hasEnergy=livingProfile.fuel[fleetProfile.active]>.05;
const tuning=fleetTuning(fleetProfile,garageTuning(garageProfile));
// Even on an empty tank, keep low-power emergency crawling so a player can
// drive to a physical energy station instead of getting permanently stranded.
if(!hasEnergy)tuning.maxSpeed=Math.min(3,tuning.maxSpeed);
const next=stepVehicle(prev,{forward:keys.w||keys.arrowup,reverse:keys.s||keys.arrowdown,
 left:keys.a||keys.arrowleft,right:keys.d||keys.arrowright},dt,tuning);velocity=next.speed;heading=next.heading;car.rotation.y=heading;const drive=moveWithCollision(car.position,{x:Math.max(-640,Math.min(640,next.x)),z:Math.max(-640,Math.min(640,next.z))},2.3,nearbyObstacles(car.position.x,car.position.z));car.position.x=drive.x;car.position.z=drive.z;livingProfile=advanceLiving(livingProfile,dt,{distance:Math.hypot(drive.x-prev.x,drive.z-prev.z),onFoot:false,carId:fleetProfile.active});if(drive.hit&&collisionCooldown<=0){audioEngine.cue('impact',Math.min(1,Math.abs(velocity)/24));progress.damage=Math.min(100,progress.damage+Math.max(1,Math.round(collisionDamage(velocity)*garageTuning(garageProfile).impactFactor)));velocity*=-.12;collisionCooldown=1.5;updateRoute();persist()}updateWheels(velocity*dt);progress.distance+=Math.abs(velocity)*dt;progress.bestSpeed=Math.max(progress.bestSpeed,Math.abs(velocity)*3.6);collisionCooldown=Math.max(0,collisionCooldown-dt);if(collisionCooldown===0&&trafficWorld.nearbyPlayer(car.position,4.5)){audioEngine.cue('impact',Math.min(1,Math.abs(velocity)/24));progress.damage=Math.min(100,progress.damage+Math.max(1,Math.round(collisionDamage(velocity)*garageTuning(garageProfile).impactFactor)));velocity*=-.22;collisionCooldown=1.5;document.querySelector('#condition').textContent=(100-progress.damage)+'%';persist()}const result=advanceMission(progress,car.position.x,car.position.z);if(result.completed){audioEngine.cue('complete');progress=result.progress;persist();updateRoute();const toast=document.querySelector('#toast');toast.textContent=`任务完成 · ${result.completed.name} · +$${result.completed.reward.toLocaleString()}`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3500)}if(progress.damage>=100){velocity=0;progress.damage=45;car.position.set(0,.15,12);persist();updateRoute()}if(Math.floor(now/3000)!==Math.floor((now-dt*1000)/3000)){persist();saveSession()}const km=Math.round(Math.abs(velocity)*3.6);document.querySelector('#speed').textContent=String(km).padStart(3,'0');document.querySelector('#speedbar').style.width=Math.min(100,km/1.9)+'%';document.querySelector('#gear').textContent='GEAR '+String(Math.max(1,Math.ceil(km/45))).padStart(2,'0')+' / AUTO · SPORT';}audioEngine.update({vehicleId:fleetProfile.active,velocity,
  accelerating:!!(keys.w||keys.arrowup),onFoot,
  moving:!!(keys.w||keys.a||keys.s||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright),
  sprinting:!!keys.shift,weather:environment.weather,
  paused:paused||navigation.isOpen()||activities.isOpen()||garageUI.isOpen()||housing.isOpen()||fleetUI.isOpen()||audioUI.isOpen()||document.body.classList.contains('mobile-actions-open'),
  active:started},now);
livingUI.update(now);
trafficWorld.update(dt,now,onFoot?avatar.position:car.position,started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen());
citizenWorld.update(dt,now,{player:{mode:onFoot?'foot':'vehicle',
 position:onFoot?avatar.position:car.position},traffic:trafficWorld.getAgentPositions(),
 hour:environment.hour,weather:environment.weather,
 active:started&&!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!fleetUI.isOpen()&&!citizenUI.isOpen()});
citizenUI.update(now);if(!paused&&!navigation.isOpen()&&!activities.isOpen()&&!garageUI.isOpen())ring.rotation.z+=dt;const focus=onFoot?avatar:car;streamAt(focus.position.x,focus.position.z);const cameraPose=cameraLayout({width:innerWidth,height:innerHeight,view,onFoot});const offset=new THREE.Vector3(...cameraPose.offset);offset.applyAxisAngle(new THREE.Vector3(0,1,0),onFoot?avatar.rotation.y:heading);const target=focus.position.clone().add(offset);camera.position.lerp(target,cameraInterpolationFactor(dt,cameraInitialized));cameraInitialized=true;const facing=onFoot?avatar.rotation.y:heading;const look=focus.position.clone().add(new THREE.Vector3(-Math.sin(facing)*cameraPose.lookAhead,cameraPose.lookHeight,-Math.cos(facing)*cameraPose.lookAhead));camera.lookAt(look);animateAvatar(now*.001,onFoot&&!!(keys.w||keys.s||keys.a||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright),!!keys.shift);navigation.update(now,started&&!paused&&!activities.isOpen()&&!garageUI.isOpen()&&!housing.isOpen()&&!fleetUI.isOpen());activities.update(now);garageUI.update(now);housing.update(now,dt,keys);fleetUI.update(now);if(now-lastTrafficHudUpdate>=750){const flow=trafficWorld.stats();document.querySelector('#trafficStatus').textContent='交通 '+flow.moving+'/'+flow.cars+' · '+flow.meanSpeed+' km/h';lastTrafficHudUpdate=now;}const frameBudget=(navigation.isOpen()||activities.isOpen()||garageUI.isOpen()||housing.isOpen()||fleetUI.isOpen()||citizenUI.isOpen()||livingUI.isOpen())?500:(!started||paused)?350:automatedRenderer?220:24;if(now-lastVisualFrame>=frameBudget){drawMap();visuals.update(now,focus.position);renderer.render(scene,camera);
 renderQuality.presented(now,started&&!paused);
 lastVisualFrame=now}
renderQualityUI.update(now);
}requestAnimationFrame(tick);
addEventListener('resize',()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderQuality.resize();
});

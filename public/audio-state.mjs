/**
 * AZURE COAST / deterministic dynamic audio model.
 * Entirely original real-time synthesis. No copyrighted samples or music.
 */
import {fleetVehicle,STARTER_ID} from './fleet.mjs';
export const AUDIO_VERSION=1;
export const DEFAULT_AUDIO=Object.freeze({
 version:AUDIO_VERSION,master:.62,engine:.66,ambience:.52,effects:.7,muted:false
});
const unit=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
export function restoreAudioPreferences(raw){
 if(!raw||typeof raw!=='object'||raw.version!==AUDIO_VERSION)return {...DEFAULT_AUDIO};
 return {
  version:AUDIO_VERSION,
  master:unit(raw.master),
  engine:unit(raw.engine),
  ambience:unit(raw.ambience),
  effects:unit(raw.effects),
  muted:raw.muted===true
 };
}
const bodyProfile=Object.freeze({
 starter:{base:41,harmonic:2.3,roughness:.54,whine:.08},
 sport:{base:48,harmonic:2.65,roughness:.51,whine:.09},
 super:{base:62,harmonic:3.1,roughness:.69,whine:.14},
 electric:{base:0,harmonic:0,roughness:0,whine:.76},
 suv:{base:29,harmonic:1.75,roughness:.61,whine:.06},
 classic:{base:34,harmonic:2.2,roughness:.73,whine:.05},
 hyper:{base:75,harmonic:3.4,roughness:.66,whine:.2}
});
/** Renderer-independent audio targets, inputs match actual driving simulation. */
export function audioFrame({
 vehicleId=STARTER_ID,velocity=0,accelerating=false,onFoot=false,
 moving=false,sprinting=false,weather='clear',paused=false,
 inside=false,active=true
}={}){
 const vehicle=fleetVehicle(vehicleId)||fleetVehicle(STARTER_ID);
 const model=bodyProfile[vehicle.body]||bodyProfile.starter;
 const speed=Number.isFinite(velocity)?Math.min(107,Math.abs(velocity)):0;
 const intensity=unit(speed/Math.max(25,vehicle.top/3.6));
 const inVehicle=active&&!paused&&!onFoot&&!inside;
 const outdoors=active&&!paused&&!inside;
 const electric=vehicle.body==='electric';
 const engineHz=electric?0:model.base*(1+intensity*.92+(accelerating?.3:0));
 const roughness=electric?0:Math.min(.24,.064+intensity*.10+(accelerating?.06:0));
 const engineGain=inVehicle&&!electric?(0.07+intensity*.13+(accelerating?.045:0)):0;
 const electricalHz=electric?180+intensity*490:210+intensity*190;
 const electricalGain=inVehicle?(electric?.045+intensity*.12:
  model.whine*.02+intensity*.024):0;
 const roadGain=inVehicle?Math.min(.1,intensity*.072+speed*.0002):0;
 const ambientRain=outdoors&&weather==='rain'?.085:0;
 const ambientWind=outdoors?(onFoot?.015:.012+intensity*.042):0;
 return {
  engineHz:Number.isFinite(engineHz)?engineHz:0,
  engineGain:unit(engineGain),
  roughness:unit(roughness),
  harmonic:model.harmonic,
  electricalHz,
  electricalGain:unit(electricalGain),
  roadGain:unit(roadGain),
  rainGain:unit(ambientRain),
  windGain:unit(ambientWind),
  footstepInterval:outdoors&&onFoot&&moving?(sprinting?.28:.45):0,
  quiet:!active||paused,
  inVehicle
 };
}
export function channelVolumes(raw){
 const p=restoreAudioPreferences(raw);
 if(p.muted)return {master:0,engine:0,ambience:0,effects:0};
 return {master:p.master,engine:p.engine,ambience:p.ambience,effects:p.effects};
}

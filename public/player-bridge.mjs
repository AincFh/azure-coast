/**
 * Same-origin read-only bridge between the AZURE COAST website and 3D game.
 * Data stays in the browser; this is not a cloud account or a shared backend.
 */
import {restoreGarage} from './garage.mjs';
import {restoreHousing,RESIDENCES} from './housing.mjs';
import {restoreActivities} from './activities.mjs';
import {restoreFleet,fleetVehicle,STARTER_ID} from './fleet.mjs';
export const GAME_PROFILE_KEY='azure-coast-driving-v2';
export const GAME_ACTIVITY_KEY='azure-coast-city-services-v1';
const safeBalance=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,1e9):0;
export function summarizeGameProfile(raw,rawActivities){
 const garage=restoreGarage(raw?.garage),housing=restoreHousing(raw?.housing),fleet=restoreFleet(raw?.fleet);
 const careers=restoreActivities(rawActivities);
 const completed=Object.values(careers.completed).reduce((sum,n)=>sum+n,0);
 const owned=housing.owned.map(id=>RESIDENCES.find(p=>p.id===id)).filter(Boolean);
 const furnished=owned.reduce((sum,home)=>sum+(housing.rooms[home.id]?.length||0),0);
 return {
  balance:safeBalance(raw?.credits),ownedIds:owned.map(p=>p.id),
  propertyCount:owned.length,propertyNames:owned.map(p=>p.name),furnitureCount:furnished,
  propertyInvestment:housing.spent,
  vehicleCount:fleet.owned.length,vehicleOwnedIds:fleet.owned.filter(id=>id!==STARTER_ID),
  vehicleNames:fleet.owned.map(id=>fleetVehicle(id)?.name).filter(Boolean),
  currentVehicle:fleetVehicle(fleet.active)?.name||'COAST / GT',vehicleInvestment:fleet.spent,
  completedJobs:completed,careerIncome:careers.earned,
  engine:garage.engine,handling:garage.handling,armor:garage.armor,
  hasPlayed:!!(raw&&typeof raw==='object'&&(Number.isFinite(raw.credits)||
    housing.owned.length>0||garage.purchases>0||completed>0))
 };
}
export function readGameProfile(store){
 let driving=null,activities=null;
 try{driving=JSON.parse(store?.getItem(GAME_PROFILE_KEY)||'null')}catch{}
 try{activities=JSON.parse(store?.getItem(GAME_ACTIVITY_KEY)||'null')}catch{}
 return summarizeGameProfile(driving,activities);
}

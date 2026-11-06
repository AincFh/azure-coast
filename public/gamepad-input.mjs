/** AZURE COAST — read-only, standards-mapped Gamepad API adapter.
 * No browser dependencies: identical input is testable without a controller.
 * Stick uses a dead zone; trigger pressure stays analog for vehicle handling.
 */
const clamp=(value)=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
export function deadZone(value,threshold=.16){
 const raw=clamp(value),limit=Number.isFinite(threshold)?Math.max(0,Math.min(.95,threshold)):.16;
 return Math.abs(raw)<=limit?0:Math.sign(raw)*(Math.abs(raw)-limit)/(1-limit);
}
const pressure=(button)=>{
 if(typeof button==='number')return Math.max(0,clamp(button));
 if(!button)return 0;
 return Math.max(0,clamp(Number(button.value??Number(button.pressed))));
};
export const GAMEPAD_ACTIONS=Object.freeze(['enter','camera','interact','pause']);
export function readGamepad(pad){
 const idle={connected:false,forward:0,reverse:0,left:0,right:0,
  walkForward:0,walkBackward:0,sprint:false,enter:false,interact:false,camera:false,pause:false};
 if(!pad||pad.connected===false||pad.mapping!=='standard')return idle;
 const buttons=pad.buttons||[],axes=pad.axes||[];
 const steer=deadZone(axes[0]??0),walk=deadZone(axes[1]??0);
 const acceleration=pressure(buttons[7]),brake=pressure(buttons[6]);
 return {
  connected:true,forward:acceleration,reverse:brake,
  left:Math.max(0,-steer),right:Math.max(0,steer),
  walkForward:Math.max(0,-walk),walkBackward:Math.max(0,walk),
  sprint:pressure(buttons[4])>.5||pressure(buttons[10])>.5,
  enter:pressure(buttons[0])>.5,camera:pressure(buttons[1])>.5,
  interact:pressure(buttons[2])>.5,pause:pressure(buttons[9])>.5
 };
}
/** Edge triggered actions prevent repeated enter/exit or pause at 60fps. */
export function gamepadEdges(previous={},current={}){
 const held={};const pressed={};
 for(const action of GAMEPAD_ACTIONS){
  held[action]=current[action]===true;
  pressed[action]=held[action]&&previous[action]!==true;
 }
 return{held,pressed};
}

/** Responsive third-person camera presets in world-space metres. */
export function cameraLayout({width=1440,height=900,view=0,onFoot=false}={}){
 const w=Number.isFinite(width)&&width>0?width:1440;
 const h=Number.isFinite(height)&&height>0?height:900;
 const portrait=w/h<.83;
 if(onFoot)return {
  offset:portrait?[0,7.2,15.5]:[0,5,10],
  lookAhead:portrait?10:15,lookHeight:2
 };
 if(view===1)return {offset:[0,3.5,2],lookAhead:20,lookHeight:2.1};
 if(view===2)return {
  offset:portrait?[0,30,42]:[0,22,31],
  lookAhead:portrait?22:15,lookHeight:2
 };
 return {
  offset:portrait?[0,11.8,29]:[0,8,18],
  lookAhead:portrait?19:15,lookHeight:2.2
 };
}
/** A fresh scene should start at the correct camera pose, not fly out of the car. */
export function cameraInterpolationFactor(dt,initialized){
 if(!initialized)return 1;
 const delta=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
 return Math.min(1,delta*4);
}

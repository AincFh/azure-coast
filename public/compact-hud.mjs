/**
 * Mobile-only mission/navigation disclosure.
 * Main-world simulation continues uninterrupted; no duplicate HUD state.
 */
export function setupCompactMissionHUD(doc=document,win=doc.defaultView){
 const trigger=doc.getElementById('hudDetailsBtn');
 if(!trigger)return null;
 const body=doc.body;
 const narrow=()=>!!win?.matchMedia?.('(max-width: 850px)').matches;
 const isOpen=()=>body.classList.contains('hud-details-open');
 const setOpen=value=>{
  const open=!!value&&narrow();
  body.classList.toggle('hud-details-open',open);
  trigger.setAttribute('aria-expanded',String(open));
  trigger.textContent=open?'收起详情':'任务详情';
  return open;
 };
 trigger.addEventListener('click',()=>setOpen(!isOpen()));
 doc.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&isOpen()){
   event.preventDefault?.();
   event.stopImmediatePropagation?.();
   setOpen(false);
   trigger.focus?.();
  }
 },true);
 for(const id of ['mapBtn','navMapBtn','activityOpen','garageOpen','begin']){
  doc.getElementById(id)?.addEventListener('click',()=>setOpen(false));
 }
 win?.addEventListener?.('resize',()=>{if(!narrow())setOpen(false)});
 setOpen(false);
 return {setOpen,isOpen};
}

// This module is loaded directly by play.html; initialize once on page boot.
if(typeof document!=='undefined')setupCompactMissionHUD(document);

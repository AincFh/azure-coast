/**
 * Mobile action center: make all city systems operable without six tiny buttons.
 * The drawer proxies the already tested service/garage/housing/dealer controls.
 * No duplicate purchase or navigation implementation.
 */
export function setupMobileActionCenter(doc=document,win=doc.defaultView){
 const $=id=>doc.getElementById(id),drawer=$('actionDrawer'),button=$('actionMenuBtn');
 if(!drawer||!button)return null;
 const narrow=()=>!!win?.matchMedia?.('(max-width: 850px)').matches;
 let opened=false,prior=null;
 const setOpen=(next)=>{
  opened=!!next&&narrow();
  drawer.hidden=!opened;doc.body.classList.toggle('mobile-actions-open',opened);
  button.setAttribute('aria-expanded',String(opened));
  if(opened){prior=doc.activeElement;$('actionClose')?.focus?.()}
  else if(prior){prior.focus?.();prior=null}
  return opened;
 };
 button.addEventListener('click',()=>setOpen(!opened));
 $('actionClose')?.addEventListener('click',()=>setOpen(false));
 drawer.addEventListener('click',event=>{
  const proxy=event.target.closest?.('[data-action-proxy]');
  if(proxy){
   const id=proxy.dataset.actionProxy;
   const allowed=['activityOpen','garageOpen','housingOpen','fleetOpen'];
   if(!allowed.includes(id))return;
   setOpen(false);
   $(id)?.click?.();
   return;
  }
  if(event.target===drawer)setOpen(false);
 });
 doc.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&opened){
   event.preventDefault?.();
   event.stopImmediatePropagation?.();
   setOpen(false);
  }
 },true);
 for(const id of ['begin','pauseBtn','mapBtn','enterBtn','cameraBtn']){
  $(id)?.addEventListener('click',()=>{if(opened)setOpen(false)});
 }
 win?.addEventListener?.('resize',()=>{if(opened&&!narrow())setOpen(false)});
 return {open:()=>setOpen(true),close:()=>setOpen(false),isOpen:()=>opened};
}
if(typeof document!=='undefined')setupMobileActionCenter(document);

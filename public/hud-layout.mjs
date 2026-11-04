/** Independent, accessible HUD panel toggles; does not require the 3D engine. */
export function setupHudPanels(doc=document){
  const panels=[['environment-controls','环境'],['economy','账户']];
  for(const [cls,label] of panels){
    const panel=doc.querySelector('.'+cls);
    if(!panel)continue;
    const id=cls+'-content';
    const body=doc.createElement('div');body.id=id;body.className='hud-panel-body';
    while(panel.firstChild)body.appendChild(panel.firstChild);
    const toggle=doc.createElement('button');toggle.type='button';toggle.className='hud-panel-toggle';toggle.textContent=label+' ▾';toggle.setAttribute('aria-controls',id);
    const small=()=>doc.defaultView?.matchMedia?.('(max-width: 850px)')?.matches ?? false;
    const setOpen=(open)=>{panel.classList.toggle('panel-open',open);toggle.setAttribute('aria-expanded',String(open));body.hidden=!open;toggle.textContent=label+(open?' ▴':' ▾')};
    panel.append(toggle,body);setOpen(!small());
    toggle.addEventListener('click',()=>setOpen(body.hidden));
    doc.defaultView?.addEventListener?.('resize',()=>{if(!small())setOpen(true)});
  }
}

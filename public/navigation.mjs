const menu=document.getElementById('mobileMenu');
const nav=document.getElementById('nav');
function sync(){if(menu&&nav)menu.setAttribute('aria-expanded',String(nav.classList.contains('open')))}
menu?.addEventListener('click',()=>queueMicrotask(sync));
nav?.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');sync()}});
window.addEventListener('hashchange',()=>{nav?.classList.remove('open');sync()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');sync();menu?.focus()}});
window.matchMedia('(min-width: 1301px)').addEventListener('change',e=>{if(e.matches){nav?.classList.remove('open');sync()}});

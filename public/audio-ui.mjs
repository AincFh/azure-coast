import {restoreAudioPreferences} from './audio-state.mjs';
const controls=Object.freeze([
 ['master','总音量'],['engine','发动机与轮胎'],['ambience','雨声与环境'],['effects','脚步与事件']
]);
/** Accessible audio preferences bound to real game audio state and driving save. */
export function setupAudioPanel({
 doc=document,getPreferences,onChange,audio,clearControls=()=>{}
}){
 const $=id=>doc.getElementById(id),panel=$('audioPanel');
 if(!panel)return null;
 let opened=false,previousFocus=null;
 const read=()=>restoreAudioPreferences(getPreferences());
 const sync=()=>{
  const p=read();
  for(const [id] of controls){
   const input=$('audio-'+id),label=$('audioValue-'+id);
   input.value=String(Math.round(p[id]*100));
   label.textContent=Math.round(p[id]*100)+'%';
  }
  $('audioMute').checked=p.muted;
  $('audioStatus').textContent=p.muted?'已静音':'启用声音（开始游戏后生效）';
  $('audioOpen').textContent=p.muted?'音效已静音':'音效设置';
  $('audioOpen').setAttribute('aria-label',p.muted?'音效已静音，打开设置':'音效设置');
 };
 const show=next=>{
  opened=!!next;panel.hidden=!opened;clearControls();
  if(opened){previousFocus=doc.activeElement;sync();$('audioClose').focus()}
  else previousFocus?.focus?.();
  return opened;
 };
 const update=(key,value)=>{
  const next={...read(),[key]:value};
  const normalized=restoreAudioPreferences(next);
  audio.setPreferences(normalized);
  onChange(normalized);
  sync();
 };
 for(const [id] of controls){
  $( 'audio-'+id).addEventListener('input',event=>{
   const value=Math.max(0,Math.min(100,Number(event.target.value)||0));
   update(id,value/100);
  });
 }
 $('audioMute').addEventListener('change',event=>update('muted',event.target.checked));
 $('audioTest').addEventListener('click',()=>{
  const ready=audio.start();
  if(ready){audio.cue('purchase',.65);$('audioStatus').textContent='播放测试音效中'}
  else $('audioStatus').textContent='浏览器未提供可用的 Web Audio 音频输出';
 });
 $('audioOpen').addEventListener('click',()=>show(!opened));
 $('audioClose').addEventListener('click',()=>show(false));
 panel.addEventListener('click',event=>{if(event.target===panel)show(false)});
 doc.addEventListener('keydown',event=>{
  if(opened&&event.key==='Escape'){
   event.preventDefault?.();
   event.stopImmediatePropagation?.();
   show(false);
  }
 },true);
 sync();
 return {open:()=>show(true),close:()=>show(false),isOpen:()=>opened,sync};
}

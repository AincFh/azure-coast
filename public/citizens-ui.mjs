import {
 CONVERSATION_TOPICS,restoreSocial,socialRank,talkToCitizen,
 nearestCitizen,TALK_RADIUS
} from './citizens-core.mjs';

/**
 * Real conversation UI: dialogue requires an on-foot character standing next
 * to an actual animated resident in the current 3D world. Relationships are
 * stored alongside the game's other progression, without an invented wallet.
 */
export function setupCitizenUI({
 doc=document,world,getPlayer,getState,onCommit,
 clearControls=()=>{},notify=()=>{},canPlay=()=>true,getEnvironment=()=>({hour:16,weather:'clear'})
}={}){
 const $=id=>doc.getElementById(id),panel=$('citizenPanel'),
  hint=$('citizenPrompt'),topics=$('citizenTopics');
 if(!panel||!world)return null;
 let opened=false,selectedId=null,previousFocus=null,lastUpdate=-Infinity;
 const locate=(radius=TALK_RADIUS)=>nearestCitizen(world.people(),getPlayer().position,radius);
 const known=()=>restoreSocial(getState());
 const text=id=>( $(id)?.textContent || '');
 function renderCitizen(person){
  const social=known(),trust=social.relationships[person.id]||0;
  $('citizenName').textContent=person.name;
  $('citizenOccupation').textContent=person.profession+' · '+person.district;
  $('citizenTrait').textContent=person.trait+' · 关系 '+trust+'/3';
  $('citizenMet').textContent=social.met.length+' 位';
  $('citizenRank').textContent=socialRank(social);
  $('citizenConversations').textContent=social.conversations+' 次';
  topics.innerHTML=CONVERSATION_TOPICS.map(topic=>
   '<button type="button" data-citizen-topic="'+topic.id+'">'+topic.label+'</button>').join('');
  $('citizenReply').textContent='请选择一个话题，与'+person.name+'交流。';
 }
 function show(next){
  if(!next){
   opened=false;panel.hidden=true;selectedId=null;
   clearControls();previousFocus?.focus?.();previousFocus=null;
   return false;
  }
  if(!canPlay())return false;
  const player=getPlayer();
  if(player.mode!=='foot'){
   notify('请先下车，再步行与街头居民交流');
   return false;
  }
  const nearby=locate();
  if(!nearby){
   const distant=locate(250);
   notify(distant?'附近的'+distant.resident.name+'距离 '+Math.round(distant.distance)+' 米 · 请走近一些':
    '当前街区没有可交谈的居民 · 可以前往市民广场');
   return false;
  }
  selectedId=nearby.resident.id;opened=true;
  panel.hidden=false;previousFocus=doc.activeElement;
  clearControls();renderCitizen(nearby.resident);
  $('citizenClose').focus();return true;
 }
 function reply(topic){
  if(!opened||!selectedId&&selectedId!==0)return false;
  const npc=world.people().find(c=>c.id===selectedId);
  if(!npc)return false;
  const player=getPlayer(),weather=getEnvironment();
  const result=talkToCitizen(known(),npc,topic,{
   position:player.position,mode:player.mode,hour:weather.hour,weather:weather.weather
  });
  if(result.reason){
   $('citizenReply').textContent='无法继续交流，请靠近居民后再试。';return false;
  }
  onCommit(result.state);
  $('citizenReply').textContent=result.reply;
  const social=result.state;
  $('citizenTrait').textContent=npc.trait+' · 关系 '+result.trust+'/3';
  $('citizenMet').textContent=social.met.length+' 位';
  $('citizenRank').textContent=socialRank(social);
  $('citizenConversations').textContent=social.conversations+' 次';
  if(result.newPerson)notify('认识了一位新邻居 · '+npc.name+' · 已结识 '+result.connections+' 人');
  return true;
 }
 $('citizenOpen')?.addEventListener('click',()=>show(!opened));
 $('citizenClose')?.addEventListener('click',()=>show(false));
 topics.addEventListener('click',event=>{
  const btn=event.target.closest('[data-citizen-topic]');
  if(btn)reply(btn.dataset.citizenTopic);
 });
 panel.addEventListener('click',event=>{if(event.target===panel)show(false)});
 doc.addEventListener('keydown',event=>{
  if(opened&&event.key==='Escape'){
   event.preventDefault?.();event.stopImmediatePropagation?.();show(false);
  }
 },true);
 function update(now){
  if(!Number.isFinite(now)||now-lastUpdate<480)return;
  lastUpdate=now;
  const p=getPlayer(),near=p.mode==='foot'?locate(16):null;
  hint.hidden=opened||!near;
  if(near&&!opened){
   hint.textContent='按 Q 与 '+near.resident.name+' 交谈 · '+near.resident.profession;
  }
  const stats=world.metrics(p.position),social=known();
  $('citizenStatus').textContent='市民 '+stats.active+'/'+stats.total+
   ' · 附近 '+stats.nearby+' · 已结识 '+social.met.length;
 }
 update(0);
 return {open:()=>show(true),close:()=>show(false),isOpen:()=>opened,
  interact:()=>show(true),update,reply};
}

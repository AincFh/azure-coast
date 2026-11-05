import {
 createSaveArchive,validateSaveArchive,applySaveArchive,
 SAVE_ARCHIVE_LIMIT,describeArchiveError
} from './save-archive.mjs';
export const RECOVERY_KEY='azure-coast-before-restore-v1';

/** Game UI for offline export, validated import and one-step undo. */
export function setupSaveManager({
 doc=document,win=doc.defaultView,storage=win?.localStorage,
 crypto=win?.crypto,reload=()=>win.location.reload()
}={}){
 const $=id=>doc.getElementById(id),panel=$('saveManagerPanel');
 if(!panel||!storage)return null;
 let opened=false,pending=null,priorFocus=null;
 const status=(text,kind='info')=>{
  $('saveStatus').textContent=text;
  $('saveStatus').dataset.kind=kind;
 };
 const summary=data=>{
  const s=data.summary;
  $('savePreviewDate').textContent=new Date(data.createdAt).toLocaleString('zh-CN');
  $('savePreviewWallet').textContent='$'+s.balance.toLocaleString('zh-CN');
  $('savePreviewHomes').textContent=s.propertyCount+' 处 / '+s.furnitureCount+' 件家具';
  $('savePreviewCars').textContent=s.vehicleCount+' 辆 / '+s.currentVehicle;
  $('savePreviewJobs').textContent=s.completedJobs+' 次委托';
  $('savePreview').hidden=false;
 };
 const setReady=()=>{
  $('saveImportApply').disabled=!pending||!$('saveOverwriteConfirm').checked;
  $('saveImportApply').textContent=pending?.source==='recovery'?'恢复上次导入前的存档':'确认覆盖并导入';
 };
 const clearSelection=()=>{
  pending=null;
  $('saveOverwriteConfirm').checked=false;
  $('savePreview').hidden=true;
  $('saveImportFile').value='';
  $('saveSourceLabel').textContent='未选择存档文件';
  setReady();
 };
 const refreshRecovery=()=>{
  try{$('saveUndoImport').disabled=!storage.getItem(RECOVERY_KEY)}
  catch{$('saveUndoImport').disabled=true}
 };
 const show=next=>{
  opened=!!next;
  panel.hidden=!opened;
  if(opened){
   priorFocus=doc.activeElement;
   clearSelection();status('所有存档仅在当前设备处理，不会上传网络。');
   refreshRecovery();$('saveManagerClose').focus();
  }else{
   clearSelection();priorFocus?.focus?.();
  }
  return opened;
 };
 async function readFile(file){
  if(!file)return;
  clearSelection();
  $('saveSourceLabel').textContent=file.name;
  if(file.size>SAVE_ARCHIVE_LIMIT){
   status('文件过大。最大支持 512 KB。','error');return;
  }
  status('正在校验 SHA-256 与全部存档记录…');
  try{
   const validated=await validateSaveArchive(await file.text(),{crypto});
   pending={validated,source:'file'};
   summary(validated);status('校验通过。请核对内容后勾选覆盖确认。','success');
   setReady();
  }catch(error){
   status(describeArchiveError(error),'error');clearPendingKeepStatus();
  }
 }
 function clearPendingKeepStatus(){
  pending=null;$('savePreview').hidden=true;
  $('saveOverwriteConfirm').checked=false;setReady();
 }
 function download(text,name){
  const blob=new Blob([text],{type:'application/json'});
  const url=win.URL.createObjectURL(blob);
  const anchor=doc.createElement('a');
  anchor.href=url;anchor.download=name;
  doc.body.appendChild(anchor);anchor.click();anchor.remove();
  win.setTimeout(()=>win.URL.revokeObjectURL(url),1500);
 }
 async function exportCurrent(){
  try{
   $('saveExport').disabled=true;
   status('正在生成完整离线存档及 SHA-256 校验…');
   const result=await createSaveArchive(storage,{crypto});
   const stamp=result.createdAt.replace(/[:.]/g,'-');
   download(JSON.stringify(result,null,2),'azure-coast-full-save-'+stamp+'.json');
   status('全部 7 类记录已导出。请妥善保存 JSON 文件。','success');
  }catch(error){status(describeArchiveError(error),'error')}
  finally{$('saveExport').disabled=false}
 }
 async function previewRecovery(){
  try{
   const data=storage.getItem(RECOVERY_KEY);
   if(!data){status('未找到导入前备份。','error');return}
   const validated=await validateSaveArchive(data,{crypto});
   pending={validated,source:'recovery'};
   $('saveOverwriteConfirm').checked=false;
   $('saveSourceLabel').textContent='导入前自动备份';
   summary(validated);setReady();
   status('已验证导入前备份。确认后可以恢复，并保留当前状态为新的恢复点。','success');
  }catch(error){status(describeArchiveError(error),'error');clearPendingKeepStatus()}
 }
 async function apply(){
  if(!pending||!$('saveOverwriteConfirm').checked)return;
  $('saveImportApply').disabled=true;
  const selected=pending;
  status('正在保存恢复点并原子替换游戏数据…');
  try{
   // Also protect the existing game from the destructive import itself.
   const previous=await createSaveArchive(storage,{crypto});
   const originalRecovery=storage.getItem(RECOVERY_KEY);
   storage.setItem(RECOVERY_KEY,JSON.stringify(previous));
   try{
    // Suppress the exiting 3D page's session autosave so the imported
    // session survives the forced reload.
    win.__AZURE_SNAPSHOT_RESTORING=true;
    applySaveArchive(storage,selected.validated);
   }catch(error){
    win.__AZURE_SNAPSHOT_RESTORING=false;
    try{
     if(originalRecovery===null)storage.removeItem(RECOVERY_KEY);
     else storage.setItem(RECOVERY_KEY,originalRecovery);
    }catch{}
    throw error;
   }
   status('恢复成功。正在重新加载游戏场景与账户。','success');
   reload();
  }catch(error){
   win.__AZURE_SNAPSHOT_RESTORING=false;
   status(describeArchiveError(error),'error');
   setReady();refreshRecovery();
  }
 }
 $('saveManagerOpen')?.addEventListener('click',()=>show(true));
 $('saveManagerStart')?.addEventListener('click',()=>show(true));
 $('saveManagerClose')?.addEventListener('click',()=>show(false));
 panel.addEventListener('click',event=>{if(event.target===panel)show(false)});
 $('saveExport')?.addEventListener('click',exportCurrent);
 $('saveImportFile')?.addEventListener('change',event=>readFile(event.target.files?.[0]));
 $('saveOverwriteConfirm')?.addEventListener('change',setReady);
 $('saveImportApply')?.addEventListener('click',apply);
 $('saveUndoImport')?.addEventListener('click',previewRecovery);
 doc.addEventListener('keydown',event=>{
  if(opened&&event.key==='Escape'){
   event.preventDefault?.();event.stopImmediatePropagation?.();
   show(false);
  }
 },true);
 refreshRecovery();setReady();
 if(win.location?.hash==='#saves')show(true);
 return {open:()=>show(true),close:()=>show(false),
  isOpen:()=>opened,previewRecovery,exportCurrent,apply};
}
if(typeof document!=='undefined')setupSaveManager();

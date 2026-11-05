/** Lightweight original tiled surface textures generated in-browser. */
export function surfaceNoise(x,y,seed=1){
 let n=Math.imul((x|0)*31+(y|0)*131+seed*17,1597334677);
 n=Math.imul(n^(n>>>15),2246822519);
 return ((n^(n>>>13))>>>0)/4294967296;
}
export function applySurfaceTextures(THREE,{asphalt,concrete,sidewalk,buildingMats}){
 const size=512;
 function texture(kind){
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle='#ecece9';ctx.fillRect(0,0,size,size);
  const grain=kind==='asphalt'?26000:kind==='ground'?9000:kind==='paving'?5600:4400;
  // Seeded grain prevents the former uniform, flat shaded cube appearance.
  for(let i=0;i<grain;i++){
   const x=surfaceNoise(i,kind.length,71)*size,y=surfaceNoise(i,kind.length,93)*size;
   const a=surfaceNoise(i,kind.length,21);
   ctx.fillStyle=a>.46?'rgba(255,255,255,.18)':'rgba(32,48,55,.14)';
   ctx.fillRect(x,y,kind==='asphalt'?1.6:2,kind==='asphalt'?1.3:1);
  }
  if(kind==='asphalt'){
   ctx.lineWidth=1;
   for(let i=0;i<23;i++){
    const x=surfaceNoise(i,51,9)*size,y=surfaceNoise(i,52,12)*size;
    ctx.strokeStyle='rgba(33,41,48,.13)';ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+9+surfaceNoise(i,30)*30,y+3);
    ctx.lineTo(x+16+surfaceNoise(i,35)*40,y+12);
    ctx.stroke();
   }
  }
  if(kind==='facade'){
   for(let y=0;y<size;y+=64){
    ctx.fillStyle='rgba(27,51,58,.11)';ctx.fillRect(0,y,size,2);
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(0,y+3,size,3);
   }
   for(let x=0;x<size;x+=125){
    ctx.fillStyle='rgba(33,56,65,.05)';ctx.fillRect(x,0,3,size);
   }
  }
  if(kind==='paving'){
   for(let n=0;n<=size;n+=64){
    ctx.fillStyle='rgba(51,62,68,.13)';ctx.fillRect(n,0,2,size);
    ctx.fillRect(0,n,size,2);
   }
  }
  const result=new THREE.CanvasTexture(canvas);
  result.wrapS=THREE.RepeatWrapping;result.wrapT=THREE.RepeatWrapping;
  result.colorSpace=THREE.SRGBColorSpace;result.anisotropy=4;
  const repeat=kind==='asphalt'?[2,40]:kind==='ground'?[12,12]:kind==='paving'?[2,22]:[2,12];
  result.repeat.set(...repeat);
  return result;
 }
 const asphaltTex=texture('asphalt'),groundTex=texture('ground');
 const pavementTex=texture('paving'),facadeTex=texture('facade');
 for(const [material,map] of [[asphalt,asphaltTex],[concrete,groundTex],[sidewalk,pavementTex]]){
  material.map=map;material.needsUpdate=true;
 }
 for(const material of buildingMats){material.map=facadeTex;material.needsUpdate=true}
 return {asphaltTex,groundTex,pavementTex,facadeTex};
}

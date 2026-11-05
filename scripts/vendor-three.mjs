/* AZURE COAST — deterministic self-hosted browser graphics runtime.
 * All production Three.js browser modules are copied from the exact pinned
 * npm package. No external CDN is needed during actual gameplay.
 */
import {mkdir,copyFile,readFile,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const version=pkg.dependencies?.three;
if(version!=='0.170.0')throw Error('Expected audited Three.js 0.170.0 pin, got '+version);
const src=join(root,'node_modules','three');
const dst=join(root,'public','vendor','three');
await mkdir(dst,{recursive:true});
const needed=['build/three.module.js','build/three.core.js','LICENSE'];
for(const name of needed){
 const original=join(src,name);
 const size=(await stat(original)).size;
 if(size<100)throw Error('Invalid Three.js runtime '+name);
 await copyFile(original,join(dst,name.split('/').at(-1)));
}
const module=(await readFile(join(dst,'three.module.js'),'utf8'));
if(!module.includes('three.core.js'))throw Error('Missing local Three.js core import');
const entry=(await readFile(join(root,'public','game.mjs'),'utf8'));
if(!entry.includes("'./vendor/three/three.module.js'"))throw Error('Game does not use self-hosted Three.js');
if(entry.includes('esm.sh/three'))throw Error('External Three.js still referenced');
console.log('Azure Coast: self-hosted Three.js '+version+' verified (module/core/MIT license)');

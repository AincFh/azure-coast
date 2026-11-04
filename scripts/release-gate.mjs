import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const file=p=>new URL(p,root);
const checks=[
 ['官网入口','public/index.html',true],
 ['游戏入口','public/play.html',true],
 ['基础驾驶逻辑','public/game.mjs',true],
 ['任务和存档','public/simulation.mjs',true],
 ['碰撞处理','public/physics.mjs',true],
 ['环境系统','public/environment.mjs',true],
 ['可验证的本地角色模型与动画资产','public/assets/characters/manifest.json',true],
 ['可验证的本地车辆模型资产','public/assets/vehicles/manifest.json',true],
 ['可验证的本地建筑与街区资产','public/assets/city/manifest.json',true],
 ['资产许可证及来源清单','ASSET_LICENSES.md',true],
 ['浏览器端到端验收结果','qa/browser-e2e.json',true],
 ['375/768/1024/1440 响应式截图验收','qa/responsive-evidence.json',true],
 ['目标设备性能验收','qa/performance.json',true]
];
const results=checks.map(([name,path])=>({name,path,pass:existsSync(file(path))}));
for(const r of results.filter(r=>r.pass&&r.path.startsWith('qa/'))){try{const value=JSON.parse(readFileSync(file(r.path),'utf8'));r.pass=value.status==='PASS'&&value.verified===true}catch{r.pass=false}}
console.log(JSON.stringify({release:results.every(r=>r.pass)?'READY_FOR_REVIEW':'BLOCKED',checks:results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;

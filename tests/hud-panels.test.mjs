import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);const read=n=>readFileSync(new URL(n,root),'utf8');
test('game loads accessible HUD panel controller and stylesheet',()=>{assert.match(read('play.html'),/hud-panels\.css/);assert.match(read('play.html'),/hud-bootstrap\.mjs/);assert.match(read('hud-layout.mjs'),/aria-expanded/);assert.match(read('hud-layout.mjs'),/aria-controls/)});
test('HUD panel stylesheet has narrow screen and short landscape rules',()=>{assert.match(read('hud-panels.css'),/max-width:850px/);assert.match(read('hud-panels.css'),/max-height:540px/);assert.match(read('hud-panels.css'),/\[hidden\]/)});
test('vehicle exit does not enter walking state before safe exit found',()=>{const src=read('game.mjs');assert.ok(src.indexOf('if(!safe)return;onFoot=true')>=0)});

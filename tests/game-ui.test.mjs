import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');const css=readFileSync(new URL('../public/game-ui.css',import.meta.url),'utf8');const js=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
test('game HUD uses separate CSS layer',()=>assert.match(html,/href="\/game-ui.css"/));
test('HUD supports mobile and short landscape',()=>{assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/@media\(max-height:540px\)/);assert.match(css,/max-width:calc\(100vw - 24px\)/)});
test('accessible keyboard focus and reduced motion',()=>{assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion:reduce/)});
test('on-foot camera and minimap track player',()=>{assert.match(js,/const facing=onFoot\?avatar.rotation.y:heading/);assert.match(js,/onFoot\?avatar.position.x:car.position.x/)});

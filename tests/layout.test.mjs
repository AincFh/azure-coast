import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../public/',import.meta.url);
const read=(p)=>readFileSync(new URL(p,base),'utf8');
test('website loads last-layer responsive corrections',()=>{assert.match(read('index.html'),/href="\/layout-fixes\.css"/);assert.match(read('layout-fixes.css'),/@media\(max-width:600px\)/);assert.match(read('layout-fixes.css'),/max-width:1300px/)});
test('interactive console loads independent responsive corrections',()=>{assert.match(read('explore.html'),/href="\/explore-fixes\.css"/);assert.match(read('explore-fixes.css'),/max-width:580px/);assert.match(read('explore-fixes.css'),/minmax\(0,1fr\)/)});
test('responsive corrections include reduced motion and focus',()=>{assert.match(read('layout-fixes.css'),/prefers-reduced-motion/);assert.match(read('explore-fixes.css'),/prefers-reduced-motion/);assert.match(read('styles.css'),/focus-visible/)})

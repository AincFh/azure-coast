import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);
const file=n=>readFileSync(new URL(n,root),'utf8');
test('global design stylesheet loaded after legacy styles',()=>{const h=file('index.html');assert.match(h,/layout-fixes\.css.*design-system\.css/);assert.match(file('design-system.css'),/max-width:1300px/)});
test('responsive layout and keyboard accessibility guards exist',()=>{const css=file('design-system.css');assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/minmax\(0,1fr\)/);assert.match(file('navigation.mjs'),/aria-expanded/);assert.match(file('navigation.mjs'),/Escape/)});

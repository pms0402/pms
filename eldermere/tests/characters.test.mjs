import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,portraitPosition,readingDuration} from '../src/characters.js';
test('all named inhabitants have individual portraits, personalities, speech and relationships',()=>{const roles=['elder','mira','smith','farmer','miner','fisher'];assert.equal(new Set(Object.values(CHARACTERS).map(p=>p.portrait)).size,8);assert.equal(new Set(roles.map(id=>CHARACTERS[id].traits.join())).size,6);for(const id of roles){const p=CHARACTERS[id];assert.ok(p.name&&p.title&&p.about.length>=2&&p.tip);assert.ok(p.about.some(t=>['브람','미라','엘린','도란','세라','로완'].some(n=>n!==p.name&&t.includes(n))));assert.match(portraitPosition(id),/^[\d.]+% (0|100)%$/);}});
test('important notices allocate readable time based on Korean text length',()=>{assert.equal(readingDuration('알림'),6500);assert.ok(readingDuration('가'.repeat(100))>=13000);assert.equal(readingDuration('가'.repeat(300)),24000);});

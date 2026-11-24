import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePacked} from '../tools/validate-packed.mjs';
test('all prepared cells, padding, input digests and content-addressed lossless files are valid',async()=>{const m=await validatePacked();assert.equal(Object.keys(m.cells).length,2753);const download=[...m.pages,...Object.values(m.backdrops)].reduce((n,p)=>n+p.bytes,0);assert.ok(download<45*1024**2,'initial artwork transfer budget');assert.ok(m.pages.reduce((n,p)=>n+p.w*p.h*4,0)<=96*1024**2,'decoded sprite budget');});

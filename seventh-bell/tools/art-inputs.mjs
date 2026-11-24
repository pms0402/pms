import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {SHEETS} from '../src/art.js';
export const BACKDROPS=['kingdom','ruins','cathedral','foundry','archive','palace','harbor','belltower','story-scenes','finale-scenes'];
export async function artInputs(){const inputs={},hash=createHash('sha256');for(const name of [...new Set([...Object.keys(SHEETS),...BACKDROPS])].sort()){const bytes=await readFile(new URL('../assets/'+name+'.png',import.meta.url));inputs[name]={bytes:bytes.length,hash:createHash('sha256').update(bytes).digest('hex')};hash.update(name+':'+inputs[name].hash+'\n');}for(const name of ['art.js','atlas-layout.js','hero-palette.js'])hash.update(await readFile(new URL('../src/'+name,import.meta.url)));hash.update(JSON.stringify(SHEETS));return{digest:hash.digest('hex'),inputs};}

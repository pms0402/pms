import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('./',import.meta.url);
await rm(new URL('dist/',root),{recursive:true,force:true});
await mkdir(new URL('dist/',root));
for (const path of ['index.html','style.css','src','assets']) await cp(new URL(path,root),new URL('dist/'+path,root),{recursive:true});
console.log('Built standalone static game: eldermere/dist (no runtime dependencies)');

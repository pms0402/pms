import {cp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('.',import.meta.url),out=new URL('dist/',root),pkg=JSON.parse(await readFile(new URL('package.json',root)));
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['index.html','style.css','src','assets'])await cp(new URL(name,root),new URL(name,out),{recursive:true});
const stamp=pkg.version+'-'+(process.env.GITHUB_SHA?.slice(0,8)||'local');
for(const name of await readdir(new URL('src/',out))){if(!name.endsWith('.js'))continue;const file=new URL('src/'+name,out),source=await readFile(file,'utf8');await writeFile(file,source.replace(/(from\s*|import\s*\(\s*)(['"])(\.\.?\/[^'"]+\.js)\2/g,(_,prefix,quote,path)=>prefix+quote+path+'?v='+stamp+quote));}
const htmlFile=new URL('index.html',out);await writeFile(htmlFile,(await readFile(htmlFile,'utf8')).replace('src="./src/main.js"','src="./src/main.js?v='+stamp+'"').replace('href="./style.css"','href="./style.css?v='+stamp+'"'));
await writeFile(new URL('version.json',out),JSON.stringify({game:'Echoes of the Seventh Bell',version:pkg.version,commit:process.env.GITHUB_SHA||null,entrySha256:createHash('sha256').update(await readFile(new URL('src/main.js',out))).digest('hex')}));
console.log('Built independent Seventh Bell site in dist/ · '+stamp);

import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(new URL('.',import.meta.url).pathname),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async(req,res)=>{try{const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}const body=await readFile(p);res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream','Cache-Control':/\/assets\/packed\/[^/]+-[a-f0-9]{16}\.(webp|png)$/.test(p)?'public, max-age=31536000, immutable':'no-cache'}).end(body);}catch{res.writeHead(404).end('Not found');}}).listen(Number(process.env.PORT||4191),'0.0.0.0',()=>console.log('Seventh Bell: http://localhost:'+(process.env.PORT||4191)));

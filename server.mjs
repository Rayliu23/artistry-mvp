import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try {
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch {res.writeHead(404);res.end('Not found');}
});
const host=process.env.HOST||'0.0.0.0';
server.listen(Number(process.env.PORT||4173),host,()=>console.log(`ARTISTRY MVP listening on ${host}:${server.address().port}`));

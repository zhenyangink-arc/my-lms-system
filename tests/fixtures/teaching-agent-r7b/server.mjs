import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {createFixture} from './fixture.server.mjs';
export async function startHarness({fixture=createFixture(),entryPoint='tests/fixtures/teaching-agent-r7b/browser.tsx',port=0}={}){
 const bundle=await build({entryPoints:[entryPoint],bundle:true,write:false,outdir:'/tmp/r7b-browser-output',platform:'browser',format:'esm',jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"development"'}});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text,video=readFileSync(new URL('./video.webm',import.meta.url));
 const server=createServer(async(req,res)=>{try{
  const host=req.headers.host;if(!host?.startsWith('127.0.0.1:')){res.writeHead(403);return res.end();}
  if(req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==`http://${host}`){res.writeHead(403);return res.end();}
   if(!['/restore','/checkpoint','/submit','/readback'].includes(req.url)){res.writeHead(404);return res.end();}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8000)throw Error('BODY_LIMIT');}
   const {request,optionId}=JSON.parse(body);const result=await fixture[req.url.slice(1)](request,optionId);res.setHeader('content-type','application/json');return res.end(JSON.stringify(result));
  }
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
  if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css);}
  if(req.url==='/data'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({manifest:fixture.manifest,context:fixture.context,state:fixture.initialState}));}
  if(req.url==='/media'){
   res.setHeader('content-type','video/webm');res.setHeader('accept-ranges','bytes');
   const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??'');if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),video.length-1):video.length-1;if(start>end){res.writeHead(416);return res.end();}res.writeHead(206,{'content-range':`bytes ${start}-${end}/${video.length}`,'content-length':end-start+1});return res.end(video.subarray(start,end+1));}
   res.setHeader('content-length',video.length);return res.end(video);
  }
  if(req.url!=='/'){res.writeHead(404);return res.end();}
  res.setHeader('content-type','text/html');return res.end('<html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
 }catch{res.writeHead(503);res.end('Fixture response unavailable');}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 return {fixture,js,css,metafile:bundle.metafile,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}

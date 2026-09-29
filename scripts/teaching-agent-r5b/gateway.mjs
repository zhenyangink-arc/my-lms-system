// Test-only localhost gateway to real isolated Auth/PostgREST, never production.
import http from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
const d=process.argv[2],s=JSON.parse(readFileSync(d+'/services.private.json'));
const stats={auth:0,rest:0,denied:0,upstreamErrors:0};
const server=http.createServer(async(req,res)=>{
 const auth=req.url.startsWith('/auth/v1/'),rest=req.url.startsWith('/rest/v1/');
 if(!auth&&!rest){stats.denied++;res.writeHead(404);res.end();return;}
 const target=s.services[auth?'auth':'rest'];
 const suffix=req.url.slice(auth?8:8)||'/';
 // Gateway's only remote destinations are owned bridge IPs, no target from request.
 const upstream=`http://${target.ip}:${target.port}${suffix}`;
 const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];
 const chunks=[];for await(const c of req)chunks.push(c);
 stats[auth?'auth':'rest']++;
 try{
  const response=await fetch(upstream,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual',signal:AbortSignal.timeout(15000)});
  const outputHeaders={};for(const[k,v]of response.headers)if(!['content-encoding','content-length','transfer-encoding','connection'].includes(k))outputHeaders[k]=v;
  res.writeHead(response.status,outputHeaders);res.end(Buffer.from(await response.arrayBuffer()));
 }catch{stats.upstreamErrors++;res.writeHead(502);res.end('ISOLATED_UPSTREAM_ERROR');}
 writeFileSync(d+'/gateway-stats.json',JSON.stringify(stats));
});
server.listen(s.gatewayPort,'127.0.0.1',()=>console.log('ISOLATED_GATEWAY_READY'));

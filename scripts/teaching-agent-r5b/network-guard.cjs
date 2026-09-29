// Preload only. Preserves every frozen artifact byte; redirects its build-bound
// Supabase origin to the owned clone and denies all other outbound networking.
const fs=require('node:fs'),net=require('node:net'),crypto=require('node:crypto');
const d=process.env.UPLY_R5B_DIRECTORY;
if(!d||!d.startsWith('/tmp/uply-r5b-private-'))throw Error('ISOLATED_DIRECTORY_REQUIRED');
const s=JSON.parse(fs.readFileSync(d+'/services.private.json')),k=JSON.parse(fs.readFileSync(d+'/keys.private.json')),publicSource=JSON.parse(fs.readFileSync(d+'/build-origin.private.json'));
const local=`http://127.0.0.1:${s.gatewayPort}`;
const stats={rewrittenToIsolated:0,blockedExternal:0,providerRequests:0};
const save=()=>fs.writeFileSync(d+'/network-guard-stats.json',JSON.stringify(stats));
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const a=Array.isArray(args[0])?args[0][0]:args[0];
 const host=typeof a==='object'?a.host:typeof args[1]==='string'?args[1]:'localhost';
 if(host&&!['localhost','127.0.0.1','::1'].includes(host)){stats.blockedExternal++;save();throw Error('R5B_EXTERNAL_SOCKET_FORBIDDEN');}
 return originalConnect.apply(this,args);
};
const original=globalThis.fetch;
const signedLocal=token=>{
 const parts=(token||'').split('.');if(parts.length!==3)return false;
 const sig=crypto.createHmac('sha256',k.jwt).update(parts[0]+'.'+parts[1]).digest('base64url');return sig===parts[2];
};
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
 if(url.origin===publicSource.origin||url.origin===local){
  stats.rewrittenToIsolated++;save();headers.set('apikey',k.anon);
  const token=(headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!signedLocal(token))headers.set('authorization','Bearer '+k.anon);
  const method=init?.method??(input instanceof Request?input.method:'GET');
  if(!['GET','HEAD'].includes(method))throw Error('R5B_CANDIDATE_WRITE_REQUEST_FORBIDDEN');
  return original(local+url.pathname+url.search,{...init,headers,method});
 }
 if(url.hostname!=='127.0.0.1'||Number(url.port)!==s.nextPort){stats.blockedExternal++;save();throw Error('R5B_EXTERNAL_FETCH_FORBIDDEN');}
 return original(input,init);
};
save();

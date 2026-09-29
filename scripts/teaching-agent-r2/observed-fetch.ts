import 'server-only';
import {appendFileSync,readFileSync} from 'node:fs';
/** Private-copy instrumentation only. Credentials/body/IDs never enter logs. */
export const r2ObservedFetch: typeof fetch = async (input,init) => {
 const d=process.env.UPLY_R2_DIRECTORY;
 if(!d?.startsWith('/tmp/uply-r2-private-'))throw Error('STAGING_ONLY');
 const state=JSON.parse(readFileSync(d+'/state.json','utf8'));
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(state.marker!=='uply-teaching-agent-r2-disposable-v1'||u.origin!==state.url)throw Error('R2_DATABASE_NETWORK_FORBIDDEN');
 let kind:string|undefined;
 try {if(u.pathname.includes('/rpc/append_agent_run_event_'))kind=JSON.parse(String(init?.body)).p_event?.kind;} catch { /* no payload retained */ }
 const at=Date.now(),method=init?.method??(input instanceof Request?input.method:'GET');
 appendFileSync(d+'/http-events.jsonl',JSON.stringify({at,path:u.pathname,method,kind})+'\n');
 try {const response=await fetch(input,init);appendFileSync(d+'/http-completions.jsonl',JSON.stringify({at:Date.now(),path:u.pathname,method,status:response.status,ms:Date.now()-at})+'\n');return response;}
 catch(error){appendFileSync(d+'/http-completions.jsonl',JSON.stringify({at:Date.now(),path:u.pathname,method,failed:true,ms:Date.now()-at})+'\n');throw error;}
};

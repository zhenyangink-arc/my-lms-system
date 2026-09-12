import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {literal,json,service} from './recording-v2-postgres.mjs';
export {literal,json,service};
export const migration='supabase/migrations/202609100001_runtime_publish_foundation.sql';
function processResult(command,args,input=''){
  return new Promise((resolve,reject)=>{const p=spawn(command,args,{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
    // Large Korean/Chinese JSON crosses pipe chunks. Decode UTF-8 as a stream,
    // not Buffer.toString() per chunk (which inserts replacement characters).
    p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');p.stdout.on('data',s=>stdout+=s);p.stderr.on('data',s=>stderr+=s);
    p.on('error',reject);p.on('close',code=>resolve({code,stdout:stdout.trim(),stderr:stderr.trim()}));p.stdin.on('error',()=>{});p.stdin.end(input);
  });
}
/** Independent disposable PG. No Recording migrations, env file, network,
 * production URL, host volume, uploaded object or production connection. */
export async function publicationPostgres(){
  const name=`uply-publish-4b1a-${randomUUID()}`;
  const start=await processResult('docker',['run','--detach','--rm','--network','none','--name',name,'--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:15-alpine']);
  if(start.code)throw Error(start.stderr);const id=start.stdout;
  const raw=sql=>processResult('docker',['exec','-i',id,'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],sql);
  const query=async sql=>{const r=await raw(sql);if(r.code)throw Error(r.stderr);return r.stdout;};
  const stop=()=>processResult('docker',['stop','--time','2',id]);
  try{
    let ready=false;for(let i=0;i<100;i++){if(!(await raw('select 1')).code){ready=true;break;}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('PostgreSQL unavailable');
    await query(`create role anon;create role authenticated;create role service_role;
      create table public.profiles(id uuid primary key,global_role text,status text);
      create table public.digital_textbooks(id uuid primary key);
      create table public.digital_textbook_versions(id uuid primary key,textbook_id uuid references public.digital_textbooks);
      create table public.digital_textbook_chapters(id uuid primary key,version_id uuid references public.digital_textbook_versions);`);
    await query(readFileSync(migration,'utf8'));
    // SQL transport only. The real repository/RPC, locks, schema and Loader are used.
    const admin={async rpc(name,args){
      if(!['publish_runtime_snapshot_v1','read_runtime_publication_v1','read_runtime_snapshot_for_owner_v1','runtime_publication_session_v1'].includes(name))throw Error('RPC not allowlisted');
      const sql=`select public.${name}(${Object.entries(args).map(([key,value])=>`${key} => ${value===null?'null':typeof value==='object'?json(value):literal(value)}`).join(',')});`;
      const r=await raw(service(sql));return r.code?{data:null,error:{message:r.stderr}}:{data:r.stdout?JSON.parse(r.stdout):null,error:null};
    }};
    return{id,raw,query,stop,admin};
  }catch(e){await stop();throw e;}
}

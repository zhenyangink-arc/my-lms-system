import 'server-only';
import { Client, type ClientConfig, type QueryResult } from 'pg';
import { readFile,lstat,realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyDevelopmentDbService, DEVELOPMENT_DB_DIRECTORY } from './provisioning-transport.server.ts';
import { DEVELOPMENT_BINDING as B } from './provisioning-contract.ts';
import type { NativeActivitySqlTransport } from '../../smart-textbook-runtime/server/durable-activity-repository.server.ts';
export const EXECUTION_DIRECTORY='/home/yangzhen/.config/uply-first-enable-20260910/development-execution/b3';
export const CANONICAL_SOURCE='/home/yangzhen/releases/uply-first-enable-20260910/source';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function privateRead(path:string){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.uid!==process.getuid?.()||(s.mode&0o077))throw Error('B3_PRIVATE_CONFIG');return readFile(path,'utf8');}
export async function verifyCurrentEnvironment(){
 if(await realpath(process.cwd())!==CANONICAL_SOURCE)throw Error('B3_ENVIRONMENT');
 const runtime=await privateRead('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json');
 if(hash(runtime)!=='7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8')throw Error('B3_RUNTIME_CONFIG');
 const config=JSON.parse(runtime),url=String(config.NEXT_PUBLIC_SUPABASE_URL??'').replace(/\/$/,'');
 if(hash(url)!==B.apiOriginSha256)throw Error('B3_AUTH_ORIGIN');
 await verifyDevelopmentDbService();return new URL(url).hostname.split('.')[0];
}
async function configuration():Promise<ClientConfig>{
 const project=await verifyCurrentEnvironment();
 const text=await privateRead(`${DEVELOPMENT_DB_DIRECTORY}/pg_service.conf`);
 const section=text.split('[uply]')[1]?.split(/^\[/m)[0];if(!section)throw Error('B3_DB_SERVICE');
 const fields=Object.fromEntries(section.split('\n').filter(x=>/^\w+\s*=/.test(x.trim())).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()];}));
 if(fields.sslmode!=='verify-full'||!(fields.host.includes(project)||fields.user.includes(project)))throw Error('B3_DB_IDENTITY');
 const lines=(await privateRead(`${DEVELOPMENT_DB_DIRECTORY}/pgpass`)).split('\n').filter(x=>x&&!x.startsWith('#'));
 const parts=(line:string)=>line.match(/(?:\\.|[^:])+/g)?.map(x=>x.replace(/\\(.)/g,'$1'));
 const matches=lines.map(parts).filter((p):p is string[]=>!!p&&p.length===5&&[fields.host,fields.port??'5432',fields.dbname,fields.user].every((v,i)=>p[i]==='*'||p[i]===v));
 if(matches.length!==1)throw Error('B3_DB_CREDENTIAL_BINDING');
 return {host:fields.host,port:Number(fields.port??5432),database:fields.dbname,user:fields.user,password:matches[0][4],ssl:{ca:await readFile(`${DEVELOPMENT_DB_DIRECTORY}/root.crt`,'utf8'),rejectUnauthorized:true,servername:fields.host},connectionTimeoutMillis:8000,query_timeout:12000,application_name:'uply-b3-controlled-execution'};
}
export type TransactionClient={connect():Promise<void>;query(sql:string):Promise<QueryResult|QueryResult[]>;end():Promise<void>};
/** Shared transaction runner: one client per complete repository transaction,
 * confirmed COMMIT required. SQL never comes from a browser or CLI. */
export function pgTransactionTransport(factory:()=>Promise<TransactionClient>):NativeActivitySqlTransport{
 return {async transaction(sql){
  if(!sql.startsWith('BEGIN ')||!sql.trimEnd().endsWith('COMMIT;'))throw Error('B3_TRANSACTION_CONTRACT');
  const client=await factory();let connected=false;
  try{await client.connect();connected=true;const result=await client.query(sql);const results=Array.isArray(result)?result:[result];
   if(results.at(-1)?.command!=='COMMIT')throw Error('B3_COMMIT_UNKNOWN');
   const row=results.filter(r=>r.command==='SELECT').flatMap(r=>r.rows).filter(r=>Object.values(r).some(v=>v&&typeof v==='object'&&!Array.isArray(v))).at(-1);
   if(!row)throw Error('B3_RESULT_UNKNOWN');return Object.values(row).find(v=>v&&typeof v==='object'&&!Array.isArray(v));
  }catch{if(connected)await client.query('ROLLBACK').catch(()=>{});throw Error('B3_TRANSACTION_UNKNOWN');}
  finally{await client.end().catch(()=>{});}
 }};
}
/** The CURRENT discriminator is available only through pinned canonical private
 * configuration; test factories never receive it by supplying a string. */
export async function currentDatabaseTransport():Promise<NativeActivitySqlTransport>{
 await verifyCurrentEnvironment();
 const t=pgTransactionTransport(async()=>{const client=new Client(await configuration());return {connect:async()=>{await client.connect();},query:async sql=>await client.query(sql),end:async()=>{await client.end();}};});
 return Object.freeze({...t,evidenceStorage:'CURRENT_DEVELOPMENT_DB' as const});
}

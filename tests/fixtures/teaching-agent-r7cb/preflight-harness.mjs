import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {literal as q} from '../teaching-agent-r7c/postgres.mjs';
export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const key=Symbol.for('uply.r7cb.preflight-test');
const denyModule='data:text/javascript,'+encodeURIComponent(`export async function requirePlatformOwner(){return globalThis[Symbol.for('uply.r7cb.preflight-test')].authorize()}`);
const readerModule='data:text/javascript,'+encodeURIComponent(`export function createAdminClient(){return globalThis[Symbol.for('uply.r7cb.preflight-test')].admin()}`);
export async function loadPreflight(harness){
 globalThis[key]=harness;
 const hooks=registerHooks({resolve(s,c,next){
  if(s==='@/lib/admin')return {url:denyModule,shortCircuit:true};
  if(s==='@/lib/supabase/admin')return {url:readerModule,shortCircuit:true};
  return next(s==='server-only'?pathToFileURL(resolve('node_modules/next/dist/compiled/server-only/empty.js')).href:s,c);
 },load(url,c,next){const r=next(url,c);if(url.includes('/native-activity-authoring.server.ts')&&harness.freeze){
  let source=String(r.source);source=source.replace(/export const canonicalFreeze = .*? as const;/,`export const canonicalFreeze = ${JSON.stringify(harness.lock)} as const;`);
  source=source.replace(/const preflightFreeze = .*? as const;/,`const preflightFreeze = ${JSON.stringify(harness.freeze)} as const;`);return {...r,source};
 }return r;}});
 const module=await import('../../../src/features/digital-textbook/server/native-activity-authoring.server.ts');
 return {module,close(){hooks.deregister();delete globalThis[key];}};
}
export async function createReadHarness(db){
 const tables=['lessons','digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','learning_agent_lessons','learning_agent_script_versions','learning_agent_script_nodes','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets'];
 const freeze={};for(const t of tables.slice(0,8)){
  const rows=JSON.parse(await db.raw(`BEGIN READ ONLY;SELECT coalesce(json_agg(to_jsonb(x) ORDER BY ${t==='learning_agent_script_nodes'?'sort_order':'id'}),'[]') FROM public.${t} x;ROLLBACK;`));
  freeze[t]=t==='learning_agent_script_nodes'?rows.map(fingerprint):fingerprint(rows[0]);
 }
 const h={lock:db.lock,freeze,actor:'owner',events:[],fault:null,rpcCalls:0,adminConstructed:0};
 function client(role){return {from(table){
  if(!tables.includes(table))throw Error('TEST_TABLE_NOT_BOUND');
  let columns='*',where=[],order='id',head=false;
  const field=s=>{if(!/^[a-z_]+$/.test(s))throw Error('TEST_FIELD');return '"'+s+'"'};
  const query={select(value,options={}){columns=value;head=Boolean(options.head);return query},eq(k,v){where.push(`${field(k)}=${q(v)}`);return query},contains(k,v){where.push(`${field(k)} @> ${q(JSON.stringify(v))}::jsonb`);return query},order(k){order=k;return query},async then(yes,no){try{
   h.events.push({role,table,columns,head});
   if(role==='service_role'&&!['learning_agent_lessons','digital_textbook_activity_secrets'].includes(table))throw Error('UNBOUNDED_PRIVILEGED_READ');
   if(table==='digital_textbook_activity_secrets'&&(!head||columns!=='activity_id'))throw Error('PRIVATE_KEY_READ');
   const selected=columns==='*'?'*':columns.split(',').map(field).join(',');
   const condition=where.length?' WHERE '+where.join(' AND '):'';
   const owner=h.actor==='anonymous'?'':db.ids.owner;
   const expr=head?`json_build_object('data',null,'error',null,'count',count(*))`:`json_build_object('data',coalesce(json_agg(to_jsonb(x) ORDER BY ${field(order)}),'[]'),'error',null)`;
   const sql=`BEGIN READ ONLY;SET LOCAL ROLE ${role};SET LOCAL test.owner=${q(owner)};SET LOCAL test.owner_allowed=${q(String(h.actor==='owner'))};SELECT ${expr} FROM (SELECT ${selected} FROM public.${table}${condition}) x;ROLLBACK;`;
   let result=JSON.parse(await db.raw(sql));if(h.fault)result=h.fault(table,result);return yes(result);
  }catch(e){return no?no(e):Promise.reject(e)}}};return query;
 },async rpc(name,args){if(role!=='authenticated')throw Error('PRIVILEGED_WRITE_FORBIDDEN');h.rpcCalls++;h.lastRpc={name,expected:args.p_expected_freeze};return {data:{contract:'canonical-activity-binding/1',result:'CREATED',targetAlias:'hangul-introduction',activityAlias:'hangul-introduction-vowel-recognition',operatorHash:'a'.repeat(64),nodeHash:'b'.repeat(64),activityHash:'c'.repeat(64),insertedRows:3,observedAt:'2026-09-17T00:00:00+00:00',transactionRef:'1'},error:null};}};}
 h.caller=client('authenticated');h.admin=()=>{h.adminConstructed++;return client('service_role')};
 h.authorize=async()=>{
  const owner=h.actor==='anonymous'?'':db.ids.owner;
  const permitted=await db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SET LOCAL test.owner=${q(owner)};SET LOCAL test.owner_allowed=${q(String(h.actor==='owner'))};SELECT coalesce(auth.uid() IS NOT NULL AND private.is_platform_owner(),false);ROLLBACK;`);
  if(permitted!=='t')throw Error('OWNER_REQUIRED');return {supabase:h.caller};
 };
 return h;
}

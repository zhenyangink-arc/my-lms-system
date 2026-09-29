// Explicit owned isolated-stack harness. Never accepts a current DB URL or key.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='/tmp/uply-r7cb-b2-workflow';const s=JSON.parse(readFileSync(dir+'/isolated-state.json')),keys=JSON.parse(readFileSync(dir+'/isolated-keys.private.json'));
assert.match(s.pg,/^uply-r7cb-b2-[a-f0-9]+-pg$/);
for(const name of [s.pg,s.auth,s.rest]){const obj=JSON.parse(execFileSync('docker',['inspect',name]))[0];assert.equal(obj.Config.Labels.stage,'r7cb-b2');assert.deepEqual(obj.HostConfig.PortBindings,{});}
function sql(q){try{return execFileSync('docker',['exec','-i',s.pg,'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(e){writeFileSync(dir+'/readback-error.private.log',e.stderr,{mode:0o600});throw Error('ISOLATED_SQL_FAILED');}}
const hooks=registerHooks({load(url,c,n){const r=n(url,c);if(url.endsWith('/provisioning-contract.ts'))return{...r,source:r.source.toString().replace('ff8db3ba3da8be9b994619fb66af48143c9ea9236e6454d2c59705d7b3279ea3',createHash('sha256').update('http://owned-isolated.invalid').digest('hex'))};return r;},resolve(x,c,n){if(x==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};if(x==='@/lib/admin')return{url:'data:text/javascript,export const requirePlatformOwner=()=>globalThis.__b2isolatedOwner()',shortCircuit:true};if(x==='@/lib/supabase/admin')return{url:'data:text/javascript,export const createAdminClient=()=>{throw Error("UNUSED")}',shortCircuit:true};return n(x,c);}});
const {DEVELOPMENT_BINDING:B}=await import('../../../src/features/development-execution/server/provisioning-contract.ts');
const {createProvisioningReadback}=await import('../../../src/features/development-execution/server/provisioning-readback.server.ts');
const {installDevelopmentProvisioning}=await import('../../../src/features/development-execution/server/provisioning-composition.server.ts');
const {provisionDevelopmentExecutionAction:action}=await import('../../../src/features/development-execution/server/provisioning.actions.ts');hooks.deregister();
const apiCalls=[];async function routedFetch(input,init){const u=new URL(typeof input==='string'?input:input.url??input.toString());let target;if(u.pathname.startsWith('/auth/v1'))target=s.base+u.pathname.slice(8)+u.search;else if(u.pathname.startsWith('/rest/v1'))target=s.restBase+u.pathname.slice(8)+u.search;else throw Error('UNBOUND_URL');apiCalls.push({path:u.pathname,method:init?.method??'GET'});return fetch(target,init);}
function client(token){return createClient('http://owned-isolated.invalid',token,{global:{fetch:routedFetch,headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
const owner=client(keys.owner),admin=client(keys.service);
globalThis.__b2isolatedOwner=async()=>{assert.equal(sql("BEGIN READ ONLY;SELECT count(*) FROM public.profiles WHERE global_role='platform_owner' AND role='platform_super_admin' AND status='active';COMMIT;"),'1');return{supabase:owner};};
let readCount=0;
const transport={async transaction(q){readCount++;return JSON.parse(sql(q));}};
// The exact readback SQL must reject the empty canonical-content fixture. No
// real user/content rows are copied. Only canonicalValid is substituted below
// for this isolated Auth workflow test; all actor/tenant facts remain real SQL.
const empty=await createProvisioningReadback(transport,B.databaseIdentity).read();assert.equal(empty.canonicalValid,false);if(process.argv.includes('--existing'))assert.equal(empty.actors.length,1);else assert.deepEqual(empty.actors,[]);
const journal=dir+'/journal';mkdirSync(journal,{mode:0o700,recursive:true});
installDevelopmentProvisioning({environment:{enabled:true,environment:B.environment,databaseIdentity:B.databaseIdentity,expiresAt:new Date(Date.now()+1200000).toISOString()},connectionIdentity:B.databaseIdentity,journalDirectory:journal,admin:()=>admin,readOnlyTransport:()=>({async transaction(q){const r=await transport.transaction(q);assert.equal(r.canonicalValid,false);return{...r,canonicalValid:true};}})});
const result=await action();
if(process.argv.includes('--existing')){assert.equal(result.status,'EXISTING');assert.equal(apiCalls.length,0);console.log(JSON.stringify({restartReadback:'EXISTING',writes:0}));process.exit(0);}
const counts=JSON.parse(sql("SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT table_name,operation,count(*)::int AS count FROM b2_probe.writes GROUP BY table_name,operation ORDER BY table_name,operation)x"));
const expected=[['auth.identities','INSERT',1],['auth.users','INSERT',1],['auth.users','UPDATE',5],['public.learning_grading_comments','INSERT',4],['public.profiles','INSERT',1],['public.profiles','UPDATE',3],['public.tenant_membership_audit_logs','INSERT',1],['public.tenant_memberships','INSERT',1],['public.tenant_student_apps','INSERT',5],['public.tenants','INSERT',1]].map(([table_name,operation,count])=>({table_name,operation,count}));
const out={contract:'development-domain-execution/1',result,apiCalls,readCount,actualSideEffects:counts,sideEffects:JSON.stringify(counts)===JSON.stringify(expected)?'MATCH':'MISMATCH',canonicalAttestation:'ISOLATED FIXTURE override; actual SQL rejects absent canonical content. Current DB freeze/binding independently READ ONLY verified.',ownerGuard:'Isolated operator fixture; production requirePlatformOwner separately tested',currentDbWrites:0};
writeFileSync('docs/evidence/teaching-agent-stage-1f-r7c-b/b2-workflow-isolated-result.json',JSON.stringify(out,null,2)+'\n');
assert.equal(result.status,'CREATED');assert.deepEqual(counts,expected);
const before=apiCalls.length;assert.equal((await action()).status,'EXISTING');assert.equal(apiCalls.length,before);
console.log(JSON.stringify({workflow:'PASS',sideEffects:'MATCH',independentReads:readCount,currentDbWrites:0}));

process.exit(0);

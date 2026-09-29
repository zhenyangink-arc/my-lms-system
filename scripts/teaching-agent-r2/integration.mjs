import '../../tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {SupabaseStudentTeachingReadRepository} from '../../src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts';
import {projectStudentSelectionPins} from '../../src/features/teaching-agent/server/page-projection/selection-projection.ts';
import {createStudentDomainRuntime} from '../../src/features/teaching-agent/server/composition/create-student-domain-runtime.ts';
import {pinStudentRuntimeDefinition} from '../../src/features/teaching-agent/server/runtime/student-runtime-definition.ts';
const d=process.argv[2],read=name=>JSON.parse(readFileSync(d+'/'+name));
const state=read('state.json'),keys=read('status.json'),users=read('users.private.json'),ids=read('fixture.json');
if(state.marker!=='uply-teaching-agent-r2-disposable-v1'||state.url!==`http://127.0.0.1:${state.ports.api}`||keys.API_URL!==state.url)throw Error('LOCAL_STAGE_REQUIRED');
const operations=[];
const clients=Object.fromEntries(Object.entries(users).map(([label,u])=>[label,createClient(state.url,keys.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+u.session.access_token},fetch:async(url,init)=>{
 if(new URL(url).origin!==state.url)throw Error('NETWORK_TARGET_FORBIDDEN');const start=performance.now();const response=await fetch(url,init);
 operations.push({label,path:new URL(url).pathname,method:init?.method??'GET',status:response.status,ms:Math.round(performance.now()-start)});return response;
}}})]));
const result={raw:[],domain:[],pins:[],errors:[]};
async function raw(label,table,id){const r=await clients[label].from(table).select('*').eq('id',id);result.raw.push({label,table,case:Object.entries(ids).find(([,v])=>v===id)?.[0]??(id===ids.anodes[0]?'aPublishedNode':'bPublishedNode'),rows:r.data?.length??0,error:r.error?.code??null,privateSentinel:JSON.stringify(r.data??[]).includes('SYNTHETIC-PRIVATE-R2'),answerSentinel:JSON.stringify(r.data??[]).includes('SYNTHETIC-ANSWER-R2')});}
for(const [table,id] of [['learning_agent_sessions',ids.ownSession],['learning_agent_sessions',ids.a2Session],['learning_agent_sessions',ids.bSession],['courses',ids.bcourse],['lessons',ids.blesson],['digital_textbook_modules',ids.bmodule],['learning_agent_script_nodes',ids.bnodes[0]],['learning_agent_script_nodes',ids.anodes[0]],['learning_agent_script_nodes',ids.adraftNode],['learning_agent_script_versions',ids.adraftVersion]])await raw('A1',table,id);
for(const label of ['A2','B1','EX','IN','TA','AA','PO'])await raw(label,'learning_agent_script_nodes',ids.anodes[0]);
const exec=()=>({signal:AbortSignal.timeout(12000),deadlineAt:new Date(Date.now()+12000).toISOString(),runId:randomUUID()});
const candidate=nodeId=>({lessonId:ids.alesson,moduleId:ids.amodule,scriptVersionId:ids.ascriptVersion,nodeId});
async function authentication(label){const auth=await clients[label].auth.getUser();if(!auth.data.user)return null;const m=await clients[label].from('tenant_memberships').select('tenant_id,role,status').eq('user_id',auth.data.user.id).eq('is_default',true).maybeSingle();return m.data?.role==='student'&&m.data.status==='active'?{actorId:auth.data.user.id,tenantId:m.data.tenant_id}:null;}
const repository=new SupabaseStudentTeachingReadRepository(clients.A1);let pins=[];
for(let i=0;i<10;i++){const before=operations.length,start=performance.now();try{pins=await projectStudentSelectionPins({candidates:ids.anodes.map(candidate),repository,authenticate:()=>authentication('A1'),execution:exec()});result.pins.push({sample:i+1,kind:i?'warm':'cold',ms:Math.round(performance.now()-start),queries:operations.slice(before).filter(o=>o.path.startsWith('/rest/')).length,pinCount:pins.length});}catch(e){result.errors.push({phase:'pins',code:e.code??e.name});break;}}
writeFileSync(d+'/pins.json',JSON.stringify(pins));
if(pins.length){const pin={...pins[0]};delete pin.displayText;
 for(const label of Object.keys(users)){
  const domain=createStudentDomainRuntime({repository:new SupabaseStudentTeachingReadRepository(clients[label]),authenticate:()=>authentication(label)});
  const r=await domain.selection.verify(pin,exec());result.domain.push({case:label,status:r.status});
 }
 const domain=createStudentDomainRuntime({repository,authenticate:()=>authentication('A1')});
 for(const [name,patch] of [['ownSession',{teachingSessionId:ids.ownSession}],['a2Session',{teachingSessionId:ids.a2Session}],['bSession',{teachingSessionId:ids.bSession}],['completedSession',{teachingSessionId:ids.completedSession}],['index',{segmentIndex:999}],['revision',{expectedRevision:'ta1:revision:'+'0'.repeat(64)}],['draftVersion',{scriptVersionId:ids.adraftVersion}],['draftNode',{nodeId:ids.adraftNode}],['otherLesson',{lessonId:ids.blesson}],['otherNode',{nodeId:ids.bnodes[0]}]]){
  const r=await domain.selection.verify({...pin,...patch},exec());result.domain.push({case:name,status:r.status});
 }
 const resolved=await domain.resolve({...pin,teachingSessionId:ids.ownSession},exec());result.ports={status:resolved.status,privateSentinel:JSON.stringify(resolved).includes('SYNTHETIC-PRIVATE-R2'),answerSentinel:JSON.stringify(resolved).includes('SYNTHETIC-ANSWER-R2')};
}
// Server code's exact manifest, never client-supplied executable JSON.
const profile=pinStudentRuntimeDefinition().profile,admin=createClient(state.url,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const definition=await admin.from('agent_definition_versions').insert({tenant_id:ids.A,actor_id:users.A1.id,agent_code:profile.agentCode,version:profile.definitionVersion.version,status:'published',manifest:profile}).select('manifest').single();
result.definition={published:!definition.error,exact:JSON.stringify(definition.data?.manifest)===JSON.stringify(profile),error:definition.error?.code??null};
// JSONB property ordering is not semantic; compare using canonical code digest.
if(definition.data){const {canonical}=await import('../../src/features/agent-core/conversation/scope.ts');result.definition.exact=canonical(definition.data.manifest)===canonical(profile);}
try{pinStudentRuntimeDefinition({...profile,artifacts:{...profile.artifacts,definitionDigest:'0'.repeat(64)}});result.definition.badDigestRejected=false;}catch{result.definition.badDigestRejected=true;}
const secret=read('private.json').SUPABASE_AUTH_JWT_SECRET,b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const unsigned=b({alg:'HS256',typ:'JWT'})+'.'+b({sub:users.A1.id,role:'authenticated',aud:'authenticated',exp:1});
const expired=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
const er=await fetch(state.url+'/rest/v1/profiles?select=id',{headers:{apikey:keys.ANON_KEY,Authorization:'Bearer '+expired}});result.expiredJwtStatus=er.status;
result.operations={count:operations.length,errors:operations.filter(x=>x.status>=400),domainMethods:[...new Set(operations.map(o=>o.method))]};
writeFileSync(d+'/integration-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

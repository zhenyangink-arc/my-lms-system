// Invoke actual Domain Ports and persisted manifest comparison using a real Auth JWT.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {SupabaseStudentTeachingReadRepository} from '../../src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts';
import {createStudentDomainRuntime} from '../../src/features/teaching-agent/server/composition/create-student-domain-runtime.ts';
import {SupabaseAgentRepositories} from '../../src/features/agent-core/persistence/supabase/repositories.ts';
import {pinStudentRuntimeDefinition} from '../../src/features/teaching-agent/server/runtime/student-runtime-definition.ts';
import {teachingRef} from '../../src/features/teaching-agent/server/selection/references.ts';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),k=read('status.json'),u=read('users.private.json').A1,ids=read('fixture.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||s.url!==`http://127.0.0.1:${s.ports.api}`||k.API_URL!==s.url)throw Error('STAGING_ONLY');
const client=createClient(s.url,k.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+u.session.access_token}}});
const authenticate=async()=>{const {data}=await client.auth.getUser();if(!data.user)return null;const m=await client.from('tenant_memberships').select('tenant_id,role,status').eq('user_id',data.user.id).eq('is_default',true).single();return m.data?.role==='student'&&m.data.status==='active'?{actorId:data.user.id,tenantId:m.data.tenant_id}:null;};
const domain=createStudentDomainRuntime({authenticate,repository:new SupabaseStudentTeachingReadRepository(client)});
const execution={runId:randomUUID(),signal:AbortSignal.timeout(12000),deadlineAt:new Date(Date.now()+12000).toISOString()};
const pin={...read('pins.json')[0],teachingSessionId:ids.ownSession};delete pin.displayText;
const verified=await domain.selection.verify(pin,execution);if(!('data' in verified))throw Error('SELECTION_FAILED');const binding=verified.data;
const lesson=await domain.currentLesson.read({binding,lessonRef:binding.selection.lessonRef,segmentRef:binding.selection.segmentRef,expectedRevision:binding.selection.contentRevision,segmentBinding:'verified_selection'},binding.authority,execution);
const state=await domain.teachingState.read({binding,teachingSessionRef:teachingRef('session',[ids.A,u.id,ids.ownSession]),expectedRevision:binding.selection.contentRevision},binding.authority,execution);
const admin=createClient(s.url,k.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),repository=new SupabaseAgentRepositories(admin,binding.authority);
const profile=pinStudentRuntimeDefinition().profile;profile.artifacts.definitionDigest='0'.repeat(64);let wrongDigestRejected=false;
try{await repository.admitRun({authority:binding.authority,profile});}catch(e){wrongDigestRejected=e.code==='FORBIDDEN';}
const result={currentLesson:{status:lesson.status,originalSentence:lesson.data?.originalSentence},teachingState:{status:state.status,phase:state.data?.phase,semantic:state.data?.semantic},wrongDigestRejectedByRealDatabaseManifest:wrongDigestRejected,domainUsesServiceRole:false};
writeFileSync(d+'/ports-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

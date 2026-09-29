import '../../tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {SupabaseStudentTeachingReadRepository} from '../../src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts';
import {projectStudentSelectionPins} from '../../src/features/teaching-agent/server/page-projection/selection-projection.ts';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),keys=read('status.json'),ids=read('fixture.json'),users=read('users.private.json');
assert.equal(s.marker,'uply-teaching-agent-r2-disposable-v1');assert.equal(s.url,`http://127.0.0.1:${s.ports.api}`);assert.equal(keys.API_URL,s.url);
const client=createClient(s.url,keys.ANON_KEY,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+users.A1.session.access_token},fetch:(url,init)=>{assert.equal(new URL(url).origin,s.url);return fetch(url,init);}}});
const user=await client.auth.getUser();assert.equal(user.data.user?.id,users.A1.id);
const membership=await client.from('tenant_memberships').select('tenant_id,role,status').eq('user_id',user.data.user.id).eq('is_default',true).single();assert.equal(membership.data?.role,'student');assert.equal(membership.data?.tenant_id,ids.A);
const catalog=await client.from('lessons').select('id,slug,unlock_mode').eq('course_id',ids.acourse);assert.equal(catalog.error,null);assert.equal(catalog.data.length,3);
const results=[];
for(const lesson of catalog.data){
 const q=await client.from('digital_textbooks').select('id').eq('lesson_id',lesson.id).eq('status','published');assert.equal(q.error,null);
 const candidates=[];
 for(const t of q.data){
  const v=await client.from('digital_textbook_versions').select('id').eq('textbook_id',t.id).eq('status','published').order('version_number',{ascending:false}).limit(1);assert.equal(v.error,null);
  if(!v.data.length)continue;
  const ch=await client.from('digital_textbook_chapters').select('id').eq('version_id',v.data[0].id).eq('status','published');assert.equal(ch.error,null);if(!ch.data.length)continue;
  const m=await client.from('digital_textbook_modules').select('id').in('chapter_id',ch.data.map(x=>x.id));assert.equal(m.error,null);if(!m.data.length)continue;
  const tl=await client.from('learning_agent_lessons').select('id,module_id').in('module_id',m.data.map(x=>x.id)).eq('status','published');assert.equal(tl.error,null);if(!tl.data.length)continue;
  const vs=await client.from('learning_agent_script_versions').select('id,lesson_id').in('lesson_id',tl.data.map(x=>x.id)).eq('status','published');assert.equal(vs.error,null);if(!vs.data.length)continue;
  const nodes=await client.from('student_learning_agent_script_nodes').select('id,script_version_id').in('script_version_id',vs.data.map(x=>x.id));assert.equal(nodes.error,null);
  for(const n of nodes.data){const ver=vs.data.find(x=>x.id===n.script_version_id),teach=tl.data.find(x=>x.id===ver.lesson_id);candidates.push({lessonId:lesson.id,moduleId:teach.module_id,scriptVersionId:ver.id,nodeId:n.id});}
 }
 const pins=await projectStudentSelectionPins({candidates,repository:new SupabaseStudentTeachingReadRepository(client),authenticate:async()=>({actorId:user.data.user.id,tenantId:membership.data.tenant_id}),execution:{signal:AbortSignal.timeout(12000),runId:randomUUID(),deadlineAt:new Date(Date.now()+12000).toISOString()}});
 results.push({slug:lesson.slug,unlock:lesson.unlock_mode,publishedNodeCandidates:candidates.length,pins:pins.length,eligible:pins.length>0});
}
assert.equal(results.filter(x=>x.eligible).length,1);assert.equal(results.find(x=>x.eligible).slug,'hangul-introduction');assert.ok(results.find(x=>x.slug==='basic-pronunciation').publishedNodeCandidates>0);
const result={status:'PROVEN BY CURRENT CONTENT STATE',scope:'disposable synthetic course and real A1 JWT only; not production proof',lessons:results,eligibleCount:1,lessonAllowlist:'NOT REQUIRED for this frozen content state',invalidation:'Any new eligible lesson or inability to freeze pilot content invalidates this proof',studentPolicyChanged:false,productionCandidateCount:0,liveProviderRequests:0};
writeFileSync(d+'/scope-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

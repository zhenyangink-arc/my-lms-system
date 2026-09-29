import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),k=read('status.json'),ids=read('fixture.json'),u=read('users.private.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||s.url!==`http://127.0.0.1:${s.ports.api}`||k.API_URL!==s.url)throw Error('OWNED_LOCAL_REQUIRED');
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(s.url,k.SERVICE_ROLE_KEY,options),owner=createClient(s.url,k.ANON_KEY,options);
assert.equal((await owner.auth.signInWithPassword({email:u.PO.email,password:u.PO.password})).error,null);
const params=async lessonId=>{const r=await admin.from('lessons').select('updated_at').eq('id',lessonId).single();assert.equal(r.error,null);return {p_lesson_id:lessonId,p_expected_updated_at:r.data.updated_at,p_chapter_title:'验证预备章',p_objectives:[]};};
const failure=await owner.rpc('create_teaching_content_skeleton',await params(ids.failureLesson));
assert.equal(failure.error?.message,'SYNTHETIC_LATE_FAILURE');
const remaining=await admin.from('digital_textbooks').select('id',{count:'exact'}).eq('lesson_id',ids.failureLesson);assert.equal(remaining.error,null);assert.equal(remaining.count,0);
const race=await admin.from('digital_textbooks').select('id,digital_textbook_versions(id,digital_textbook_chapters(id))').eq('lesson_id',ids.raceLesson).single();assert.equal(race.error,null);
assert.equal(race.data.digital_textbook_versions.length,1);assert.equal(race.data.digital_textbook_versions[0].digital_textbook_chapters.length,1);
const publish=await owner.rpc('publish_digital_textbook_chapter',{p_chapter_id:race.data.digital_textbook_versions[0].digital_textbook_chapters[0].id});assert.equal(publish.error,null);
const before=await admin.from('digital_textbooks').select('*').eq('id',race.data.id).single();assert.equal(before.data.status,'published');
const duplicate=await owner.rpc('create_teaching_content_skeleton',await params(ids.raceLesson));assert.equal(duplicate.error?.message,'AUTHORING_CONTENT_EXISTS');
const after=await admin.from('digital_textbooks').select('*').eq('id',race.data.id).single();assert.deepEqual(before.data,after.data);
for(const [label,key] of [['anon',k.ANON_KEY],['service_role',k.SERVICE_ROLE_KEY]]){
 const r=await createClient(s.url,key,options).rpc('create_teaching_content_skeleton',await params(ids.failureLesson));assert.equal(r.error?.code,'42501',label);
}
const script=await admin.from('learning_agent_script_versions').select('created_by,published_by').eq('id',ids.ascriptVersion).single();assert.equal(script.error,null);assert.equal(script.data.created_by,u.PO.id);assert.equal(script.data.published_by,u.PO.id);
const review=await admin.from('teaching_script_source_reviews').select('reviewed_by').eq('script_version_id',ids.ascriptVersion).single();assert.equal(review.error,null);assert.equal(review.data.reviewed_by,u.PO.id);
const result={status:'PASS',authorReviewPublisherVerified:true,lateInsertFailureExact:true,atomicRollback:true,oneVersionOneChapter:true,publishedStateProtected:true,anonDenied:true,serviceRoleDenied:true,productionWrites:0};
writeFileSync(d+'/r3d-closing-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

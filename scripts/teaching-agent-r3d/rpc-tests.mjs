import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n));
const s=read('state.json'),k=read('status.json'),ids=read('fixture.json'),users=read('users.private.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||s.url!==`http://127.0.0.1:${s.ports.api}`||k.API_URL!==s.url)throw Error('OWNED_LOCAL_REQUIRED');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(s.url,k.SERVICE_ROLE_KEY,options),clients={};
for(const label of ['PO','PO2','MA','UT','TB','A1','TA','AA']){
 const c=createClient(s.url,k.ANON_KEY,options),login=await c.auth.signInWithPassword(users[label]);assert.equal(login.error,null);clients[label]=c;
}
const result={checks:[],realIndependentAuthSessions:true,errors:[]};
const check=(name,ok)=>{result.checks.push({name,pass:!!ok});assert.ok(ok,name);};
const params=async id=>{const r=await admin.from('lessons').select('updated_at').eq('id',id).single();assert.equal(r.error,null);return {p_lesson_id:id,p_expected_updated_at:r.data.updated_at,p_chapter_title:'并发验证预备章',p_objectives:[]};};
const rpc=(label,p)=>clients[label].rpc('create_teaching_content_skeleton',p);
const count=async id=>{const r=await admin.from('digital_textbooks').select('id',{count:'exact'}).eq('lesson_id',id);assert.equal(r.error,null);return r.count;};
try{
 check('formal UI target still has zero textbooks',await count(ids.alesson)===0);
 for(const [label,id] of [['A1',ids.alesson],['UT',ids.alesson],['TA',ids.alesson],['MA',ids.alesson],['MA',ids.blesson],['TB',ids.alesson],['AA',ids.alesson]]){
  const r=await rpc(label,await params(id));check(label+' denied '+(id===ids.blesson?'Tenant B':'Tenant A'),r.error?.code==='42501');
 }
 const p=await params(ids.raceLesson);
 const bad=await rpc('PO',{...p,p_expected_updated_at:'2020-01-01T00:00:00Z'});check('stale catalog revision rejected',bad.error?.code==='PT409');
 const responses=await Promise.all([rpc('PO',p),rpc('PO2',p)]);
 writeFileSync(d+'/rpc-responses.private.json',JSON.stringify(responses));
 check('two actual authenticated HTTP sessions: one success',responses.filter(r=>!r.error).length===1);
 check('other concurrent session conflicts',responses.filter(r=>r.error?.message==='AUTHORING_CONTENT_EXISTS').length===1);
 check('one canonical root',await count(ids.raceLesson)===1);
 const created=responses.find(r=>!r.error).data;
 for(const [table,id] of [['digital_textbooks',created.textbookId],['digital_textbook_versions',created.versionId],['digital_textbook_chapters',created.chapterId],['learning_agent_lessons',created.teachingLessonId]]){
  const r=await admin.from(table).select('status').eq('id',id).single();check(table+' draft',r.data?.status==='draft');
 }
 check('server-resolved profile',created.profileId===ids.profile);
 const versions=await admin.from('learning_agent_script_versions').select('id',{count:'exact'}).eq('lesson_id',created.teachingLessonId);check('no generated script',versions.count===0);
 const before=await admin.from('digital_textbooks').select('*').eq('id',created.textbookId).single();
 for(let i=0;i<2;i++)check('repeat/double click '+i,(await rpc('PO',p)).error?.message==='AUTHORING_CONTENT_EXISTS');
 const after=await admin.from('digital_textbooks').select('*').eq('id',created.textbookId).single();check('existing content byte equivalent',JSON.stringify(before.data)===JSON.stringify(after.data));
 check('partial legacy rejected',(await rpc('PO',await params(ids.partialLesson))).error?.message==='AUTHORING_CONTENT_EXISTS');
 const partial=await admin.from('digital_textbooks').select('digital_textbook_versions(id)').eq('lesson_id',ids.partialLesson).single();check('partial legacy not repaired',partial.data.digital_textbook_versions.length===0);
 const fail=await rpc('PO',await params(ids.failureLesson));check('late fifth insert fails',!!fail.error);check('late failure rolls back root and FK descendants',await count(ids.failureLesson)===0);
 check('formal UI target remains from zero',await count(ids.alesson)===0);
 result.status='PASS';
}catch(e){result.status='FAIL';result.errors.push(e.message);process.exitCode=1;}
writeFileSync(d+'/r3d-rpc-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

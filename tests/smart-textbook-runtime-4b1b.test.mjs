import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {publishedChapterFixture,publishedOverrides} from './fixtures/published-chapter-one.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {literal as q,json,service} from './fixtures/recording-v2-postgres.mjs';
import {source} from './fixtures/runtime-4a.mjs';
import {wav} from './fixtures/teacher-boundary-4a14.mjs';
import {verifySingleVersionAuthoring} from './fixtures/single-version-authoring.mjs';

test('4B1B/4B1C actual app admission + single-version authoring + formal HTTP + published Runtime',{timeout:600000},async t=>{
 let f,browser,http;const saved={...process.env},originalFetch=globalThis.fetch;
 try{
  f=await publishedChapterFixture();const {db}=f;
  await db.query(`alter table public.digital_textbook_preferences add column support_mode text, add column updated_at timestamptz;
    alter table public.digital_textbook_preferences add unique(tenant_id,student_id,textbook_id);`);
  await db.query(await readFile('supabase/migrations/202609100003_runtime_admission_control.sql','utf8'));
  const secret=randomBytes(32);await db.query(`insert into recording_private.proof_keys values('admission-isolated',decode('${secret.toString('hex')}','hex'),true)`);
  const parent=randomUUID(),category=randomUUID(),course=randomUUID(),lesson=randomUUID();
  await db.query(`create table public.course_categories(id uuid,slug text,parent_id uuid,is_published boolean);
   create table public.courses(id uuid,slug text,category_id uuid,is_published boolean);
   create table public.lessons(id uuid,slug text,course_id uuid,is_published boolean,sort_order int,unlock_mode text,prerequisite_lesson_id uuid,prerequisite_chapter_id uuid,available_from timestamptz,is_manually_locked boolean);
   create table public.course_chapters(id uuid,slug text,lesson_id uuid,is_published boolean,sort_order int,unlock_mode text,prerequisite_chapter_id uuid,available_from timestamptz,is_manually_locked boolean);
   create table public.lesson_progress(lesson_id uuid,user_id uuid,status text);
   create table public.chapter_test_attempts(test_slug text,student_id uuid,tenant_id uuid,passed boolean);
   insert into public.course_categories values(${q(parent)},'korean',null,true),(${q(category)},'korean-basic',${q(parent)},true);
   insert into public.courses values(${q(course)},'korean-beginner',${q(category)},true);
   insert into public.lessons values(${q(lesson)},'basic-pronunciation',${q(course)},true,1,'immediate',null,null,null,false);
   insert into public.course_chapters values(gen_random_uuid(),'korean-level-one-01',${q(lesson)},true,1,'immediate',null,null,false);
   grant select on all tables in schema public to service_role;`);
  await db.query(`alter table public.chapter_tests add column if not exists status text default 'published';alter table public.chapter_tests add column if not exists updated_at timestamptz default now();
   alter table public.digital_textbooks add column if not exists updated_at timestamptz default now();
   alter table public.digital_textbook_versions add column if not exists updated_at timestamptz default now();
   alter table public.digital_textbook_chapters add column if not exists updated_at timestamptz default now();
   alter table public.digital_textbook_chapters add column if not exists production_status text;
   create table public.chapter_test_questions(id uuid default gen_random_uuid(),test_id uuid,is_chapter_test_item boolean,question_type text,prompt text,options jsonb,correct_option int,status text,updated_at timestamptz);
   insert into public.chapter_test_questions(test_id,is_chapter_test_item,question_type,prompt,options,correct_option,status) select id,true,'single_choice','隔离发布校验题','["a","b","c","d"]',0,'draft' from public.chapter_tests;
   create schema if not exists private;
   create function auth.uid() returns uuid language sql as $$select ${q(f.student)}::uuid$$;
   create function private.is_platform_owner() returns boolean language sql as $$select exists(select 1 from public.profiles where id=auth.uid() and global_role='platform_owner')$$;`);
  await db.query(await readFile('supabase/migrations/202608180032_platform_owner_publish_textbook_chapter.sql','utf8'));
  await db.query(await readFile('supabase/migrations/202609100005_chapter_publish_semantic_compatibility.sql','utf8'));
  Object.assign(process.env,{RECORDING_EVIDENCE_PROOF_KEY_ID:'admission-isolated',RECORDING_EVIDENCE_PROOF_SECRET_HEX:secret.toString('hex'),
   R2_ACCOUNT_ID:'isolated',R2_ACCESS_KEY_ID:'isolated',R2_SECRET_ACCESS_KEY:'isolated',R2_BUCKET_NAME:'isolated'});
  const overrides={...publishedOverrides,
   '@/lib/r2':'export async function createR2SignedObjectUrl(key){return globalThis.__isolatedBytes.sign(key);} export async function checkR2ObjectExists(){throw Error("No student objects in this test");} export async function createR2SignedUploadUrl(){throw Error("No upload");} export async function deleteR2Object(){throw Error("No delete");}'};
  const objects=new Map();globalThis.__isolatedBytes={sign(key){const token=randomUUID(),type=key.endsWith('.png')?'image/png':'audio/wav';objects.set(token,{type,bytes:type==='audio/wav'?wav():Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')});return `https://isolated.r2.cloudflarestorage.com/${token}`;}};
  globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='isolated.r2.cloudflarestorage.com'){const r=objects.get(url.pathname.slice(1));if(!r)throw Error('Unknown isolated object');return new Response(r.bytes,{headers:{'content-type':r.type}});}if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('NETWORK_OUTSIDE_ISOLATION');return originalFetch(input,init);};
  const admission=await serverModule('src/features/smart-textbook-runtime/server/application-admission.server.ts',overrides);
  const api=await serverModule('src/app/api/smart-textbook-runtime/learning/route.ts',overrides);
  // A single bundled app HTTP module shares the SAME installed teacher/learning
  // presentation owners, as a Next server module graph does.
  const app=await serverModule('src/features/smart-textbook-runtime/server/application-http.server.ts',overrides);
  const call=async(input,headers={})=>api.POST(new Request('https://isolated.invalid/api/smart-textbook-runtime/learning',{method:'POST',headers:{origin:'https://isolated.invalid','content-type':'application/json',...headers},body:JSON.stringify(input)}));
  const enable=()=>db.query(`update runtime_publish_private.admission_control set enabled=true,cohort=${json([{tenantId:f.tenant,studentId:f.student}])}`);
  const page=()=>admission.runtimePageDecision({chapterNumber:1,platformAudit:false});
  await t.test('default off/non-cohort/other chapters/audit use legacy; client flags do not enable',async()=>{
   delete process.env.SMART_TEXTBOOK_RUNTIME_ADMISSION_ENABLED;assert.equal(await page(),'legacy');
   assert.equal((await call({operation:'bootstrap',enabled:true},{'x-runtime-enabled':'true',cookie:'runtime=true'})).status,409);
   process.env.SMART_TEXTBOOK_RUNTIME_ADMISSION_ENABLED='true';assert.equal(await page(),'legacy');await enable();
   const actor=f.auth.user.id;f.auth.user.id=randomUUID();assert.equal(await page(),'legacy','enabled policy excludes non-cohort');f.auth.user.id=actor;
   assert.equal(await admission.runtimePageDecision({chapterNumber:2,platformAudit:false}),'legacy');
   assert.equal(await admission.runtimePageDecision({chapterNumber:1,platformAudit:true}),'legacy');
   assert.equal(await page(),'unavailable','no published pointer');
  });
  const pointer=await f.publisher.publishChapterOne(null);
  await t.test('canonical public Origin survives an internal reverse-proxy request URL without trusting forwarded headers',async()=>{
   const previous=process.env.SMART_TEXTBOOK_RELEASE_ORIGIN;process.env.SMART_TEXTBOOK_RELEASE_ORIGIN='https://public-runtime.invalid';
   try{
    const proxied=(origin,extra={})=>api.POST(new Request('http://127.0.0.1:3000/api/smart-textbook-runtime/learning',{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:'{}'}));
    assert.equal((await proxied('https://public-runtime.invalid')).status,409,'canonical Origin passes HTTP boundary and reaches closed envelope validation');
    assert.equal((await proxied('http://127.0.0.1:3000')).status,403,'internal listener origin is not browser-authorized');
    assert.equal((await proxied('https://public-runtime.invalid',{'x-forwarded-host':'evil.invalid','x-forwarded-proto':'https'})).status,409,'attacker-controlled forwarded headers do not choose the canonical Origin');
    assert.equal((await proxied('https://evil.invalid')).status,403);
   }finally{if(previous===undefined)delete process.env.SMART_TEXTBOOK_RELEASE_ORIGIN;else process.env.SMART_TEXTBOOK_RELEASE_ORIGIN=previous;}
  });
  await t.test('central stop overlapping issue revokes orphan locator; control ACL and invalid policy rejected',async()=>{
   for(const role of ['anon','authenticated','service_role'])assert.notEqual((await db.raw(`set role ${role};update runtime_publish_private.admission_control set enabled=true`)).code,0);
   assert.notEqual((await db.raw(`update runtime_publish_private.admission_control set cohort='[{"tenantId":"bad","studentId":"bad"}]'`)).code,0);
   await db.query(`create function public.isolated_stop_admission() returns trigger language plpgsql as $$begin update runtime_publish_private.admission_control set enabled=false;return new;end$$;
    create trigger isolated_stop_admission after insert on runtime_publish_private.sessions for each row execute function public.isolated_stop_admission();`);
   assert.equal((await call({operation:'bootstrap'})).status,409);
   assert.equal(await db.query('select count(*) from runtime_publish_private.sessions where not revoked'),'0');
   await db.query('drop trigger isolated_stop_admission on runtime_publish_private.sessions;drop function public.isolated_stop_admission()');await enable();
  });
  await t.test('admission prerequisites: key/epoch/cohort/migration/snapshot and LIVE unlocks fail closed',async()=>{
   assert.equal(await page(),'runtime');
   const keys=['RECORDING_EVIDENCE_V2_ENABLED','RECORDING_EVIDENCE_PROOF_SECRET_HEX','R2_BUCKET_NAME'];
   for(const key of keys){const old=process.env[key];delete process.env[key];assert.equal(await page(),'unavailable',key);process.env[key]=old;}
   await db.query("update recording_private.proof_keys set enabled=false where id='admission-isolated'");assert.equal(await page(),'unavailable');await db.query("update recording_private.proof_keys set enabled=true where id='admission-isolated'");
   process.env.RECORDING_EVIDENCE_V2_EPOCH='99';assert.equal(await page(),'unavailable');process.env.RECORDING_EVIDENCE_V2_EPOCH='2';
   await db.query('update public.course_chapters set is_manually_locked=true');assert.equal(await page(),'unavailable');assert.equal((await call({operation:'bootstrap'})).status,409);await db.query('update public.course_chapters set is_manually_locked=false');
   f.auth.profile.membership_tier='normal';assert.equal((await call({operation:'bootstrap'})).status,409);f.auth.profile.membership_tier='vip2';
   await db.query(`alter function public.runtime_recording_dependency_v1(uuid,uuid,bigint,text,text,uuid,bigint,text) rename to isolated_hidden_dependency`);assert.equal(await page(),'unavailable');await db.query(`alter function public.isolated_hidden_dependency(uuid,uuid,bigint,text,text,uuid,bigint,text) rename to runtime_recording_dependency_v1`);
  });
  let first;
  await t.test('actual Route bootstrap; scope is opaque, no Preview backend; stop new admission retains pinned session',async()=>{
   const r=await call({operation:'bootstrap'});assert.equal(r.status,200);first=await r.json();assert.equal(first.manifest.steps.length,8);assert.equal(first.manifest.activityRefs.length,19);assert.equal(first.context.trackingDisabled,false);
   assert.equal(first.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
   await db.query('update runtime_publish_private.admission_control set enabled=false');
   assert.equal(await page(),'legacy');assert.equal((await call({operation:'bootstrap'})).status,409);
   assert.equal((await call({operation:'bootstrap',sessionRef:first.sessionRef})).status,200);
   const u=f.auth.user.id;f.auth.user.id=randomUUID();assert.equal((await call({operation:'bootstrap',sessionRef:first.sessionRef})).status,409);f.auth.user.id=u;
   await enable();
   assert.equal((await call({operation:'bootstrap',sessionRef:'learning-session-'+randomUUID()})).status,409);
   assert.equal((await call({operation:'bootstrap'},{origin:'https://other.invalid'})).status,403);
  });
  await t.test('pointer release changes only new sessions, not existing application bootstrap',async()=>{
   const compiler=await serverModule('src/lib/smart-textbook-legacy-adapter/final-readiness.server.ts');
   globalThis.__releaseB=(...args)=>{const r=compiler.finalizeChapterOneNonUiReadiness(...args);r.manifest.snapshot.compilerVersion+='.4b1b-isolated';return r;};
   const release=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',{...overrides,'../smart-textbook-legacy-adapter/final-readiness.server':'export function finalizeChapterOneNonUiReadiness(...a){return globalThis.__releaseB(...a);}'});
   const next=await release.publishChapterOne(pointer);const restored=await(await call({operation:'bootstrap',sessionRef:first.sessionRef})).json();assert.equal(restored.manifest.snapshot.id,first.manifest.snapshot.id);
   const fresh=await(await call({operation:'bootstrap'})).json();assert.equal(fresh.manifest.snapshot.id,next.snapshotId);assert.notEqual(fresh.manifest.snapshot.id,first.manifest.snapshot.id);
   await db.query(`update runtime_publish_private.sessions set expires_at=clock_timestamp()-interval '1 second' where id=${q(fresh.sessionRef.slice('learning-session-'.length))}`);
   assert.equal((await call({operation:'bootstrap',sessionRef:fresh.sessionRef})).status,409);
  });
  await t.test('real dependency fence: original rejected; NEW VERSION SQL create/edit, other chapter, shared profile/parent/media effects',async()=>{
   const reject=async sql=>assert.match((await db.raw(sql)).stderr,/IMMUTABLE/);
   await reject(`update public.digital_textbook_activities set public_config='{}' where id=${q(source.activities[0].id)}`);
   await reject(`update public.digital_textbook_activity_secrets set answer_key='{}' where activity_id=${q(source.activities[0].id)}`);
   await reject(`update public.learning_agent_script_nodes set teacher_script='{}' where id=${q(source.teachingNodes[0].id)}`);
   await reject(`update public.learning_agent_profiles set display_name='{"zh-CN":"edited"}'`);
   await reject(`update public.digital_textbooks set title='{"zh-CN":"edited"}' where id=${q(source.textbook.id)}`);
   await reject(`update public.digital_textbook_media_assets set production_status='ready' where id=${q(source.media.find(m=>m.production_status==='pending').id)}`);
   const version=randomUUID(),chapter=randomUUID(),module=randomUUID(),node=randomUUID(),activity=randomUUID();
   const clone=async(table,id,changes)=>{await db.query(`insert into public.${table} select (jsonb_populate_record(null::public.${table},to_jsonb(r)||${json(changes)})).* from public.${table} r where id=${q(id)}`);};
   await clone('digital_textbook_versions',source.version.id,{id:version,version_number:99,status:'draft'});
   await clone('digital_textbook_chapters',source.chapter.id,{id:chapter,version_id:version,status:'draft'});
   await clone('digital_textbook_modules',source.modules[0].id,{id:module,chapter_id:chapter});
   await clone('digital_textbook_nodes',source.nodes[0].id,{id:node,module_id:module});
   await clone('digital_textbook_activities',source.activities[0].id,{id:activity,node_id:node});
   await db.query(`update public.digital_textbook_activities set public_config='{"isolated":"editable"}' where id=${q(activity)};insert into public.digital_textbook_activity_secrets(activity_id,answer_key) values(${q(activity)},'{"kind":"index","value":1}');update public.digital_textbook_versions set status='published' where id=${q(version)};`);
   assert.equal(await db.query(`select status from public.digital_textbook_versions where id=${q(version)}`),'published');
   // Source-version status publication is possible in SQL; the certified fixed-ID
   // Manifest compiler must NOT quietly publish this different identity set.
   const capture=await db.query(service(`select public.capture_runtime_publication_v1(${q(f.student)},${json({textbookId:source.textbook.id,versionId:version,chapterId:chapter})})`));
   assert.equal(JSON.parse(capture).digital_textbook_activities[0].id,activity);
   const {projectPublicationCapture}=await serverModule('src/lib/smart-textbook-publishing/capture.server.ts');
   await assert.rejects(async()=>projectPublicationCapture(JSON.parse(capture)));
   // ACTUAL existing chapter publish workflow touches shared test/parent rows.
   // 4B1C corrects the former shared timestamp blocker. This is the REAL old
   // owner RPC, not a substitute published-state UPDATE.
   await db.query(`select public.publish_digital_textbook_chapter(${q(chapter)})`);
   assert.equal(await db.query("select count(*) from public.chapter_test_questions where status='published'"),'1','real chapter publish completed atomically');
   const sibling=randomUUID();await clone('digital_textbook_chapters',source.chapter.id,{id:sibling,chapter_number:2});
   await db.query(`update public.digital_textbook_chapters set title='{"zh-CN":"isolated sibling edited"}' where id=${q(sibling)}`);
   assert.equal(await db.query(`select title->>'zh-CN' from public.digital_textbook_chapters where id=${q(sibling)}`),'isolated sibling edited');
   await db.query(`select public.publish_digital_textbook_chapter(${q(sibling)})`);
  });
  await t.test('4B1C single-version owner editing, request drain, republish and stale-session denial', {timeout:300000},async()=>{
   await verifySingleVersionAuthoring({f,call,overrides});
  });
  await t.test('Chromium mounts ACTUAL PublishedRuntimeEntry via ACTUAL application HTTP, reload and stop', {timeout:300000},async()=>{
   const js=await build({entryPoints:['tests/fixtures/runtime-4b1b-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime4b1b-client',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
   const payloads=[],errors=[];http=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'||req.url==='/style.css'){const ext=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',ext==='.js'?'text/javascript':'text/css');return res.end(js.outputFiles.find(f=>f.path.endsWith(ext)).text);}
    if(req.method==='POST'){const chunks=[];for await(const c of req)chunks.push(c);const request=new Request(`http://127.0.0.1:${http.address().port}${req.url}`,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)});
     const response=await app.runtimeApplicationPost(request,req.url.endsWith('/teacher')?'teacher':'learning');res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));const bytes=Buffer.from(await response.arrayBuffer());if(response.headers.get('content-type')?.startsWith('application/json'))payloads.push(bytes.toString());return res.end(bytes);}
    res.setHeader('content-type','text/html');res.end('<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
   }catch(e){errors.push(e.message);res.statusCode=500;res.end('{}');}});
   await new Promise(r=>http.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(40000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${http.address().port}`);await page.locator('form').first().waitFor();assert.equal(await page.locator('form').count(),3);assert.equal(await page.locator('nav ol button').count(),8);
   if(process.env.UPLY_UI_SCREENSHOTS){
    await (await import('node:fs/promises')).mkdir(process.env.UPLY_UI_SCREENSHOTS,{recursive:true});
    const titles=await page.locator('nav ol button').allTextContents();
    for(const width of [1440,375]){
     await page.setViewportSize({width,height:900});
     for(let i=0;i<titles.length;i++){
      await page.locator('nav ol button').nth(i).click();await page.mouse.move(0,0);
      await page.waitForLoadState('networkidle');
      await page.getByRole('heading',{name:titles[i],exact:true}).waitFor();
      await page.locator('.runtime-content-card').first().waitFor();
      if(i===0)await page.locator('form').first().waitFor();
      else await page.getByRole('group',{name:'子活动',exact:true}).waitFor();
      await page.waitForTimeout(200);
      if(i===0||i===4)await page.waitForFunction(()=>document.querySelector('.runtime-scene-image img')?.naturalWidth>0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.equal(await page.getByText('复杂活动、听说录音及页进度执行尚待完成；本投影仅显示教学内容。',{exact:true}).count(),0);
      await page.screenshot({path:`${process.env.UPLY_UI_SCREENSHOTS}/${width}-step-${i+1}.png`,fullPage:true});
     }
    }
    await page.setViewportSize({width:1440,height:900});await page.locator('nav ol button').first().click();await page.locator('form').first().waitFor();
   }
   await page.getByText('修订后的见面问候检查', {exact:true}).waitFor();
   const form=page.locator('form').filter({hasText:'修订后的见面问候检查'});await form.locator('input').nth(1).check();
   const submission=page.waitForResponse(r=>r.url().endsWith('/learning')&&r.request().postDataJSON()?.payload?.request?.op==='native-submit');
   await form.getByRole('button',{name:'提交答案'}).click();
   const graded=await submission;assert.equal(graded.status(),200);assert.equal((await graded.json()).correct,true,'actual revised answer is graded by the server');
   const teaching=page.getByRole('region',{name:'金老师讲解',exact:true});await teaching.getByRole('button',{name:'开始讲解'}).click();
   await page.waitForFunction(()=>['feedback','awaiting-task','awaiting-answer'].includes(document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')));
   assert((await teaching.locator('.runtime-teacher-caption').innerText()).length>0);
   const original=await page.evaluate(()=>sessionStorage.getItem('uply-published-chapter-one-session'));
   await page.reload();await page.locator('nav').waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('uply-published-chapter-one-session')),original);
   assert.equal(await page.getByRole('link',{name:'返回课程'}).getAttribute('href'),'/student/dashboard/courses/korean?course=korean-level-one');
   page.once('dialog',dialog=>dialog.accept());
   await page.getByLabel('语言',{exact:true}).selectOption('ko-KR');
   await page.getByRole('link',{name:'강좌로 돌아가기'}).waitFor();
   assert.notEqual(await page.evaluate(()=>sessionStorage.getItem('uply-published-chapter-one-session')),original);
   assert.equal((await call({operation:'bootstrap',sessionRef:original})).status,409,'language change revokes the old durable session');
   await db.query('update runtime_publish_private.admission_control set enabled=false');await page.reload();await page.locator('nav').waitFor();
   const fresh=await browser.newPage();await fresh.goto(`http://127.0.0.1:${http.address().port}`);await fresh.getByRole('alert').waitFor();
   assert.deepEqual(errors,[]);assert(!payloads.some(p=>/answer_key|objectKey|object_key|secret|proof|tenantId|studentId/.test(p)));
  });
 }catch(e){throw Error(e.message.slice(0,2500));}finally{
  await browser?.close();if(http)await new Promise(r=>http.close(r));globalThis.fetch=originalFetch;delete globalThis.__isolatedBytes;delete globalThis.__releaseB;await f?.dispose();
  for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);
 }
});

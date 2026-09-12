import test from 'node:test';
import assert from 'node:assert/strict';
import {source,evidence,compiled,manifest} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {publishedChapterFixture,publishedOverrides} from './fixtures/published-chapter-one.mjs';
import {literal as q,json,processResult} from './fixtures/recording-v2-postgres.mjs';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {wav} from './fixtures/teacher-boundary-4a14.mjs';
import {writeFile} from 'node:fs/promises';
const media=await serverModule('src/lib/smart-textbook-publishing/media-policy.server.ts');
const artifacts=await serverModule('src/lib/smart-textbook-publishing/artifact.server.ts');
const {validateLessonManifestV1}=await import('../src/lib/smart-textbook-runtime-v1/validator.ts');
const {digest}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');

test('PF-1 all 75 actual refs: 12 required ready, 35 existing TTS, 28 unused reservations; no identity/readiness edits',()=>{
  const rows=media.mediaPublicationAudit(source,compiled),updated=media.withMediaPublicationPolicy(source,compiled);
  assert.equal(rows.length,75);assert.equal(rows.filter(r=>r.rule==='required-ready').length,12);
  assert.equal(rows.filter(r=>r.rule==='existing-browser-tts').length,35);assert.equal(rows.filter(r=>r.rule==='unused-reservation').length,28);
  assert.deepEqual(updated.manifest.mediaRefs.map(({admission,...r})=>r),manifest.mediaRefs);
  assert.deepEqual(updated.manifest.runtimeTargets,manifest.runtimeTargets);assert.deepEqual(updated.manifest.steps,manifest.steps);
  const {snapshot:oldSnapshot,...oldSemantic}=manifest,{snapshot:newSnapshot,...newSemantic}=updated.manifest;
  assert.deepEqual({...newSemantic,mediaRefs:newSemantic.mediaRefs.map(({admission,...r})=>r)},oldSemantic);
  const bundle=artifacts.packageSnapshot(source,evidence,updated);assert.equal(artifacts.assertPublishableSnapshot(bundle).manifest.mediaRefs.length,75);
  assert.notEqual(bundle.manifestDigest,manifest.snapshot.contentDigest);assert.notEqual(bundle.snapshotId,manifest.snapshot.id);
  assert.deepEqual(media.withMediaPublicationPolicy(source,compiled),updated);
});
test('PF-1 unknown/edit/rejected/unqualified media still block; public exceptions are not native playback rights',()=>{
  for(const mutate of [s=>s.media[0].metadata.script='changed',s=>s.media.pop(),s=>s.nodes[0].content.lead={'zh-CN':'changed'}]){
    const s=structuredClone(source);mutate(s);assert.throws(()=>media.withMediaPublicationPolicy(s,compiled));
  }
  const m=media.withMediaPublicationPolicy(source,compiled).manifest,pending=m.mediaRefs.find(r=>r.admission);
  pending.readiness='rejected';assert.equal(validateLessonManifestV1(m).success,false);
  pending.readiness='pending';pending.admission.rule='wildcard';assert.equal(validateLessonManifestV1(m).success,false);
  const partial=media.withMediaPublicationPolicy(source,compiled).manifest;delete partial.mediaRefs.find(r=>r.admission).admission;
  assert.equal(validateLessonManifestV1(partial).success,false);
  const forged=media.withMediaPublicationPolicy(source,compiled);forged.manifest.mediaRefs.find(r=>r.admission).admission.evidenceDigest='0'.repeat(64);
  assert.throws(()=>artifacts.packageSnapshot(source,evidence,forged));
  assert.throws(()=>artifacts.assertPublishableSnapshot(artifacts.packageSnapshot(source,evidence,compiled)),/ADMISSION/);
});

test('PF-2/PF-3 actual publisher, fenced PostgreSQL, actual published Loader and durable session',{timeout:300000},async t=>{
  let f;try{
    f=await publishedChapterFixture();const {db,publisher,loader,boundary}=f;
    const {publicationRepository}=await serverModule('src/lib/smart-textbook-publishing/repository.server.ts');
    const repo=publicationRepository(f.admin),before=await publisher.compileChapterOnePublication();
    const activity=source.activities.find(a=>a.activity_key==='orientation-greeting')??source.activities.find(a=>a.node_id===source.nodes.find(n=>n.content.dialogueGroups)?.id);
    await t.test('consistent capture covers 19 grader secrets and all v23 teaching dependencies; concurrent authoring invalidates stale compile',async()=>{
      assert.equal(before.privatePayload.dependencies.digital_textbook_activity_secrets.length,19);
      assert.equal(before.privatePayload.dependencies.learning_agent_script_nodes.length,8);
      assert.equal(before.privatePayload.dependencies.learning_agent_script_audio_assets.length,44);
      const editing=db.raw(`begin;update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":1}' where activity_id=${q(activity.id)};select pg_sleep(.8);commit;`);
      let observed=false;for(let i=0;i<40;i++)if(await db.query("select count(*) from pg_locks where locktype='advisory' and classid=4171 and objid=2 and granted")!=='0'){observed=true;break;}
      assert(observed,'writer holds the real transaction fence while publisher arrives');
      await assert.rejects(repo.publish(f.student,before,null),/SOURCE_CAPTURE_CONFLICT/);
      assert.equal((await editing).code,0);
      assert.equal(await db.query('select count(*) from runtime_publish_private.snapshots'),'0');
      await db.query(`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":0}' where activity_id=${q(activity.id)}`);
    });
    let pointer;
    await t.test('writer already waiting during publication observes the NEW fence after commit, not its old MVCC view',async()=>{
      await db.query(`create function public.isolated_pause_publication() returns trigger language plpgsql as $$begin perform pg_sleep(.8);return new;end$$;create trigger pause_publication before insert on runtime_publish_private.snapshots for each row execute function public.isolated_pause_publication();`);
      const publishing=publisher.publishChapterOne(null);
      let observed=false;for(let i=0;i<80;i++)if(await db.query("select count(*) from pg_locks where locktype='advisory' and classid=4171 and objid=2 and granted")!=='0'){observed=true;break;}
      assert(observed,'real publisher holds the transaction fence');
      const editing=db.raw(`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":1}' where activity_id=${q(activity.id)}`);
      pointer=await publishing;assert.match((await editing).stderr,/IMMUTABLE/);
    });
    const loaded=await loader.loadPublishedRuntimeSnapshot();
    const session=await boundary.issue(),scope={sessionRef:session.sessionRef},resolved=await f.session.createRuntimeLearningSessionResolver().resolve(scope);
    await t.test('positive formal publisher → immutable store → published Loader → opaque durable resolver',async()=>{
      assert.equal(loaded.bundle.snapshotId,pointer.snapshotId);assert.equal(resolved.snapshotId,pointer.snapshotId);
      assert.equal(resolved.manifest.steps.length,8);assert.equal(resolved.manifest.activityRefs.length,19);
      assert.equal(resolved.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
      assert.equal(resolved.publishedData.source.teachingVersions[0].version_number,23);
      assert.deepEqual(resolved.publishedData.source.teachingNodes,artifacts.normalizedSource(source).teachingNodes);
      assert.equal(digest(resolved.publishedData.source),digest(artifacts.normalizedSource(source)),'complete captured source equals frozen Chapter 1, including all eight lesson records');
      await writeFile('/tmp/uply-publication-closure.json',JSON.stringify({oldDigest:manifest.snapshot.contentDigest,newDigest:loaded.bundle.manifestDigest,sourceRevision:loaded.bundle.sourceRevision,steps:resolved.manifest.steps.length,activities:resolved.manifest.activityRefs.length,media:media.mediaPublicationAudit(resolved.publishedData.source,resolved.publishedData.result)},null,2));
      assert.equal(await db.query('select count(*) from runtime_publish_private.dependency_fences'),'1');
      assert(!JSON.stringify(resolved.manifest).match(/answer_key|object_key|service_role|system_prompt|privatePayload/));
    });
    await t.test('published edits/inserted children/Teacher changes roll back; current permissions are NOT frozen',async()=>{
      const changes=[`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":1}' where activity_id=${q(activity.id)}`,
        `update public.digital_textbook_activities set public_config='{}' where id=${q(activity.id)}`,
        `update public.digital_textbook_nodes set content='{}' where id=${q(activity.node_id)}`,
        `update public.learning_agent_script_nodes set teacher_script='{"zh-CN":"changed"}' where id=${q(source.teachingNodes[0].id)}`,
        `insert into public.digital_textbook_activities(id,node_id,activity_type) values(gen_random_uuid(),${q(activity.node_id)},'single_choice')`];
      for(const sql of changes){const r=await db.raw(sql);assert.notEqual(r.code,0);assert.match(r.stderr,/IMMUTABLE/);}
      const draft=await publisher.newPublicationDraft(loaded.bundle);draft.source.chapter.title['zh-CN']='detached draft';
      assert.notEqual((await loader.loadPublishedRuntimeSnapshot()).bundle.manifest.chapter.title['zh-CN'],draft.source.chapter.title['zh-CN']);
      f.auth.profile.global_role='organization_owner';await assert.rejects(publisher.publishChapterOne(pointer),/OWNER_ONLY/);f.auth.profile.global_role='platform_owner';
      const originalTenant=f.auth.tenant;f.auth.tenant=null;await assert.rejects(loader.loadPublishedRuntimeSnapshot(),/FORBIDDEN/);f.auth.tenant=originalTenant;
      const old=f.auth.user.id;f.auth.user.id='00000000-0000-4000-8000-000000000099';await assert.rejects(f.session.createRuntimeLearningSessionResolver().resolve(scope));f.auth.user.id=old;
    });
    await t.test('real grader/attempt SQL concurrent with answer edit cannot write using edited answers',async()=>{
      const catalog=await boundary.catalog(scope),mount=await boundary.resume(scope);
      const block=resolved.manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===mount.activeStepId);
      const native=resolved.manifest.blocks.filter(b=>b.type==='multiple_choice');
      await db.query(`create function public.isolated_pause_attempt() returns trigger language plpgsql as $$begin perform pg_sleep(.15);return new;end$$;create trigger pause_attempt before insert on public.digital_textbook_attempts for each row execute function public.isolated_pause_attempt();`);
      for(const b of native){const a=resolved.manifest.activityRefs.find(a=>a.id===b.props.activityRef);
        const request={...scope,generation:mount.generation,target:block.runtimeTarget,request:{op:'native-submit',activity:catalog.find(c=>c.runtimeRef===a.id).serviceRef,response:a.publicPresentation.options[0].id}};
        const [result,edit]=await Promise.all([boundary.dispatch(request,new AbortController().signal),db.raw(`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":1}' where activity_id=${q(a.activityId)}`)]);
        assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.correct,true);assert.equal(result.preview,false);assert.notEqual(edit.code,0);
      }
      assert.equal(await db.query('select count(*) from public.digital_textbook_attempts'),'3');
      assert.equal(await db.query('select count(*) from public.digital_textbook_attempts where is_correct'),'3');
    });
    await t.test('real publisher release A → release B → rollback A; CAS and old-session fence',async()=>{
      // Simulate a second SERVER COMPILER RELEASE, not edited teacher content,
      // injected storage, a fake compiler result, or a test-specific Loader.
      // The complete real finalizer runs; only build provenance differs.
      const compiler=await serverModule('src/lib/smart-textbook-legacy-adapter/final-readiness.server.ts');
      globalThis.__publicationCompilerRelease2=(...args)=>{const r=compiler.finalizeChapterOneNonUiReadiness(...args);r.manifest.snapshot.compilerVersion+='.isolated-release2';return r;};
      const releaseB=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',{...publishedOverrides,
        '../smart-textbook-legacy-adapter/final-readiness.server':'export function finalizeChapterOneNonUiReadiness(...args){return globalThis.__publicationCompilerRelease2(...args);}'});
      const races=await Promise.allSettled([releaseB.publishChapterOne(pointer),releaseB.publishChapterOne(pointer)]);
      assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
      const current=(await loader.loadPublishedRuntimeSnapshot()).pointer;
      assert.notEqual(current.snapshotId,pointer.snapshotId);
      assert.equal((await f.session.createRuntimeLearningSessionResolver().resolve(scope)).snapshotId,pointer.snapshotId);
      const rollback=await publisher.rollbackPublication(loaded.bundle.scope,pointer.snapshotId,current);
      assert.equal(rollback.generation,3);await assert.rejects(publisher.publishChapterOne(pointer),/CONFLICT/);
      assert.equal((await f.session.createRuntimeLearningSessionResolver().resolve(scope)).snapshotId,pointer.snapshotId);
      assert.equal(await db.query('select count(*) from runtime_publish_private.snapshots'),'2');
      assert.equal(await db.query('select count(*) from runtime_publish_private.dependency_fences'),'2');
      delete globalThis.__publicationCompilerRelease2;
    });
    await t.test('SQL authoring isolation, ACL and row set fence reject bypasses',async()=>{
      const bad=await db.raw(`begin isolation level repeatable read;update public.digital_textbook_activity_secrets set answer_key=answer_key;commit;`);assert.match(bad.stderr,/ISOLATION_REQUIRED/);
      for(const role of ['anon','authenticated'])assert.notEqual((await db.raw(`set role ${role};select public.capture_runtime_publication_v1(${q(f.student)},${json(loaded.bundle.scope)})`)).code,0);
      assert.notEqual((await db.raw('set role service_role;delete from runtime_publish_private.dependency_fences')).code,0);
      assert.match((await db.raw('truncate public.digital_textbook_media_assets')).stderr,/TRUNCATE_FORBIDDEN/);
      assert.notEqual((await db.raw(`set role service_role;select public.publish_runtime_snapshot_v1(${q(f.student)},'{}',null,'publish',null,null)`)).code,0);
    });
    await t.test('different OS process restores same durable session through REAL resolver and rechecks fence',async()=>{
      const script=`import {serverModule} from './tests/fixtures/runtime-4a2.server.mjs';import {recordingSqlTransport} from './tests/fixtures/recording-4a7-transport.mjs';import {processResult} from './tests/fixtures/recording-v2-postgres.mjs';
      const db={raw:sql=>processResult('docker',['exec','-i',${JSON.stringify(db.id)},'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],sql)};
      const rpc=recordingSqlTransport({raw:sql=>db.raw(sql.replace('select public."assert_runtime_dependency_fence_v1"(', 'select to_jsonb(public."assert_runtime_dependency_fence_v1"(').replace(/(select to_jsonb\\(public\\."assert_runtime_dependency_fence_v1"[\\s\\S]*)\\);$/, '$1));'))},()=>{throw Error('no storage')});
      const admin={rpc:rpc.rpc,from(t){if(!['digital_textbook_chapters','digital_textbook_versions'].includes(t))throw Error('read table');let filters=[];return {select(){return this},eq(k,v){if(!/^[a-z_]+$/.test(k)||!/^[a-f0-9-]+$/.test(v))throw Error('filter');filters.push(k+"='"+v+"'");return this},async maybeSingle(){const r=await db.raw('select to_jsonb(r) from public.'+t+' r where '+filters.join(' and '));return {data:JSON.parse(r.stdout),error:null}}}}};
      globalThis.__publishedChapter={admin,auth:{user:{id:${JSON.stringify(f.student)}},tenant:{id:${JSON.stringify(f.tenant)}},profile:{role:'student',membership_tier:'vip2'},supabase:admin}};
      try{const m=await serverModule('src/features/smart-textbook-runtime/server/learning-session.server.ts',${JSON.stringify(publishedOverrides)});const a=await m.createRuntimeLearningSessionResolver().resolve(${JSON.stringify(scope)});console.log(JSON.stringify({snapshot:a.snapshotId,steps:a.manifest.steps.length}));}catch(e){console.error(e.message);process.exitCode=1;}`;
      const child=await processResult('node',['--no-warnings','--experimental-strip-types','--input-type=module','-e',script]);assert.equal(child.code,0,child.stderr.slice(-1000));assert.deepEqual(JSON.parse(child.stdout),{snapshot:pointer.snapshotId,steps:8});
    });
    await t.test('strict COMPLETE Chromium: published Loader → durable session → actual domain ports → same LessonRuntime', {timeout:180000},async()=>{
      const {createTeacherRuntimeBoundary}=await serverModule('src/features/smart-textbook-runtime/server/teacher-boundary.server.ts');
      const {productionTeacherBackend}=await serverModule('src/features/smart-textbook-runtime/server/production-teacher-backend.server.ts',publishedOverrides);
      const teacher=createTeacherRuntimeBoundary({authorize:async()=>({actorId:f.student,tenantId:f.tenant,role:'learner'}),
        resolveScope:boundary.teacher.resolveScope,createBackend:productionTeacherBackend({scope:boundary.teacher.domainScope,request:()=>new Request('https://publication-isolated.invalid/teacher')}),
        readSpeech:async()=>new Blob([wav()],{type:'audio/wav'}),
        readCharacter:async()=>new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')],{type:'image/png'})});
      const js=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/publish-complete',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
      const errors=[],payloads=[];let browser;
      const server=createServer(async(req,res)=>{try{
        const send=value=>{res.setHeader('content-type','application/json');const body=JSON.stringify(value??null);payloads.push(body);res.end(body);};
        if(req.url==='/bundle.js'||req.url==='/style.css'){const ext=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',ext==='.js'?'text/javascript':'text/css');return res.end(js.outputFiles.find(f=>f.path.endsWith(ext)).text);}
        if(req.url==='/data'){
          // Actual published Loader on every full page load, never fixture data.
          const current=await loader.loadPublishedRuntimeSnapshot(),mount=await boundary.resume(scope);
          const block=current.bundle.manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===mount.activeStepId);
          const state=await boundary.dispatch({...scope,generation:mount.generation,target:block.runtimeTarget,request:{op:'refresh'}},new AbortController().signal);
          return send({manifest:current.bundle.manifest,context:{runtimeSessionId:session.sessionRef,snapshotId:current.bundle.snapshotId,sourceState:'published',trackingDisabled:false,locale:'zh-CN',supportMode:'bilingual'},state,learningSession:session.sessionRef,teacherBoundary:true});
        }
        if(req.method==='POST'){
          const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks));
          if(req.url==='/teacher-witness')return send({ok:true});
          const result=req.url.endsWith('/teacher')?await teacher.dispatch(input):input.operation==='catalog'?await boundary.catalog({sessionRef:input.sessionRef}):input.operation==='resume'?await boundary.resume({sessionRef:input.sessionRef}):input.operation==='enter'?await boundary.enter(input.payload):await boundary.dispatch(input.payload,new AbortController().signal);
          if(result instanceof Blob){res.setHeader('content-type',result.type);return res.end(Buffer.from(await result.arrayBuffer()));}return send(result);
        }
        res.setHeader('content-type','text/html; charset=utf-8');res.end('<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
      }catch(e){errors.push(e.message);res.statusCode=409;res.end('{}');}});
      try{
        await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(30000);
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>{window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};let timer;Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak(u){timer=setTimeout(()=>u.onend?.(),25);},cancel(){clearTimeout(timer);},pause(){clearTimeout(timer);},resume(){}}});});
        await page.goto(`http://127.0.0.1:${server.address().port}/?mode=strict`);
        await page.locator('nav').waitFor();await page.locator('form').first().waitFor();assert.equal(await page.locator('nav').count(),1);assert.equal(await page.locator('form').count(),3);
        await page.locator('form input:checked').first().waitFor();assert.equal(await page.locator('form input:checked').count(),3);
        const teaching=page.getByRole('region',{name:'金老师讲解',exact:true});await teaching.getByRole('button',{name:'开始讲解'}).click();
        await page.waitForFunction(()=>['feedback','awaiting-task','awaiting-answer'].includes(document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')));
        assert((await teaching.locator('.runtime-teacher-caption').innerText()).length>0);
        for(const step of resolved.manifest.steps){
          const button=page.locator('nav button').filter({hasText:step.title['zh-CN']});await button.click();
          const learning=resolved.manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===step.id);
          await page.locator(`[data-runtime-target="${learning.runtimeTarget}"]`).waitFor();
          await page.waitForLoadState('networkidle');
        }
        await page.reload();await page.locator('nav').waitFor();assert.equal(await page.locator('nav').count(),1);
        assert.deepEqual(errors,[]);
        assert(!payloads.some(p=>/answer_key|object_key|objectKey|signedUrl|service_role|system_prompt|privatePayload/.test(p)));
      }catch(e){throw Error(e.message.slice(0,500)+'; transport: '+JSON.stringify(errors).slice(0,2500));}
      finally{await browser?.close();await new Promise(r=>server.close(r));}
    });
  }catch(e){throw Error(e.message?.slice(0,2500),{cause:undefined});}finally{await f?.dispose();}
});

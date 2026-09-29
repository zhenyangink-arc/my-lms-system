import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { publishedChapterFixture,publishedOverrides } from './fixtures/published-chapter-one.mjs';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';
import { literal as q,json } from './fixtures/recording-v2-postgres.mjs';

test('saved source preview uses formal compiler, real owner boundary and unchanged publication admission',{timeout:300000},async t=>{
  let f,browser,server;
  try{
    f=await publishedChapterFixture();
    await f.db.query(await readFile('supabase/migrations/202609130001_textbook_grammar_authoring.sql','utf8'));
    const overrides={...publishedOverrides};
    const owner=`export async function requirePlatformOwner(){const a=globalThis.__publishedChapter.auth;if(a.profile?.global_role!=='platform_owner')throw Error('FORBIDDEN');return a;} export function isPlatformCourseAuditorRole(r){return r==='platform_owner';}`;
    for(const p of ['../../../lib/admin','@/lib/admin'])overrides[p]=owner;
    const api=await serverModule('tests/fixtures/authoring-preview.server.ts',overrides),call=api.chapterWorkbenchOperation;
    const original=await api.readAuditSource();
    const oldSession=api.createRecordingAuditContinuation(f.auth.user.id,original);
    const check=await call({operation:'check'});assert(check.ok);
    assert.equal((await call({operation:'publish',expected:check.check.expected,digest:check.check.digest})).ok,true);
    const publishedBefore=await f.loader.loadPublishedRuntimeSnapshot();
    const beforeCounts=await f.db.query('select (select count(*) from digital_textbook_attempts),(select count(*) from digital_textbook_speaking_evidence)');
    assert.equal((await call({operation:'begin'})).ok,true);
    const read=await call({operation:'read'});assert(read.ok);
    const grammar=read.data.steps.flatMap(s=>s.nodes.flatMap(n=>n.grammarCards??[]))[0];
    const changed='预览与发布一致的语法形式';
    const patch={form:changed,function:grammar.card.function,caution:grammar.card.caution,source:grammar.card.source};
    assert.equal((await call({operation:'save-grammar',cardId:grammar.cardId,expected:grammar.expected,patch})).ok,true);
    let preview=await api.readAuditSource(),bundle=await api.compileChapterOnePublication();
    await t.test('saved grammar rebind is identical in preview and publisher; no publish/attempt side effects',async()=>{
      assert.deepEqual(preview.result.manifest,bundle.manifest);
      assert.deepEqual(preview.result.bindings,bundle.privatePayload.result.bindings);
      assert.equal(preview.result.manifest.steps.length,8);assert.equal(preview.result.manifest.activityRefs.length,19);
      assert.equal(preview.result.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
      assert.equal(preview.source.teachingVersions[0].version_number,23);
      assert.equal((await call({operation:'read'})).data.pointer.snapshotId,publishedBefore.bundle.snapshotId);
      assert.throws(()=>api.createRecordingAuditContinuation(f.auth.user.id,preview,oldSession),/REVISION/);
      assert.equal(await f.db.query('select (select count(*) from digital_textbook_attempts),(select count(*) from digital_textbook_speaking_evidence)'),beforeCounts);
    });
    let session=api.createRecordingAuditContinuation(f.auth.user.id,preview);
    let workbench=(await call({operation:'read'})).data;
    const js=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{AuditRuntimeClient}from'./src/features/smart-textbook-runtime/components/audit-client';import{ChapterWorkbench}from'./src/features/digital-textbook/workbench/chapter-workbench';const root=createRoot(document.getElementById('root'));fetch('/data').then(r=>r.json()).then(p=>root.render(location.pathname==='/workbench'?<ChapterWorkbench initial={p.workbench} contentHref='/content' scriptsHref='/scripts' previewHref='/preview'/>:<AuditRuntimeClient manifest={p.manifest} context={p.context} state={p.state}/>));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/tmp/authoring-preview-browser',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'action-transport',setup(b){b.onResolve({filter:/^\.\/actions$/},a=>a.importer.includes('workbench')?{path:'action',namespace:'isolated'}:undefined);b.onLoad({filter:/.*/,namespace:'isolated'},()=>({contents:`export async function chapterWorkbenchAction(input){return fetch('/operation',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json());}`}));}}]});
    const styles=(await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:process.cwd()+'/src/app/globals.css'})).css;
    const errors=[],payloads=[];
    server=createServer(async(req,res)=>{try{
      const send=x=>{payloads.push(JSON.stringify(x));res.setHeader('content-type','application/json');res.end(JSON.stringify(x));};
      if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(js.outputFiles.find(f=>f.path.endsWith('.js')).text);return;}
      if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(styles+js.outputFiles.find(f=>f.path.endsWith('.css')).text);return;}
      if(req.url==='/data')return send({workbench,manifest:preview.result.manifest,context:{runtimeSessionId:session,snapshotId:preview.result.manifest.snapshot.id,sourceState:'draft',trackingDisabled:true,locale:'zh-CN',supportMode:'bilingual'},state:{snapshotId:preview.result.manifest.snapshot.id,revision:preview.result.report.sourceRevision,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]}});
      if(req.method==='POST'){
        let raw='';for await(const c of req)raw+=c;const input=JSON.parse(raw);
        if(req.url==='/operation')return send(await call(input));
        const request=new Request(`http://127.0.0.1${req.url}`,{method:'POST'});
        const value=req.url.endsWith('/teacher')?await api.auditTeacherBoundary(request,input):await api.auditLearningBoundary(request,input);
        if(value instanceof Blob){res.setHeader('content-type',value.type);res.end(Buffer.from(await value.arrayBuffer()));return;}
        return send(value);
      }
      res.setHeader('content-type','text/html;charset=utf-8');res.end('<html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main class="p-4" data-dashboard-ui="management" data-management-workspace="platform"><div id="root"></div></main><script type="module" src="/bundle.js"></script></body></html>');
    }catch(e){errors.push(e.message);res.statusCode=409;res.end('{}');}});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    await t.test('Chromium strict complete AuditRuntimeClient loads saved grammar through real audit services; reload',async()=>{
      await page.goto(`${url}/preview`);
      await page.waitForTimeout(500);assert.deepEqual(errors,[],'browser bootstrap errors');
      await page.getByRole('button',{name:'主题助词与判断句',exact:true}).click();
      await page.getByText(changed,{exact:true}).first().waitFor();
      assert.equal(await page.locator('nav').count(),1);
      await page.reload();
      await page.getByText(changed,{exact:true}).first().waitFor();
      assert.deepEqual(errors,[]);
    });
    await t.test('owner enforcement on preview and issue disclosure; private errors never echo',async()=>{
      for(const role of ['student','organization_owner','teacher']){
        f.auth.profile.global_role=role;
        await assert.rejects(api.readAuditSource(),/OWNER_ONLY/);
        const r=await call({operation:'check'});assert.equal(r.ok,false);assert.equal(r.diagnostics,undefined);
      }
      f.auth.profile.global_role='platform_owner';
      assert.deepEqual(api.publicationDiagnostics(new Error('secret object_key service_role private transcript')),[]);
      const hostile=api.compilationDiagnostics(preview.source,[{source:{path:'content.secret.object_key',nodeId:'private'},result:'unsupported',reason:'private transcript'}]);
      assert.doesNotMatch(JSON.stringify(hostile),/secret|object_key|private transcript/);
    });
    await t.test('unsupported vocabulary edit: check and preview both reject, Chromium focuses actionable step diagnostic',async()=>{
      const node=preview.source.nodes.find(n=>n.content.vocabulary);
      const content=structuredClone(node.content);content.vocabulary[0].zh+='（隔离修改）';
      await f.db.query(`update digital_textbook_nodes set content=${json(content)} where id=${q(node.id)}`);
      const r=await call({operation:'check'});assert.equal(r.ok,false);
      assert(r.diagnostics.some(d=>d.code==='identity'&&d.stepId===node.module_id));
      await assert.rejects(api.readAuditSource(),/PUBLICATION_DIAGNOSTIC/);
      await page.goto(`${url}/workbench`);await page.getByRole('button',{name:'校验发布',exact:true}).click();
      await page.getByRole('button',{name:'校验待发布内容',exact:true}).click();
      const summary=page.getByRole('alert',{name:'需要处理的内容'});await summary.waitFor();
      assert(await summary.evaluate(e=>e===document.activeElement));
      await mkdir('/tmp/uply-authoring-preview-evidence',{recursive:true});
      for(const width of [1440,375]){
        await page.setViewportSize({width,height:950});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'diagnostics fit narrow viewport');
        await page.screenshot({path:`/tmp/uply-authoring-preview-evidence/diagnostics-${width}.png`,fullPage:true});
      }
      await summary.getByRole('button',{name:'定位学习步骤'}).first().click();
      assert.equal(await page.getByRole('navigation',{name:'章节学习步骤'}).getByRole('button',{name:/问候与人物身份/}).getAttribute('aria-current'),'step');
      assert.doesNotMatch(JSON.stringify(r),/object_key|answer_key|service_role/);
      await f.db.query(`update digital_textbook_nodes set content=${json(node.content)} where id=${q(node.id)}`);
    });
    await t.test('changed media and later script version remain blocked in BOTH paths',async()=>{
      const media=preview.source.media[0];
      await f.db.query(`update digital_textbook_media_assets set alt_text=${json({'zh-CN':'隔离修改'})} where id=${q(media.id)}`);
      let r=await call({operation:'check'});assert.equal(r.ok,false);assert(r.diagnostics?.length);
      await assert.rejects(api.readAuditSource());
      await f.db.query(`update digital_textbook_media_assets set alt_text=${json(media.alt_text)} where id=${q(media.id)}`);
      const version=preview.source.teachingVersions[0];
      await f.db.query(`update learning_agent_script_versions set version_number=24 where id=${q(version.id)}`);
      r=await call({operation:'check'});assert.equal(r.ok,false);assert(r.diagnostics.some(d=>d.code==='teaching'));
      await assert.rejects(api.readAuditSource(),/PUBLICATION_DIAGNOSTIC/);
      await f.db.query(`update learning_agent_script_versions set version_number=23 where id=${q(version.id)}`);
    });
    await t.test('republish uses same checked preview digest; student Loader gets saved grammar, preview never writes learning records',async()=>{
      const r=await call({operation:'check'});assert(r.ok);assert.equal(r.check.digest,bundle.manifestDigest);
      const published=await call({operation:'publish',expected:r.check.expected,digest:r.check.digest});assert(published.ok);
      const loaded=await f.loader.loadPublishedRuntimeSnapshot();assert.equal(loaded.bundle.manifestDigest,bundle.manifestDigest);
      assert.equal(await f.db.query('select (select count(*) from digital_textbook_attempts),(select count(*) from digital_textbook_speaking_evidence)'),beforeCounts);
      assert.doesNotMatch(payloads.join('\n'),/object_key|objectKey|answer_key|service_role|privatePayload|proof_keys/);
    });
    await mkdir('/tmp/uply-authoring-preview-evidence',{recursive:true});
    await page.screenshot({path:'/tmp/uply-authoring-preview-evidence/diagnostics.png',fullPage:true});
  }finally{
    await browser?.close();if(server)await new Promise(r=>server.close(r));await f?.dispose();
  }
});

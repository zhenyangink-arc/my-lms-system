import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { publishedChapterFixture, publishedOverrides } from './fixtures/published-chapter-one.mjs';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';

test('chapter workbench: authorized real DB edit/check/publish, Chromium author workflow', {timeout:300000}, async t=>{
  let f, browser, http;
  try {
    f=await publishedChapterFixture();
    await f.db.query(await readFile('supabase/migrations/202609130001_textbook_grammar_authoring.sql','utf8'));
    const api=await serverModule('src/features/digital-textbook/workbench/service.server.ts',publishedOverrides);
    const call=api.chapterWorkbenchOperation;
    let read=await call({operation:'read'});
    assert.equal(read.ok,true,JSON.stringify(read));
    assert.equal(read.data.steps.length,8);
    assert.equal(read.data.steps[0].title,'初次见面交流目标');
    const activities=read.data.steps.flatMap(s=>s.nodes.flatMap(n=>n.activities));
    assert.equal(activities.length,19);
    assert.equal(read.data.steps[0].nodes.flatMap(n=>n.activities).length,3);
    const a=activities.find(a=>a.key==='orientation-check');assert(a.editable);
    assert(!/object_key|objectKey|configuration|answer_key|service_role/.test(JSON.stringify(read)));

    await t.test('owner is reauthorized for every read and mutation; strict input and locked save',async()=>{
      for(const role of ['student','tenant_super_admin','organization_owner','teacher']){
        f.auth.profile.global_role=role;
        for(const operation of ['read','begin','check','publish','save'])assert.equal((await call({operation})).ok,false);
      }
      f.auth.profile.global_role='platform_owner';
      assert.equal((await call({operation:'read',tenantId:'injected'})).ok,false);
      assert.equal((await call({operation:'save',activityId:a.id,prompt:a.prompt,koreanPrompt:a.koreanPrompt,answerIndex:0})).ok,false);
    });
    const initialCheck=await call({operation:'check'});assert(initialCheck.ok,JSON.stringify(initialCheck));
    const first=await call({operation:'publish',expected:initialCheck.check.expected,digest:initialCheck.check.digest});assert(first.ok,JSON.stringify(first));
    const before=await f.loader.loadPublishedRuntimeSnapshot();
    read=await call({operation:'read'});

    const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ChapterWorkbench}from'./src/features/digital-textbook/workbench/chapter-workbench';createRoot(document.getElementById('root')).render(<ChapterWorkbench initial={window.initial} contentHref='/content' previewHref='/preview' scriptsHref='/scripts'/>);`,resolveDir:process.cwd(),loader:'tsx'},
      bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'isolated-action-transport',setup(b){
        b.onResolve({filter:/^\.\/actions$/},args=>args.importer.includes('workbench')?{path:'action',namespace:'isolated'}:undefined);
        b.onLoad({filter:/.*/,namespace:'isolated'},()=>({contents:`export async function chapterWorkbenchAction(input){return fetch('/operation',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json());}`}));
      }}]});
    const css=(await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:process.cwd()+'/src/app/globals.css'})).css;
    const payloads=[];
    http=createServer(async(req,res)=>{try{
      if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
      if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);return;}
      if(req.url==='/operation'){let raw='';for await(const chunk of req)raw+=chunk;const result=await call(JSON.parse(raw));payloads.push(JSON.stringify(result));res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;}
      const loaded=await call({operation:'read'});if(!loaded.ok)throw Error('read');
      const initial=JSON.stringify(loaded.data).replaceAll('<','\\u003c');
      res.setHeader('content-type','text/html; charset=utf-8');res.end(`<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main data-dashboard-ui="management" data-management-workspace="platform" class="p-4"><div id="root"></div></main><script>window.initial=${initial}</script><script type="module" src="/bundle.js"></script></body></html>`);
    }catch{res.statusCode=500;res.end('isolated failure');}});
    await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto(`http://127.0.0.1:${http.address().port}`);
    await page.waitForTimeout(500);
    assert.deepEqual(errors,[],'browser mount');
    await mkdir('/tmp/uply-workbench-redesign-visual',{recursive:true});
    for(const width of [1440,375]){
      await page.setViewportSize({width,height:950});
      await page.screenshot({path:`/tmp/uply-workbench-redesign-visual/${width}.png`,fullPage:true});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
    }
    await page.setViewportSize({width:1440,height:950});
    await page.getByRole('button',{name:'教学脚本',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'编辑题干与答案'}).count(),0);
    await page.getByText('本页展示已发布台词，修改请前往教学脚本管理。').waitFor();
    await page.screenshot({path:'/tmp/uply-workbench-redesign-visual/teaching.png',fullPage:true});
    await page.getByRole('button',{name:'校验发布',exact:true}).click();
    assert(await page.getByRole('button',{name:'发布校验版本'}).isDisabled());
    assert.equal(await page.getByRole('navigation',{name:'章节学习步骤'}).count(),0);
    await page.screenshot({path:'/tmp/uply-workbench-redesign-visual/publish.png',fullPage:true});
    await page.getByRole('button',{name:'活动内容',exact:true}).click();
    await t.test('browser enters edit, all 8 steps navigate, saves prompt/answer, validates and publishes',async()=>{
      await page.getByRole('button',{name:'进入编辑',exact:true}).click();
      await page.getByRole('button',{name:'已进入编辑',exact:true}).waitFor();
      for(let i=0;i<8;i++)await page.getByRole('navigation',{name:'章节学习步骤'}).getByRole('button').nth(i).click();
      await page.getByRole('navigation',{name:'章节学习步骤'}).getByRole('button').first().click();
      assert.equal(await page.getByRole('button',{name:'编辑题干与答案'}).count(),3);
      await page.getByRole('button',{name:'编辑题干与答案'}).first().click();
      await page.getByLabel('中文题干',{exact:true}).fill('取消后不应保存');
      await page.getByRole('button',{name:'取消修改',exact:true}).click();
      assert.equal(await page.getByText('取消后不应保存',{exact:true}).count(),0);
      const canceled=await call({operation:'read'});
      assert.equal(canceled.data.steps.flatMap(s=>s.nodes.flatMap(n=>n.activities)).find(x=>x.id===a.id).prompt,a.prompt);
      await page.getByRole('button',{name:'编辑题干与答案'}).first().click();
      await page.getByLabel('中文题干',{exact:true}).fill('工作台保存后的真实隔离题干');
      await page.getByLabel('正确选项（仅负责人可见）').selectOption('1');
      assert(await page.getByRole('button',{name:'校验发布',exact:true}).isDisabled());
      await page.getByRole('button',{name:'保存题目',exact:true}).click();
      await page.getByText('题干和正确选项已一并保存，尚未发布。').waitFor();
      await page.getByRole('button',{name:'校验发布',exact:true}).click();
      await page.getByRole('button',{name:'校验待发布内容'}).click();
      await page.getByText('校验通过。发布将再次检查内容和当前发布版本。').waitFor();
      await page.getByRole('button',{name:'发布校验版本'}).click();
      await page.getByText('发布成功。测试账号请返回课程后重新进入；本操作不扩大 Runtime 开放范围。').waitFor();
      const after=await f.loader.loadPublishedRuntimeSnapshot();
      assert.notEqual(after.bundle.snapshotId,before.bundle.snapshotId);
      assert.equal(after.bundle.privatePayload.source.activities.find(x=>x.id===a.id).prompt['zh-CN'],'工作台保存后的真实隔离题干');
      assert.equal(after.bundle.privatePayload.dependencies.digital_textbook_activity_secrets.find(x=>x.activity_id===a.id).answer_key.value,1);
      assert.deepEqual(after.bundle.manifest.runtimeTargets.map(x=>x.id),before.bundle.manifest.runtimeTargets.map(x=>x.id));
      assert.deepEqual(after.bundle.privatePayload.source.teachingNodes,before.bundle.privatePayload.source.teachingNodes);
      await page.reload();await page.getByRole('button',{name:'进入编辑',exact:true}).waitFor();
      await page.getByText('工作台保存后的真实隔离题干',{exact:true}).waitFor();
    });
    await t.test('Chromium: real grammar text save, reload and formal republish preserve targets/media',async()=>{
      await page.getByRole('button',{name:'进入编辑',exact:true}).click();
      await page.getByRole('button',{name:'已进入编辑',exact:true}).waitFor();
      await page.getByRole('navigation',{name:'章节学习步骤'}).getByRole('button').nth(2).click();
      assert.equal(await page.getByRole('button',{name:'编辑语法文字',exact:true}).count(),3);
      await page.getByRole('button',{name:'编辑语法文字',exact:true}).first().click();
      assert(await page.getByRole('button',{name:'校验发布',exact:true}).isDisabled());
      await page.getByLabel('功能说明（中文）',{exact:true}).fill('浏览器保存的语法功能说明');
      await page.getByRole('button',{name:'保存语法文字',exact:true}).click();
      await page.getByText('语法文字和稳定身份映射已保存，尚未发布。请重新校验并发布。').waitFor();
      await page.reload();
      await page.getByRole('navigation',{name:'章节学习步骤'}).getByRole('button').nth(2).click();
      const loaded=await call({operation:'read'});
      assert.equal(loaded.data.steps[2].nodes[0].grammarCards[0].card.function['zh-CN'],'浏览器保存的语法功能说明');
      for(const width of [375,1440]){
        await page.setViewportSize({width,height:950});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await page.screenshot({path:`/tmp/uply-workbench-redesign-visual/grammar-${width}.png`,fullPage:true});
      }
      await page.getByRole('button',{name:'校验发布',exact:true}).click();
      await page.getByRole('button',{name:'校验待发布内容',exact:true}).click();
      await page.getByText('校验通过。发布将再次检查内容和当前发布版本。').waitFor();
      await page.getByRole('button',{name:'发布校验版本',exact:true}).click();
      await page.getByText('发布成功。测试账号请返回课程后重新进入；本操作不扩大 Runtime 开放范围。').waitFor();
      const published=await f.loader.loadPublishedRuntimeSnapshot();
      assert.deepEqual(published.bundle.manifest.runtimeTargets.map(t=>t.id),before.bundle.manifest.runtimeTargets.map(t=>t.id));
      assert.deepEqual(published.bundle.privatePayload.source.media,before.bundle.privatePayload.source.media);
    });
    await t.test('stale check and CAS reject; out-of-range answer rejected; no private payload',async()=>{
      assert((await call({operation:'begin'})).ok);
      const checked=await call({operation:'check'});assert(checked.ok);
      assert.equal((await call({operation:'save',activityId:a.id,prompt:'拒绝越界',koreanPrompt:'',answerIndex:999})).ok,false);
      assert((await call({operation:'save',activityId:a.id,prompt:'校验后其他负责人修改',koreanPrompt:a.koreanPrompt,answerIndex:0})).ok);
      const stale=await call({operation:'publish',expected:checked.check.expected,digest:checked.check.digest});assert.equal(stale.ok,false);assert.match(stale.message,/重新校验/);
      const fresh=await call({operation:'check'});assert(fresh.ok);
      const races=await Promise.all([call({operation:'publish',expected:fresh.check.expected,digest:fresh.check.digest}),call({operation:'publish',expected:fresh.check.expected,digest:fresh.check.digest})]);
      assert.equal(races.filter(r=>r.ok).length,1);
      assert(!/object_key|objectKey|answer_key|service_role|configuration/.test(payloads.join('')));
      assert.deepEqual(errors,[]);
    });
  } finally {await browser?.close();if(http)await new Promise(resolve=>http.close(resolve));await f?.dispose();}
});

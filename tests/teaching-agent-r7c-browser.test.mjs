import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {createDurableFixture} from './fixtures/teaching-agent-r7c/fixture.server.mjs';
import {startDatabase,seedFixture,startService} from './fixtures/teaching-agent-r7c/postgres.mjs';
test('R7C mounted native Activity and surviving database across service restarts',async t=>{
 const db=await startDatabase(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});let service;
 const errors=[],logs=[],publicPayloads=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>logs.push(e.text()));
 page.on('response',async r=>{if(r.url().endsWith('/data'))publicPayloads.push(await r.text());});
 await page.route('**/*',route=>{if(service&&route.request().url().startsWith(service.url+'/'))return route.continue();external.push(route.request().url());return route.abort();});
 const ready=()=>page.waitForFunction(()=>window.r7bFacts?.().availability==='available'&&document.querySelector('video')?.readyState>=1);
 const phase=x=>page.waitForFunction(v=>window.r7bFacts?.().runtimePhase===v,x);
 const seek=x=>page.locator('input[aria-label="视频位置"]').fill(String(x));
 const trigger=async()=>{await page.getByRole('button',{name:'继续播放',exact:true}).click();await seek(12);await phase('AWAITING_ACTIVITY');};
 const submit=async n=>{await page.locator('input[type="radio"]').nth(n).check();await page.getByRole('button',{name:'提交答案',exact:true}).click();};
 const start=async()=>{if(service)await service.stop();const ids=await seedFixture(db);service=await startService(db,ids);await page.goto(service.url);await ready();return ids;};
 const restart=async ids=>{const port=Number(new URL(service.url).port),pid=service.pid;await service.stop();service=await startService(db,ids,port);assert.notEqual(service.pid,pid);await page.reload();await ready();};
 try{
 await t.test('public bundle, public HTTP DTO, DOM and facts contain no private answer binding',async()=>{
  const bundle=await build({entryPoints:['tests/fixtures/teaching-agent-r7c/browser.tsx'],bundle:true,write:false,outdir:'/tmp/r7c-leakage-build',platform:'browser',format:'esm',jsx:'automatic',metafile:true});
  assert.ok(!Object.keys(bundle.metafile.inputs).some(p=>/\.server\.|smart-textbook-submission|postgres\.mjs|final-nodes/.test(p)));const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;assert.doesNotMatch(js,/answer_key|native-choice-response|SIMULATED_LOST_RESPONSE|optionIndex/);
  await start();await trigger();assert.equal(await page.locator('input[type="radio"]').count(),3);assert.doesNotMatch(await page.locator('body').innerText(),/正确答案|B\. ㅏ|A\. 가|练习2/);assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>window.r7bFacts())),/answer_key|correctIndex|optionIndex|requestId/);
 });
 await t.test('waiting survives actual service process restart; correct durable readback and completed restart',async()=>{
  const ids=await start();await trigger();await restart(ids);await phase('AWAITING_ACTIVITY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
  await submit(1);await phase('RESUME_READY');const f=await createDurableFixture(db,ids),rows=await f.repository.read(f.scope);assert.equal(rows.attempts.length,1);assert.equal(rows.progress.status,'completed');
  await restart(ids);await phase('RESUME_READY');assert.equal(await page.locator('form').count(),0);await page.getByRole('button',{name:'继续播放',exact:true}).click();await seek(12);await phase('PLAYING');assert.equal(await page.locator('form').count(),0);
 });
 await t.test('wrong durable attempt holds; correct answer resumes; backward/forward seek and cue dedupe',async()=>{
  const ids=await start();await trigger();await submit(0);await page.getByText('请再想一想。',{exact:true}).waitFor();await phase('AWAITING_ACTIVITY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);await submit(1);await phase('PLAYING');
  const f=await createDurableFixture(db,ids);assert.equal((await f.repository.read(f.scope)).attempts.length,2);await seek(2);await seek(20);assert.equal(await page.locator('form').count(),0);assert.equal((await service.metrics()).checkpoints,1);assert.equal((await service.metrics()).readbacks,2);
 });
 await t.test('lost committed response reads DB and resumes without resubmit',async()=>{await start();await trigger();await service.mode('lost-completed');await submit(1);await phase('PLAYING');assert.equal((await service.metrics()).submits,1);assert.equal((await service.metrics()).readbacks,1);});
 await t.test('lost no-commit response holds; unknown readback holds without repeated submit',async()=>{await start();await trigger();await service.mode('lost-no-commit');await submit(1);await page.waitForFunction(()=>window.r7bFacts().runtimePhase==='AWAITING_ACTIVITY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);assert.equal((await service.metrics()).submits,1);
  await service.mode('unknown');await submit(1);await page.getByRole('button',{name:'核对作答状态'}).waitFor();await phase('AWAITING_ACTIVITY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);assert.equal((await service.metrics()).submits,2);
 });
 await t.test('user pause, autoplay reject and media error remain safe with durable binding',async()=>{
  await start();await trigger();await page.getByRole('button',{name:'保持暂停',exact:true}).click();await submit(1);await phase('RESUME_READY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
  await page.locator('video').evaluate(v=>{v.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));});await page.getByRole('button',{name:'继续播放',exact:true}).click();await page.getByText('浏览器暂停了自动播放，请点击继续播放。').waitFor();await phase('RESUME_READY');
  await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));await phase('ERROR');assert.equal(await page.getByRole('button',{name:'继续播放',exact:true}).isDisabled(),true);
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.doesNotMatch(publicPayloads.join(''),/answer_key|optionIndex|correctIndex|正确答案/);assert.doesNotMatch(logs.join(''),/answer_key|optionIndex|correctIndex|正确答案/);
 }finally{if(service)await service.stop();await browser.close();await db.stop();}
});

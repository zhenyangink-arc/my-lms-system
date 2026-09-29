import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from '@playwright/test';
import {startHarness} from './fixtures/teaching-agent-r7b/server.mjs';
test('R7B mounted existing LessonRuntime with real HTML5 fixture',async t=>{
 const h=await startHarness(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 const clientLogs=[],externalRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>clientLogs.push(m.text()));
 await page.route('**/*',route=>{if(route.request().url().startsWith(h.url+'/'))return route.continue();externalRequests.push(new URL(route.request().url()).origin);return route.abort();});
 const ready=async()=>{await page.waitForFunction(()=>window.r7bFacts?.().availability==='available'&&document.querySelector('video')?.readyState>=1);};
 const phase=async value=>page.waitForFunction(v=>window.r7bFacts?.().runtimePhase===v,value);
 const load=async()=>{h.fixture.reset();await page.goto(h.url);await ready();};
 const seek=async seconds=>page.locator('input[aria-label="视频位置"]').fill(String(seconds));
 const trigger=async()=>{await page.getByRole('button',{name:'继续播放',exact:true}).click();await seek(12);await phase('AWAITING_ACTIVITY');};
 const submit=async n=>{await page.locator('input[type="radio"]').nth(n).check();await page.getByRole('button',{name:'提交答案',exact:true}).click();};
 try{
 await t.test('public bundle excludes server/private imports; pre-submit DOM contains no answer designation',async()=>{
  assert.ok(!Object.keys(h.metafile.inputs).some(x=>/fixture\.server|native-execution-projection\.server|smart-textbook-submission|r6f\/final-nodes/.test(x)));assert.doesNotMatch(h.js,/privateAnswer|SIMULATED_RESPONSE_LOST/);
  await load();await trigger();assert.doesNotMatch(await page.locator('body').innerText(),/正确答案|B\. ㅏ|A\. 가|练习2/);assert.equal(await page.locator('input[type="radio"]').count(),3);
  assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>window.r7bFacts())),/correctAnswer|answerKey|正确答案/);
 });
 await t.test('real play crosses 5s cue; pauses, reveals existing Activity, completes and resumes once',async()=>{
  await load();assert.equal(await page.locator('video').evaluate(v=>v.duration),30);await page.getByRole('button',{name:'继续播放',exact:true}).click();await phase('AWAITING_ACTIVITY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);assert.equal(h.fixture.metrics.checkpoints,1);
  assert.equal(await page.locator('.lesson-runtime').getAttribute('data-presentation'),'learning');await submit(1);await phase('PLAYING');assert.equal(await page.locator('video').evaluate(v=>v.paused),false);assert.equal(await page.locator('.lesson-runtime').getAttribute('data-presentation'),'split');assert.equal(h.fixture.metrics.submits,1);
  await seek(2);await seek(12);assert.equal(await page.locator('form').count(),0);assert.equal(h.fixture.metrics.checkpoints,1);
 });
 await t.test('wrong answer holds, explicit next answer can complete',async()=>{await load();await trigger();await submit(0);await phase('AWAITING_ACTIVITY');await page.getByText('请再想一想。',{exact:true}).waitFor();assert.equal(await page.locator('video').evaluate(v=>v.paused),true);await submit(1);await phase('PLAYING');});
 await t.test('UNKNOWN submission/readback stays paused without retry',async()=>{await load();await trigger();h.fixture.setMode('unknown');await submit(1);await page.getByRole('button',{name:'核对作答状态'}).waitFor();await phase('AWAITING_ACTIVITY');assert.equal(h.fixture.metrics.submits,1);assert.equal(h.fixture.metrics.readbacks,1);assert.equal(await page.locator('video').evaluate(v=>v.paused),true);});
 await t.test('response lost after commit uses readback without resubmit',async()=>{await load();await trigger();h.fixture.setMode('lost-completed');await submit(1);await phase('PLAYING');assert.equal(h.fixture.metrics.submits,1);assert.equal(h.fixture.metrics.readbacks,1);});
 await t.test('refresh waiting and completed',async()=>{await load();await trigger();await page.reload();await ready();await phase('AWAITING_ACTIVITY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);await submit(1);await phase('RESUME_READY');await page.reload();await ready();await phase('RESUME_READY');assert.equal(await page.locator('form').count(),0);await page.getByRole('button',{name:'继续播放',exact:true}).click();await seek(20);await phase('PLAYING');assert.equal(h.fixture.metrics.checkpoints,1);});
 await t.test('user pause during activity is retained',async()=>{await load();await trigger();await page.getByRole('button',{name:'保持暂停',exact:true}).click();await submit(1);await phase('RESUME_READY');assert.equal(await page.locator('video').evaluate(v=>v.paused),true);});
 await t.test('autoplay rejected once, user may explicitly continue',async()=>{await load();await page.locator('video').evaluate(v=>{v.play=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));});await page.getByRole('button',{name:'继续播放',exact:true}).click();await page.getByText('浏览器暂停了自动播放，请点击继续播放。').waitFor();await phase('RESUME_READY');});
 await t.test('media error fails closed',async()=>{await load();await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));await phase('ERROR');assert.equal(await page.getByRole('button',{name:'继续播放',exact:true}).isDisabled(),true);assert.equal(h.fixture.metrics.checkpoints,0);});
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.doesNotMatch(clientLogs.join('\n'),/privateAnswer|correctIndex|correctAnswer|正确答案/);
 }finally{await browser.close();await h.close();}
});

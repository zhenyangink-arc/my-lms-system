import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { chromium } from '@playwright/test';
import { koreanHarness,requestFixture } from './fixtures/teaching-agent/student-runtime.mjs';
const {projectStudentSelectionPins}=await import('../src/features/teaching-agent/server/page-projection/selection-projection.ts');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('real Next browser UI: server pins, selection, statuses, answer, cancel, retry, cleanup, keyboard and mobile',{skip:process.env.RUN_TEACHING_AGENT_UI_BROWSER_TESTS!=='1',timeout:180000},async t=>{
 const cwd=resolve('.'),dir=mkdtempSync('/tmp/uply-stage1e-browser-'),s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));
 const h=koreanHarness(),input=await requestFixture(h,{session:false});const allPins=(await projectStudentSelectionPins({candidates:[input.selection],authenticate:h.authenticate,repository:h.repository,execution:{signal:new AbortController().signal,runId:crypto.randomUUID(),deadlineAt:new Date(Date.now()+40000).toISOString()}}));const pins=allPins.filter(p=>p.locale==='zh-CN');
 symlinkSync(join(cwd,'node_modules'),join(dir,'node_modules'),'dir');mkdirSync(join(dir,'app'),{recursive:true});
 writeFileSync(join(dir,'package.json'),JSON.stringify({private:true}));
 writeFileSync(join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2020',module:'esnext',moduleResolution:'bundler',jsx:'react-jsx',skipLibCheck:true,allowImportingTsExtensions:true,paths:{'@/*':[cwd+'/src/*']}},include:['**/*.ts','**/*.tsx']}));
 writeFileSync(join(dir,'next.config.mjs'),`export default {compress:false,reactStrictMode:true,devIndicators:false,experimental:{externalDir:true},webpack(config){config.resolve.alias['@']='${cwd}/src';return config;}};`);
 writeFileSync(join(dir,'postcss.config.mjs'),readFileSync('postcss.config.mjs','utf8'));
 writeFileSync(join(dir,'app/style.css'),`@import "tailwindcss" source(none);\n@import "${cwd}/src/app/design-tokens.css";\n@source "${cwd}/src/features/teaching-agent/components";\n@source "${cwd}/src/components/ui";\nbody {margin:0;background:var(--background);color:var(--foreground);font-family:Arial,sans-serif;} main {max-width:850px;margin:auto;padding:24px;} button {cursor:pointer;}\n`);
 writeFileSync(join(dir,'app/layout.tsx'),`import './style.css';export default function Layout({children}){return <html lang="zh-CN"><body>{children}</body></html>}`);
 writeFileSync(join(dir,'app/page.tsx'),`import {Suspense} from 'react';import Link from 'next/link';import {StudentAiTeacherIntegration} from '${cwd}/src/features/teaching-agent/components/StudentAiTeacherIntegration';import {studentTransportEnabled} from '${cwd}/src/features/teaching-agent/server/transport/transport-config.ts';\nexport default async function Page({searchParams}){const p=await searchParams;const pins=${JSON.stringify(pins)},koreanPins=${JSON.stringify(allPins.filter(pin=>pin.locale==='ko-KR'))};return <main><h1>韩语课堂</h1><Link href="/?enabled=1&chapter=2">切换课时</Link><p>课堂视频和练习保持原有状态。</p>{studentTransportEnabled(p.enabled)&&<Suspense fallback={null}><StudentAiTeacherIntegration pins={p.locale==='ko-KR'?koreanPins:p.chapter==='2'?[pins[1]]:pins}/></Suspense>}</main>}`);
 for(const suffix of ['route.ts','[runId]/route.ts','[runId]/cancel/route.ts']){const path=join(dir,'app/api/teaching-agent/runs',suffix);mkdirSync(join(path,'..'),{recursive:true});writeFileSync(path,readFileSync(join(cwd,'src/app/api/teaching-agent/runs',suffix),'utf8').replace('@/features/teaching-agent/server/transport/production',join(cwd,'tests/fixtures/teaching-agent/next-transport-composition.ts')));}
 const logs=[];const child=spawn(process.execPath,[join(cwd,'node_modules/next/dist/bin/next'),'dev','--webpack','-H','127.0.0.1','-p',String(port)],{cwd:dir,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs.push(String(b)));child.stderr.on('data',b=>logs.push(String(b)));
 let browser;const origin=`http://127.0.0.1:${port}`;
 try {
  let ready=false;for(let i=0;i<30;i++){try{const r=await fetch(origin,{signal:AbortSignal.timeout(10000)});if(r.status===200){ready=true;break;}}catch{}if(child.exitCode!==null)break;await delay(250);}assert.ok(ready,logs.join(''));
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(r.url().includes('/api/'))calls.push({url:r.url(),method:r.method(),body:r.postData()});});
  await page.goto(origin);assert.equal(await page.getByRole('button',{name:/解释这句话/}).count(),0);assert.equal(calls.length,0);
  await page.goto(origin+'/?enabled=1');const first=page.getByRole('button',{name:'解释这句话：저는 학생입니다.',exact:true});await first.waitFor();await first.focus();await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();await page.getByText('讲解已完成',{exact:true}).waitFor();assert.equal(await page.getByText('依据当前课文',{exact:true}).count(),1);
  assert.equal(JSON.parse(calls.find(c=>c.url.endsWith('/runs')).body).selection.segmentRef,pins[0].segmentRef);
  assert.equal(await page.getByRole('textbox').count(),0);assert.doesNotMatch(await page.getByRole('dialog').innerText(),/DeepSeek|Tool|Skill|Supabase|ta1:|tenant|AgentRun/);
  for(let tab=0;tab<6;tab++){await page.keyboard.press('Tab');await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement),null,{timeout:2000}).catch(async error=>{throw new Error(`Tab ${tab}: ${await page.evaluate(()=>document.activeElement?.outerHTML)}`,{cause:error});});}
  await page.screenshot({path:join(dir,'desktop-completed.png')});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.ok(await first.evaluate(e=>e===document.activeElement));
  const second=page.getByRole('button',{name:'解释这句话：이것은 책입니다.',exact:true});await second.click();await page.getByText('讲解已完成',{exact:true}).waitFor();const posts=calls.filter(c=>c.url.endsWith('/runs')&&c.method==='POST');assert.equal(JSON.parse(posts.at(-1).body).selection.segmentRef,pins[1].segmentRef);
  await page.getByRole('button',{name:'关闭讲解',exact:true}).click();
  // Warm cancel module so compilation does not let the short synthetic run complete first.
  await page.evaluate(async()=>{await fetch('/api/teaching-agent/runs/00000000-0000-4000-a000-000000000001/cancel',{method:'POST'});});
  const prev=calls.length;await first.click();await page.getByRole('button',{name:'停止讲解',exact:true}).click();await page.getByText('讲解已停止',{exact:true}).waitFor();assert.ok(calls.slice(prev).some(c=>c.url.endsWith('/cancel')));await page.getByRole('button',{name:'关闭讲解',exact:true}).click();
  // Failure and stale are browser test interception only, never a product bypass.
  await page.route('**/api/teaching-agent/runs',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'PROVIDER_UNAVAILABLE'})}));
  await first.click();await page.getByText('讲解服务暂时不可用，请稍后重试。',{exact:true}).waitFor();await page.unroute('**/api/teaching-agent/runs');await page.getByRole('button',{name:'重试',exact:true}).click();await page.getByText('讲解已完成',{exact:true}).waitFor();await page.getByRole('button',{name:'关闭讲解',exact:true}).click();
  // Close cancels and route cleanup prevents an A answer in B.
  await first.click();await page.evaluate(()=>document.querySelector('a').click());await page.waitForURL('**chapter=2');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:/저는 학생입니다/}).count(),0);
  await page.getByRole('button',{name:/解释这句话/}).click();await page.getByText('讲解已完成',{exact:true}).waitFor();assert.equal(await page.getByText('你选择的句子').locator('..').getByText('이것은 책입니다.',{exact:true}).count(),1);await page.getByRole('button',{name:'关闭讲解',exact:true}).click();
  await page.route('**/api/teaching-agent/runs',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'FORBIDDEN'})}));await page.getByRole('button',{name:/解释这句话/}).click();await page.getByRole('dialog').getByText(/课程内容可能已经更新/).waitFor();assert.equal(await page.getByText('你选择的句子').count(),0);await page.getByRole('button',{name:'关闭讲解',exact:true}).click();assert.ok(await page.getByRole('button',{name:/解释这句话/}).isDisabled());await page.unroute('**/api/teaching-agent/runs');
  await page.goto(origin+'/?enabled=1&locale=ko-KR');await page.getByRole('button',{name:'이 문장 설명: '+allPins.find(pin=>pin.locale==='ko-KR').displayText,exact:true}).click();await page.getByText('설명이 완료되었어요',{exact:true}).waitFor();await page.getByRole('button',{name:'설명 닫기',exact:true}).click();
  await page.goto(origin+'/?enabled=1');
  await page.route('**/api/teaching-agent/runs',route=>{const id=crypto.randomUUID(),conversationId=crypto.randomUUID();const payload=[{type:'run.started',conversationId},{type:'answer.final',text:'部分内容的讲解',sourceRefs:[pins[0].segmentRef],completeness:'partial'},{type:'run.completed',usageStatus:'unknown'}].map((e,i)=>JSON.stringify({protocolVersion:1,runId:id,seq:i+1,at:new Date().toISOString(),...e})).join('\n')+'\n';return route.fulfill({status:200,contentType:'application/x-ndjson',body:payload});});
  await first.click();await page.getByText('本次讲解基于部分可用课程内容。',{exact:true}).waitFor();await page.getByRole('button',{name:'关闭讲解',exact:true}).click();await page.unroute('**/api/teaching-agent/runs');
  await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});await page.goto(origin+'/?enabled=1');await page.evaluate(()=>document.documentElement.classList.add('dark'));await first.click();await page.getByText('讲解已完成',{exact:true}).waitFor();
  const dialog=page.getByRole('dialog'),box=await dialog.boundingBox();assert.ok(box.width<=375&&box.x>=0);assert.ok(await page.getByRole('button',{name:'关闭讲解',exact:true}).isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:join(dir,'mobile-completed.png')});await page.setViewportSize({width:812,height:375});assert.ok((await dialog.boundingBox()).height<=375);await page.getByRole('button',{name:'关闭讲解',exact:true}).click();
  assert.deepEqual(errors,[]);assert.ok(calls.every(c=>c.url.includes('/api/teaching-agent/runs')));
  writeFileSync('/tmp/uply-stage1e-browser-results.json',JSON.stringify({realNext:true,browser:'Chromium',featureOffRequests:0,liveProviderRequests:0,desktopScreenshot:join(dir,'desktop-completed.png'),mobileScreenshot:join(dir,'mobile-completed.png'),checks:['server pins A/B','keyboard Enter/Escape focus','answer/source','cancel endpoint','failure retry','stale clears selection','route cleanup','375px mobile','landscape','reduced motion','actual dark token class','Korean UI','partial badge','focus trap'],pageErrors:errors},null,2));t.diagnostic(`Screenshots ${dir}; real Next/Chromium PASS; live requests 0`);
 }finally{await browser?.close();child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(5000)]);if(child.exitCode===null)child.kill('SIGKILL');writeFileSync(join(dir,'next-test.log'),logs.join(''));}
});

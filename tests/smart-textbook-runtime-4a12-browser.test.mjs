import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {manifest,compiled,source} from './fixtures/runtime-4a.mjs';
import {learningSessionFixture} from './fixtures/learning-session-4a12.mjs';
import {capsule} from './fixtures/runtime-4a9.mjs';
const {patternExecutions}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');

test('4A12 strict whole learning Runtime: opaque boundary, real executors, preview domain, reload; NOT owner E2E',async t=>{
  const f=await learningSessionFixture(),requests=[],results=[],errors=[];
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-strict-4a12',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const server=createServer(async(req,res)=>{try{
    const send=x=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(x??null));};
    if(req.url==='/bundle.js'||req.url==='/style.css'){const ext=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',ext==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(ext)).text);}
    if(req.url==='/data')return send({manifest,context:f.context,state:f.state,learningSession:f.sessionRef});
    if(req.url==='/api/smart-textbook-runtime-audit/learning'){
      const chunks=[];for await(const c of req)chunks.push(c);const r=new Request('http://isolated/learning',{method:'POST',headers:req.headers,body:Buffer.concat(chunks)});
      let input,blob;if(req.headers['content-type']?.startsWith('multipart')){const form=await r.formData();input=JSON.parse(form.get('request'));blob=form.get('recording');assert(blob.size>2048);}else input=await r.json();requests.push(input);
      const value=input.operation==='catalog'?await f.boundary.catalog({sessionRef:input.sessionRef}):input.operation==='resume'?await f.boundary.resume({sessionRef:input.sessionRef}):input.operation==='enter'?await f.boundary.enter(input.payload):await f.boundary.dispatch(input.payload,new AbortController().signal,blob);
      if(input.payload?.request?.op.endsWith('complete'))results.push(value);
      if(value instanceof Blob){res.setHeader('content-type',value.type);return res.end(Buffer.from(await value.arrayBuffer()));}return send(value);
    }
    res.setHeader('content-type','text/html; charset=utf-8');res.end('<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch(e){errors.push(e.message);res.statusCode=400;res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const page=await browser.newPage(),uiErrors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>uiErrors.push(e.message));
    await page.addInitScript(()=>{const now=performance.now.bind(performance);window.clockOffset=0;performance.now=()=>now()+window.clockOffset;window.spoken=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak(u){window.spoken.push(u.text);setTimeout(()=>u.onend?.(),5);},cancel(){}}});});
    const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(`${origin}/?mode=learning-strict`);
    const group=()=>page.getByRole('group',{name:'子活动',exact:true}),module=()=>page.getByRole('region',{name:'本步骤练习流程',exact:true});
    const enter=async key=>{await page.locator('nav').getByRole('button',{name:manifest.steps.find(s=>s.key===key).title['zh-CN'],exact:true}).click();if(key==='orientation')await page.locator('form').first().waitFor();else await group().waitFor();};
    const choose=async n=>{await group().getByRole('button').nth(n).click();await page.waitForFunction(n=>document.querySelector('[aria-label="子活动"]')?.querySelectorAll('button')[n]?.getAttribute('aria-pressed')==='true',n);};
    const answer=async()=>{for(const field of await module().locator('form fieldset fieldset').all()){const radio=field.locator('input[type=radio]');if(await radio.count())await radio.first().check();else await field.locator('input').fill('학습');}};
    const record=async(region,seconds,turn)=>{await region.getByRole('button',{name:'开始录音',exact:true}).click();await region.getByText('正在录音…',{exact:true}).waitFor();await page.waitForTimeout(700);await page.evaluate(n=>window.clockOffset+=n*1000,seconds);await region.getByRole('button',{name:'停止录音',exact:true}).click();await region.getByRole('button',{name:'上传录音',exact:true}).click();if(turn)await region.getByRole('button',{name:`${turn.speaker}：已录，可重试 · ${turn.text}`,exact:true}).waitFor();else await region.getByText(/录音已保存/).waitFor();};
    await t.test('strict activation and three native submissions restore without formal attempts',async()=>{
      await page.locator('nav').waitFor();await page.locator('form').first().waitFor();assert.equal(await page.getByText(/组件检查模式/).count(),0);assert.equal(await page.locator('form').count(),3);
      for(const form of await page.locator('form').all()){await form.locator('input[type=radio]').first().check();await form.getByRole('button',{name:'提交答案'}).click();await form.getByText('回答正确',{exact:true}).waitFor();}
      await page.reload();await page.locator('form input:checked').first().waitFor();assert.equal(await page.locator('form input:checked').count(),3);assert.equal(await page.getByText('回答正确',{exact:true}).count(),3);assert.equal(f.state.attempts.length,0);
    });
    await t.test('vocabulary, three grammar groups, pattern dialogue/order/compose through one boundary',async()=>{
      await enter('vocabulary');for(const b of await module().getByRole('group',{name:'题目定位'}).getByRole('button').all()){await b.click();await module().locator('input[type=radio]').first().check();}await module().getByRole('button',{name:'检查作答',exact:true}).click();await module().getByText('回答正确',{exact:true}).waitFor();
      await enter('grammar');for(let a=0;a<3;a++){await choose(a);for(let p=0;p<2;p++){await module().getByRole('group',{name:'练习页'}).getByRole('button').nth(p).click();await answer();await module().getByRole('button',{name:'检查本页',exact:true}).click();await module().getByRole('button',{name:'查看本页订正'}).click();await module().getByRole('button',{name:p?'提交整组练习':'检查后继续',exact:true}).click();}await module().getByText(/服务器检查反馈/).waitFor();}
      await enter('patterns');const patterns=patternExecutions(manifest,compiled.bindings,capsule('patterns').id,'zh-CN');
      const run=async p=>{for(const turn of p.turns.filter(t=>t.kind!=='line')){if(turn.kind==='choice')await module().getByRole('button',{name:turn.options[0].text,exact:true}).click();else{for(const token of turn.tokens)await module().getByRole('button',{name:token.text,exact:true}).click();await module().getByRole('button',{name:'加入对话'}).click();}}await module().getByRole('button',{name:'提交整段练习'}).click();await module().getByText('服务器检查反馈',{exact:true}).waitFor();};
      await run(patterns[0]);await choose(1);const tokens=module().locator('form button').filter({hasNotText:/检查作答|移除/});for(const b of await tokens.all())await b.click();await module().getByRole('button',{name:'检查作答',exact:true}).click();await module().getByText('回答正确',{exact:true}).waitFor();await choose(2);await run(patterns[1]);
    });
    await t.test('dialogue + all role recordings; listening + repeat + speaking, one mounted session',async()=>{
      await enter('dialogue');for(let i=0;i<2;i++){await choose(i);await module().locator('input[type=radio]').first().check();await module().getByRole('button',{name:'检查作答',exact:true}).click();await module().getByText('回答正确',{exact:true}).waitFor();}
      await choose(2);const role=page.getByRole('region',{name:'分角色录音',exact:true}),plan=f.plans.find(p=>p.kind==='dialogue-roleplay');await role.getByRole('radio',{name:'左侧角色',exact:true}).check();for(const turn of plan.scenes[0].turns.filter(t=>t.side==='left')){if(await role.getByRole('button',{name:'播放对方台词',exact:true}).count())await role.getByRole('button',{name:'播放对方台词',exact:true}).click();await record(role,3,turn);}await role.getByRole('button',{name:'完成角色练习',exact:true}).click();await role.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
      await enter('listen_speak');for(let p=0;p<2;p++){await module().getByRole('button',{name:`第 ${p+1} 页`,exact:true}).click();await module().getByRole('button',{name:'加载本页听力',exact:true}).click();await module().locator('audio[src]').waitFor({state:'attached'});await module().locator('audio').evaluate(e=>e.play());await answer();await module().getByRole('button',{name:'检查本页',exact:true}).click();await module().getByRole('button',{name:'听力母稿',exact:true}).click();await module().getByText('隔离学习母稿',{exact:true}).waitFor();await module().getByRole('button',{name:'查看本页订正'}).click();}await module().getByRole('button',{name:'提交整组练习',exact:true}).click();await module().getByText(/服务器检查反馈/).waitFor();
      await page.getByRole('button',{name:/^播放：/}).first().click();await page.getByText('已练习',{exact:true}).first().waitFor();
      await choose(1);const speaking=page.getByRole('region',{name:'独立口语表达',exact:true});for(let i=0;i<4;i++){await speaking.getByRole('combobox').nth(i).selectOption({index:1});await speaking.getByRole('checkbox').nth(i).check();}await record(speaking,20);await speaking.getByRole('button',{name:'提交口语练习',exact:true}).click();await speaking.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
    });
    await t.test('read/write, review and full reload restore saved activities/pages/pattern/repeat/recording; no fabricated completion',async()=>{
      await enter('read_write');for(const b of await module().getByRole('group',{name:'题目定位'}).getByRole('button').all()){await b.click();await module().locator('input[type=radio]').first().check();}await module().getByRole('button',{name:'检查作答'}).click();await module().getByText('回答正确',{exact:true}).waitFor();await choose(1);await module().locator('textarea').fill('저는 학생입니다.');for(const b of await module().locator('input[type=checkbox]').all())await b.check();await module().getByRole('button',{name:'提交作答'}).click();await module().getByText('预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      await enter('review');for(const b of await module().locator('input[type=checkbox]').all())await b.check();await module().getByRole('button',{name:'检查作答'}).click();await module().getByText('回答正确',{exact:true}).waitFor();await choose(1);for(const field of await module().locator('fieldset fieldset').all()){const radio=field.locator('input[type=radio]');if(await radio.count())await radio.first().check();}await module().locator('input[type=checkbox]').first().check();await module().getByRole('button',{name:'提交作答'}).click();await module().getByText('预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      await page.reload();await group().waitFor();assert.equal(await page.locator('nav [aria-current="step"]').innerText(),manifest.steps[7].title['zh-CN']);
      await enter('orientation');await page.locator('form input:checked').first().waitFor();assert.equal(await page.locator('form input:checked').count(),3);
      await enter('vocabulary');await module().locator('input:checked').waitFor();await enter('grammar');assert.equal(await module().getByRole('button',{name:'第 2 页',exact:true}).getAttribute('aria-pressed'),'true');
      await enter('patterns');await module().getByRole('button',{name:'重新练习',exact:true}).waitFor();await enter('dialogue');await choose(2);await page.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
      await enter('listen_speak');await page.getByText('已练习',{exact:true}).first().waitFor();await choose(1);await page.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();await enter('read_write');await choose(1);assert.equal(await module().locator('textarea').inputValue(),'저는 학생입니다.');await enter('review');await choose(1);await module().locator('input:checked').first().waitFor();
      assert.equal(f.state.attempts.length,0);assert.equal(f.state.completedStepIds.length,0);assert(results.length===2&&results.every(r=>r.score===null&&!r.formalCompletion&&r.progressDelta===null));
      const completionOps=['native-submit','submit','pages-finish','pattern-finish','roleplay-complete','speaking-complete'];
      const submitted=[...new Set(requests.map(r=>r.payload?.request).filter(r=>r&&completionOps.includes(r.op)).map(r=>r.activity))];
      assert.deepEqual(submitted.sort(),(await f.boundary.catalog({sessionRef:f.sessionRef})).map(r=>r.serviceRef).sort());assert.equal(submitted.length,19);
      for(const input of requests){const text=JSON.stringify(input);assert(!/capsuleRef|tenantId|studentId|snapshotId|sourceRevision|versionId|proof|objectKey/.test(text));for(const a of source.activities)assert(!text.includes(a.id));}
      assert.deepEqual(uiErrors,[]);assert.equal(errors.length,0,JSON.stringify(errors));
      await writeFile('/tmp/uply-runtime-4a12-strict.json',JSON.stringify({snapshotId:manifest.snapshot.id,strictLearningMount:true,strictLearningReload:true,unifiedBrowserBoundary:true,previewFormalCompletion:false,steps:8,activities:19,requests:requests.length}));
    });
  }finally{await browser?.close();await new Promise(r=>server.close(r));f.dispose();}
});

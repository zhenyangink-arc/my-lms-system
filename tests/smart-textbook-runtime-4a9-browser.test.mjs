import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {compiled,manifest,source,context,state,content,gradePreview} from './fixtures/runtime-4a.mjs';
import {capsule,flowFixture} from './fixtures/runtime-4a9.mjs';
import {executions,serverModule} from './fixtures/runtime-4a2.server.mjs';
const {activityPages}=await import('../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {patternExecutions}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {learningTools,openLearningDestination}=await import('../src/features/smart-textbook-runtime/server/learning-tools.server.ts');

test('4A9 Chromium scoped learning flows + actual grader/checker + synthetic transport; NOT owner E2E',async t=>{
  const {flow,authority}=await flowFixture(),calls=[],results=[],payloads=[];
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-learning-browser',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const repeatApi=await serverModule('src/features/smart-textbook-runtime/server/guided-repeat.server.ts'),repeatStore=repeatApi.createPreviewRepeatStore();
  let allowCompletion=false,hold=false,release;
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'||req.url==='/style.css'){const suffix=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',suffix==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(suffix)).text);}
    res.setHeader('content-type','application/json');
    if(req.url==='/data')return res.end(JSON.stringify({manifest,content,context,state,compatibility:true,learningFlow:true,guidedRepeat:true}));
    if(req.method==='POST'){
      let raw='';for await(const chunk of req)raw+=chunk;const r=JSON.parse(raw);calls.push({path:req.url,...r});let value;
      if(req.url==='/activities'){const b=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.props.capsuleRef===r.ref);value=executions.filter(a=>b.props.activityRefs.includes(a.ref));}
      else if(req.url==='/pages')value=activityPages(compiled.bindings,compiled.services,r.ref,'zh-CN');
      else if(req.url==='/patterns')value=patternExecutions(manifest,compiled.bindings,r.ref,'zh-CN');
      else if(req.url==='/tools')value=learningTools(manifest,compiled.bindings,compiled.services,r.capsuleRef,source.nodes);
      else if(req.url==='/open'){const formal=allowCompletion?{...state,completedStepIds:manifest.steps.map(s=>s.id),activityProgress:compiled.bindings.activities.filter(a=>a.countsTowardCompletion).map(a=>({activityRef:a.ref,completed:true}))}:state;value=openLearningDestination(manifest,compiled.bindings,compiled.services,authority.scope,r.capsuleRef,r.target,formal,allowCompletion,source.nodes);}
      else if(req.url==='/flow'){
        if(r.sessionId!==context.runtimeSessionId||r.snapshotId!==context.snapshotId)throw Error('scope');
        switch(r.operation){case 'restore':value=await flow.restore(r.capsuleRef);break;case 'submit':value=await flow.submit(r.capsuleRef,r.activityRef,r.response);break;case 'page-check':value=await flow.pageCheck(r.capsuleRef,r.pageId,r.response);if(hold)await new Promise(resolve=>{release=resolve;});break;case 'reveal':value=await flow.revealPage(r.capsuleRef,r.pageId);break;case 'finish-pages':value=await flow.finishPages(r.capsuleRef,r.activityRef);break;case 'pattern-check':value=await flow.patternCheck(r.capsuleRef,r.activityRef,r.response);break;case 'finish-pattern':value=await flow.finishPattern(r.capsuleRef,r.activityRef,r.responses);break;default:throw Error('operation');}
        if(['submit','finish-pages','finish-pattern'].includes(r.operation))results.push(value);
      }else if(req.url==='/listening'){
        const p=activityPages(compiled.bindings,compiled.services,r.capsuleRef,'zh-CN').find(p=>p.pageId===r.pageId&&p.listening);if(!p)throw Error('page');
        if(r.kind==='transcript'){if(!(await flow.restore(r.capsuleRef)).pages.some(p=>p.pageId===r.pageId&&p.checked))throw Error('check required');value={transcript:'隔离测试母稿'};}
        else{const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);res.setHeader('content-type','audio/wav');return res.end(wav);}
      }else if(req.url==='/repeat/load'||req.url==='/repeat/mark'){const lesson=repeatApi.repeatLesson(manifest,compiled.bindings,compiled.services,r.capsuleRef,'zh-CN');value=req.url.endsWith('load')?(lesson?{lesson,state:repeatStore.read('audit',lesson)}:null):repeatStore.mark('audit',lesson,r.trackId,r.segmentId);}
      else if(req.url==='/submit')value=await gradePreview(r.ref,r.response);
      else if(req.url==='/cancel')value={};
      else throw Error('unavailable teacher');
      const body=JSON.stringify(value);payloads.push(body);return res.end(body);
    }
    res.setHeader('content-type','text/html');res.end('<html lang="zh-CN"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(()=>{window.spoken=[];window.cancelled=0;window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.spoken.push(u.text);},cancel(){window.cancelled++;}}});});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const enter=async key=>{await page.getByRole('button',{name:manifest.steps.find(s=>s.key===key).title['zh-CN'],exact:true}).click();if(key==='orientation')await page.locator('form').first().waitFor();else await page.getByRole('group',{name:'子活动',exact:true}).waitFor();};
    const module=()=>page.getByRole('region',{name:'本步骤练习流程',exact:true});
    const choose=async n=>{const button=module().getByRole('group',{name:'子活动',exact:true}).getByRole('button').nth(n);await button.click();await page.waitForFunction(n=>document.querySelector('[aria-label="子活动"]')?.querySelectorAll('button')[n]?.getAttribute('aria-pressed')==='true',n);};
    const answer=async form=>{for(const field of await form.locator('fieldset fieldset').all()){const radios=field.locator('input[type=radio]');if(await radios.count())await radios.first().check();else await field.locator('input').fill('학습');}};
    await t.test('eight steps and orientation three retain layout/navigation',async()=>{for(const s of manifest.steps)assert.equal(await page.locator('nav').getByRole('button',{name:s.title['zh-CN'],exact:true}).count(),1);await page.locator('form').first().waitFor();assert.equal(await page.locator('form').count(),3);for(const key of manifest.steps.map(s=>s.key)){await enter(key);assert.equal(await page.locator('nav').count(),1);}});
    await t.test('vocabulary per-item input → original submit → reload responses, not completion',async()=>{
      await enter('vocabulary');const form=module().locator('form');await form.waitFor();for(const button of await form.getByRole('group',{name:'题目定位'}).getByRole('button').all()){await button.click();await form.locator('input[type=radio]').first().check();}
      await form.getByRole('button',{name:'检查作答',exact:true}).click();await form.getByText('回答正确',{exact:true}).waitFor();await page.reload();await enter('vocabulary');await module().locator('input:checked').waitFor();assert.equal(await module().getByText(/已完成/).count(),0);
    });
    await t.test('grammar six pages with correction, final aggregation, nine real old TTS owners and restore',async()=>{
      await enter('grammar');await page.getByRole('button',{name:'例句点读',exact:true}).first().click();assert.equal(await page.evaluate(()=>window.spoken.length),1);assert.equal(await page.getByRole('button',{name:'例句点读',exact:true}).count(),9);
      for(let a=0;a<3;a++){await choose(a);for(let p=0;p<2;p++){await module().getByRole('group',{name:'练习页'}).getByRole('button').nth(p).click();await answer(module().locator('form'));await module().getByRole('button',{name:'检查本页',exact:true}).click();await module().getByText('本页检查反馈，不代表正式完成。',{exact:true}).waitFor();await module().getByRole('button',{name:'查看本页订正'}).click();await module().getByRole('button',{name:p?'提交整组练习':'检查后继续',exact:true}).click();}await module().getByText(/服务器检查反馈/).waitFor();}
      await page.reload();await enter('grammar');await module().getByText('本页检查反馈，不代表正式完成。',{exact:true}).waitFor();assert.equal(await module().getByRole('button',{name:'第 2 页',exact:true}).getAttribute('aria-pressed'),'true');
    });
    await t.test('patterns choice → order → compose preserve wrong stay/advance and final grader',async()=>{
      await enter('patterns');const patterns=patternExecutions(manifest,compiled.bindings,capsule('patterns').id,'zh-CN');
      const doPattern=async pattern=>{for(const turn of pattern.turns.filter(t=>t.kind!=='line')){if(turn.kind==='choice'){await module().getByRole('button',{name:turn.options[1].text,exact:true}).click();await module().getByText('请再检查这一轮作答，正确后对话才会继续。',{exact:true}).waitFor();await module().getByRole('button',{name:turn.options[0].text,exact:true}).click();}else{await module().getByRole('heading',{name:turn.task,exact:true}).waitFor();for(const token of turn.tokens)await module().getByRole('button',{name:token.text,exact:true}).click();await module().getByRole('button',{name:'加入对话'}).click();}}await module().getByRole('button',{name:'提交整段练习'}).click();await module().getByText('服务器检查反馈',{exact:true}).waitFor();};
      await doPattern(patterns[0]);await module().getByRole('button',{name:'继续下一练习'}).click();const order=executions.find(x=>x.ref===capsule('patterns').activities[1].activityId);for(const option of order.options)await module().getByRole('button',{name:option.text,exact:true}).click();await module().getByRole('button',{name:'检查作答',exact:true}).click();await module().getByText('回答正确',{exact:true}).waitFor();await module().getByRole('button',{name:'继续下一练习'}).click();await doPattern(patterns[1]);
    });
    await t.test('dialogue two original activities schedule before unchanged roleplay port',async()=>{await enter('dialogue');for(let a=0;a<2;a++){await choose(a);await module().locator('input[type=radio]').first().check();await module().getByRole('button',{name:'检查作答',exact:true}).click();await module().getByText('回答正确',{exact:true}).waitFor();}assert.equal(await module().getByRole('group',{name:'子活动'}).getByRole('button').count(),3);});
    await t.test('two listening real audio owners, transcript gate, aggregate and repeat practice restore',async()=>{
      await enter('listen_speak');const c=capsule('listen_speak'),owners=learningTools(manifest,compiled.bindings,compiled.services,c.id,source.nodes).playback.filter(p=>p.kind==='listening');
      for(let n=0;n<2;n++){await module().getByRole('button',{name:`第 ${n+1} 页`,exact:true}).click();await page.waitForTimeout(100);await page.evaluate(target=>window.testCommand(target,'play'),owners[n].target);assert.match(await module().locator('audio').getAttribute('src'),/^blob:/);await answer(module().locator('form'));await module().getByRole('button',{name:'检查本页',exact:true}).click();await module().getByRole('button',{name:'听力母稿',exact:true}).click();await module().getByText('隔离测试母稿',{exact:true}).waitFor();}
      await module().getByRole('button',{name:'提交整组练习'}).click();await module().getByText(/服务器检查反馈/).waitFor();await page.reload();await enter('listen_speak');await choose(0);await module().getByRole('button',{name:'听力母稿'}).click();await module().getByText('隔离测试母稿').waitFor();
    });
    await t.test('read/write and review return targets, chapter test remains server-gated',async()=>{
      await enter('read_write');for(const button of await module().getByRole('group',{name:'题目定位'}).getByRole('button').all()){await button.click();await module().locator('input[type=radio]').first().check();}await module().getByRole('button',{name:'检查作答'}).click();await module().getByText('回答正确',{exact:true}).waitFor();await module().getByRole('button',{name:'继续下一练习'}).click();await module().locator('textarea').fill('저는 학생입니다.');for(const box of await module().locator('input[type=checkbox]').all())await box.check();await module().getByRole('button',{name:'提交作答'}).click();await module().getByText('预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      await enter('review');for(const box of await module().locator('input[type=checkbox]').all())await box.check();await module().getByRole('button',{name:'检查作答'}).click();await module().getByText('回答正确',{exact:true}).waitFor();await module().getByRole('button',{name:'继续下一练习'}).click();await module().getByRole('button',{name:'提交作答',exact:true}).waitFor();for(const f of await module().locator('fieldset fieldset').all()){const radio=f.locator('input[type=radio]');if(await radio.count())await radio.first().check();}await module().locator('input[type=checkbox]').first().check();await module().getByRole('button',{name:'提交作答'}).click();await module().getByText('预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      await page.getByRole('button',{name:'进入章节测试',exact:true}).click();await page.getByText('尚未满足服务器章节完成条件，不能进入测试。',{exact:true}).waitFor();await page.getByRole('button',{name:'返回词汇练习',exact:true}).click();await module().getByRole('group',{name:'题目定位'}).waitFor();assert.equal(await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).getAttribute('aria-current'),'step');
      await enter('review');allowCompletion=true;await page.getByRole('button',{name:'进入章节测试'}).click();await page.waitForURL('**/dashboard/assignments/korean/korean-level-one-01');allowCompletion=false;
    });
    await t.test('stale page response cannot repaint another step; private payload scan',async()=>{
      await enter('grammar');await choose(0);await module().getByRole('button',{name:'第 1 页',exact:true}).click();hold=true;await module().getByRole('button',{name:'检查本页',exact:true}).click();for(let n=0;!release&&n<50;n++)await page.waitForTimeout(20);assert(release);await enter('vocabulary');release();hold=false;await page.waitForTimeout(100);assert.equal(await module().getByRole('button',{name:'检查本页',exact:true}).count(),0);
      assert(results.length>=12);assert(results.every(r=>r.preview&&r.nodeCompleted===false));assert(results.filter(r=>r.correct===null).every(r=>r.score===null));assert(!/answer_key|object_key|objectKey|signedUrl|tenantId|studentId|service_role|proof/.test(payloads.join('\n')));assert.deepEqual(errors,[]);
    });
  }finally{release?.();await browser?.close();await new Promise(r=>server.close(r));}
});

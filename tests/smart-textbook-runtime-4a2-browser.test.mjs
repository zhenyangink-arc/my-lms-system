import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { compiled,manifest,content,context,state,gradePreview } from './fixtures/runtime-4a.mjs';
import { executions,gradeComposite,teacherSession,serverModule,existingPageChecker } from './fixtures/runtime-4a2.server.mjs';
const {activityPages,checkBoundPage}=await import('../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {resolveAuditListening}=await import('../src/features/smart-textbook-runtime/server/listening-binding.server.ts');
const {patternExecutions,checkBoundPattern}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');

test('4A-2 Chromium mounted components, real legacy resolver/grader/grant; isolated transport NOT owner E2E',async t=>{
  const {auditTeacherTurn}=await serverModule('src/features/smart-textbook-runtime/server/audit-teacher.server.ts');
  const {auditTtsOwner,auditTtsService,observeAuditTts}=await serverModule('src/features/smart-textbook-runtime/server/audit-tts.server.ts');
  const checkPage=await existingPageChecker(),scope={sourceRevision:compiled.services.sourceRevision,versionId:compiled.services.versionId,actorId:'test-owner',tenantId:'test-tenant',authorized:true};
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-4a2-browser',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  let session=teacherSession(),observations=[],issued=[],submissions=[],patternChecks=[],holdPattern=false,releasePattern=null;
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'||req.url==='/style.css'){res.setHeader('content-type',req.url.endsWith('.js')?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(req.url.endsWith('.js')?'.js':'.css')).text);}
    res.setHeader('content-type','application/json');
    if(req.url==='/data')return res.end(JSON.stringify({manifest,content,context,state,compatibility:true}));
    if(req.method==='POST'){
      let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);let value;
      if(req.url==='/activities'){const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.props.capsuleRef===input.ref);if(!block)throw Error('Bad scope');value=executions.filter(a=>block.props.activityRefs.includes(a.ref));}
      else if(req.url==='/pages')value=activityPages(compiled.bindings,compiled.services,input.ref,'zh-CN');
      else if(req.url==='/patterns')value=patternExecutions(manifest,compiled.bindings,input.ref,'zh-CN');
      else if(req.url==='/pattern-check'){value=await checkBoundPattern(manifest,compiled.bindings,input.capsuleRef,input.activityRef,input.response,checkPage);patternChecks.push(value);if(holdPattern)await new Promise(resolve=>{releasePattern=resolve;});}
      else if(req.url==='/page-check'){
        const p=activityPages(compiled.bindings,compiled.services,input.capsuleRef,'zh-CN').find(p=>p.pageId===input.pageId);if(!p)throw Error('Unknown page');
        value=await checkBoundPage(compiled.services,scope,p,input.response,checkPage);session.pageChecks??=new Map();session.pageChecks.set(p.pageId,value);
      }else if(req.url==='/listening'){
        resolveAuditListening(session,{...input,sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483'});
        if(input.kind==='transcript')value={transcript:'测试传输母稿，并非真实私密母稿'};
        else{res.setHeader('content-type','audio/wav');const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);return res.end(wav);}
      }
      else if(req.url==='/composite-submit'){submissions.push(input);value=await gradeComposite(input.ref,input.response);}
      else if(req.url==='/submit')value=await gradePreview(input.ref,input.response);
      else if(req.url==='/teacher'){
        if(input.generation<=session.revokedThrough)throw Error('Stale');session.generation=input.generation;
        const result=await auditTeacherTurn(session.data,session.state,input.ref,input.intent,input.answer,'zh-CN');session.state=result.state;session.lastTurn=result.turn;
        value={...result.turn,playbackOwner:auditTtsOwner(session)};
      }else if(req.url==='/tts/issue'){value=await auditTtsService(session,'session').issue({actorId:'test-owner',tenantId:'owner-audit:test-owner'},{sessionId:'session'});issued.push(value);}
      else if(req.url==='/tts/observe'){value=await observeAuditTts(session,'session',input.grantId);observations.push(value);}
      else if(req.url==='/cancel'){session.revokedThrough=Math.max(session.revokedThrough,input.generation);value={};}
      else throw Error('Unknown service');
      return res.end(JSON.stringify(value));
    }
    res.setHeader('content-type','text/html');res.end('<html lang="zh-CN"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch{res.statusCode=400;res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Only the OS speech boundary is substituted. Actual React owner, target registry,
    // HTTP observation transport, Phase 3D grant service and Agent resolver execute.
    await page.addInitScript(()=>{window.testUtterances=[];window.testCancelled=0;window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.testUtterances.push(u);},cancel(){window.testCancelled++;}}});});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await t.test('mounted v23 task obtains exact authorized utterance; onend satisfies teaching wait only once',async()=>{
      await page.getByRole('button',{name:'开始讲解',exact:true}).click();
      for(let i=0;i<12&&!session.lastTurn?.task;i++){
        await page.getByRole('button',{name:session.lastTurn?.continueLabel??'继续',exact:true}).click();
        await page.getByText('正在读取教学内容…',{exact:true}).waitFor({state:'hidden'});
      }
      assert.ok(session.lastTurn.task);await page.getByRole('button',{name:'播放老师指定的表达',exact:true}).click();
      await page.waitForFunction(()=>window.testUtterances.length===1);
      assert.equal(await page.evaluate(()=>window.testUtterances[0].text),compiled.tts.text);assert.equal(session.state.completedTaskEvents.length,0);
      await page.evaluate(()=>window.testUtterances[0].onend());await page.getByText('已报告示范播放结束，可返回老师继续讲解。',{exact:true}).waitFor();
      assert.equal(observations.length,1);assert.equal(observations[0].formalCompletion,false);assert.equal(observations[0].progressDelta,null);assert.equal(observations[0].score,null);assert.equal(session.state.completedTaskEvents.length,1);
      assert.equal(await page.getByRole('button',{name:'播放老师指定的表达',exact:true}).isDisabled(),true);
      const duplicate=await page.evaluate(async grantId=>(await fetch('/tts/observe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grantId})})).json(),issued[0].grantId);
      assert.equal(duplicate.duplicate,true);assert.equal(duplicate.teachingPlaybackWaitSatisfied,false);assert.equal(session.state.completedTaskEvents.length,1);
      await page.getByRole('button',{name:session.lastTurn.continueLabel,exact:true}).click();await page.getByText('正在读取教学内容…',{exact:true}).waitFor({state:'hidden'});assert.equal(session.lastTurn.phase,'task_feedback');
      assert.equal(await page.getByRole('button',{name:'播放老师指定的表达',exact:true}).count(),0);
    });
    await t.test('complex vocabulary form → frozen IDs → existing preview grader, no official attempt write',async()=>{
      await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();const form=page.locator('form').first();await form.waitFor();
      for(const field of await form.locator('fieldset fieldset').all())await field.locator('input').first().check();
      await form.getByRole('button',{name:'检查作答',exact:true}).click();await form.getByText('回答正确',{exact:true}).waitFor();
      assert.equal(submissions.length,1);assert.equal(submissions[0].response.kind,'choice-group');assert.ok(submissions[0].response.items.every(i=>i.partId&&!('index'in i)));
      assert.match(await form.innerText(),/不计入正式进度/);assert.equal(await page.locator('nav').count(),1);
      await assert.rejects(page.evaluate(target=>window.testCommand(target,'play'),compiled.tts.target));
    });
    await t.test('six grammar pages use original page checker; stable input survives Step remount without completion claims',async()=>{
      await page.getByRole('button',{name:manifest.steps[2].title['zh-CN'],exact:true}).click();await page.getByRole('button',{name:'检查本页',exact:true}).first().waitFor();
      const sections=page.getByRole('region',{name:'语法练习',exact:true});assert.equal(await sections.count(),3);
      for(const section of await sections.all())for(const button of await section.getByRole('button',{name:/第 \d 页/}).all()){
        await button.click();for(const field of await section.locator('form fieldset fieldset').all()){const radio=field.locator('input[type="radio"]');if(await radio.count())await radio.first().check();else await field.locator('input').fill('학습');}
        await section.getByRole('button',{name:'检查本页',exact:true}).click();await section.getByText('本页检查反馈，不代表正式完成。',{exact:true}).waitFor();
      }
      assert.equal(session.pageChecks.size,6);
      await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();await page.getByRole('button',{name:manifest.steps[2].title['zh-CN'],exact:true}).click();
      await page.getByRole('button',{name:'检查本页',exact:true}).first().waitFor();assert.equal(await page.locator('input:checked').count(),6);assert.equal(await page.getByText('本页检查反馈，不代表正式完成。',{exact:true}).count(),0);
    });
    await t.test('two listening pages mount bytes, transcript only after page check, page disposal revokes old blob',async()=>{
      await page.getByRole('button',{name:manifest.steps[5].title['zh-CN'],exact:true}).click();await page.getByRole('button',{name:'加载本页听力',exact:true}).waitFor();
      const section=page.getByRole('region',{name:'听辨练习',exact:true});let priorUrl;
      for(const button of await section.getByRole('button',{name:/第 \d 页/}).all()){
        await button.click();assert.equal(await section.getByRole('button',{name:'听力母稿',exact:true}).count(),0);
        await section.getByRole('button',{name:'加载本页听力',exact:true}).click();await section.locator('audio').waitFor();const url=await section.locator('audio').getAttribute('src');assert.ok(url.startsWith('blob:'));
        if(priorUrl)assert.equal(await page.evaluate(async u=>{try{await fetch(u);return false;}catch{return true;}},priorUrl),true);priorUrl=url;
        for(const field of await section.locator('form fieldset fieldset').all())await field.locator('input').first().check();
        await section.getByRole('button',{name:'检查本页',exact:true}).click();await section.getByRole('button',{name:'听力母稿',exact:true}).click();await section.getByText('测试传输母稿，并非真实私密母稿',{exact:true}).waitFor();
      }
      assert.equal(session.pageChecks.size,8);await page.getByRole('button',{name:manifest.steps[7].title['zh-CN'],exact:true}).click();assert.equal(await page.locator('audio').count(),0);
    });
    await t.test('writing and self-check mounted forms use original open submissions, neither invents completion',async()=>{
      await page.getByRole('button',{name:manifest.steps[6].title['zh-CN'],exact:true}).click();await page.getByRole('button',{name:'提交作答',exact:true}).waitFor();
      let form=page.locator('form').filter({has:page.getByRole('button',{name:'提交作答',exact:true})});await form.locator('textarea').fill('저는 학생입니다.');for(const checkbox of await form.locator('input[type="checkbox"]').all())await checkbox.check();
      await form.getByRole('button',{name:'提交作答',exact:true}).click();await form.getByText('预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      await page.getByRole('button',{name:manifest.steps[7].title['zh-CN'],exact:true}).click();await page.getByRole('button',{name:'提交作答',exact:true}).waitFor();
      form=page.locator('form').filter({has:page.getByRole('button',{name:'提交作答',exact:true})});for(const field of await form.locator('fieldset fieldset').all()){const radio=field.locator('input[type="radio"]');if(await radio.count())await radio.first().check();}
      await form.locator('input[type="checkbox"]').first().check();await form.getByRole('button',{name:'提交作答',exact:true}).click();await form.getByText('预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      assert.deepEqual(submissions.slice(-2).map(s=>s.response.kind),['writing','self-check']);assert.equal(await page.locator('nav').count(),1);
    });
    await t.test('pattern conversation four choices and composition six rounds: incorrect stays, original checks advance, no final preview submit',async()=>{
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.getByRole('button',{name:manifest.steps[3].title['zh-CN'],exact:true}).click();
      const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===manifest.steps[3].id);
      const patterns=patternExecutions(manifest,compiled.bindings,block.props.capsuleRef,'zh-CN'),before=submissions.length;
      for(const pattern of patterns){
        const section=page.getByRole('region',{name:pattern.title,exact:true});await section.waitFor();
        for(const turn of pattern.turns.filter(t=>t.kind!=='line')){
          if(turn.kind==='choice'){
            const choice=section.getByRole('button',{name:turn.options[0].text,exact:true});await choice.waitFor();
            await section.getByRole('button',{name:turn.options[1].text,exact:true}).click();
            await section.getByText('请再检查这一轮作答，正确后对话才会继续。',{exact:true}).waitFor();assert.equal(await choice.count(),1);
            await choice.click();
          }else{
            await section.getByRole('heading',{name:turn.task,exact:true}).waitFor();
            for(const token of turn.tokens)await section.getByRole('button',{name:token.text,exact:true}).click();
            await section.getByRole('button',{name:'加入对话',exact:true}).click();
          }
        }
        await section.getByText('本段练习已结束；预览不产生正式完成或学习进度。',{exact:true}).waitFor();
      }
      assert.equal(patternChecks.length,14);assert.equal(patternChecks.filter(c=>c.correct).length,10);
      assert.ok(patternChecks.every(c=>c.formalCompletion===false&&c.progressDelta===null));assert.equal(submissions.length,before);assert.equal(await page.locator('nav').count(),1);
      // An automatic old-turn timer must not advance the next Step's UI.
      await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();
      await page.getByRole('button',{name:manifest.steps[3].title['zh-CN'],exact:true}).click();
      await page.getByRole('button',{name:manifest.steps[7].title['zh-CN'],exact:true}).click();
      await page.getByRole('button',{name:'提交作答',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:patterns[0].title,exact:true}).count(),0);
    });
    await t.test('pending pattern response is cancelled on Step disposal and cannot restore accepted state on re-entry',async()=>{
      const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===manifest.steps[3].id),pattern=patternExecutions(manifest,compiled.bindings,block.props.capsuleRef,'zh-CN')[0],turn=pattern.turns.find(t=>t.kind==='choice');
      await page.getByRole('button',{name:manifest.steps[3].title['zh-CN'],exact:true}).click();
      const section=page.getByRole('region',{name:pattern.title,exact:true});holdPattern=true;
      await section.getByRole('button',{name:turn.options[0].text,exact:true}).click();
      await section.getByText('正在检查…',{exact:true}).waitFor();
      for(let tries=0;!releasePattern&&tries<500;tries++)await new Promise(r=>setTimeout(r,10));
      assert.ok(releasePattern,'the held domain response was reached');
      await page.getByRole('button',{name:manifest.steps[7].title['zh-CN'],exact:true}).click();
      holdPattern=false;releasePattern();releasePattern=null;
      await page.getByRole('button',{name:'提交作答',exact:true}).waitFor();
      await page.getByRole('button',{name:manifest.steps[3].title['zh-CN'],exact:true}).click();
      await section.getByRole('button',{name:turn.options[0].text,exact:true}).waitFor();
      assert.equal(await section.getByText('本段练习已结束；预览不产生正式完成或学习进度。',{exact:true}).count(),0);
    });
    assert.equal(issued.length,1);assert.deepEqual(errors,[]);
  }finally{releasePattern?.();await browser?.close();await new Promise(r=>server.close(r));}
});

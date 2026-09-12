import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {isolatedSessionFixture,manifest,compiled,capsules,source} from './fixtures/runtime-4a10.mjs';
import {content,context} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
const {activityExecutions}=await import('../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
const {activityPages}=await import('../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {patternExecutions}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {repeatLesson,readGuidedRepeatHistory}=await serverModule('src/features/smart-textbook-runtime/server/guided-repeat.server.ts');
const {learningTools,openLearningDestination}=await import('../src/features/smart-textbook-runtime/server/learning-tools.server.ts');
const {isKoreanChapterLearningCompleted}=await import('../src/lib/korean-learning-unlocks.ts');
const {auditLearningTargets}=await import('../src/features/smart-textbook-runtime/core/target-coverage.ts');
const {resolvePatternMedia}=await serverModule('src/features/smart-textbook-runtime/server/pattern-media.server.ts');
function wav(){const b=Buffer.alloc(16044);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return b;}

test('4A10 Chromium: actual resolver/Reader → 8-Step restoration and full target enumeration (diagnostic, not strict activation)',async t=>{
  const fixture=await isolatedSessionFixture(),payloads=[],observations=[];let mediaMode='pending',mediaCalls=0,releaseLate;
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-4a10-browser',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'||req.url==='/style.css'){const suffix=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',suffix==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(suffix)).text);}
    const a=await fixture.resolver.resolve(fixture.ref); // Actual resolver, isolated normal-auth transport.
    const send=value=>{const body=JSON.stringify(value);payloads.push(body);res.setHeader('content-type','application/json');res.end(body);};
    if(req.url==='/data'){const history=await fixture.reader(new AbortController().signal);return send({manifest,content,context:{...context,runtimeSessionId:a.sessionId},state:history.server,compatibility:true,learningFlow:true,guidedRepeat:true,recording:true,authoritativeHistory:true,patternAudio:true});}
    if(req.url==='/history')return send((await fixture.reader(new AbortController().signal)).server);
    if(req.method==='POST'){
      let raw='';for await(const c of req)raw+=c;const r=JSON.parse(raw),signal=new AbortController().signal;
      if(req.url==='/activities')return send(activityExecutions(manifest,compiled.bindings,r.ref,'zh-CN'));
      if(req.url==='/pages')return send(activityPages(compiled.bindings,compiled.services,r.ref,'zh-CN'));
      if(req.url==='/patterns')return send(patternExecutions(manifest,compiled.bindings,r.ref,'zh-CN'));
      if(req.url==='/tools')return send(learningTools(manifest,compiled.bindings,compiled.services,r.capsuleRef,source.nodes));
      if(req.url==='/open'){
        const history=(await fixture.reader(signal)).server;
        // Synthetic persisted learner fixture, not a browser completion flag.
        const required=compiled.bindings.activities.filter(x=>x.countsTowardCompletion);assert.equal(required.length,17);
        const completed=required.every(x=>fixture.history.tables.digital_textbook_attempts.some(row=>row.activity_id===x.activityId&&row.meets_completion_requirements))&&fixture.history.tables.digital_textbook_node_progress.every(row=>row.status==='completed');
        const legacy=isKoreanChapterLearningCompleted({progressPercent:completed?100:0,readingSeconds:0,completionSource:completed?'smart_textbook':null});
        return send(openLearningDestination(manifest,compiled.bindings,compiled.services,a.scope,r.capsuleRef,r.target,history,legacy,source.nodes));
      }
      if(req.url==='/listening'){
        const page=activityPages(compiled.bindings,compiled.services,r.capsuleRef,'zh-CN').find(p=>p.pageId===r.pageId&&p.listening);assert(page);
        const owner=learningTools(manifest,compiled.bindings,compiled.services,r.capsuleRef,source.nodes).playback.find(p=>p.kind==='listening'&&p.pageId===page.pageId);assert(owner);assert(manifest.mediaRefs.some(m=>m.id===owner.mediaRef&&m.readiness==='ready'&&m.revision===owner.revision));
        assert.equal(r.kind,'audio');res.setHeader('content-type','audio/wav');return res.end(wav());
      }
      if(req.url==='/flow'&&r.operation==='restore'){assert.equal(r.sessionId,a.sessionId);assert.equal(r.snapshotId,a.snapshotId);return send((await fixture.reader(signal)).capsules.find(c=>c.capsuleRef===r.capsuleRef));}
      if(req.url==='/repeat/load'){const lesson=repeatLesson(manifest,compiled.bindings,compiled.services,r.capsuleRef,'zh-CN');return send(lesson?{lesson,state:await readGuidedRepeatHistory(fixture.history.db,compiled.services,a.scope,lesson)}:null);}
      if(req.url==='/api/smart-textbook-runtime-audit/recording'){
        assert.equal(r.sessionId,a.sessionId);assert.equal(r.snapshotId,a.snapshotId);
        if(r.op==='load')return send(await fixture.history.recording.load(r.capsuleRef));
        if(r.op==='restore')return send(await fixture.history.recording.restore(r.capsuleRef,r.activityRef));
        if(r.op==='audio'){
          const restored=await fixture.history.recording.restore(r.scope.capsuleRef,r.scope.activityRef);
          const target=manifest.runtimeTargets.find(t=>t.id===r.scope.target);
          assert(restored.recordings.some(x=>x.id===r.recordingId&&x.partId===target?.partId));
          res.setHeader('content-type','audio/wav');return res.end(wav());
        }
        throw Error('This persisted restore test cannot write recordings');
      }
      if(req.url==='/pattern-audio'){
        mediaCalls++;assert.equal(resolvePatternMedia(manifest,compiled.bindings,r.capsuleRef,r.turnId),null);
        if(mediaMode==='ready'||mediaMode==='late-ready'){
          const synthetic=structuredClone(manifest);
          for(const ref of synthetic.mediaRefs)if(compiled.bindings.mediaMetadata.some(x=>x.ref===ref.id&&x.purpose==='guided-conversation-line'))ref.readiness='ready';
          assert(resolvePatternMedia(synthetic,compiled.bindings,r.capsuleRef,r.turnId));
          if(mediaMode==='late-ready')await new Promise(resolve=>{releaseLate=resolve;});
          res.setHeader('content-type','audio/wav');return res.end(wav());
        }
        if(mediaMode==='fail')throw Error('isolated media failure');res.statusCode=204;return res.end();
      }
      if(req.url==='/cancel')return send({});
      throw Error('Unavailable domain operation, no production forwarding');
    }
    res.setHeader('content-type','text/html; charset=utf-8');if(req.url==='/dashboard/assignments/korean/korean-level-one-01')return res.end('<main>隔离章节测试目的地</main>');res.end('<html lang="zh-CN"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch{res.statusCode=400;res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      window.spoken=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.spoken.push(u.text);setTimeout(()=>u.onend?.(),1);},cancel(){}}});
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.createdBlobs=[];window.revokedBlobs=[];URL.createObjectURL=b=>{const url=create(b);window.createdBlobs.push(url);return url;};URL.revokeObjectURL=url=>{window.revokedBlobs.push(url);revoke(url);};
      const play=HTMLMediaElement.prototype.play,pause=HTMLMediaElement.prototype.pause;
      window.audioResults=[];window.audioPauses=0;window.failAudio=false;
      HTMLMediaElement.prototype.play=async function(){if(window.failAudio){window.audioResults.push('rejected');throw new DOMException('isolated playback failure','NotSupportedError');}await play.call(this);window.audioResults.push('played');};
      HTMLMediaElement.prototype.pause=function(){window.audioPauses++;return pause.call(this);};
    });
    const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin);
    const group=()=>page.getByRole('group',{name:'子活动',exact:true});
    const enter=async key=>{await page.locator('nav').getByRole('button',{name:manifest.steps.find(s=>s.key===key).title['zh-CN'],exact:true}).click();if(key==='orientation')await page.locator('form').first().waitFor();else await group().waitFor();};
    const sample=async(step,stateId,initial)=>{
      // DOM refs are inspected only in the test auditor, not used as Runtime identities.
      const declarations=manifest.runtimeTargets.filter(t=>t.stepId===step.id&&manifest.blocks.some(b=>b.id===t.blockId&&b.type==='compat.learning.v1'));
      const navigationTargets=capsules.filter(c=>c.stepId===step.id).flatMap(c=>learningTools(manifest,compiled.bindings,compiled.services,c.id,source.nodes).navigation.map(n=>n.target));
      const evidence=await page.evaluate(async({declarations,stateId,initial,navigationTargets})=>{
        const mounted=window.testMounted(),out=[];
        for(const t of declarations.filter(t=>mounted.includes(t.id))){
          const elements=[...document.querySelectorAll('[data-runtime-target]')].filter(e=>e.getAttribute('data-runtime-target')===t.id),successfulCommands=[];
          for(const command of t.capabilities){
            // Internal chapter navigation needs separate completion authorization;
            // do not fabricate it merely to make this diagnostic count green.
            if(command==='open'&&navigationTargets.includes(t.id))continue;
            try{await window.testCommand(t.id,command);const e=elements[0];if(command==='focus'&&document.activeElement!==e)continue;if(command==='highlight'&&!e?.hasAttribute('data-runtime-highlight'))continue;if(command==='reveal'&&!e?.getClientRects().length)continue;successfulCommands.push(command);}catch{}
          }
          out.push({target:t.id,stepId:t.stepId,stateId,initial,ownerCount:elements.length,successfulCommands});
        }return out;
      },{declarations,stateId,initial,navigationTargets});observations.push(...evidence);
    };
    await t.test('all three native saved selections + feedback + full reload',async()=>{
      await page.locator('form').first().waitFor();for(let reload=0;reload<2;reload++){
        assert.equal(await page.locator('form').count(),3);assert.equal(await page.locator('form input:checked').count(),3);
        for(const block of manifest.blocks.filter(b=>b.type==='multiple_choice')){const expected=(await fixture.reader(new AbortController().signal)).server.attempts.find(a=>a.activityRef===block.props.activityRef).selectedOptionId;assert.equal(await page.locator(`input[name="${block.id}"]:checked`).inputValue(),expected);}
        assert.equal(await page.getByText('서버에 저장된 답변을 복원했습니다.',{exact:true}).count(),3);
        await page.reload();await page.locator('form input:checked').first().waitFor();
      }
    });
    await t.test('once-mounted eight steps: all activities, saved pages/questions, recording restore and target legal state enumeration',async()=>{
      for(const step of manifest.steps){await enter(step.key);await sample(step,`${step.id}:entry`,true);if(step.key==='orientation')continue;
        const count=await group().getByRole('button').count();assert.equal(count,capsules.find(c=>c.stepId===step.id).activities.length);
        for(let n=0;n<count;n++){
          await group().getByRole('button').nth(n).click();await page.waitForFunction(n=>document.querySelector('[aria-label="子活动"]')?.querySelectorAll('button')[n]?.getAttribute('aria-pressed')==='true',n);
          await page.waitForTimeout(60);await sample(step,`${step.id}:activity:${n}`,false);
          for(const name of ['题目定位','练习页']){
            const locator=page.getByRole('group',{name,exact:true});if(!await locator.count())continue;
            for(let k=0;k<await locator.getByRole('button').count();k++){await locator.getByRole('button').nth(k).click();await sample(step,`${step.id}:activity:${n}:${name}:${k}`,false);}
          }
          if(step.key==='dialogue'&&n===2){
            const role=page.getByRole('region',{name:'分角色录音',exact:true});await role.getByText('已录，可重试',{exact:false}).first().waitFor();
            const plan=(await fixture.history.recording.load(capsules.find(c=>c.stepId===step.id).id)).find(p=>p.kind==='dialogue-roleplay');
            for(const scene of plan.scenes){await role.getByLabel('场景',{exact:true}).selectOption(scene.id);
              for(const side of ['left','right']){await role.getByRole('radio',{name:side==='left'?'左侧角色':'右侧角色',exact:true}).check();
                for(const turn of scene.turns.filter(x=>x.side===side)){await role.getByRole('button',{name:`${turn.speaker}：已录，可重试 · ${turn.text}`,exact:true}).click();await page.waitForTimeout(20);await sample(step,`role:${scene.id}:${side}:${turn.partId}`,false);}
              }
            }
          }
          if(step.key==='listen_speak'&&n===1){await page.getByRole('region',{name:'独立口语表达'}).getByText(/^录音已保存/).waitFor();}
        }
      }
      await page.reload();await enter('grammar');assert.equal(await page.getByRole('button',{name:'第 2 页',exact:true}).getAttribute('aria-pressed'),'true');
      await enter('listen_speak');assert.equal((await fixture.reader(new AbortController().signal)).server.guidedRepeat[0].segmentIds.length,14);
      const report=auditLearningTargets(manifest,observations);assert.equal(report.rows.length,359);assert.equal(report.duplicateOwners,0);
      // Persist diagnostic evidence, NOT a passed capability fixture.
      await writeFile('/tmp/uply-runtime-4a10-target-coverage.json',JSON.stringify(report,null,2));
      t.diagnostic(JSON.stringify({targets:359,requiredUnsupported:report.requiredUnsupported,danglingCommands:report.danglingCommands,categories:Object.fromEntries([...new Set(report.rows.map(r=>r.category))].map(c=>[c,report.rows.filter(r=>r.category===c).length]))}));
    });
    await t.test('4A12 inactive grammar item reveal activates its real activity/page before focus; no hidden owner',async()=>{
      await enter('grammar');await group().getByRole('button').first().click();
      const c=capsules.find(c=>c.stepId===manifest.steps.find(s=>s.key==='grammar').id),pages=activityPages(compiled.bindings,compiled.services,c.id,'zh-CN'),p=pages.at(-1),target=manifest.runtimeTargets.find(t=>t.stepId===c.stepId&&t.partId===p.items.at(-1).partId);
      await page.waitForTimeout(60);assert.equal(await page.evaluate(id=>window.testMounted().includes(id),target.id),false);
      await page.evaluate(async id=>{await window.testCommand(id,'reveal');await window.testCommand(id,'focus');},target.id);
      assert.equal(await group().getByRole('button').last().getAttribute('aria-pressed'),'true');
      assert.equal(await page.getByRole('button',{name:'第 2 页',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-runtime-target')),target.id);
    });
    await t.test('4A12 complete target witness: authorized return and 17-activity chapter-test gate, no completion from browser',async()=>{
      const c=capsules.find(c=>c.stepId===manifest.steps.find(s=>s.key==='review').id),navigation=learningTools(manifest,compiled.bindings,compiled.services,c.id,source.nodes).navigation;
      for(const n of navigation){
        await enter('review');await page.getByRole('button',{name:n.label,exact:true}).waitFor();
        const evidence=await page.evaluate(async n=>{
          for(const command of ['reveal','focus','highlight'])await window.testCommand(n.target,command);
          const elements=[...document.querySelectorAll('[data-runtime-target]')].filter(e=>e.getAttribute('data-runtime-target')===n.target);
          if(elements.length!==1||document.activeElement!==elements[0]||!elements[0].hasAttribute('data-runtime-highlight'))throw Error('NAVIGATION_OWNER');
          await window.testCommand(n.target,'open');return {ownerCount:elements.length,successfulCommands:['reveal','focus','highlight','open']};
        },n);
        observations.push({target:n.target,stepId:c.stepId,stateId:`authorized:${n.partId}`,initial:false,...evidence});
        if(n.kind==='chapter-test'){await page.waitForURL('**/dashboard/assignments/korean/korean-level-one-01');try{await page.getByText('隔离章节测试目的地').waitFor();}catch{throw Error(`Destination ${page.url()}: ${(await page.content()).slice(0,1000)}`);}await page.goto(origin);await page.locator('nav').waitFor();}
      }
      const audit=auditLearningTargets(manifest,observations);assert.equal(audit.requiredUnsupported,0);assert.equal(audit.danglingCommands,0);assert.equal(audit.duplicateOwners,0);assert.equal(audit.rows.filter(r=>r.category==='invalid').length,0);assert.equal(audit.rows.filter(r=>r.category==='commandless-identity').length,163);
      await writeFile('/tmp/uply-runtime-4a12-target-coverage.json',JSON.stringify(audit,null,2));
    });
    await t.test('real frozen pattern pending resources → existing TTS; failed transport also TTS; never fake ready',async()=>{
      const beforeBlobs=await page.evaluate(()=>window.createdBlobs.length);
      await enter('patterns');await group().getByRole('button').first().click();await page.getByRole('button',{name:'重新练习',exact:true}).click();await page.getByRole('checkbox',{name:'语音朗读（可选）'}).check();await page.waitForFunction(()=>window.spoken.length>0);assert(mediaCalls>0);assert.equal(await page.evaluate(()=>window.createdBlobs.length),beforeBlobs);
      await enter('vocabulary');const previous=await page.evaluate(()=>window.spoken.length);
      mediaMode='fail';await enter('patterns');await group().getByRole('button').first().click();await page.getByRole('button',{name:'重新练习',exact:true}).click();await page.getByRole('checkbox',{name:'语音朗读（可选）'}).check();await page.waitForFunction(n=>window.spoken.length>n,previous);
    });
    await t.test('4A15 proven Registry allows complete activation; legacy diagnostic payloads clean',async()=>{
      await page.goto(`${origin}/?mode=strict`);await page.locator('nav').waitFor();assert.equal(await page.locator('nav').count(),1);
      assert(!/object_key|objectKey|answer_key|signedUrl|tenantId|studentId|service_role|proof/.test(payloads.join('\n')));assert.deepEqual(errors,[]);
    });
    await t.test('4A11 synthetic ready binding → real Chromium Audio; rejected play → TTS; Step/unmount/late bytes cleanup',async()=>{
      await page.goto(origin);await page.locator('nav').waitFor();await enter('orientation');mediaMode='ready';
      const start=async()=>{await enter('patterns');await group().getByRole('button').first().click();await page.getByRole('button',{name:'重新练习',exact:true}).click();await page.getByRole('checkbox',{name:'语音朗读（可选）'}).check();};
      await start();await page.waitForFunction(()=>window.audioResults.includes('played'));
      assert((await page.evaluate(()=>window.createdBlobs)).every(x=>x.startsWith('blob:')));
      await enter('vocabulary');await page.waitForFunction(()=>window.createdBlobs.every(x=>window.revokedBlobs.includes(x)));assert(await page.evaluate(()=>window.audioPauses>0));
      await page.evaluate(()=>{window.failAudio=true;window.spoken=[];});await start();
      await page.waitForFunction(()=>window.audioResults.includes('rejected')&&window.spoken.length>0);
      await enter('vocabulary');await page.waitForFunction(()=>window.createdBlobs.every(x=>window.revokedBlobs.includes(x)));
      await page.evaluate(()=>{window.failAudio=false;});mediaMode='late-ready';releaseLate=undefined;const count=mediaCalls;await start();
      await page.waitForFunction(()=>document.querySelector('input[type="checkbox"]')?.checked);for(let n=0;n<100&&!releaseLate;n++)await new Promise(r=>setTimeout(r,10));assert(mediaCalls>count);assert(releaseLate);
      const before=await page.evaluate(()=>window.createdBlobs.length);await enter('vocabulary');releaseLate();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.createdBlobs.length),before);
      mediaMode='ready';await start();await page.waitForFunction(n=>window.createdBlobs.length>n,before);await page.evaluate(()=>window.testUnmount());await page.waitForFunction(()=>window.createdBlobs.every(x=>window.revokedBlobs.includes(x)));
      assert.deepEqual(errors,[]);
    });
  }finally{releaseLate?.();await browser?.close();await new Promise(r=>server.close(r));}
});

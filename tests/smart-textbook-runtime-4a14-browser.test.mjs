import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {manifest,source,evidence} from './fixtures/runtime-4a.mjs';
import {teacherBoundaryFixture} from './fixtures/teacher-boundary-4a14.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {auditTeacherTargets} from '../src/features/smart-textbook-runtime/core/teacher-readiness.ts';
const {teacherSourceInventory}=await serverModule('src/features/smart-textbook-runtime/server/teacher-inventory.server.ts');

test('4A14 mounted opaque Teacher with learning: real resolver/Audio, Grant owner, seven commands, lifecycle (development mount, NOT complete readiness)',async t=>{
  const f=await teacherBoundaryFixture(),requests=[],responses=[],witnesses=[],errors=[];
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/teacher4a14',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const server=createServer(async(req,res)=>{try{
    const send=x=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(x??null));};
    if(req.url==='/bundle.js'||req.url==='/style.css'){const ext=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',ext==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(ext)).text);}
    if(req.url==='/data')return send({manifest,context:f.learning.context,state:f.learning.state,learningSession:f.learning.sessionRef,teacherBoundary:true});
    if(req.method==='POST'){
      const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks));
      if(req.url==='/teacher-witness'){witnesses.push(input);return send({ok:true});}
      requests.push({path:req.url,input});let value;
      if(req.url==='/api/smart-textbook-runtime-audit/teacher')value=await f.boundary.dispatch(input);
      else if(input.operation==='catalog')value=await f.learning.boundary.catalog({sessionRef:input.sessionRef});
      else if(input.operation==='resume')value=await f.learning.boundary.resume({sessionRef:input.sessionRef});
      else if(input.operation==='enter')value=await f.learning.boundary.enter(input.payload);
      else value=await f.learning.boundary.dispatch(input.payload,new AbortController().signal);
      if(value instanceof Blob){res.setHeader('content-type',value.type);return res.end(Buffer.from(await value.arrayBuffer()));}
      if(req.url.endsWith('/teacher'))responses.push({operation:input.operation,value});return send(value);
    }
    res.setHeader('content-type','text/html; charset=utf-8');res.end('<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch(e){errors.push(e.message);res.statusCode=400;res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),uiErrors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>uiErrors.push(e.message));
    await page.addInitScript(()=>{
      window.spoken=[];window.ttsEnded=0;let active=null,timer=null,paused=false;
      window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
      const schedule=()=>{if(active&&!paused&&!window.ttsHold)timer=setTimeout(()=>{const u=active;active=null;window.ttsEnded++;u.onend?.();},30);};
      Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak(u){if(active)throw Error('simultaneous TTS');active=u;window.lastTtsEnd=u.onend;window.spoken.push(u.text);schedule();},cancel(){clearTimeout(timer);active=null;},pause(){paused=true;clearTimeout(timer);},resume(){paused=false;schedule();}}});
      const NativeAudio=window.Audio;window.audios=[];window.Audio=function(...args){const a=new NativeAudio(...args);window.audios.push(a);return a;};
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.blobs=new Set();URL.createObjectURL=b=>{const u=create(b);window.blobs.add(u);return u;};URL.revokeObjectURL=u=>{window.blobs.delete(u);revoke(u);};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const teacher=page.getByRole('region',{name:'金老师讲解',exact:true});await teacher.getByRole('button',{name:'开始讲解'}).click();
    const settled=async()=>page.waitForFunction(()=>['feedback','awaiting-task','awaiting-answer','remediation','completed','error'].includes(document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')));
    const phases=new Set(),texts=[],poses=new Set(),blackboard=new Set();let wrong=false,question=false,task=false,taskTarget;
    for(let i=0;i<40;i++){
      await settled();const phase=await teacher.getAttribute('data-teacher-phase');phases.add(phase);assert.notEqual(phase,'error',JSON.stringify({errors,responses:responses.slice(-2)}));
      texts.push(await teacher.locator('.runtime-teacher-caption').innerText());poses.add(await teacher.locator('img').getAttribute('data-pose'));
      for(const type of await teacher.locator('[data-blackboard-type]').evaluateAll(es=>es.map(e=>e.getAttribute('data-blackboard-type'))))blackboard.add(type);
      if(phase==='completed')break;
      if(phase==='awaiting-task'){
        const cue=responses.findLast(r=>r.value?.task)?.value;assert(cue);
        taskTarget=cue.task.target;
        await page.waitForFunction(()=>document.querySelector('[data-tts-owner]')||[...document.querySelectorAll('button')].some(b=>b.textContent==='播放老师指定的表达'));
        await teacher.getByRole('button',{name:'听老师指定的表达',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')!=='awaiting-task');task=true;
      }else if(phase==='awaiting-answer'||phase==='remediation'){
        const cue=responses.findLast(r=>r.value?.awaitingAnswer)?.value;assert(cue);question=true;
        await teacher.getByRole('button',{name:cue.questionOptions[wrong?0:1],exact:true}).click();
        if(!wrong){await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')==='remediation');wrong=true;}
      }else{
        const cue=responses.findLast(r=>r.value?.cue)?.value;
        await teacher.getByRole('button',{name:cue.continueLabel||'继续',exact:true}).click();
      }
      await page.waitForTimeout(80);
    }
    assert(task&&question&&wrong);assert(phases.has('completed'));assert(phases.has('remediation'));
    assert.deepEqual([...blackboard].sort(),['bullets','expression','text']);assert(poses.size>0);
    assert.equal(await page.locator('nav').count(),1);assert.equal(await page.locator('form').count(),3);
    assert.equal(witnesses.filter(w=>w.source.endsWith(':studentTask')&&w.command==='play').length,1);
    assert(witnesses.every(w=>w.ownerCount===1));
    const inventory=teacherSourceInventory(f.data),audit=auditTeacherTargets(manifest,inventory.requirements,witnesses.map(w=>({...w,snapshotId:manifest.snapshot.id,stepId:manifest.steps[0].id,result:'executed',test:'4A14 mounted Teacher Chromium'})));
    assert.equal(audit.requiredUnsupported,0);assert.equal(audit.danglingCommands,0);assert.equal(audit.duplicateOwners,0);assert.deepEqual(audit.unknownWitnesses,[]);
    assert.equal(responses.filter(r=>r.operation==='observeTts').length,1);
    const observation=responses.find(r=>r.operation==='observeTts').value;
    assert.deepEqual([observation.formalCompletion,observation.progressDelta,observation.score,observation.agentAdvance],[false,null,null,false]);
    assert(observation.teachingPlaybackWaitSatisfied);assert.equal(f.learning.state.completedStepIds.length,0);
    // Task owner has unmounted; the real ordinary learning owner is usable again,
    // without issuing/consuming another Teacher observation.
    const observations=responses.filter(r=>r.operation==='observeTts').length;
    await page.evaluate(target=>window.testCommand(target,'play'),taskTarget);
    assert.equal(responses.filter(r=>r.operation==='observeTts').length,observations);
    assert(f.media.length>0&&f.characters.length>0);assert(f.media.every(m=>!evidence.speech.some(a=>a.id===m.assetId&&a.segment_index===199)));
    await teacher.getByRole('button',{name:'停止讲解'}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.blobs.size),0);
    const enter=async index=>{await page.locator('nav').getByRole('button',{name:manifest.steps[index].title['zh-CN'],exact:true}).click();await page.waitForTimeout(80);};
    await t.test('real Audio pause/resume, Step cancellation, detached late ended',async()=>{
      f.setAudioDuration(2);await teacher.getByRole('button',{name:'开始讲解'}).click();
      await page.waitForFunction(()=>window.audios.some(a=>!a.paused));
      await teacher.getByRole('button',{name:'暂停讲解'}).click();await page.waitForFunction(()=>window.audios.every(a=>a.paused));
      await teacher.getByRole('button',{name:'继续播放'}).click();await page.waitForFunction(()=>window.audios.some(a=>!a.paused));
      await page.evaluate(()=>window.lateAudioEnded=window.audios.find(a=>!a.paused).onended);
      await enter(1);const count=requests.filter(r=>r.path.endsWith('/teacher')).length;
      await page.evaluate(()=>window.lateAudioEnded?.(new Event('ended')));await page.waitForTimeout(80);
      assert.equal(requests.filter(r=>r.path.endsWith('/teacher')).length,count);assert.equal(await page.evaluate(()=>window.blobs.size),0);
      await enter(0);f.setAudioDuration(.06);
    });
    await t.test('late authorized HTTP bytes after Step disposal cannot attach to a new Step',async()=>{
      const held=f.holdSpeech();await teacher.getByRole('button',{name:'开始讲解'}).click();await held.entered;
      await enter(1);held.release();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.blobs.size),0);
      // This controlled refusal is expected, and must not be hidden as success.
      const expectedRefusal=errors.findIndex(e=>/REVOKED|STALE/.test(e));assert(expectedRefusal>=0);errors.splice(expectedRefusal,1);
      await enter(0);
    });
    await t.test('Browser fallback TTS cancellation cannot advance a new Step',async()=>{
      f.setAudioFailure(true);await page.evaluate(()=>window.ttsHold=true);await teacher.getByRole('button',{name:'开始讲解'}).click();
      await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')==='tts-playing');
      await enter(1);const count=responses.filter(r=>r.operation==='advance'||r.operation==='observeTts').length;
      await page.evaluate(()=>window.lastTtsEnd?.());await page.waitForTimeout(80);
      assert.equal(responses.filter(r=>r.operation==='advance'||r.operation==='observeTts').length,count);assert.equal(await page.evaluate(()=>window.blobs.size),0);
      await page.evaluate(()=>window.ttsHold=false);f.setAudioFailure(false);await enter(0);
    });
    const reach=async desired=>{
      await teacher.getByRole('button',{name:'开始讲解'}).click();
      for(let n=0;n<30;n++){
        await settled();const phase=await teacher.getAttribute('data-teacher-phase');assert.notEqual(phase,'error');if(phase===desired)return;
        const cue=responses.findLast(r=>r.value?.cue)?.value;
        if(phase==='awaiting-task'){await teacher.getByRole('button',{name:'听老师指定的表达',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')!=='awaiting-task');}
        else await teacher.getByRole('button',{name:cue.continueLabel||'继续',exact:true}).click();
        await page.waitForTimeout(60);
      }throw Error(`Never reached ${desired}`);
    };
    await t.test('active Grant → Step switch → late browser onend never observes or advances',async()=>{
      await reach('awaiting-task');const issued=responses.filter(r=>r.operation==='issueTts').length,observed=responses.filter(r=>r.operation==='observeTts').length;
      await page.evaluate(()=>window.ttsHold=true);await teacher.getByRole('button',{name:'听老师指定的表达',exact:true}).click();
      for(let i=0;i<100&&responses.filter(r=>r.operation==='issueTts').length===issued;i++)await page.waitForTimeout(10);
      assert.equal(responses.filter(r=>r.operation==='issueTts').length,issued+1);await page.waitForTimeout(50);
      await enter(1);await page.evaluate(()=>window.lastTtsEnd?.());await page.waitForTimeout(100);
      assert.equal(responses.filter(r=>r.operation==='observeTts').length,observed);assert.equal(await page.evaluate(()=>window.blobs.size),0);
      const old=responses.findLast(r=>r.operation==='open').value.session,grant=responses.findLast(r=>r.operation==='issueTts').value.grantId;
      await assert.rejects(f.boundary.dispatch({session:old,operation:'observeTts',grantId:grant}),/SCOPE/);
      await page.evaluate(()=>window.ttsHold=false);await enter(0);
    });
    await t.test('question waiting → Step switch removes answer handlers and keeps learning unchanged',async()=>{
      await reach('awaiting-answer');const answers=responses.filter(r=>r.operation==='answer').length;
      await enter(1);assert.equal(await page.getByRole('region',{name:'金老师讲解',exact:true}).count(),0);
      assert.equal(responses.filter(r=>r.operation==='answer').length,answers);assert.equal(f.learning.state.attempts.length,0);await enter(0);
    });
    await t.test('Audio failure + unavailable Browser TTS retains text-only explanation without learning completion',async()=>{
      f.setAudioFailure(true);await page.evaluate(()=>{window.savedUtterance=window.SpeechSynthesisUtterance;window.SpeechSynthesisUtterance=undefined;});
      await teacher.getByRole('button',{name:'开始讲解'}).click();await settled();assert.equal(await teacher.getAttribute('data-teacher-phase'),'feedback');
      assert((await teacher.locator('.runtime-teacher-caption').innerText()).length>0);assert.equal(f.learning.state.completedStepIds.length,0);
      await teacher.getByRole('button',{name:'停止讲解'}).click();await page.evaluate(()=>window.SpeechSynthesisUtterance=window.savedUtterance);f.setAudioFailure(false);
    });
    // The same Root retains learning owners and can switch every Step.
    for(const step of manifest.steps){await page.locator('nav').getByRole('button',{name:step.title['zh-CN'],exact:true}).click();await page.waitForTimeout(50);}
    await page.locator('nav').getByRole('button',{name:manifest.steps[0].title['zh-CN'],exact:true}).click();
    f.setAudioFailure(true);await teacher.getByRole('button',{name:'开始讲解'}).click();await settled();assert.notEqual(await teacher.getAttribute('data-teacher-phase'),'error');assert((await page.evaluate(()=>window.spoken.length))>1);
    await page.locator('nav').getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.blobs.size),0);
    await page.reload();await page.locator('nav').waitFor();assert.equal(await page.locator('nav [aria-current="step"]').innerText(),manifest.steps[1].title['zh-CN']);
    await page.locator('nav').getByRole('button',{name:manifest.steps[0].title['zh-CN'],exact:true}).click();await teacher.getByRole('button',{name:'开始讲解'}).waitFor();
    for(const {path,input} of requests.filter(r=>r.path.endsWith('/teacher'))){const json=JSON.stringify(input);assert(!/scriptVersionId|nodeId|tenantId|userId|speechAssetId|objectKey|generation|snapshot|sourceRevision|score/.test(json),path);for(const node of source.teachingNodes)assert(!json.includes(node.id));}
    assert.deepEqual(uiErrors,[]);assert.deepEqual(errors,[]);
    const nodeCoverage=source.teachingNodes.map(node=>({key:node.node_key,covered:responses.some(r=>r.value?.text?.trim()&&node.teacher_script['zh-CN'].includes(r.value.text))}));
    assert(nodeCoverage.every(n=>n.covered),JSON.stringify(nodeCoverage));
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=strict`);
    await page.locator('nav').waitFor();assert.equal(await page.locator('nav').count(),1);await teacher.getByRole('button',{name:'开始讲解'}).waitFor();
    await writeFile('/tmp/uply-runtime-4a14-mounted.json',JSON.stringify({snapshotId:manifest.snapshot.id,teachingRevision:manifest.teachingRefs[0].revision,
      mode:'development-mounted-not-strict-complete',nodes:nodeCoverage,targets:audit,blackboard:[...blackboard].sort(),phases:[...phases],
      mountedGrant:true,pauseResume:true,audioStepDispose:true,ttsStepDispose:true,grantStepDispose:true,questionStepDispose:true,lateHttp:true,lateAudioEnded:true,lateTtsEnded:true,
      ordinaryOwnerRestored:true,teacherCompletionIsLearningCompletion:false,learningSteps:8,orientationActivities:3,ownerAuthenticatedE2E:false,strictComplete:false,strictCompleteActivationSmoke:true}));
  }finally{await browser?.close();await new Promise(r=>server.close(r));f.dispose();}
});

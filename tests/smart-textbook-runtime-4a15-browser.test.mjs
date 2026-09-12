import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {persistedTeacherFixture} from './fixtures/teacher-persisted-4a15.mjs';
import {manifest,source,compiled,evidence} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {auditTeacherTargets} from '../src/features/smart-textbook-runtime/core/teacher-readiness.ts';
const {teacherSourceInventory}=await serverModule('src/features/smart-textbook-runtime/server/teacher-inventory.server.ts');

// Temporary explicit evidence stage. After implementation proof passes and the
// registry is promoted, the default run MUST be strict; never auto-fallback.
const implementationEvidence=process.env.UPLY_TEACHER_IMPLEMENTATION_EVIDENCE==='1';
test(`4A15 ${implementationEvidence?'PRE-PROMOTION evidence':'STRICT COMPLETE'} persisted Teacher + Learning + PostgreSQL + reload`,{timeout:300000},async t=>{
  let f,browser,server;const errors=[],requests=[],responses=[],witnesses=[];
  try{
    f=await persistedTeacherFixture();const l=f.learning;
    const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/teacher4a15',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
    server=createServer(async(req,res)=>{try{
      const send=x=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(x??null));};
      if(req.url==='/bundle.js'||req.url==='/style.css'){const ext=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',ext==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(ext)).text);}
      if(req.url==='/data')return send({manifest,context:l.context,state:l.state,learningSession:l.sessionRef,teacherBoundary:true});
      if(req.method==='POST'){
        const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks));
        if(req.url==='/teacher-witness'){witnesses.push(input);return send({ok:true});}
        requests.push({path:req.url,input});let value;
        if(req.url.endsWith('/teacher'))value=await f.boundary.dispatch(input);
        else if(input.operation==='catalog')value=await l.boundary.catalog({sessionRef:input.sessionRef});
        else if(input.operation==='resume')value=await l.boundary.resume({sessionRef:input.sessionRef});
        else if(input.operation==='enter')value=await l.boundary.enter(input.payload);
        else value=await l.boundary.dispatch(input.payload,new AbortController().signal);
        if(value instanceof Blob){res.setHeader('content-type',value.type);return res.end(Buffer.from(await value.arrayBuffer()));}
        if(req.url.endsWith('/teacher'))responses.push({input,value});return send(value);
      }
      res.setHeader('content-type','text/html; charset=utf-8');res.end('<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
    }catch(e){errors.push(e.message);res.statusCode=409;res.end('{}');}});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(30000);const uiErrors=[];page.on('pageerror',e=>uiErrors.push(e.message));
    await page.addInitScript(()=>{
      window.spoken=[];window.ttsHold=false;let active=null,timer=null,paused=false;
      window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
      const schedule=()=>{if(active&&!paused&&!window.ttsHold)timer=setTimeout(()=>{const u=active;active=null;const ended=u.onend;ended?.();if(window.duplicateEnd)ended?.();},30);};
      Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak(u){if(active)throw Error('duplicate owner');active=u;window.lastTtsEnd=u.onend;window.spoken.push(u.text);schedule();},cancel(){clearTimeout(timer);active=null;},pause(){paused=true;clearTimeout(timer);},resume(){paused=false;schedule();}}});
      const fetchOriginal=window.fetch.bind(window);window.observationRetries=0;
      window.fetch=async(input,init)=>{const response=await fetchOriginal(input,init);if(window.duplicateHttp&&String(input).endsWith('/teacher')&&init?.body&&JSON.parse(init.body).operation==='observeTts'&&response.ok){const retry=await fetchOriginal(input,init);if(!retry.ok)throw Error('observation retry rejected');window.observationRetries++;}return response;};
      window.urls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);window.urls.add(u);return u;};URL.revokeObjectURL=u=>{window.urls.delete(u);revoke(u);};
    });
    const url=`http://127.0.0.1:${server.address().port}/${implementationEvidence?'':'?mode=strict'}`;await page.goto(url);
    const teacher=page.getByRole('region',{name:'金老师讲解',exact:true});
    const phase=()=>teacher.getAttribute('data-teacher-phase');
    const settled=async()=>{await page.waitForFunction(()=>['feedback','awaiting-task','awaiting-answer','remediation','completed','error'].includes(document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')));assert.notEqual(await phase(),'error',JSON.stringify(errors));};
    const last=()=>responses.findLast(r=>r.value?.cue)?.value;
    const next=async()=>{const count=responses.length;await teacher.getByRole('button',{name:last().continueLabel||'继续',exact:true}).click();for(let i=0;i<1000&&responses.length===count;i++)await page.waitForTimeout(10);await settled();};
    const reach=async desired=>{for(let i=0;i<40;i++){await settled();if(await phase()===desired)return;await next();}throw Error('Desired Teacher phase never reached');};
    const persisted=async()=>(await f.rows('learning_agent_sessions')).find(r=>r.id===f.sessionId);
    await t.test('existing active Agent row → same Root mounted character/blackboard/speech; no fresh DB session',async()=>{
      await teacher.getByRole('button',{name:'开始讲解'}).click();await settled();assert.equal((await f.rows('learning_agent_sessions')).length,1);assert.equal((await persisted()).current_node_id,source.teachingNodes.find(n=>n.node_key==='step-8-bbfc46').id);
      await teacher.locator('img[data-pose]').waitFor();assert((await teacher.locator('.runtime-teacher-caption').innerText()).length>0);assert.equal(await page.locator('nav').count(),1);assert.equal(await page.locator('form').count(),3);
    });
    let oldSession,oldCue,oldGrant,oldEnd;
    await t.test('pending grant + actual full reload restores SAME DB phase, not old opaque objects',async()=>{
      await reach('awaiting-task');oldSession=responses.findLast(r=>r.input.operation==='open').value.session;oldCue=last().cue;
      await page.evaluate(()=>window.ttsHold=true);await teacher.getByRole('button',{name:'听老师指定的表达'}).click();
      for(let i=0;i<300&&!responses.some(r=>r.input.operation==='issueTts');i++)await page.waitForTimeout(10);
      oldGrant=responses.findLast(r=>r.input.operation==='issueTts').value.grantId;oldEnd=await page.evaluateHandle(()=>window.lastTtsEnd);
      assert.equal((await f.rows('learning_agent_task_events')).length,0);assert.equal((await persisted()).teaching_state.teachingTurnPhase,'task');
      await page.reload();await teacher.getByRole('button',{name:'开始讲解'}).click();await settled();assert.equal(await phase(),'awaiting-task');
      assert.equal((await f.rows('learning_agent_sessions')).length,1);assert.notEqual(last().cue,oldCue);assert.notEqual(responses.findLast(r=>r.input.operation==='open').value.session,oldSession);
      await assert.rejects(f.boundary.dispatch({session:oldSession,operation:'observeTts',grantId:oldGrant}),/SCOPE/);
      await assert.rejects(f.boundary.dispatch({session:oldSession,operation:'speech',cue:oldCue}),/SCOPE/);
      // Destroyed browser realm cannot supply a live callback; no callback or
      // Blob handle is serialized across reload.
      await assert.rejects(oldEnd.evaluate(fn=>fn?.()));assert.equal((await f.rows('learning_agent_task_events')).length,0);
    });
    await t.test('mounted onend → real grant → existing events Route → one SQL event; duplicate HTTP delivery cannot advance',async()=>{
      await page.evaluate(()=>{window.duplicateEnd=true;window.duplicateHttp=true;});await teacher.getByRole('button',{name:'听老师指定的表达'}).click();
      await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')!=='awaiting-task');await settled();assert.equal(last().phase,'task_feedback');
      const events=await f.rows('learning_agent_task_events');assert.equal(events.length,1);assert.equal(events[0].session_id,f.sessionId);assert.equal(events[0].target_key,'dialogue:greeting:0');assert.equal((await persisted()).teaching_state.teachingTurnPhase,'task_feedback');
      const observations=responses.filter(r=>r.input.operation==='observeTts');assert.equal(observations.length,2);assert.equal(observations[1].value.duplicate,true);assert.equal(observations[1].value.teachingPlaybackWaitSatisfied,false);assert.equal(await page.evaluate(()=>window.observationRetries),1);
      const observation=observations[0];assert(observation.value.teachingPlaybackWaitSatisfied);assert.deepEqual([observation.value.formalCompletion,observation.value.progressDelta,observation.value.score,observation.value.agentAdvance],[false,null,null,false]);
      // After the resolver has left task, a replay is explicitly refused; it
      // must not upsert a second event or move teaching_state.
      const before=JSON.stringify((await persisted()).teaching_state);await assert.rejects(f.boundary.dispatch(observation.input),/Unauthorized|GRANT/);assert.equal((await f.rows('learning_agent_task_events')).length,1);assert.equal(JSON.stringify((await persisted()).teaching_state),before);
    });
    await t.test('persisted event reload does not request another observation; wrong/retry/correct persisted by original responder',async()=>{
      const count=responses.filter(r=>r.input.operation==='issueTts').length;await page.reload();await teacher.getByRole('button',{name:'开始讲解'}).click();await settled();assert.equal(last().phase,'task_feedback');assert.equal(last().task,null);assert.equal(responses.filter(r=>r.input.operation==='issueTts').length,count);
      await reach('awaiting-answer');await teacher.getByRole('button',{name:last().questionOptions[1],exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')==='remediation');assert.equal((await persisted()).teaching_state.answerCorrect,false);
      await teacher.getByRole('button',{name:last().questionOptions[0],exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-teacher-phase]')?.getAttribute('data-teacher-phase')==='feedback');assert.equal((await persisted()).teaching_state.answerCorrect,true);
      assert.equal((await f.rows('learning_agent_node_attempts')).length,2);assert.equal((await f.rows('digital_textbook_attempts')).length,0);
    });
    await t.test('terminal persists completed and focuses native activity; teaching completion never becomes learning completion',async()=>{
      await reach('completed');const row=await persisted();assert.equal(row.status,'completed');assert.equal(row.current_node_id,source.teachingNodes.find(n=>n.node_key==='ready-for-practice').id);
      const lastSession=responses.findLast(r=>r.input.operation==='open').value.session;assert.deepEqual(await f.boundary.dispatch({session:lastSession,operation:'advance'}),last());
      assert.equal((await f.rows('digital_textbook_attempts')).length,0);assert.equal((await f.rows('digital_textbook_node_progress')).length,0);assert.equal(l.state.completedStepIds.length,0);
      for(const form of await page.locator('form').all()){await form.locator('input[type=radio]').first().check();await form.getByRole('button',{name:'提交答案'}).click();await form.getByText('回答正确',{exact:true}).waitFor();}
      assert.equal(l.state.attempts.length,0);const sessionsBefore=(await f.rows('learning_agent_sessions')).length;
      await page.reload();await page.locator('form input:checked').first().waitFor();assert.equal(await page.locator('form input:checked').count(),3);assert.equal((await persisted()).status,'completed');assert.equal((await f.rows('learning_agent_sessions')).length,sessionsBefore);
      await teacher.getByRole('button',{name:'开始讲解'}).waitFor();assert.equal(await page.locator('nav').count(),1);
    });
    const inventory=teacherSourceInventory(f.data),targets=auditTeacherTargets(manifest,inventory.requirements,witnesses.map(w=>({...w,snapshotId:manifest.snapshot.id,stepId:manifest.steps[0].id,result:'executed',test:'4A15 persisted mounted Chromium'})));
    assert.equal(targets.requiredUnsupported,0);assert.equal(targets.danglingCommands,0);assert.equal(targets.duplicateOwners,0);
    const nodeCoverage=source.teachingNodes.map(n=>({key:n.node_key,covered:responses.some(r=>r.value?.text?.trim()&&n.teacher_script['zh-CN'].includes(r.value.text))}));assert(nodeCoverage.every(n=>n.covered));
    for(const r of requests.filter(r=>r.path.endsWith('/teacher'))){const serialized=JSON.stringify(r.input);assert(!/tenantId|studentId|scriptVersionId|nodeId|assetId|objectKey|signedUrl|sourceRevision|snapshot|proof|answer_key/.test(serialized));assert(!serialized.includes(f.sessionId));for(const node of source.teachingNodes)assert(!serialized.includes(node.id));}
    for(const {value} of responses){const text=JSON.stringify(value);assert(!/object_key|objectKey|scriptVersionId|teaching_state|signedUrl|tenantId|studentId|answer_key/.test(text));
      for(const privateId of [f.sessionId,f.student,f.tenant,...source.teachingNodes.map(n=>n.id),...evidence.speech.map(a=>a.id)])assert(!text.includes(privateId));}
    assert(f.media.length>0);assert(f.media.every(id=>!evidence.speech.some(a=>a.id===id&&a.segment_index===199)));
    assert.deepEqual(errors,[]);assert.deepEqual(uiErrors,[]);
    await writeFile(`/tmp/uply-runtime-4a15-${implementationEvidence?'implementation':'complete'}.json`,JSON.stringify({snapshotId:manifest.snapshot.id,teachingRevision:manifest.teachingRefs[0].revision,sourceRevision:compiled.report.sourceRevision,strictComplete:!implementationEvidence,
      persistedAgent:true,realRespond:true,realEvents:true,realPostgres:true,productionMounted:true,persistedReload:true,learningReload:true,grantReloadRevoked:true,terminalPersisted:true,formalLearningMutation:false,nodes:nodeCoverage,targets}));
  }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f?.dispose();}
});

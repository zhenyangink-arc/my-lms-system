import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {manifest,compiled,source,content,context} from './runtime-4a.mjs';
const {createLearningBoundary}=await import('../../src/features/smart-textbook-runtime/server/learning-boundary.server.ts');
const {activityExecutions}=await import('../../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
const {activityPages}=await import('../../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {patternExecutions}=await import('../../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {learningTools}=await import('../../src/features/smart-textbook-runtime/server/learning-tools.server.ts');

/** Mounted real Chromium MediaRecorder -> existing production service -> real
 * isolated SQL supplied by rehearsal -> actual Reader -> same React provider.
 * No student auth/database/media is consulted. Not strict activation evidence. */
export async function mountedRecordingIntegration({recording,refresh,authority}){
  const sessionRef=authority.sessionId,requests=[],results=[],errors=[];
  const boundary=createLearningBoundary({resolve:async input=>{
    assert.deepEqual(input,{sessionRef});return {sessionId:sessionRef,snapshotId:manifest.snapshot.id,expiresAt:Date.now()+600000,
      locale:'zh-CN',admin:authority.admin,db:authority.admin,manifest,bindings:compiled.bindings,services:compiled.services,nodes:source.nodes,
      scope:{authorized:true,actorId:authority.owner.studentId,tenantId:authority.owner.tenantId,versionId:manifest.version.id,sourceRevision:compiled.report.sourceRevision}};
  }},async()=>({
    recording,learning:async c=>content[c],refresh:async()=> (await refresh()).server,
    activities:{load:async c=>activityExecutions(manifest,compiled.bindings,c,'zh-CN'),submit:async()=>{throw Error('Not a general grader test');}},
    pages:{load:async c=>activityPages(compiled.bindings,compiled.services,c,'zh-CN')},patterns:{load:async c=>patternExecutions(manifest,compiled.bindings,c,'zh-CN')},
    guidedRepeat:{load:async()=>null},learningTools:{load:async c=>learningTools(manifest,compiled.bindings,compiled.services,c,source.nodes)},
    learningFlow:{restore:async c=>(await refresh()).capsules.find(x=>x.capsuleRef===c)},
  }));
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-4a12-recording',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const server=createServer(async(req,res)=>{let operation='bootstrap',requestGeneration=null;try{
    const send=x=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(x??null));};
    if(req.url==='/bundle.js'||req.url==='/style.css'){const ext=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',ext==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(ext)).text);}
    if(req.url==='/data')return send({manifest,content,context:{...context,runtimeSessionId:sessionRef,trackingDisabled:false},state:(await refresh()).server,learningSession:sessionRef});
    if(req.url==='/api/smart-textbook-runtime-audit/learning'){
      const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks),r=new Request('http://isolated/learning',{method:'POST',headers:req.headers,body});
      let input,blob;if(req.headers['content-type']?.startsWith('multipart/form-data')){const form=await r.formData();input=JSON.parse(form.get('request'));blob=form.get('recording');assert(blob.size>0);}else input=await r.json();
      requests.push(input);
      operation=input.operation==='dispatch'?input.payload.request.op:input.operation;
      requestGeneration=input.payload?.generation??null;
      let result;if(input.operation==='catalog')result=await boundary.catalog({sessionRef:input.sessionRef});else if(input.operation==='resume')result=await boundary.resume({sessionRef:input.sessionRef});else if(input.operation==='enter')result=await boundary.enter(input.payload);else result=await boundary.dispatch(input.payload,new AbortController().signal,blob);
      if(input.payload?.request?.op==='speaking-complete'||input.payload?.request?.op==='roleplay-complete')results.push(result);
      if(result instanceof Blob){res.setHeader('content-type',result.type);return res.end(Buffer.from(await result.arrayBuffer()));}return send(result);
    }
    res.setHeader('content-type','text/html');res.end('<html lang="zh-CN"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch(e){const current=await boundary.resume({sessionRef});errors.push({message:e.message,operation,requestGeneration,currentGeneration:current.generation});res.statusCode=400;res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const page=await browser.newPage();page.setDefaultTimeout(15000);const uiErrors=[];page.on('pageerror',e=>uiErrors.push(e.message));
    await page.addInitScript(()=>{const now=performance.now.bind(performance);window.clockOffset=0;performance.now=()=>now()+window.clockOffset;window.spoken=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.spoken.push(u.text);setTimeout(()=>u.onend?.(),5);},cancel(){}}});});
    const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin);
    const enter=async key=>{await page.locator('nav').getByRole('button',{name:manifest.steps.find(s=>s.key===key).title['zh-CN'],exact:true}).click();await page.getByRole('group',{name:'子活动',exact:true}).waitFor();};
    const select=async n=>{await page.getByRole('group',{name:'子活动',exact:true}).getByRole('button').nth(n).click();};
    const record=async(region,seconds,turn)=>{
      await region.getByRole('button',{name:'开始录音',exact:true}).click();await region.getByText('正在录音…',{exact:true}).waitFor();await page.waitForTimeout(700);
      await page.evaluate(n=>window.clockOffset+=n*1000,seconds);await region.getByRole('button',{name:'停止录音',exact:true}).click();await region.getByRole('button',{name:'上传录音',exact:true}).click();
      if(turn)await region.getByRole('button',{name:`${turn.speaker}：已录，可重试 · ${turn.text}`,exact:true}).waitFor();else await region.getByText(/录音已保存/).waitFor();
    };
    await enter('listen_speak');await select(1);const speaking=page.getByRole('region',{name:'独立口语表达',exact:true});
    for(let i=0;i<4;i++){await speaking.getByRole('combobox').nth(i).selectOption({index:1});await speaking.getByRole('checkbox').nth(i).check();}
    await record(speaking,20);assert.equal((await refresh()).server.attempts.length,0,'real upload is not completion');
    await speaking.getByRole('button',{name:'提交口语练习',exact:true}).click();await speaking.getByText('服务端已接收完成。',{exact:true}).waitFor();
    await page.waitForFunction(()=>window.testServerState().attempts.length===1);assert.equal((await page.evaluate(()=>window.testServerState())).completedStepIds.length,0);
    const state=await page.evaluate(()=>window.testServerState());assert.equal(state.attempts[0].result.correct,null);assert.equal(state.attempts[0].result.score,null);
    await enter('dialogue');await select(2);const role=page.getByRole('region',{name:'分角色录音',exact:true});await role.getByRole('radio',{name:'左侧角色',exact:true}).check();
    const plan=(await recording.load(compiled.bindings.capsules.find(c=>c.kind==='learning'&&c.stepId===manifest.steps.find(s=>s.key==='dialogue').id).id,new AbortController().signal)).find(p=>p.kind==='dialogue-roleplay');
    for(const turn of plan.scenes[0].turns.filter(t=>t.side==='left')){
      if(await role.getByRole('button',{name:'播放对方台词',exact:true}).count())await role.getByRole('button',{name:'播放对方台词',exact:true}).click();
      await record(role,3,turn);assert.equal((await refresh()).server.attempts.length,1);
    }
    await role.getByRole('button',{name:'完成角色练习',exact:true}).click();await role.getByText('服务端已接收完成。',{exact:true}).waitFor();await page.waitForFunction(()=>window.testServerState().attempts.length===2);
    await role.getByRole('button',{name:'完成角色练习',exact:true}).click();await role.getByText('服务端已完成，无需重复提交。',{exact:true}).waitFor();assert.equal((await refresh()).server.attempts.length,2);
    await page.reload();await enter('dialogue');await select(2);await role.getByText('服务端已完成。',{exact:true}).waitFor();await enter('listen_speak');await select(1);await speaking.getByText('服务端已完成。',{exact:true}).waitFor();
    assert.equal((await page.evaluate(()=>window.testServerState())).attempts.length,2);
    assert(results.every(r=>r.score===null));assert(results.some(r=>r.status==='already-completed'));assert.deepEqual(uiErrors,[]);
    // Canceled Step reads are intentionally rejected; never exempt a write or completion.
    const cancellable=['tools','content','repeat','recording-load','recording-restore','recording-audio','refresh','activities','pages','patterns','restore'];
    assert.deepEqual(errors.filter(e=>!(cancellable.includes(e.operation)&&['LEARNING_BOUNDARY_GENERATION','LEARNING_BOUNDARY_GENERATION_OR_STEP','This operation was aborted'].includes(e.message)&&e.requestGeneration<e.currentGeneration)),[]);
    for(const request of requests){const serialized=JSON.stringify(request);assert(!/tenantId|studentId|versionId|sourceRevision|snapshotId|capsuleRef|objectKey|proof/.test(serialized));for(const a of source.activities)assert(!serialized.includes(a.id),'DB activity UUID on browser wire');}
    await page.evaluate(()=>window.testUnmount());const witness={snapshotId:manifest.snapshot.id,mountedRecording:true,speaking:true,roleplay:true,reload:true,serverAuthority:true,requests:requests.length};
    await writeFile('/tmp/uply-runtime-4a12-recording-sql.json',JSON.stringify(witness));return witness;
  }catch(error){throw new Error(`${error.message}\nBoundary errors: ${JSON.stringify(errors)}\nOperations: ${JSON.stringify(requests.map(r=>[r.operation,r.payload?.request?.op,r.payload?.generation]))}`);}
  finally{await browser?.close();await new Promise(r=>server.close(r));}
}

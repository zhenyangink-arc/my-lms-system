import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {compiled,manifest,content,context,state,source} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';

test('4A8 isolated Chromium + actual audit HTTP service (not authenticated owner E2E)',async t=>{
  const owner='synthetic-authorized-audit-owner';
  globalThis.__recordingOwnerAllowed=true;
  const route=await serverModule('tests/fixtures/recording-4a8-http.ts',{
    '@/lib/admin':'export async function requirePlatformOwner(){if(!globalThis.__recordingOwnerAllowed)throw Error("Forbidden");return {user:{id:"synthetic-authorized-audit-owner"}};}',
    '../../../lib/admin':'export async function requirePlatformOwner(){if(!globalThis.__recordingOwnerAllowed)throw Error("Forbidden");return {user:{id:"synthetic-authorized-audit-owner"}};}',
  });
  const auditData={source,result:compiled},sessionId=route.createRecordingAuditContinuation(owner,auditData),ctx={...context,runtimeSessionId:sessionId};
  const binder=await serverModule('src/features/smart-textbook-runtime/server/recording-binding.server.ts');
  const repeatApi=await serverModule('src/features/smart-textbook-runtime/server/guided-repeat.server.ts'),repeatStore=repeatApi.createPreviewRepeatStore();
  const plans=compiled.bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>binder.recordingPlans(manifest,compiled.bindings,c.id,'zh-CN'));
  const speaking=plans.find(p=>p.kind==='speaking-introduction'),role=plans.find(p=>p.kind==='dialogue-roleplay');
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-recording-browser',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  let failUpload=false,failDelete=false,hold=false,release=null;const bodies=[],responses=[];
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'||req.url==='/style.css'){const suffix=req.url.endsWith('.js')?'.js':'.css';res.setHeader('content-type',suffix==='.js'?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(suffix)).text);}
    if(req.url==='/data'){
      const previous=new URL(req.headers.referer??'http://localhost').searchParams.get('recordingAudit');
      if(previous)ctx.runtimeSessionId=route.createRecordingAuditContinuation(owner,auditData,previous);
      res.setHeader('content-type','application/json');return res.end(JSON.stringify({manifest,content,context:ctx,state,recording:true,guidedRepeat:true}));}
    if(req.url==='/repeat/load'||req.url==='/repeat/mark'){
      let body='';for await(const c of req)body+=c;const input=JSON.parse(body),lesson=repeatApi.repeatLesson(manifest,compiled.bindings,compiled.services,input.capsuleRef,'zh-CN');res.setHeader('content-type','application/json');
      return res.end(JSON.stringify(req.url==='/repeat/load'?(lesson?{lesson,state:repeatStore.read(owner,lesson)}:null):repeatStore.mark(owner,lesson,input.trackId,input.segmentId)));
    }
    if(req.url==='/api/smart-textbook-runtime-audit/recording'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);bodies.push(bytes.toString());
      if((failUpload&&req.headers['content-type']?.includes('multipart'))||(failDelete&&bytes.toString().includes('"op":"remove"'))){res.statusCode=503;return res.end('{}');}
      const input=new Request(`http://127.0.0.1:${server.address().port}${req.url}`,{method:'POST',headers:req.headers,body:bytes});
      const output=await route.POST(input);if(hold&&req.headers['content-type']?.includes('multipart'))await new Promise(r=>{release=r;});
      const result=Buffer.from(await output.arrayBuffer());if(output.headers.get('content-type')?.includes('json'))responses.push(result.toString());
      res.writeHead(output.status,Object.fromEntries(output.headers));return res.end(result);
    }
    res.setHeader('content-type','text/html');res.end('<html lang="zh-CN"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
    const page=await browser.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      // Actual Chromium MediaRecorder + generated audio MediaStream. No empty
      // recorder/Blob success stub. Only permission and elapsed wall time are controlled.
      window.recorderMode='allow';window.clockOffset=0;window.stoppedTracks=0;window.revoked=0;window.created=0;window.tts=[];window.audioPlayed=0;
      const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=async function(){await play.call(this);window.audioPlayed++;};
      const originalNow=performance.now.bind(performance);performance.now=()=>originalNow()+window.clockOffset;
      const originalGet=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=async constraints=>{
        if(window.recorderMode==='denied')throw new DOMException('Denied','NotAllowedError');
        const stream=await originalGet(constraints);for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{window.stoppedTracks++;stop();};}
        if(window.recorderMode==='deferred')await new Promise(resolve=>{window.releasePermission=resolve;});return stream;
      };
      window.originalRecorder=MediaRecorder;
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{window.created++;return create(b);};URL.revokeObjectURL=u=>{window.revoked++;revoke(u);};
      const speak=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{window.tts.push(u.text);speak(u);};
    });
    const url=`http://127.0.0.1:${server.address().port}`;await page.goto(url);
    const enter=async index=>{await page.getByRole('button',{name:manifest.steps[index].title['zh-CN'],exact:true}).click();};
    const sp=page.getByRole('region',{name:'独立口语表达',exact:true}),rp=page.getByRole('region',{name:'分角色录音',exact:true});
    const record=async(region,seconds=16)=>{
      await region.getByRole('button',{name:/^(开始录音|重新录制)$/}).click();try{await region.getByText('正在录音…',{exact:true}).waitFor();}catch{throw Error(await region.innerText());}
      // Enough real encoded samples for the existing 2 KiB minimum; duration
      // acceleration explicitly tests browser-reported policy, not trusted listening.
      await page.waitForTimeout(650);await page.evaluate(n=>{window.clockOffset+=n*1000;},seconds);
      await region.getByRole('button',{name:'停止录音',exact:true}).click();await region.getByRole('button',{name:'上传录音',exact:true}).waitFor();
    };
    await enter(5);await sp.getByRole('button',{name:'开始录音',exact:true}).waitFor();
    await t.test('permission denied and unsupported MediaRecorder errors allow recovery',async()=>{
      await page.evaluate(()=>{window.recorderMode='denied';});await sp.getByRole('button',{name:'开始录音',exact:true}).click();await sp.getByText('无法使用麦克风，请允许权限后重试。',{exact:true}).waitFor();
      await page.evaluate(()=>{window.recorderMode='allow';window.MediaRecorder=undefined;});await sp.getByRole('button',{name:'开始录音',exact:true}).click();await sp.getByText('当前浏览器不支持录音，请换用支持麦克风的浏览器。',{exact:true}).waitFor();await page.evaluate(()=>{window.MediaRecorder=window.originalRecorder;});
    });
    await t.test('actual recording start/stop, duration rejection, local playback, failed upload/retry',async()=>{
      await sp.getByRole('button',{name:'开始录音',exact:true}).click();await sp.getByText('正在录音…',{exact:true}).waitFor();await page.waitForTimeout(650);await sp.getByRole('button',{name:'停止录音',exact:true}).click();await sp.getByText('请至少录制 15 秒后重试。',{exact:true}).waitFor();
      await record(sp);await sp.getByRole('button',{name:'播放录音',exact:true}).click();
      failUpload=true;await sp.getByRole('button',{name:'上传录音',exact:true}).click();await sp.getByText('上传失败，本地录音仍保留；请重试上传。',{exact:true}).waitFor();failUpload=false;
      await sp.getByRole('button',{name:'上传录音',exact:true}).click();await sp.getByText(/录音已保存/).waitFor();assert.ok(await page.evaluate(()=>window.stoppedTracks>=2));
      await page.waitForFunction(()=>window.audioPlayed>0);
    });
    await t.test('empty recorder output is rejected in mounted UI, never uploaded',async()=>{
      const before=bodies.filter(b=>b.includes('name="recording"')).length;
      await page.evaluate(()=>{window.MediaRecorder=class{state='inactive';mimeType='audio/webm';start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([],{type:this.mimeType})});this.onstop?.();}};});
      await sp.getByRole('button',{name:'重新录制',exact:true}).click();await sp.getByRole('button',{name:'停止录音',exact:true}).click();await sp.getByText('录音为空或过短，请重新录制。',{exact:true}).waitFor();
      assert.equal(bodies.filter(b=>b.includes('name="recording"')).length,before);await page.evaluate(()=>{window.MediaRecorder=window.originalRecorder;});
      assert.equal(await sp.getByRole('button',{name:'提交口语练习'}).isDisabled(),true);
      await sp.getByRole('button',{name:'重试恢复',exact:true}).click();await sp.getByText(/录音已保存/).waitFor();
    });
    await t.test('speaking <4 rejects, valid criteria accepted without formal completion; reload restores bytes',async()=>{
      for(let i=0;i<4;i++)await sp.getByRole('combobox').nth(i).selectOption({index:1});
      for(let i=0;i<3;i++)await sp.getByRole('checkbox').nth(i).check();await sp.getByRole('button',{name:'提交口语练习'}).click();await sp.getByRole('alert').waitFor();
      await sp.getByRole('checkbox').nth(3).check();await sp.getByRole('button',{name:'提交口语练习'}).click();await sp.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
      await sp.screenshot({path:'/tmp/runtime-4a8-speaking.png'});
      const oldSession=ctx.runtimeSessionId;await page.reload();await enter(5);await sp.getByText(/录音已保存/).waitFor();await sp.getByRole('button',{name:'播放录音',exact:true}).click();assert.notEqual(ctx.runtimeSessionId,oldSession);
    });
    await t.test('rerecord, delete failure preserves recording, retry deletion succeeds',async()=>{
      await record(sp);await sp.getByRole('button',{name:'上传录音',exact:true}).click();await sp.getByText(/录音已保存/).waitFor();failDelete=true;
      await sp.getByRole('button',{name:'删除录音',exact:true}).click();await sp.getByText('删除失败，已保存录音未清除；请重试删除。',{exact:true}).waitFor();failDelete=false;await sp.getByRole('button',{name:'删除录音',exact:true}).click();await sp.getByText('尚未录音',{exact:true}).waitFor();
    });
    await t.test('Step dispose aborts recording; delayed upload cannot update the new Step',async()=>{
      await sp.getByRole('button',{name:'开始录音',exact:true}).click();await sp.getByText('正在录音…',{exact:true}).waitFor();const before=await page.evaluate(()=>window.stoppedTracks);await enter(7);assert.ok(await page.evaluate(()=>window.stoppedTracks)>before);await enter(5);await sp.getByRole('button',{name:'开始录音',exact:true}).waitFor();
      await record(sp);hold=true;await sp.getByRole('button',{name:'上传录音'}).click();await new Promise(resolve=>{const timer=setInterval(()=>{if(release){clearInterval(timer);resolve();}},10);});await enter(7);hold=false;release();release=null;assert.equal(await sp.count(),0);
    });
    await t.test('permission resolution after Step disposal stops late MediaStream',async()=>{
      await enter(5);await sp.getByRole('button',{name:'重新录制',exact:true}).waitFor();await page.evaluate(()=>{window.recorderMode='deferred';});
      await sp.getByRole('button',{name:'重新录制',exact:true}).click();await page.waitForFunction(()=>typeof window.releasePermission==='function');const before=await page.evaluate(()=>window.stoppedTracks);
      await enter(7);await page.evaluate(()=>{window.releasePermission();window.recorderMode='allow';});await page.waitForFunction(n=>window.stoppedTracks>n,before);
    });
    await t.test('full recall recording uses same isolated service and stable track target',async()=>{
      await enter(5);const recall=page.getByRole('region',{name:'逐句跟读',exact:true}),track=recall.getByRole('article').first();
      await track.getByRole('button',{name:'开始录音',exact:true}).waitFor();await record(track,2);await track.getByRole('button',{name:'上传录音',exact:true}).click();await track.getByText(/录音已保存/).waitFor();
      assert.equal(await recall.getByRole('button',{name:'提交口语练习'}).count(),0);
      await page.reload();await enter(5);await recall.getByRole('article').first().getByText(/录音已保存/).waitFor();
      assert.equal(await recall.getByText('已练习',{exact:true}).count(),0);
    });
    for(const side of ['left','right'])await t.test(`role ${side}: counterpart TTS, student evidence, full turns, restore and retry`,async()=>{
      await page.evaluate(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});
      await enter(4);await rp.getByRole('radio',{name:side==='left'?'左侧角色':'右侧角色',exact:true}).check();
      const turns=role.scenes[0].turns.filter(t=>t.side===side);
      for(let i=0;i<turns.length;i++){
        if(await rp.getByRole('button',{name:'播放对方台词',exact:true}).count())await rp.getByRole('button',{name:'播放对方台词',exact:true}).click();
        await record(rp,2);await rp.getByRole('button',{name:'上传录音',exact:true}).click();await rp.getByRole('button',{name:new RegExp('已录，可重试.*'+turns[i].text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).waitFor();
        if(i===0){await page.reload();await enter(4);await rp.getByRole('radio',{name:side==='left'?'左侧角色':'右侧角色',exact:true}).check();}
      }
      await rp.getByRole('button',{name:'完成角色练习',exact:true}).click();await rp.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
      await rp.getByRole('button',{name:'完成角色练习',exact:true}).click();await rp.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
      const retry=rp.getByRole('button').filter({hasText:turns[0].text}).first();await retry.click();await record(rp,2);await rp.getByRole('button',{name:'上传录音',exact:true}).click();await rp.getByText(/录音已保存/).waitFor();
      await rp.getByRole('button',{name:'完成角色练习',exact:true}).click();await rp.getByText('预览已通过，不计入正式进度。',{exact:true}).waitFor();
      await rp.getByRole('button').filter({hasText:turns.at(-1).text}).first().click();
    });
    await t.test('stable target commands, no manufactured play, private payload scan and owner denial',async()=>{
      const current=role.scenes[0].turns.filter(t=>t.side==='right').at(-1);
      for(const command of ['reveal','focus','highlight'])await page.evaluate(({target,command})=>window.testCommand(target,command),{target:current.target,command});
      await assert.rejects(page.evaluate(target=>window.testCommand(target,'play'),current.target));
      assert.ok(await page.evaluate(()=>window.tts.length>0));
      await rp.screenshot({path:'/tmp/runtime-4a8-roleplay.png'});
      const text=responses.join('\n');for(const secret of ['objectKey','object_key','tenantId','studentId','answer_key','signedUrl','proof','service_role'])assert.ok(!text.includes(secret),secret);
      for(const body of bodies.filter(b=>b.startsWith('{')))for(const secret of ['tenantId','studentId','objectKey','score','completionPercent'])assert.ok(!body.includes(`"${secret}"`),secret);
      globalThis.__recordingOwnerAllowed=false;const response=await fetch(`${url}/api/smart-textbook-runtime-audit/recording`,{method:'POST',headers:{origin:url,'content-type':'application/json'},body:JSON.stringify({sessionId,snapshotId:manifest.snapshot.id,op:'load',capsuleRef:speaking.capsuleRef})});assert.equal(response.status,403);globalThis.__recordingOwnerAllowed=true;
      await page.evaluate(()=>window.testUnmount());assert.ok(await page.evaluate(()=>window.revoked>0));
    });
    assert.deepEqual(errors,[]);
  }finally{release?.();await browser?.close();await new Promise(r=>server.close(r));delete globalThis.__recordingAudit;delete globalThis.__recordingOwnerAllowed;}
});

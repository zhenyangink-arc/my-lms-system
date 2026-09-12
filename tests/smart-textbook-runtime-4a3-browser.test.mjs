import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {compiled,manifest,content,context,state} from './fixtures/runtime-4a.mjs';
const {repeatLesson,createPreviewRepeatStore}=await import('../src/features/smart-textbook-runtime/server/guided-repeat.server.ts');

test('4A-3 isolated Chromium: mounted repeat executor (NOT authenticated owner E2E)',async t=>{
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-4a3-browser',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const capsule=compiled.bindings.capsules.find(c=>c.kind==='learning'&&c.sections.some(s=>s.slot==='repeatTracks'));
  const lesson=repeatLesson(manifest,compiled.bindings,compiled.services,capsule.id,'zh-CN'),store=createPreviewRepeatStore();
  let marks=0,hold=false,release=null;
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'||req.url==='/style.css'){const js=req.url.endsWith('.js');res.setHeader('content-type',js?'text/javascript':'text/css');return res.end(bundle.outputFiles.find(f=>f.path.endsWith(js?'.js':'.css')).text);}
    res.setHeader('content-type','application/json');
    if(req.url==='/data')return res.end(JSON.stringify({manifest,content,context,state,guidedRepeat:true}));
    if(req.method==='POST'){
      let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);
      const bound=repeatLesson(manifest,compiled.bindings,compiled.services,input.capsuleRef,'zh-CN');
      if(req.url==='/repeat/load')return res.end(JSON.stringify(bound?{lesson:bound,state:store.read('isolated-owner',bound)}:null));
      if(req.url==='/repeat/mark'&&bound){marks++;const result=store.mark('isolated-owner',bound,input.trackId,input.segmentId);if(hold)await new Promise(r=>{release=r;});return res.end(JSON.stringify(result));}
      throw Error('Unknown service');
    }
    res.setHeader('content-type','text/html');res.end('<html lang="zh-CN"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch{res.statusCode=400;res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.repeatUtterances=[];window.repeatCancelled=0;window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],speak:u=>window.repeatUtterances.push(u),cancel:()=>window.repeatCancelled++}});});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const enter=async()=>{await page.getByRole('button',{name:manifest.steps[5].title['zh-CN'],exact:true}).click();await page.getByRole('region',{name:'逐句跟读',exact:true}).waitFor();};
    const region=page.getByRole('region',{name:'逐句跟读',exact:true});
    const line=id=>region.locator(`[data-runtime-target="${lesson.tracks.flatMap(t=>t.segments).find(s=>s.id===id).target}"]`);
    await enter();
    await t.test('two tracks / fourteen mounted stable parts, each current sentence plays and marks practice only',async()=>{
      assert.equal(await region.getByRole('heading',{level:4}).count(),2);assert.equal(await region.getByRole('button',{name:/^播放：/}).count(),14);
      for(const track of lesson.tracks)for(const segment of track.segments){
        const card=line(segment.id),before=await page.evaluate(()=>window.repeatUtterances.length);
        await card.getByRole('button',{name:/^播放：/}).click();await page.waitForFunction(n=>window.repeatUtterances.length===n+1,before);
        assert.equal(await page.evaluate(()=>window.repeatUtterances.at(-1).text),segment.text);
        assert.equal(await card.getByText('已练习',{exact:true}).count(),0);
        await page.evaluate(()=>window.repeatUtterances.at(-1).onend());await card.getByText('已练习',{exact:true}).waitFor();
      }
      assert.equal(marks,14);assert.equal(store.read('isolated-owner',lesson).practicedSegmentIds.length,14);
      assert.equal(store.read('isolated-owner',lesson).formalCompletion,false);assert.equal(store.read('isolated-owner',lesson).progressDelta,null);
      assert.equal(await page.locator('nav').count(),1);
    });
    await t.test('repeat save idempotent and browser reload restores all isolated server markers',async()=>{
      await line(lesson.tracks[0].segments[0].id).getByRole('button',{name:/^播放：/}).click();await page.evaluate(()=>window.repeatUtterances.at(-1).onend());
      await line(lesson.tracks[0].segments[0].id).getByText('已练习',{exact:true}).waitFor();assert.equal(store.read('isolated-owner',lesson).practicedSegmentIds.length,14);
      await page.reload();await enter();assert.equal(await region.getByText('已练习',{exact:true}).count(),14);
    });
    await t.test('stop and Step dispose cancel actual owner; late onend cannot mark',async()=>{
      const before=marks,card=line(lesson.tracks[0].segments[0].id);
      await card.getByRole('button',{name:/^播放：/}).click();await page.evaluate(()=>{window.lateRepeatEnd=window.repeatUtterances.at(-1).onend;});await card.getByRole('button',{name:'停止',exact:true}).click();
      await page.evaluate(()=>window.lateRepeatEnd());assert.equal(marks,before);
      await card.getByRole('button',{name:/^播放：/}).click();await page.evaluate(()=>{window.lateRepeatEnd=window.repeatUtterances.at(-1).onend;});
      await page.getByRole('button',{name:manifest.steps[7].title['zh-CN'],exact:true}).click();await page.evaluate(()=>window.lateRepeatEnd());assert.equal(marks,before);assert.ok(await page.evaluate(()=>window.repeatCancelled>=2));await enter();
    });
    await t.test('stable targets reveal/focus/highlight; declared line play uses real TTS without saving a practice marker',async()=>{
      const segment=lesson.tracks[0].segments[0];
      for(const command of ['reveal','focus','highlight'])await page.evaluate(({target,command})=>window.testCommand(target,command),{target:segment.target,command});
      assert.equal(await line(segment.id).getAttribute('data-runtime-highlight'),'true');
      const before=marks;
      await page.evaluate(target=>{window.targetRepeatPlayback=window.testCommand(target,'play');},segment.target);
      await page.evaluate(()=>window.repeatUtterances.at(-1).onend());
      await page.evaluate(()=>window.targetRepeatPlayback);
      assert.equal(marks,before);
      await assert.rejects(page.evaluate(target=>window.testCommand(target,'open'),segment.target));
    });
    await t.test('pending save response cannot revive disposed Step; server practice marker remains idempotent',async()=>{
      hold=true;const segment=lesson.tracks[1].segments[0];await line(segment.id).getByRole('button',{name:/^播放：/}).click();await page.evaluate(()=>window.repeatUtterances.at(-1).onend());
      await new Promise(resolve=>{const timer=setInterval(()=>{if(release){clearInterval(timer);resolve();}},10);});
      await page.getByRole('button',{name:manifest.steps[7].title['zh-CN'],exact:true}).click();hold=false;release();release=null;
      assert.equal(await region.count(),0);await enter();assert.equal(await region.getByText('已练习',{exact:true}).count(),14);
    });
    await t.test('unsupported browser and playback errors do not save and allow retry',async()=>{
      const card=line(lesson.tracks[0].segments[0].id),before=marks;
      await card.getByRole('button',{name:/^播放：/}).click();await page.evaluate(()=>window.repeatUtterances.at(-1).onerror());await region.getByRole('alert').waitFor();assert.equal(marks,before);
      await page.evaluate(()=>{delete window.speechSynthesis;});await card.getByRole('button',{name:/^播放：/}).click();await region.getByText('当前浏览器不支持跟读播放，请换用支持语音播放的浏览器。',{exact:true}).waitFor();assert.equal(marks,before);
    });
    assert.deepEqual(errors,[]);
  }finally{release?.();await browser?.close();await new Promise(r=>server.close(r));}
});

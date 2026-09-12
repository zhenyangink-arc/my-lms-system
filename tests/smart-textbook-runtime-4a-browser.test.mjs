import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { compiled,manifest,content,context,state,gradePreview } from './fixtures/runtime-4a.mjs';
const {contentUtterances}=await import('../src/features/smart-textbook-runtime/server/content-playback.server.ts');
import { minimalManifest,blockManifest } from './fixtures/smart-textbook-runtime-v1/samples.mjs';

test('actual React Renderer in Chromium: layouts, 8 Steps, MC server roundtrip, targets and lifecycle',async t=>{
  const bundle=await build({entryPoints:['tests/fixtures/runtime-4a-browser.tsx'],bundle:true,write:false,outdir:'/tmp/runtime-4a-generated',platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
  let selected=structuredClone(manifest),submissions=[],delaySubmit=false,releaseSubmit,presentationTools,sceneImage=false,imageFailure=false;
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(js);}
    if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css);}
    if(req.url==='/data'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({manifest:selected,context:{...context,snapshotId:selected.snapshot.id},state:{...state,snapshotId:selected.snapshot.id},content,presentationTools,sceneImage}));}
    // Explicit isolated image transport; never presented as real textbook artwork.
    if(req.url==='/scene-image'){if(imageFailure){res.statusCode=503;return res.end();}res.setHeader('content-type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pN8AAAAASUVORK5CYII=','base64'));}
    if(req.url==='/submit'){let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);submissions.push(input);if(delaySubmit)await new Promise(r=>releaseSubmit=r);res.setHeader('content-type','application/json');return res.end(JSON.stringify(await gradePreview(input.ref,input.response)));}
    res.setHeader('content-type','text/html');res.end('<html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  }catch{res.statusCode=500;res.end('test transport rejected');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}`;
  try{
    await t.test('chapter toolbar follows real Step position and fullscreen exits without resetting learning',async()=>{
      await page.goto(url);await page.locator('.runtime-chapter-location').waitFor();
      assert.equal(await page.locator('.runtime-chapter-location strong').innerText(),manifest.chapter.title['zh-CN']);
      assert.equal(await page.locator('.runtime-chapter-location span').innerText(),'1 / 8');
      await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();
      assert.equal(await page.locator('.runtime-chapter-location span').innerText(),'2 / 8');
      await page.getByRole('button',{name:'全屏',exact:true}).click();
      await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('lesson-runtime'));
      await page.getByRole('button',{name:'退出全屏',exact:true}).click();
      await page.waitForFunction(()=>!document.fullscreenElement);
      assert.equal(await page.locator('.runtime-chapter-location span').innerText(),'2 / 8');
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.locator('.runtime-toolbar').evaluate(e=>e.scrollWidth<=e.clientWidth));
      await page.setViewportSize({width:1440,height:1000});
      await page.getByRole('button',{name:manifest.steps[0].title['zh-CN'],exact:true}).click();
    });
    await t.test('scene bytes mount locally, failure preserves teaching content, retry and Step disposal revoke Blob',async()=>{
      sceneImage=true;imageFailure=true;
      await page.addInitScript(()=>{window.revokedImages=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=u=>{window.revokedImages.push(u);revoke(u);};});
      await page.goto(url);await page.getByRole('button',{name:'重试图片'}).waitFor();
      assert.equal(await page.locator('form').count(),3);
      imageFailure=false;await page.getByRole('button',{name:'重试图片'}).click();
      const img=page.locator('.runtime-scene-image img');await img.waitFor();await page.waitForFunction(()=>document.querySelector('.runtime-scene-image img')?.naturalWidth>0);
      const blob=await img.getAttribute('src');assert.match(blob,/^blob:/);
      await page.getByRole('button',{name:selected.steps[1].title['zh-CN'],exact:true}).click();
      await page.waitForFunction(u=>window.revokedImages.includes(u),blob);assert.equal(await page.locator('.runtime-scene-image').count(),0);
      await page.getByRole('button',{name:selected.steps[0].title['zh-CN'],exact:true}).click();
      sceneImage=false;
    });
    await t.test('strict Runtime refuses genuinely unsupported video; minimal native Runtime activates',async()=>{
      selected=blockManifest('video');
      await page.goto(url+'/?mode=strict');await page.getByRole('alert').waitFor();assert.match(await page.locator('body').innerText(),/暂不能激活/);
      selected=minimalManifest();await page.reload();await page.locator('.lesson-runtime').waitFor();assert.equal(await page.locator('nav').count(),1);selected=structuredClone(manifest);
    });
    await t.test('orientation all three: actual radio selection → real server grader → feedback; no completion write',async()=>{
      await page.goto(url);await page.locator('form').first().waitFor();assert.equal(await page.locator('form').count(),3);
      for(const form of await page.locator('form').all()){await form.locator('input').first().check();await form.getByRole('button',{name:'提交答案',exact:true}).click();await form.getByText('回答正确',{exact:true}).waitFor();assert.match(await form.innerText(),/预览检查/);}
      assert.equal(new Set(submissions.map(s=>s.ref)).size,3);assert.equal(await page.locator('nav').count(),1);
    });
    await t.test('dialogue tabs use frozen group IDs, keyboard selection and Teacher reveal selects hidden group',async()=>{
      const block=manifest.blocks.find(b=>b.type==='compat.learning.v1');
      const groups=content[block.props.capsuleRef].cards.find(c=>c.section==='dialogueGroups').children;
      const tabs=page.getByRole('tablist',{name:'选择对话组'});
      assert.equal(await tabs.getByRole('tab').count(),4);
      await tabs.getByRole('tab').first().focus();await page.keyboard.press('End');
      assert.equal(await tabs.getByRole('tab').last().getAttribute('aria-selected'),'true');
      const line=groups[0].children[0],target=manifest.runtimeTargets.find(t=>t.blockId===block.id&&t.partId===line.partId);
      await page.evaluate(async id=>{await window.testCommand(id,'reveal');await window.testCommand(id,'focus');},target.id);
      assert.equal(await tabs.getByRole('tab').first().getAttribute('aria-selected'),'true');
      assert.equal(await page.getByRole('tabpanel').count(),1);
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-runtime-target')),target.id);
      await tabs.getByRole('tab').last().click();await page.reload();
      await page.waitForFunction(()=>document.querySelector('[role=tablist] [role=tab]:last-child')?.getAttribute('aria-selected')==='true');
      await tabs.getByRole('tab').first().click();
      await page.setViewportSize({width:390,height:844});
      assert.equal(await tabs.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      await page.setViewportSize({width:1440,height:1000});
    });
    await t.test('mounted stable part reveal focus highlight; unavailable play rejected; dispose cancels highlight',async()=>{
      const block=manifest.blocks.find(b=>b.type==='compat.learning.v1');
      const flatten=cards=>cards.flatMap(c=>[c,...flatten(c.children)]);
      const target=manifest.runtimeTargets.find(t=>t.blockId===block.id&&t.partId&&t.capabilities.includes('reveal')&&flatten(content[block.props.capsuleRef].cards).some(c=>c.partId===t.partId));
      await page.waitForFunction(id=>document.querySelectorAll('[data-runtime-target]').length>10,target.id);
      await page.evaluate(async id=>{await window.testCommand(id,'reveal');await window.testCommand(id,'focus');await window.testCommand(id,'highlight');},target.id);
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-runtime-target')),target.id);
      assert.equal(await page.locator('[data-runtime-highlight]').count(),1);
      assert.equal(await page.evaluate(async id=>{try{await window.testCommand(id,'play');return false;}catch{return true;}},target.id),true);
      await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();assert.equal(await page.locator('[data-runtime-highlight]').count(),0);
    });
    await t.test('all eight Step titles/order and scoped contents, stable-id reload',async()=>{
      for(const step of manifest.steps){await page.getByRole('button',{name:step.title['zh-CN'],exact:true}).click();await page.getByRole('heading',{level:1,name:step.title['zh-CN'],exact:true}).waitFor();await page.locator('[data-region="interaction.main"] article').first().waitFor();assert.equal(await page.locator('nav').count(),1);}
      await page.reload();await page.getByRole('heading',{level:1,name:manifest.steps[7].title['zh-CN'],exact:true}).waitFor();
    });
    await t.test('late submission cannot render old feedback after Step unmount',async()=>{
      await page.getByRole('button',{name:manifest.steps[0].title['zh-CN'],exact:true}).click();delaySubmit=true;
      const form=page.locator('form').first();await form.locator('input').first().check();await form.getByRole('button',{name:'提交答案',exact:true}).click();
      while(!releaseSubmit)await new Promise(r=>setTimeout(r,10));
      await page.getByRole('button',{name:manifest.steps[1].title['zh-CN'],exact:true}).click();releaseSubmit();delaySubmit=false;
      await page.getByRole('heading',{name:'核心词汇',exact:true}).waitFor();assert.equal(await page.locator('form').count(),0);assert.equal(await page.getByText('回答正确',{exact:true}).count(),0);
    });
    await t.test('teaching reveal opens collapsed Region using a handle, no selector commands',async()=>{
      await page.getByRole('button',{name:manifest.steps[0].title['zh-CN'],exact:true}).click();
      await page.getByRole('button',{name:'收起教学区',exact:true}).click();const block=manifest.blocks.find(b=>b.type==='compat.teacher.v1');
      await page.evaluate(id=>window.testCommand(id,'reveal'),block.runtimeTarget);assert.equal(await page.locator('.lesson-runtime').getAttribute('data-collapsed'),'false');
    });
    await t.test('split/stacked layout, ratio, collapsed teaching and bounded responsive layout',async()=>{
      assert.equal(await page.locator('.lesson-runtime').getAttribute('data-ratio'),'30-70');
      await page.getByRole('button',{name:'收起教学区',exact:true}).click();assert.equal(await page.locator('.lesson-runtime').getAttribute('data-collapsed'),'true');
      await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.runtime-classroom').evaluate(el=>getComputedStyle(el).display),'grid');
      selected.layout.preset='stacked-classroom';selected.layout.desktopRatio='50-50';await page.reload();await page.locator('.lesson-runtime').waitFor();assert.equal(await page.locator('.lesson-runtime').getAttribute('data-layout'),'stacked-classroom');
      await page.evaluate(()=>window.testUnmount());assert.equal(await page.locator('.lesson-runtime').count(),0);
    });
    await t.test('group playback waits for each real onend; group switch and Step disposal cancel the queue',async()=>{
      selected=structuredClone(manifest);
      presentationTools=Object.fromEntries(selected.blocks.filter(b=>b.type==='compat.learning.v1').map(b=>[b.props.capsuleRef,{
        snapshotId:selected.snapshot.id,capsuleRef:b.props.capsuleRef,navigation:[],playback:contentUtterances(compiled.bindings,b.props.capsuleRef).map(p=>({...p,kind:'browser-tts',locale:'ko-KR',target:selected.runtimeTargets.find(t=>t.blockId===b.id&&t.partId===p.partId).id})),
      }]));
      await page.addInitScript(()=>{window.spoken=[];window.cancelled=0;window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.spoken.push(u);},cancel(){window.cancelled++;}}});});
      await page.goto(url);await page.getByRole('button',{name:selected.steps[0].title['zh-CN'],exact:true}).click();
      const tabs=page.getByRole('tablist',{name:'选择对话组'});await tabs.getByRole('tab').first().click();
      await page.getByRole('button',{name:'整组播放',exact:true}).click();await page.waitForFunction(()=>window.spoken.length===1);
      await page.evaluate(()=>window.spoken[0].onend());await page.waitForFunction(()=>window.spoken.length===2);
      await page.evaluate(()=>window.spoken[1].onend());await page.getByRole('button',{name:'停止播放',exact:true}).waitFor({state:'hidden'});
      await page.getByRole('button',{name:'整组播放',exact:true}).click();await page.waitForFunction(()=>window.spoken.length===3);
      await tabs.getByRole('tab').nth(1).click();assert.equal(await page.evaluate(()=>window.spoken[2].onend),null);
      await page.getByRole('button',{name:'整组播放',exact:true}).click();await page.waitForFunction(()=>window.spoken.length===4);
      await page.getByRole('button',{name:selected.steps[1].title['zh-CN'],exact:true}).click();assert.equal(await page.evaluate(()=>window.spoken[3].onend),null);
      assert.ok(await page.evaluate(()=>window.cancelled)>=2);presentationTools=undefined;
    });
    await t.test('support drawer opens via stable target, all desktop ratio presets remain bounded',async()=>{
      selected=minimalManifest();const b=selected.blocks[0];b.region='interaction.support';selected.steps[0].regions=[{region:b.region,blockIds:[b.id]}];selected.regions.push({id:'interaction.support',role:'support',parent:'interaction',content:'blocks',allowedBlockTypes:['text']});selected.layout.supportPresentation='drawer';
      await page.setViewportSize({width:1440,height:1000});
      for(const ratio of ['30-70','40-60','50-50']){selected.layout.desktopRatio=ratio;await page.goto(url);await page.locator('details').waitFor();assert.equal(await page.locator('.lesson-runtime').getAttribute('data-ratio'),ratio);await page.evaluate(id=>window.testCommand(id,'reveal'),b.runtimeTarget);assert.equal(await page.locator('details').getAttribute('open'),'');}
    });
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

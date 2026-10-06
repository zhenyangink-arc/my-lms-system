// Source-reference component comparison. Does not launch Next, load env files,
// contact a DB, or claim parity with the deployed 8443 compiled build.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,stat,symlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {chromium} from '@playwright/test';
import {catalog,workbench} from '../tests/fixtures/release-8443-reconcile.mjs';
import {manifest,context,state,content} from '../tests/fixtures/runtime-4a.mjs';

const root=process.cwd(),referenceRef='b14a6e01952592c6830a2ff617f0141280c636e0';
const output=process.env.UPLY_RECONCILE_EVIDENCE_DIR||await mkdtemp(path.join(tmpdir(),'uply-reconcile-browser-'));
await mkdir(output,{recursive:true});
const reference=path.join(output,'reference-source');await mkdir(reference,{recursive:true});
// Only sanitized src bytes are extracted. No Git metadata, env, public binaries or private evidence.
const archive=execFileSync('git',['archive',referenceRef,'src'],{cwd:root,maxBuffer:40*1024*1024});
execFileSync('tar',['-x','-C',reference],{input:archive});
await symlink(path.join(root,'node_modules'),path.join(reference,'node_modules'),'dir');
const allowedDifferences=[
 'Native video/pause-question editor is present only in current main; protected main feature, absent in release source. Reference shows an explicit fixture placeholder.',
 'Bounded R1 shared hint event fix: original release first touch tap fails (focus opens then click closes); candidate preserves first/second/third tap toggle plus outside dismissal, ignores touch compatibility mouseleave, and closes on Escape while returning focus. Original source failure is explicitly recorded, not adapted.',
 'Current main subcategory naming, CreateTeachingContentEntry, timezone/subject/native publication controls are allowed Gate differences; fixture comparison covers common mounted component surfaces, not authenticated page authorization.',
];
const adapters=[
 'Both bundles use the exact same fixture TSX/data, with all src imports mapped to their respective source tree. Next Link/navigation/dynamic and server-action/DB/media transports are synthetic only.',
 'Runtime mounts real RuntimeClassroom with omitTeacher=true in inspection context, projected safe fixture content, no activation or live teacher/media. The same projected data is supplied to both source versions.',
 'The standalone RuntimeToolbar callback is mounted directly in both versions. No reference production locale-threading fix is applied.',
 'Reference TeachingVideoPilotEditor import is an explicit absent-feature placeholder; it is excluded from shared visual parity and tested on candidate only.',
];
const calls=`function record(name,args){window.reconcileCalls.push({name,args:args.map(v=>v instanceof FormData?[...v.entries()]:v)});}`;
const actionSource=names=>calls+names.map(name=>`export async function ${name}(...args){record(${JSON.stringify(name)},args);
 if(${JSON.stringify(name)}==='chapterWorkbenchAction') {const i=args[0];if(location.search.includes('error'))return {ok:false,message:'隔离请求被拒绝'};if(i.operation==='begin')return {ok:true,kind:'begin',state:'editing',inflight:0};if(i.operation==='read')return {ok:true,kind:'read',data:${JSON.stringify(workbench)}};if(i.operation==='check')return {ok:true,kind:'check',check:{snapshotId:'fixture',digest:'${'b'.repeat(64)}',expected:null,steps:1,activities:1}};if(i.operation==='publish')return {ok:true,kind:'publish',pointer:{snapshotId:'fixture',generation:1}};return {ok:true,kind:'save'};}
 if(${JSON.stringify(name)}==='saveTeachingScriptNodeAction')return {status:'success',message:'隔离草稿保存成功'};
 if(${JSON.stringify(name)}==='inspectSelectedVideoAssetAction')return {ok:true,asset:{assetId:'course-video-sample01',title:'隔离视频',sizeBytes:5487747,videoDurationSeconds:30,containerDurationSeconds:30.016,previewUrl:'/synthetic-video'}};
 if(${JSON.stringify(name)}==='listTeacherVideosAction')return {ok:true,items:[]};return {ok:true};}`).join('\n');
const files={};const closure={};const sourceHashes={};
for(const [label,sourceRoot] of [['reference',reference],['candidate',root]]) {
 const plugin={name:'isolated-reference-transports',setup(p){
  p.onResolve({filter:/^next\/(link|navigation|dynamic)$/},a=>({path:a.path,namespace:'next-stub'}));
  p.onLoad({filter:/.*/,namespace:'next-stub'},a=>({loader:'jsx',resolveDir:root,contents:a.path==='next/link'?'import React from "react";export default function Link({prefetch,replace,scroll,...props}){return <a {...props}/>;}':a.path==='next/dynamic'?'import React from "react";export default function dynamic(loader,options){const C=React.lazy(loader);return props=><React.Suspense fallback={options?.loading?.()}><C {...props}/></React.Suspense>;}':'export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){},push(href){window.reconcileCalls.push({navigation:href});}});export const useSearchParams=()=>new URLSearchParams(location.search);'}));
  p.onResolve({filter:/./},async a=>{
   if(a.namespace==='next-stub'||a.namespace==='synthetic')return;
   let target=a.path.startsWith('@/')?path.join(sourceRoot,'src',a.path.slice(2)):a.path.startsWith('.')?path.resolve(a.resolveDir,a.path):a.path.startsWith('/')?a.path:null;
   if(!target)return;
   if(target.startsWith(path.join(root,'src')+path.sep))target=path.join(sourceRoot,path.relative(root,target));
   if(!target.startsWith(path.join(sourceRoot,'src')+path.sep))return;
   const normalized=target.replaceAll(path.sep,'/');
   if(normalized.endsWith('/features/courses/api/service'))return {path:'course-data',namespace:'synthetic'};
   if(normalized.endsWith('/TeachingVideoPilotEditor')&&label==='reference')return {path:'pilot-absent',namespace:'synthetic'};
   if(normalized.endsWith('/CourseCoverUploadField'))return {path:'cover-upload',namespace:'synthetic'};
   if(normalized.endsWith('/LessonResourceSourceField'))return {path:'resource-source',namespace:'synthetic'};
   if(normalized.endsWith('/digital-textbook-action-dialogs'))return {path:'content-dialog',namespace:'synthetic'};
   for(const candidate of [target,target+'.tsx',target+'.ts',target+'.mjs',path.join(target,'index.tsx'),path.join(target,'index.ts')]) {
    try{if(!(await stat(candidate)).isFile())continue;}catch{continue;}
    if(/(?:actions|catalog-actions|teacher-video-actions)\.ts$/.test(candidate))return {path:candidate,namespace:'actions'};
    return {path:candidate};
   }
   return {path:target};
  });
  p.onLoad({filter:/.*/,namespace:'actions'},async a=>{const s=await readFile(a.path,'utf8'),names=[...s.matchAll(/export async function (\w+)/g)].map(m=>m[1]);return {contents:actionSource(names),loader:'js'};});
  p.onLoad({filter:/.*/,namespace:'synthetic'},a=>({loader:'jsx',resolveDir:root,contents:a.path==='course-data'?`export async function getCourseManagementData(){const q=new URLSearchParams(location.search);return {...${JSON.stringify(catalog)},canManage:!q.has('readonly'),categories:q.has('empty')?[]:${JSON.stringify(catalog.categories)},courses:q.has('empty')?[]:${JSON.stringify(catalog.courses)},lessons:q.has('empty')?[]:${JSON.stringify(catalog.lessons)},chapters:q.has('empty')?[]:${JSON.stringify(catalog.chapters)},catalogErrorMessage:q.has('error')?'隔离课程读取失败':null};}`:a.path==='pilot-absent'?'import React from "react";export function TeachingVideoPilotEditor(){return <p data-reference-absent="native-editor">Release source has no native video editor; protected current feature.</p>;}':a.path==='cover-upload'?'export const CourseCoverUploadField=()=>null;':a.path==='resource-source'?'export const LessonResourceSourceField=()=>null;':'import React from "react";export function DigitalTextbookContentDialog(){return <p role="status">隔离内容编辑传输</p>;}'}));
 }};
 const result=await build({entryPoints:[path.join(root,'tests/fixtures/release-8443-reconcile.tsx')],bundle:true,write:false,outfile:path.join(output,label+'.js'),platform:'browser',jsx:'automatic',metafile:true,nodePaths:[path.join(root,'node_modules')],define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[plugin]});
 closure[label]=Object.keys(result.metafile.inputs).filter(f=>f.includes('/src/')||f.startsWith('src/'));sourceHashes[label]={};for(const file of closure[label]){try{sourceHashes[label][file]=createHash('sha256').update(await readFile(path.resolve(root,file))).digest('hex');}catch{/* Synthetic namespaces are recorded separately as adapters. */}}files[label]={js:result.outputFiles.find(f=>f.path.endsWith('.js')).contents};
 const cssSource=await readFile(path.join(sourceRoot,'src/app/globals.css'),'utf8');
 // Explicit common fixture + selected-source tree scanning avoids reliance on cwd auto-discovery.
 const css=(await postcss([tailwind({base:root})]).process(cssSource+`\n@source "${path.join(sourceRoot,'src')}";\n@source "${path.join(root,'tests/fixtures/release-8443-reconcile.tsx')}";`,{from:path.join(sourceRoot,'src/app/globals.css')})).css;
 files[label].css=css+'\n'+await readFile(path.join(sourceRoot,'src/features/smart-textbook-runtime/components/runtime.css'),'utf8');
 await writeFile(path.join(output,label+'.js'),files[label].js);await writeFile(path.join(output,label+'.css'),files[label].css);
}
const result={passed:false,referenceRef,scope:'Synthetic mounted real components; source reference only; live8443/DB/auth/runtime activation NOT VALIDATED',adapters,allowedDifferences,checks:[],visual:[],errors:[],failures:[],referenceKnownIssues:[],deniedRequests:[],closure,sourceHashes};
result.fixtureHashes={};for(const file of ['scripts/verify-release-8443-reconcile.mjs','tests/fixtures/release-8443-reconcile.tsx','tests/fixtures/release-8443-reconcile.mjs'])result.fixtureHashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture.invalid');const label=u.pathname.startsWith('/reference/')?'reference':'candidate';
 if(u.pathname.endsWith('/app.js')){res.setHeader('content-type','text/javascript');return res.end(files[label].js);}
 if(u.pathname.endsWith('/style.css')){res.setHeader('content-type','text/css');return res.end(files[label].css);}
 if(u.pathname==='/runtime-data'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({manifest,context,state,content}));}
 if(u.pathname.startsWith('/api/')){res.writeHead(404);return res.end();}
 res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="zh-CN" data-management-workspace="platform"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${label}/style.css"></head><body><div id="root"></div><script src="/${label}/app.js"></script></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
async function mounted(page,label,surface,query=''){
 await page.goto(`${origin}/${label}/?surface=${surface}${query}`);await page.waitForFunction(()=>document.documentElement.dataset.fixtureReady||document.documentElement.dataset.fixtureError);assert.equal(await page.locator('html').getAttribute('data-fixture-error'),null);await page.locator('#root > main').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(120);
}
async function snapshot(page,label,surface,width,mode='light'){
 await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),mode==='dark');
 const screenshot=path.join(output,`${label}-${surface}-${width}-${mode}.png`);const png=await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'});
 return {png:png.toString('base64'),screenshot,sha256:createHash('sha256').update(png).digest('hex'),text:await page.locator('#root').innerText()};
}
async function diff(page,a,b,name){
 // Decode and compare actual screenshot pixels in local browser Canvas. No package install.
 const d=await page.evaluate(async({a,b})=>{async function load(s){const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();return i;}const [i,j]=await Promise.all([load(a),load(b)]),w=Math.max(i.width,j.width),h=Math.max(i.height,j.height),ca=document.createElement('canvas'),cb=document.createElement('canvas');ca.width=cb.width=w;ca.height=cb.height=h;const x=ca.getContext('2d'),y=cb.getContext('2d');x.drawImage(i,0,0);y.drawImage(j,0,0);const aa=x.getImageData(0,0,w,h),bb=y.getImageData(0,0,w,h);let changed=0;const dd=x.createImageData(w,h);for(let p=0;p<aa.data.length;p+=4){let delta=0;for(let k=0;k<4;k++)delta=Math.max(delta,Math.abs(aa.data[p+k]-bb.data[p+k]));if(delta>8){changed++;dd.data[p]=255;dd.data[p+3]=255;}else{dd.data[p]=aa.data[p]/3;dd.data[p+1]=aa.data[p+1]/3;dd.data[p+2]=aa.data[p+2]/3;dd.data[p+3]=255;}}x.putImageData(dd,0,0);return {width:w,height:h,changed,total:w*h,referenceSize:[i.width,i.height],candidateSize:[j.width,j.height],png:ca.toDataURL('image/png').split(',')[1]};},{a:a.png,b:b.png});
 const file=path.join(output,name+'-diff.png');await writeFile(file,Buffer.from(d.png,'base64'));delete d.png;result.visual.push({name,...d,ratio:d.changed/d.total,reference:a.screenshot,candidate:b.screenshot,diff:file,referenceHash:a.sha256,candidateHash:b.sha256});
 assert.deepEqual(d.referenceSize,d.candidateSize,`screenshot dimensions: ${name}`);assert.equal(a.text,b.text,`visible text: ${name}`);assert.ok(d.changed/d.total<0.001,`pixel difference exceeds 0.1%: ${name} ${(d.changed/d.total*100).toFixed(3)}%`);
}
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();result.deniedRequests.push(route.request().url());return route.abort();});
 const pages={reference:await context.newPage(),candidate:await context.newPage()};for(const [label,p]of Object.entries(pages)){p.setDefaultTimeout(10000);p.on('pageerror',e=>result.errors.push({label,message:e.message}));}
 for(const surface of ['catalog','textbook','workbench','grammar','toolbar','runtime'])for(const width of [390,768,1440]){
  const shots={};for(const label of ['reference','candidate']){const p=pages[label];await p.setViewportSize({width,height:1000});await mounted(p,label,surface);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label} ${surface} ${width} page overflow`);shots[label]=await snapshot(p,label,surface,width);}
  await diff(pages.candidate,shots.reference,shots.candidate,`${surface}-${width}-light`);
  if(width===1440){for(const label of ['reference','candidate'])shots[label]=await snapshot(pages[label],label,surface,width,'dark');await diff(pages.candidate,shots.reference,shots.candidate,`${surface}-${width}-dark`);}
 }
 result.checks.push('Six common real component surfaces: 390/768/1440 light +1440 dark, identical text/dimensions, <=0.1% screenshot pixel difference, no page overflow.');
 for(const label of ['reference','candidate']){
  const p=pages[label];await p.setViewportSize({width:1440,height:1000});
  await mounted(p,label,'catalog','&folder=lesson:lesson');assert.match(await p.getByRole('list',{name:'当前目录内容'}).getByRole('link').first().getAttribute('href'),/node=chapter&id=cda24.*folder=lesson%3Alesson#course-content/);result.checks.push(`${label}: lesson directory retains chapter detail and folder URL`);
  await mounted(p,label,'catalog','&readonly');assert.equal(await p.getByRole('button',{name:/新建/}).count(),0);
  await mounted(p,label,'catalog','&error');assert.match(await p.locator('body').innerText(),/隔离课程读取失败/);
  await mounted(p,label,'catalog','&empty');assert.match(await p.locator('body').innerText(),/暂无|没有/);
  await mounted(p,label,'textbook');const chapter=p.getByRole('navigation',{name:'选择教材章节'}).getByRole('button').first();await chapter.focus();await p.keyboard.press('Enter');assert.match(p.url(),/chapter=cda24/);
  assert.equal(await p.getByRole('link',{name:/打开内容工作台/}).getAttribute('href'),'/workbench');assert.match(await p.getByRole('link',{name:/查看本章课程结构/}).getAttribute('href'),/chapter=cda24/);
  await p.getByRole('button',{name:'检查与发布',exact:true}).click();await p.getByRole('button',{name:'教材设置',exact:true}).click();await p.getByRole('button',{name:'内容制作',exact:true}).click();
  const hint=p.getByRole('button',{name:'学习步骤与互动题目的制作入口'});assert.equal(await hint.evaluate(e=>document.activeElement===e),false);await hint.hover();await p.getByRole('tooltip').waitFor();await p.keyboard.press('Escape');await p.waitForTimeout(100);assert.equal(await hint.evaluate(e=>document.activeElement===e),true,'Escape returns focus');
  if(label==='candidate'){assert.equal(await hint.getAttribute('aria-expanded'),'false','Hover Escape must remain closed after focus returns');result.checks.push('Candidate hover Escape closes tooltip and returns trigger focus without reopening.');}
  else{assert.equal(await hint.getAttribute('aria-expanded'),'true','Original reference hover Escape defect remains unadapted');result.referenceKnownIssues.push({label,check:'Hover Escape closes after focus return',expanded:'true',disposition:'Inherited original-source FAIL explicitly allowed by R1 focus-order fix'});}
  await p.mouse.move(0,0);assert.equal(await hint.getAttribute('aria-expanded'),'false');await hint.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');await p.getByRole('tooltip').waitFor();assert.equal(await hint.getAttribute('aria-expanded'),'true');assert.notEqual(await hint.evaluate(e=>getComputedStyle(e).getPropertyValue('box-shadow')),'none');await p.screenshot({path:path.join(output,label+'-hint-focus.png')});await p.keyboard.press('Enter');assert.equal(await hint.getAttribute('aria-expanded'),'false');await p.keyboard.press('Space');assert.equal(await hint.getAttribute('aria-expanded'),'true');await p.keyboard.press('Escape');assert.equal(await hint.getAttribute('aria-expanded'),'false');if(label==='candidate'){await hint.dispatchEvent('pointerdown',{pointerType:'touch',bubbles:true});await hint.dispatchEvent('pointercancel',{pointerType:'touch',bubbles:true});await p.keyboard.press('Space');assert.equal(await hint.getAttribute('aria-expanded'),'true','Keyboard works after canceled pointer gesture');await p.keyboard.press('Enter');assert.equal(await hint.getAttribute('aria-expanded'),'false');result.checks.push('Candidate pointercancel does not suppress subsequent Space/Enter keyboard activation.');}
  await mounted(p,label,'textbook','&readonly');assert.equal(await p.getByRole('link',{name:/打开内容工作台/}).count(),0);assert.equal(await p.getByRole('button',{name:'编辑词汇',exact:true}).count(),0);assert.match(await p.locator('body').innerText(),/只读查看/);
  await mounted(p,label,'textbook','&empty');assert.match(await p.locator('body').innerText(),/暂无可查看/);
  await mounted(p,label,'textbook');await p.getByRole('textbox',{name:'搜索章节'}).fill('不存在');assert.match(await p.locator('body').innerText(),/没有匹配章节/);
  await mounted(p,label,'workbench');assert.equal(await p.getByRole('button',{name:'编辑题干与答案',exact:true}).isDisabled(),true);p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'进入编辑',exact:true}).click();await p.getByRole('button',{name:'编辑题干与答案',exact:true}).click();await p.getByLabel('中文题干',{exact:true}).fill('隔离修改题干');await p.getByLabel('正确选项（仅负责人可见）').selectOption('1');await p.getByRole('button',{name:'保存题目',exact:true}).click();await p.getByText('题干和正确选项已一并保存，尚未发布。',{exact:true}).waitFor();
  const save=await p.evaluate(()=>window.reconcileCalls.find(x=>x.name==='chapterWorkbenchAction'&&x.args[0].operation==='save').args[0]);assert.equal(save.prompt,'隔离修改题干');assert.equal(save.answerIndex,1);assert.equal(save.activityId,'33333333-3333-4333-8333-333333333333');
  await p.getByRole('button',{name:'编辑语法文字',exact:true}).click();await p.getByLabel('功能说明（中文）',{exact:true}).fill('隔离功能说明');await p.getByRole('button',{name:'保存语法文字',exact:true}).click();await p.getByText('语法文字和稳定身份映射已保存，尚未发布。请重新校验并发布。',{exact:true}).waitFor();const grammarSave=await p.evaluate(()=>window.reconcileCalls.find(x=>x.name==='chapterWorkbenchAction'&&x.args[0].operation==='save-grammar').args[0]);assert.equal(grammarSave.cardId,'22222222-2222-4222-8222-222222222222');assert.equal(grammarSave.expected,'a'.repeat(64));assert.equal(grammarSave.patch.function['zh-CN'],'隔离功能说明');assert.deepEqual(Object.keys(grammarSave.patch).sort(),['caution','form','function','source']);await p.getByRole('button',{name:'校验发布',exact:true}).click();assert.equal(await p.getByRole('button',{name:'发布校验版本',exact:true}).isDisabled(),true);await p.getByRole('button',{name:'校验待发布内容',exact:true}).click();await p.getByText('校验通过。发布将再次检查内容和当前发布版本。',{exact:true}).waitFor();p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'发布校验版本',exact:true}).click();await p.getByText(/发布成功。测试账号请返回课程/).waitFor();const publish=await p.evaluate(()=>window.reconcileCalls.find(x=>x.name==='chapterWorkbenchAction'&&x.args[0].operation==='publish').args[0]);assert.equal(publish.digest,'b'.repeat(64));assert.equal(publish.expected,null);await p.screenshot({path:path.join(output,label+'-workbench-published.png')});
  await mounted(p,label,'workbench','&readonly');assert.match(await p.locator('body').innerText(),/当前只读/);assert.equal(await p.getByRole('button',{name:'编辑题干与答案',exact:true}).count(),0);
  await mounted(p,label,'workbench','&error');p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'进入编辑',exact:true}).click();await p.getByRole('alert').filter({hasText:'隔离请求被拒绝'}).waitFor();assert.equal(await p.getByRole('button',{name:'编辑题干与答案',exact:true}).isDisabled(),true);
  await mounted(p,label,'workbench','&empty');assert.match(await p.locator('body').innerText(),/0 个学习步骤/);
  await mounted(p,label,'toolbar');p.once('dialog',d=>d.dismiss());await p.getByRole('combobox',{name:'语言',exact:true}).selectOption('ko-KR');assert.equal(await p.evaluate(()=>window.reconcileCalls.length),0);p.once('dialog',d=>d.accept());await p.getByRole('combobox',{name:'语言',exact:true}).selectOption('ko-KR');await p.getByRole('combobox',{name:'언어',exact:true}).waitFor();assert.deepEqual(await p.evaluate(()=>window.reconcileCalls),[{locale:'ko-KR'}]);
  await mounted(p,label,'toolbar','&error');p.once('dialog',d=>d.accept());await p.getByRole('combobox',{name:'语言',exact:true}).selectOption('ko-KR');await p.getByRole('status').filter({hasText:'语言切换失败'}).waitFor();assert.equal(await p.getByRole('combobox').inputValue(),'zh-CN');assert.equal(await p.getByRole('combobox').isEnabled(),true);
  await mounted(p,label,'runtime');for(const step of manifest.steps){await p.getByRole('button',{name:step.title['zh-CN'],exact:true}).click();await p.getByRole('heading',{level:1,name:step.title['zh-CN'],exact:true}).waitFor();}assert.equal(await p.locator('nav').count(),1);
  result.checks.push(`${label}: catalog empty/error/read-only; chapter keyboard/history/cross-navigation; studio tabs/search/read-only; mouse hover/leave + keyboard Tab/focus/Enter/Space/Escape hint; workbench begin/save/grammar-CAS/check/publish exact synthetic payloads+failure+read-only+empty; toolbar cancel/success/failure; runtime eight ordered steps`);
 }
 const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});await touch.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 for(const label of ['reference','candidate']){const p=await touch.newPage();await mounted(p,label,'textbook');const hint=p.getByRole('button',{name:'学习步骤与互动题目的制作入口'});await hint.tap();await p.waitForTimeout(150);const expanded=await hint.getAttribute('aria-expanded');const visible=await p.getByRole('tooltip').count()>0;await p.screenshot({path:path.join(output,label+'-hint-touch.png')});if(label==='reference'){
   assert.equal(expanded,'false','Original reference touch defect must remain unadapted');assert.equal(visible,false);
   result.referenceKnownIssues.push({label,check:'First touch tap opens CardTitleWithHint',expanded,visible,evidence:path.join(output,label+'-hint-touch.png'),disposition:'Inherited original-source FAIL explicitly allowed by R1 bounded candidate event fix'});
  }else{
   assert.equal(expanded,'true','Candidate first touch tap must open');assert.equal(visible,true);
   await hint.tap();await p.waitForTimeout(150);assert.equal(await hint.getAttribute('aria-expanded'),'false','Second touch tap closes');assert.equal(await p.getByRole('tooltip').count(),0);
   await hint.tap();await p.waitForTimeout(150);assert.equal(await hint.getAttribute('aria-expanded'),'true','Third touch tap opens');await p.getByRole('tooltip').waitFor();
   await p.getByRole('heading',{name:'你好',exact:true}).tap();await p.waitForTimeout(150);assert.equal(await hint.getAttribute('aria-expanded'),'false','Outside touch dismisses');assert.equal(await p.getByRole('tooltip').count(),0);
   result.checks.push('Candidate390px touch: first tap opens, second closes, third opens, outside tap dismisses; original source defect retained and explicitly allowed.');
  }await p.close();}await touch.close();
 const p=pages.candidate;await p.setViewportSize({width:1440,height:1000});await mounted(p,'reference','editor');assert.equal(await p.locator('[data-reference-absent="native-editor"]').count(),1);
 for(const width of [390,768,1440]){await p.setViewportSize({width,height:1000});await mounted(p,'candidate','editor');await p.locator('[data-video-pilot-editor]').waitFor();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`native editor ${width} overflow`);await snapshot(p,'candidate','editor',width);}
 await p.getByLabel('暂停时间（秒）',{exact:true}).fill('-1');await p.getByRole('button',{name:/保存视频草稿/}).click();await p.getByRole('alert').waitFor();assert.equal(await p.evaluate(()=>window.reconcileCalls.filter(x=>x.name==='saveTeachingScriptNodeAction').length),0);await p.getByLabel('暂停时间（秒）',{exact:true}).fill('12.5');await p.getByLabel('关联单选题',{exact:true}).selectOption('33333333-3333-4333-8333-333333333333');assert.equal(await p.locator('[data-dirty]').getAttribute('data-dirty'),'true');await p.getByRole('button',{name:/保存视频草稿/}).click();await p.waitForFunction(()=>window.reconcileCalls.some(x=>x.name==='saveTeachingScriptNodeAction'));const form=await p.evaluate(()=>window.reconcileCalls.find(x=>x.name==='saveTeachingScriptNodeAction').args[1]);assert.ok(form.some(([k,v])=>k==='node_id'&&v==='44444444-4444-4444-8444-444444444444'));assert.ok(form.some(([k,v])=>k==='video_pilot_intent'&&v==='save'));const savedDraft=JSON.parse(form.find(([k])=>k==='video_pilot_json')[1]);assert.equal(savedDraft.contract,'video-pilot-authoring/1');assert.deepEqual(savedDraft.cue,{id:'pause-1',atSeconds:12.5,activityId:'33333333-3333-4333-8333-333333333333'});await p.waitForFunction(()=>document.querySelector('[data-dirty]')?.dataset.dirty==='false');
 await mounted(p,'candidate','editor','&readonly');assert.equal(await p.getByRole('button',{name:/保存视频草稿/}).count(),0);assert.equal(await p.getByLabel('暂停时间（秒）',{exact:true}).isDisabled(),true);assert.equal(await p.getByLabel('关联单选题',{exact:true}).isDisabled(),true);result.checks.push('Candidate-only protected native editor: 390/768/1440, invalid pause rejected locally; dirty/manual save pause+activity payload+readonly; explicit absent release placeholder.');
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.deniedRequests,[]);assert.deepEqual(result.failures,[],'Meaningful interaction failures require review');result.passed=true;
}catch(error){result.failure=error.stack;throw error;}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));result.cleanup='Chromium contexts and ephemeral loopback server closed in finally; source/artifacts retained for review.';await writeFile(path.join(output,'validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,checks:result.checks,visualComparisons:result.visual.length,failure:result.failure,evidence:output},null,2));
}

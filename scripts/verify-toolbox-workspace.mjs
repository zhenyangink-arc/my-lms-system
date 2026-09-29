// Real listing/components, isolated data and Action transports. No production access.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from '@playwright/test';

const root = process.cwd();
const dir = await mkdtemp(path.join(tmpdir(), 'uply-toolbox-ui-'));
const word = {id:'word',ko:'안녕',zh:'你好',pos:'感叹词',collocation:'',transcription:'',source:'custom',sortOrder:1};
const courses = [{id:'course',title:'隔离测试课程',lessons:[{id:'lesson',title:'问候',textbooks:[{id:'book',title:'测试教材',status:'published',chapters:[{id:'chapter',number:1,status:'published',versionId:'version',versionNumber:1,versionStatus:'published',nodes:[{id:'node',vocabulary:[word]}],grammarNodes:[]}]}]}]}];
const data = {hasError:false,canManage:true,courseTree:[{id:'course',title:'隔离测试课程'}],vocabularyLibrary:[word],grammarLibrary:[],toolboxItems:[{id:'tool',title:'单词练习',description:'复习已学词汇',slug:'words',href:'/tools/words',iconName:'Book',relatedCourseId:'course',isEnabled:true,sortOrder:1}]};
const actions = (await Promise.all(['growth-toolbox','digital-textbook'].map(name=>readFile(`src/app/dashboard/admin/${name}/actions.ts`,'utf8')))).join('\n');
const actionNames = [...actions.matchAll(/export async function (\w+)/g)].map(m=>m[1]);
await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client';
import Listing from './src/features/growth-toolbox/components/growth-toolbox-listing';
window.calls=[]; (async()=>{const content=await Listing({studentAppId:'test-app',chapterId:new URLSearchParams(location.search).has('noChapter')?undefined:'chapter'});
createRoot(document.getElementById('root')).render(<main data-dashboard-ui="management" data-management-workspace="platform" style={{padding:24,maxWidth:1400,margin:'auto'}}>{content}</main>);})();`,loader:'tsx',resolveDir:root},outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated',setup(p){
  p.onResolve({filter:/^(next\/navigation|@\/lib\/auth)$/},a=>({path:a.path,namespace:'isolated'}));
  p.onResolve({filter:/api\/(service|actions|chapter-practice-actions)$/},a=>({path:a.path,namespace:'isolated'}));
  p.onResolve({filter:/@\/app\/dashboard\/admin\/.*\/actions$/},a=>({path:a.path,namespace:'isolated'}));
  p.onLoad({filter:/.*/,namespace:'isolated'},a=>({loader:'js',contents:
    a.path==='next/navigation'?'export const useRouter=()=>({refresh(){}});':
    a.path==='@/lib/auth'?'export const requireActiveUser=async()=>({supabase:{from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null,error:null})};return q}}});':
    a.path.includes('chapter-practice-actions')?'export async function reviewChapterPracticeAction(input){window.calls.push(input);return {ok:true,message:"隔离保存成功"}}':
    a.path.endsWith('/actions')?actionNames.map(n=>`export async function ${n}(){return {status:'error',message:'本测试不保存独立资源'}}`).join('\n'):
    a.path.includes('digital-textbook')?`export async function getDigitalTextbookManagementData(){return ${JSON.stringify({hasError:false,courses})}}`:
    `export async function getGrowthToolboxManagementData(){const d=${JSON.stringify(data)};if(new URLSearchParams(location.search).has('readonly'))d.canManage=false;return d;}`
  }));
}}]});
const css=(await postcss([tailwind({base:root})]).process(await readFile('src/app/globals.css','utf8'),{from:path.join(root,'src/app/globals.css')})).css;
const js=await readFile(path.join(dir,'app.js'));
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/style.css'?css:'<!doctype html><html lang="zh-CN" data-management-workspace="platform"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const checks=[];
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);
  await page.getByRole('heading',{name:'本章教材练习引用'}).waitFor();
  const confirm=page.getByRole('button',{name:'确认关联到练习'});
  assert.equal(await confirm.isDisabled(),true);
  await page.getByRole('checkbox',{name:'我已核对完整内容，确认用于本章练习。'}).check();
  await page.getByRole('tab',{name:'独立练习库',exact:true}).click();
  await page.getByRole('tab',{name:'章节练习',exact:true}).click();
  assert.equal(await confirm.isEnabled(),true);
  await confirm.click();
  await page.getByText('隔离保存成功').waitFor();
  const calls=await page.evaluate(()=>window.calls);
  assert.equal(calls.length,1);assert.equal(calls[0].chapterId,'chapter');assert.equal(calls[0].snapshot.length,1);
  checks.push('章节默认展示；核对门禁保留；切换不丢确认状态；真实关联组件提交正确范围');
  await page.screenshot({path:path.join(dir,'chapter.png'),fullPage:true});
  await page.getByRole('tab',{name:'独立练习库',exact:true}).click();
  await page.getByRole('cell',{name:'你好',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'教材原文'}).isVisible(),false);
  await page.getByText('从教材添加 · 所选章节',{exact:true}).click();
  await page.getByRole('heading',{name:'教材原文'}).waitFor();
  await page.getByRole('tab',{name:'语法',exact:true}).click();
  await page.getByRole('heading',{name:'独立语法库',exact:true}).waitFor();
  await page.screenshot({path:path.join(dir,'library.png'),fullPage:true});
  checks.push('教材复制按需展开；词汇/语法切换；独立库与章节引用分离');
  await page.getByRole('tab',{name:'工具设置'}).click();
  assert.equal(await page.getByRole('columnheader',{name:/学生端路径/}).count(),0);
  await page.getByRole('cell',{name:'隔离测试课程',exact:true}).waitFor();
  const search=page.getByRole('textbox',{name:'搜索工具入口'});
  await search.fill('不存在');await page.getByText('没有符合条件的工具入口').waitFor();
  await page.getByRole('tab',{name:'章节练习',exact:true}).click();
  await page.getByRole('tab',{name:'工具设置'}).click();assert.equal(await search.inputValue(),'不存在');
  await search.fill('');
  await page.screenshot({path:path.join(dir,'settings.png'),fullPage:true});
  await page.getByRole('tab',{name:'工具设置'}).focus();await page.keyboard.press('Home');
  assert.equal(await page.getByRole('tab',{name:'章节练习',exact:true}).getAttribute('aria-selected'),'true');
  checks.push('技术列默认隐藏；搜索状态保留；键盘 Home 切换');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await page.screenshot({path:path.join(dir,'dark.png'),fullPage:true});
  checks.push('手机默认页无横向溢出；深色截图');
  await page.goto(url+'?noChapter');await page.getByText('在上方选择章节与教材版本后，可核对并关联本章教材练习。').waitFor();
  await page.goto(url+'?readonly');await page.getByText('当前权限仅可查看独立练习库和工具设置，不能管理章节练习关联。').waitFor();
  assert.equal(await page.getByRole('button',{name:'确认关联到练习'}).count(),0);
  checks.push('未选章节与只读权限明确提示，不暴露关联操作');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(dir,'result.json'),JSON.stringify({checks,browserErrors:errors,productionAccess:false},null,2));
  console.log(JSON.stringify({passed:checks.length,evidence:dir,checks},null,2));
} finally {await browser?.close();await new Promise(r=>server.close(r));}

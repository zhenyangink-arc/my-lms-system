import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

test('course structure: real listing navigation, scope, search, status, details and responsive layout', {timeout:120000}, async()=>{
  const base={description:'',sort_order:10,is_published:true,is_manually_locked:false,unlock_mode:'immediate',duration_minutes:20};
  const data={canManage:true,dashboardBasePath:'/platform/dashboard',categories:[{...base,id:'cat',title:'韩语课程',slug:'korean',parent_id:null}],courses:[{...base,id:'course',title:'韩语初级',slug:'level-one',category_id:'cat'}],lessons:Array.from({length:8},(_,i)=>({...base,id:`lesson-${i}`,title:`第 ${i+1} 课：${i===0?'你好！':'日常交流'}`,slug:`lesson-${i}`,course_id:'course',sort_order:i,is_published:i!==7})),chapters:[{...base,id:'chapter',title:'初次见面',slug:'hello',lesson_id:'lesson-0',completion_rule:'test_passed',chapter_test_id:null}],resources:[]};
  const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Listing from './src/features/courses/components/course-catalog-listing';const q=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(await Listing({searchParams:Promise.resolve(Object.fromEntries(q)),studentAppId:'app',routeBasePath:'/',textbookRoute:'/textbooks'}));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-transport',setup(b){
    b.onResolve({filter:/api\/service$/},a=>a.importer.endsWith('course-catalog-listing.tsx')?{path:'data',namespace:'test'}:undefined);
    b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));
    b.onResolve({filter:/course-catalog-action-dialogs$/},()=>({path:'dialogs',namespace:'test'}));
    b.onResolve({filter:/lesson-resources-table$/},()=>({path:'resources',namespace:'test'}));
    b.onResolve({filter:/lesson-resource-action-dialogs$/},()=>({path:'resource-action',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},a=>({loader:'jsx',resolveDir:process.cwd(),contents:a.path==='data'?`export async function getCourseManagementData(){return {...${JSON.stringify(data)},canManage:!location.search.includes('readonly')}}`:a.path==='link'?`import React from'react';export default function Link({prefetch,...p}){return <a {...p}/>} `:a.path==='resources'?`import React from'react';export function LessonResourcesTable(){return <p>暂无资料</p>}`:a.path==='resource-action'?`import React from'react';export function CreateLessonResourceDialog(){return <button>新增资料</button>}`:`import React from'react';export function CourseCatalogEditDialog({node}){return <button className="min-h-11 rounded-lg border px-4 text-sm" onClick={()=>alert(node.id)}>编辑</button>}export function CourseCatalogCreateDialog({target}){return <button className="min-h-11 rounded-lg border px-4 text-sm">{target.title}</button>}` }));
  }}]});
  const css=(await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:process.cwd()+'/src/app/globals.css'})).css;
  const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html; charset=utf-8');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main class="p-4" data-dashboard-ui="management" data-management-workspace="platform"><div id="root"></div></main><script type="module" src="/bundle.js"></script></body></html>');});
  let browser;
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);await page.getByText('切换目录',{exact:true}).click();
    await page.getByRole('navigation',{name:'分类与课程'}).getByRole('link',{name:/韩语初级/}).click();await page.getByRole('heading',{name:'韩语初级',exact:true}).waitFor();
    const items=page.getByRole('list',{name:'当前目录内容'});
    assert.match(page.url(),/folder=course/);assert.equal(await items.getByRole('link').count(),8);
    assert.equal(await items.getByRole('button',{name:'编辑',exact:true}).count(),0);
    await page.getByLabel('查找当前目录').fill('第 1 课');assert.equal(await items.getByRole('link').count(),1);await page.getByLabel('查找当前目录').fill('');
    await page.getByLabel('开放状态',{exact:true}).selectOption('draft');assert.equal(await items.getByRole('link').count(),1);await page.getByLabel('开放状态',{exact:true}).selectOption('all');
    await page.getByRole('link',{name:/第 1 课：你好/}).click();await page.getByRole('heading',{name:'第 1 课：你好！',exact:true}).waitFor();
    assert.equal(await items.locator('[aria-current="true"]').count(),1);
    const editDialog=page.waitForEvent('dialog');const clicking=page.locator('#course-content').getByRole('button',{name:'编辑',exact:true}).click();const edit=await editDialog;assert.equal(edit.message(),'lesson-0');await edit.accept();await clicking;
    await page.reload();await page.getByRole('heading',{name:'课时资料',exact:true}).waitFor();
    await mkdir('/tmp/uply-course-workspace-visual',{recursive:true});
    for(const width of [1440,375]){await page.setViewportSize({width,height:960});await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:`/tmp/uply-course-workspace-visual/${width}.png`,fullPage:true,animations:'disabled'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:'/tmp/uply-course-workspace-visual/dark.png',fullPage:true,animations:'disabled'});
    await page.getByRole('link',{name:'管理章节',exact:true}).click();await items.getByRole('link',{name:/初次见面/}).click();await page.getByRole('heading',{name:'初次见面',exact:true}).waitFor();
    await page.getByRole('link',{name:'收起详情'}).click();await page.getByRole('heading',{name:'选择内容，开始管理'}).waitFor();
    await page.getByText('切换目录',{exact:true}).click();
    await page.getByLabel('搜索分类或课程').fill('没有');await page.getByText('没有匹配的分类或课程',{exact:true}).waitFor();
    await page.goto(url+'?readonly&folder=course:course&node=lesson&id=lesson-0');await page.getByRole('heading',{name:'课时资料',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'编辑',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:/新建/}).count(),0);assert.equal(await page.getByRole('button',{name:'新增资料'}).count(),0);
    await page.goto(url+'?folder=course:missing');await page.getByText('当前目录不存在或不可访问。请从左侧重新选择。').waitFor();assert.equal(await page.getByRole('button',{name:/新建/}).count(),0);
    await page.goto(url+'?folder=course:course&node=lesson&id=missing');await page.getByRole('heading',{name:'未找到所选内容'}).waitFor();
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});

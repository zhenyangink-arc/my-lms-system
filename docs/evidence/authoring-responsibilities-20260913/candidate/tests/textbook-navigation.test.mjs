import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

test('textbook management: scoped workbench, visible editors, legacy publication and read-only access', { timeout: 120000 }, async () => {
  const modules = ['orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review'].map(code=>({code,nodeCount:1}));
  const chapters = Array.from({length:17},(_,i)=>i===1?'cda24fb8-c93b-4a19-9577-4418350ff708':`chapter-${i}`).map((id,i)=>({id,number:i,title:i===0?'课程导览':i===1?'你好！':`练习主题 ${i}`,slug:`chapter-${i+1}`,status:'published',versionId:'v1',versionNumber:1,versionStatus:'published',modules,nodes:[{id:`node-${i}`,vocabulary:[{ko:'안녕하세요',zh:'你好',pos:'',collocation:'',transcription:''},{ko:'학생',zh:'学生',pos:'',collocation:'',transcription:''}]}],grammarNodes:[]}));
  const data = {hasError:false,canManage:true,canPublishChapters:true,courses:[{id:'course',title:'韩语课程',lessons:[{id:'lesson',title:'韩语一级',textbooks:[{id:'book',title:'韩语教材',slug:'korean-level-one',status:'published',chapters}]}]}]};
  const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Listing from './src/features/digital-textbook/components/digital-textbook-listing';import {CourseWorkflowNavigation} from './src/app/dashboard/admin/apps/CourseWorkflowNavigation';const q=new URLSearchParams(location.search);const navigation=await CourseWorkflowNavigation({access:{app:{slug:'korean'},scope:'platform',globalRole:q.has('readonly')?'platform_admin':'platform_owner',capabilities:{manageContent:true},appId:'test',appPath:'/platform/dashboard/admin/apps/korean'},section:'textbooks',chapterId:q.get('chapter')||undefined});createRoot(document.getElementById('root')).render(<>{navigation}{await Listing({studentAppId:'test',chapterId:q.get('chapter')||undefined,workbenchHref:q.has('readonly')?undefined:'/platform/dashboard/admin/apps/korean/textbooks/workbench',courseStructureRoute:'/content'})}</>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-transport',setup(b){
    b.onResolve({filter:/api\/service$/},a=>(a.importer.endsWith('digital-textbook-listing.tsx')||a.importer.endsWith('CourseWorkflowNavigation.tsx'))?{path:'data',namespace:'test'}:undefined);
    b.onResolve({filter:/^next\/(navigation|dynamic|link)$/},a=>({path:a.path,namespace:'test'}));
    b.onResolve({filter:/digital-textbook-action-dialogs$/},()=>({path:'dialog',namespace:'dialog'}));
    b.onLoad({filter:/.*/,namespace:'dialog'},()=>({contents:'export const DigitalTextbookContentDialog = null;'}));
    b.onResolve({filter:/admin\/digital-textbook\/actions$/},()=>({path:'actions',namespace:'test'}));
b.onLoad({filter:/.*/,namespace:'test'},a=>({loader:'jsx',resolveDir:process.cwd(),contents:a.path==='data'?`export async function getDigitalTextbookManagementData(){const d=${JSON.stringify(data)};if(location.search.includes('readonly')){d.canManage=false;d.canPublishChapters=false;}if(location.search.includes('error')){d.hasError=true;d.courses=[];}return d;}`:a.path==='next/navigation'?`export const useRouter=()=>({refresh(){}});export const useSearchParams=()=>new URLSearchParams(location.search);`:a.path==='next/link'?`import React from 'react';export default function Link(p){return <a {...p}/>}`:a.path==='next/dynamic'?`import React from 'react';export default function dynamic(){return p=><div role="dialog" aria-label={p.panel}>原编辑器传参：{p.panel}<button onClick={()=>p.onOpenChange(false)}>关闭</button></div>}`:`export async function publishTextbookChapterAction(){throw Error('unexpected mutation')}export async function setTextbookStatusAction(){throw Error('unexpected mutation')}` }));
  }}]});
  const css=(await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:process.cwd()+'/src/app/globals.css'})).css;
  let browser;const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html; charset=utf-8');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:req.url==='/style.css'?css:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main class="p-4" data-dashboard-ui="management" data-management-workspace="platform"><div id="root"></div></main><script type="module" src="/bundle.js"></script></body></html>');});
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);await page.getByRole('link',{name:'打开内容工作台'}).waitFor();
    assert.equal(await page.getByRole('navigation',{name:'选择教材章节'}).getByRole('button').count(),17);
    assert.equal(await page.getByRole('table').count(),0);
    assert.equal(await page.getByRole('combobox').count(),0);
    assert.equal(await page.getByRole('navigation',{name:'课程内容工作导航'}).count(),1);
    assert.equal(await page.getByRole('button',{name:'发布章节与测试',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'编辑词汇',exact:true}).count(),1);
    await page.getByRole('button',{name:'编辑词汇',exact:true}).click();await page.getByRole('dialog',{name:'vocabulary',exact:true}).waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.getByRole('button',{name:'查看语法内容',exact:true}).click();await page.getByRole('dialog',{name:'grammar',exact:true}).waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.getByRole('button',{name:'检查与发布',exact:true}).click();
    await page.getByRole('button',{name:'发布章节与测试',exact:true}).click();await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('alertdialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'教材设置',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'编辑词汇',exact:true}).count(),0);
    await page.getByText('更多',{exact:true}).click();await page.getByRole('button',{name:'整本教材下架为草稿',exact:true}).waitFor();
    await page.getByRole('button',{name:'内容制作',exact:true}).click();
    await mkdir('/tmp/uply-textbook-studio-visual',{recursive:true});
    for(const width of [1440,375]){await page.setViewportSize({width,height:960});await page.screenshot({path:`/tmp/uply-textbook-studio-visual/${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.setViewportSize({width:1440,height:960});
    await page.evaluate(()=>document.documentElement.classList.add('dark'));
    await page.screenshot({path:'/tmp/uply-textbook-studio-visual/dark.png',fullPage:true});
    await page.evaluate(()=>document.documentElement.classList.remove('dark'));
    await page.getByRole('navigation',{name:'选择教材章节'}).getByRole('button',{name:/练习主题 2/}).click();
    assert.match(page.url(),/chapter=chapter-2/);await page.getByRole('heading',{name:'练习主题 2',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'打开内容工作台'}).count(),0);
    await page.reload();await page.getByRole('heading',{name:'练习主题 2',exact:true}).waitFor();
    await page.getByRole('textbox',{name:'搜索章节'}).fill('不存在的章节');await page.getByText('没有匹配章节，请换个关键词。').waitFor();
    await page.goto(url+'?chapter=unknown');await page.getByText('该章节不存在或不在可查看范围内，请从目录选择。').waitFor();
    await page.goto(url+'?readonly');await page.getByText('只读查看',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'编辑词汇',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'打开内容工作台'}).count(),0);
    await page.getByRole('button',{name:'检查与发布',exact:true}).click();assert.equal(await page.getByRole('button',{name:'发布章节与测试',exact:true}).count(),0);
    await page.goto(url+'?error');await page.getByText('教材内容读取不完整，暂不显示数量或开放编辑。请刷新重试。',{exact:true}).waitFor();
    assert.equal(await page.getByRole('region',{name:'教材制作工作区'}).count(),0);
    assert.equal(await page.getByRole('button',{name:'编辑词汇',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});

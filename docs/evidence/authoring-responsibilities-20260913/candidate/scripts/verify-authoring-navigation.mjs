// Real navigation and Studio components; local-only transports, no credentials.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const root=process.cwd(), dir=await mkdtemp(path.join(tmpdir(),'uply-authoring-links-'));
await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {CourseWorkflowLinks} from './src/app/dashboard/admin/apps/CourseWorkflowLinks';
import {courseContentSteps} from './src/lib/course-content-workflow';
import {TextbookStudio} from './src/features/digital-textbook/components/textbook-studio';
import {WORKBENCH_CHAPTER_ID} from './src/features/digital-textbook/components/textbook-navigation';
const row={chapterId:WORKBENCH_CHAPTER_ID,chapterNumber:1,chapterTitle:'你好',chapterSlug:'hello',chapterStatus:'published',textbookId:'book',textbookTitle:'韩语1级',textbookSlug:'korean',versionNumber:1,vocabularyCount:0,grammarCount:3,vocabularyNodes:[],grammarNodes:[{id:'grammar',items:[],cards:[{form:'은/는'},{form:'이에요'},{form:'입니까'}]}]};
const steps=courseContentSteps({app:{slug:'korean'},scope:'platform',globalRole:'platform_owner',capabilities:{manageContent:true}});
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-6xl space-y-5 p-4"><CourseWorkflowLinks steps={steps} section="textbooks" appPath="/platform/dashboard/admin/apps/korean"/><TextbookStudio rows={[row,{...row,chapterId:'chapter-two',chapterTitle:'这是什么',chapterNumber:2}]} canManage canPublish={false} workbenchHref="/platform/dashboard/admin/apps/korean/textbooks/workbench" courseStructureRoute="/platform/dashboard/admin/apps/korean/content"/></main>);
`},bundle:true,platform:'browser',jsx:'automatic',outfile:path.join(dir,'app.js'),define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'local-transports',setup(p){
  p.onResolve({filter:/^next\/(link|navigation|dynamic)$/},a=>({path:a.path,namespace:'test'}));
  // Action-bearing editors/publication controls remain tested separately; never invoke them here.
  p.onResolve({filter:/digital-textbook-(action-dialogs|table\/cell-action)$/},a=>({path:a.path,namespace:'test'}));
  p.onLoad({filter:/.*/,namespace:'test'},a=>({loader:'tsx',resolveDir:root,contents:a.path==='next/link'?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:
    a.path==='next/navigation'?`import {useSyncExternalStore} from 'react';const old=history.replaceState.bind(history);history.replaceState=(...args)=>{old(...args);window.dispatchEvent(new Event('url-change'))};const sub=cb=>{window.addEventListener('url-change',cb);return()=>window.removeEventListener('url-change',cb)};export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(sub,()=>location.search,()=>''))}`:
    a.path==='next/dynamic'?`export default function dynamic(){return ()=>null}`:
    `export function DigitalTextbookCellAction(){return null} export function DigitalTextbookContentDialog(){return null}`}));
}}]});
const css=(await postcss([tailwind({base:root})]).process(await readFile('src/app/globals.css','utf8'),{from:path.join(root,'src/app/globals.css')})).css;
const js=await readFile(path.join(dir,'app.js'));
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/style.css'?css:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const checks=[];
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/?chapter=cda24fb8-c93b-4a19-9577-4418350ff708');
 const nav=page.getByRole('navigation',{name:'课程内容工作导航'});
 await nav.getByRole('link',{name:'教材制作',exact:true}).waitFor();
 assert.equal(await nav.getByRole('link').count(),4);
 assert.equal(await nav.getByRole('link',{name:'教材制作'}).getAttribute('aria-current'),'page');
 await page.getByRole('button',{name:/这是什么/}).click();
 for(const link of await nav.getByRole('link').all())assert.equal(new URL(await link.getAttribute('href'),'https://test.invalid').searchParams.get('chapter'),'chapter-two');
 assert.equal(await page.getByRole('link',{name:'打开内容工作台'}).count(),0);
 checks.push('四板块单一导航；切换第二章后全部跳转携带第二章；不冒充支持第二章工作台');
 await page.getByRole('button',{name:/你好/}).click();
 await page.getByRole('button',{name:'检查与发布',exact:true}).click();
 assert.equal(await page.getByRole('link',{name:'前往工作台校验与发布'}).count(),1);
 assert.equal(await page.getByRole('link',{name:'打开内容工作台'}).count(),0);
 checks.push('第一章单一工作台入口随制作/发布上下文改名；章节测试功能仍分区保留');
 const hint=page.getByRole('button',{name:'教材制作的职责与边界'});
 await hint.focus();await page.getByRole('tooltip').filter({hasText:'不会更新教材快照'}).waitFor();
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
 checks.push('职责说明可键盘聚焦、Escape退出；复用统一提示组件');
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:950});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
  await page.screenshot({path:path.join(dir,width+'.png'),fullPage:true});
 }
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(dir,'dark.png'),fullPage:true});
 assert.deepEqual(errors,[]);checks.push('375/768/1440宽度无页面溢出；深色渲染；无JS异常');
 await writeFile(path.join(dir,'validation.json'),JSON.stringify({checks,productionAccess:false,scope:'Real components with isolated Next navigation transport; not authenticated application E2E'},null,2));
 console.log(JSON.stringify({passed:checks.length,checks,evidence:dir},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r))}

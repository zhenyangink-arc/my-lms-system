// Isolated component verification. Server Actions are explicit test transports;
// no login, production credentials, database or media objects are used.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from '@playwright/test';

const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), 'uply-script-workspace-'));
const output = process.env.UPLY_SCRIPT_UI_EVIDENCE_DIR || directory;
await mkdir(output, { recursive: true });
const actionPaths = [
  'src/app/dashboard/admin/teaching-scripts/actions.ts',
  'src/features/learning-agent-script-studio/source-review-actions.ts',
  'src/features/learning-agent-script-studio/release-check-actions.ts',
  'src/features/learning-agent-script-studio/teacher-video-actions.ts',
];
const names = (await Promise.all(actionPaths.map(f => readFile(f, 'utf8')))).flatMap(s => [...s.matchAll(/export async function (\w+)/g)].map(m => m[1]));
const actionModule = names.map(name => `export async function ${name}(...args) {
  window.actionCalls.push({ name: '${name}', args: args.map(v => v instanceof FormData ? [...v.entries()] : v) });
  if ('${name}' === 'saveTeachingScriptNodeAction') return {status:'success',message:'教学小节已保存到草稿。'};
  if ('${name}' === 'inspectChapterRelease') return {checkedAt:'2026-09-13T00:00:00Z',checks:[{label:'隔离检查',state:'ready',detail:'仅验证界面显示'}]};
  if ('${name}' === 'searchReleaseCheckStudents') return {options:[],message:'没有匹配项'};
  if ('${name}' === 'loadScriptSourceReview') return {ok:false,message:'隔离复核提示'};
  return {ok:true,items:[]};
}`).join('\n');
await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import {TeachingScriptStudio} from './src/features/learning-agent-script-studio/TeachingScriptStudio';
    const text=v=>({'zh-CN':v,'ko-KR':''});
    const node=(id,order,terminal=false)=>({id,versionId:'draft',key:id,type:terminal?'summary':'explanation',order,title:text(terminal?'完成学习':'第一次见面，怎样开口？'),script:text('先主动问候，再介绍自己。'),configuration:{terminal,teacherVideo:{mode:'legacy'},virtualCharacter:{kind:'uply-teacher',pose:'explaining'},display:{kind:'overview',title:text('初次见面')}},referenceActivityId:null,actionType:'none',nextNodeKey:null,remediationNodeKey:null,required:true,updatedAt:'2026-09-13T00:00:00Z',speechAssets:[],speechAssetsFromPublishedVersion:false,interactionSecret:null});
    const codes=['orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review'];
    const modules=codes.map((code,i)=>({id:code,code,order:i+1,title:text(code),chapterId:'chapter-one',chapterNumber:1,chapterTitle:text('你好？'),textbookId:'book',textbookTitle:text('韩国语 1 级'),textbookVersion:{id:'v1',number:1,status:'published',newerDraftNumber:null},textbookStatus:'published',chapterStatus:'published',practiceStatus:'linked',lessonId:'lesson-'+code,activities:[],learningTargets:[],versions:['draft','published','archived'].map((status,j)=>({id:code+'-'+status,lessonId:'lesson-'+code,number:24-j,status,title:text('教学脚本'),changeNote:'',publishedAt:null,sourceReviewStatus:'unreviewed',nodes:[node(code+'-first-'+status,1),node(code+'-last-'+status,2,true)]}))}));
    window.actionCalls=[];
    createRoot(document.getElementById('root')).render(<main data-dashboard-ui="management" data-management-workspace="platform" className="management-teaching-script-page" style={{maxWidth:1500,margin:'auto',padding:16}}><TeachingScriptStudio data={{appId:'test-app',modules,characterStyleTemplates:[],blackboardLayoutTemplates:[]}} /></main>);`, loader: 'tsx', resolveDir: root },
  outfile: path.join(directory, 'app.js'), bundle: true, platform: 'browser', jsx: 'automatic',
  define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-actions', setup(plugin) {
    plugin.onResolve({ filter: /^(next\/navigation|next\/link)$/ }, args => ({ path: args.path, namespace: 'stub' }));
    plugin.onResolve({ filter: /(?:^|\/)(actions|source-review-actions|release-check-actions|teacher-video-actions)$/ }, args => ({ path: args.path, namespace: 'actions' }));
    plugin.onLoad({ filter: /.*/, namespace: 'actions' }, () => ({ contents: actionModule, loader: 'js' }));
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === 'next/link'
      ? 'import React from "react"; export default function Link(props){return React.createElement("a",props)}'
      : 'export const usePathname=()=>"/platform/dashboard/admin/apps/korean/teaching-scripts"; export const useRouter=()=>({refresh(){},push(){}});', loader: 'js', resolveDir: root }));
  } }],
});
const css = (await postcss([tailwind({ base: root })]).process(await readFile('src/app/globals.css','utf8'), { from: path.join(root,'src/app/globals.css') })).css;
const js = await readFile(path.join(directory,'app.js'));
const server = createServer((req,res)=>{
  if (req.url === '/app.js') { res.setHeader('Content-Type','text/javascript'); return res.end(js); }
  if (req.url === '/style.css') { res.setHeader('Content-Type','text/css'); return res.end(css); }
  if (req.url?.startsWith('/api/')) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><html lang="zh-CN" data-management-workspace="platform"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script></html>');
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
const checks=[];
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Isolated browser error:',e.message);});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('heading',{name:'教学脚本',exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'可横向滚动的教学编排轴'}).count(),0);
  assert.equal(await page.locator('[name="script_zh"]').first().isVisible(),true);
  assert.equal(await page.getByRole('button',{name:'检查本章准备情况'}).isVisible(),false);
  assert.equal(await page.getByRole('navigation',{name:'课程结构'}).locator('[aria-current="page"]').count(),1);
  checks.push('default narration visible; checks and axis collapsed; one selected step');
  await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
  const narration=page.locator('[name="script_zh"]').first();
  await narration.click();
  await narration.press('ControlOrMeta+A');
  await narration.pressSequentially('先主动问候，然后介绍姓名。');
  assert.equal(await narration.inputValue(),'先主动问候，然后介绍姓名。');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByLabel('选择教学小节',{exact:true}).selectOption('orientation-last-draft');
  assert.equal(await page.getByLabel('选择教学小节',{exact:true}).inputValue(),'orientation-first-draft');
  assert.equal(await narration.inputValue(),'先主动问候，然后介绍姓名。');
  checks.push('first keystroke retained; cancelling unsaved navigation preserves input');
  await page.getByRole('button',{name:'保存当前小节',exact:true}).click();
  await page.waitForFunction(()=>window.actionCalls.some(x=>x.name==='saveTeachingScriptNodeAction'&&x.args[1].some(([k,v])=>k==='script_zh'&&v==='先主动问候，然后介绍姓名。')));
  const save=await page.evaluate(()=>window.actionCalls.filter(x=>x.name==='saveTeachingScriptNodeAction').at(-1).args[1]);
  assert.ok(save.some(([k,v])=>k==='script_zh'&&v==='先主动问候，然后介绍姓名。'));
  assert.ok(save.some(([k])=>k==='virtual_character_kind'));
  assert.ok(save.some(([k])=>k==='buffer_preset_id'));
  checks.push('real form submission retains narration and collapsed character fields');
  await page.getByRole('tab',{name:/画面/}).click();
  const character=page.locator('details[aria-labelledby="virtual-character-group-title"]');
  assert.equal(await character.getAttribute('open'),null);
  await character.locator(':scope > summary').click();
  assert.notEqual(await character.getAttribute('open'),null);
  await page.screenshot({path:path.join(output,'advanced.png'),fullPage:true});
  checks.push('character editor remains accessible behind advanced disclosure');
  await page.getByRole('button',{name:'显示教学编排轴',exact:true}).click();
  await page.getByRole('button',{name:'路径预演',exact:true}).click();
  await page.getByRole('button',{name:'下一节点',exact:true}).click();
  await page.getByRole('button',{name:'下一节点',exact:true}).click();
  await page.getByText(/结束节点，路径预演已完成/).waitFor();
  assert.equal(await page.getByRole('button',{name:'新增小节',exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'退出路径预演',exact:true}).click();
  await page.getByRole('button',{name:'隐藏教学编排轴',exact:true}).click();
  checks.push('path preview follows ending; node add/reorder controls preserved');
  await page.getByLabel('选择教学小节',{exact:true}).selectOption('orientation-last-draft');
  await page.locator('#subsection-editor-title').filter({hasText:'完成学习'}).waitFor();
  await page.getByRole('button',{name:/第 1 章第 2 步：/}).click();
  await page.getByLabel('查看版本').selectOption('vocabulary-archived');
  await page.getByText('已归档 · 只读',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'保存当前小节',exact:true}).count(),0);
  await page.getByLabel('查看版本').selectOption('vocabulary-draft');
  checks.push('step/node/version switch; archived remains read-only');
  await page.locator('summary').filter({hasText:'复核与发布检查'}).click();
  await page.getByRole('button',{name:'检查本章准备情况',exact:true}).click();
  await page.getByText('隔离检查 · 已满足').waitFor();
  await page.getByRole('button',{name:'读取复核内容',exact:true}).click();
  await page.getByText('隔离复核提示',{exact:true}).waitFor();
  await page.locator('summary').filter({hasText:'复核与发布检查'}).click();
  await page.locator('summary').filter({hasText:'发布学习步骤'}).click();
  await page.getByText(/已发布教材快照的更新仍需在教材工作台完成/).waitFor();
  await page.getByRole('button',{name:'校验并发布',exact:true}).click();
  await page.waitForFunction(()=>window.actionCalls.some(x=>x.name==='publishTeachingScriptAction'));
  checks.push('review/check/publish still use original Action contracts');
  await page.locator('summary').filter({hasText:'发布学习步骤'}).click();
  for(const width of [375,768,1440]) {
    await page.setViewportSize({width,height:950});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'horizontal overflow at '+width);
    await page.screenshot({path:path.join(output,width+'.png'),fullPage:true});
  }
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await page.screenshot({path:path.join(output,'dark.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  checks.push('375/768/1440px no page overflow; dark render; no JS exceptions');
  const result={passed:true,checks,scope:'Isolated real components, mocked server transports; not owner or production E2E'};
  await writeFile(path.join(output,'validation.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({...result,evidence:output},null,2));
} finally {await browser?.close();await new Promise(ok=>server.close(ok));}

// Isolated UI fixtures: no credentials, user sessions, or requests to the LMS database.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const directory = await mkdtemp(join(tmpdir(), 'lms-workflow-ui-'));
const reviewActions = `
let current = { source: { module: { title: { 'zh-CN': '核心词汇' } }, nodes: [{ content: { vocabulary: [{ ko: '학교', zh: '学校更新' }] } }], activities: [] }, previousSource: { nodes: [{ content: { vocabulary: [{ ko: '학교', zh: '学校旧版' }] } }] }, scriptToken: 'fixture', revision: 1, reviewedAt: null, sourceChanged: true, scriptChanged: false, status: 'changed' };
export async function loadScriptSourceReview() { return { ok:true, review: current }; }
export async function confirmScriptSourceReview(input) { window.fixtureConfirmed = input.review.revision; current = {...current,status:'reviewed'}; return {ok:true,message:'已确认教材与脚本一致。'}; }
`;
const releaseActions = `
export async function searchReleaseCheckStudents() { return {options:[{studentId:'fixture-student',tenantId:'fixture-tenant',label:'测试学生 · 测试机构'}],message:''}; }
export async function inspectChapterRelease(input) { window.fixtureStudent = input.student?.studentId; return {checkedAt:'2026-09-08T00:00:00Z',checks:[{label:'正式脚本',state:'ready',detail:'1/1 个模块有正式脚本。'},{label:'学生学习顺序',state:'blocked',detail:'章节未解锁。'}]}; }
`;
await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
import {ScriptSourceReviewPanel} from './src/features/learning-agent-script-studio/ScriptSourceReviewPanel';
import {ChapterReleaseCheckPanel} from './src/features/learning-agent-script-studio/ChapterReleaseCheckPanel';
function App(){const [disabled,setDisabled]=React.useState(false);return <main><h1>本地测试数据</h1><button onClick={()=>setDisabled(!disabled)}>切换未保存状态</button><ScriptSourceReviewPanel versionId="fixture" disabled={disabled} archived={false}/><ChapterReleaseCheckPanel appId="fixture" chapterId="fixture" disabled={disabled}/></main>};createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  outfile: join(directory, 'app.js'), bundle: true, platform: 'browser', jsx: 'automatic',
  plugins: [{ name: 'fixture-actions', setup(plugin) {
    plugin.onResolve({ filter: /^next\/navigation$|source-review-actions$|release-check-actions$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'next/navigation' ? 'export const useRouter=()=>({refresh(){}});' : args.path.endsWith('source-review-actions') ? reviewActions : releaseActions, loader: 'js' }));
  }}],
});
const cssDirectory = process.env.LMS_UI_CSS_DIR;
const stylesheet = cssDirectory ? (await Promise.all((await readdir(cssDirectory)).filter(file => file.endsWith('.css')).sort().map(file => readFile(join(cssDirectory, file), 'utf8')))).join('\n') : '';
const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>main{padding:16px;max-width:1000px;margin:auto}main>section{margin-top:16px}main>h1{font-size:24px;margin-bottom:16px}</style><div id="root"></div><script src="/app.js"></script></html>';
const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', request.url === '/app.js' ? 'text/javascript' : request.url === '/styles.css' ? 'text/css' : 'text/html');
  response.end(request.url === '/app.js' ? await readFile(join(directory, 'app.js')) : request.url === '/styles.css' ? stylesheet : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', { name: '读取复核内容', exact: true }).click();
  await page.getByText('当前教材内容', {exact:true}).click();
  await page.getByText('上次复核的教材内容', {exact:true}).click();
  await page.getByText(/学校更新/).waitFor();
  await page.getByText(/学校旧版/).waitFor();
  assert.equal(await page.getByRole('button', {name:'确认复核',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', {name:'确认复核',exact:true}).click();
  await page.getByText('已确认教材与脚本一致。',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureConfirmed),1);
  await page.getByPlaceholder('输入学生姓名').fill('测试');
  await page.getByRole('button',{name:'查找',exact:true}).click();
  await page.getByLabel('检查对象').selectOption('fixture-tenant:fixture-student');
  await page.getByRole('button',{name:'检查本章准备情况',exact:true}).click();
  await page.getByText('章节未解锁。',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureStudent),'fixture-student');
  await page.getByRole('button',{name:'切换未保存状态'}).click();
  assert.equal(await page.getByRole('button',{name:'检查本章准备情况',exact:true}).isDisabled(),true);
  const hint = page.getByRole('button',{name:'查看详细说明'}).first();
  await hint.focus();
  await page.getByRole('tooltip').waitFor();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(directory,'mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: source comparison, explicit confirmation, selected-student check, unsaved guard, keyboard hint, mobile overflow.');
  console.log(`Fixture screenshot: ${directory}/mobile.png`);
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }

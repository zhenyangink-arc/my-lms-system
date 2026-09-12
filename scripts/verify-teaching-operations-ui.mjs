// Component fixtures only: no LMS account, auth cookies or database access.
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const directory = await mkdtemp(join(tmpdir(),"lms-teaching-ui-"));
await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
    import {PlanExecutionPanel} from './src/features/curriculum-plans/components/PlanExecutionPanel';
    import {TeachingOperationsNavigation} from './src/app/dashboard/admin/apps/TeachingOperationsNavigation';
    const execution=[{studentId:'a',itemId:'one',title:'第一章教材',status:'completed',progressPercent:100,reason:'已完成',assignmentId:null},{studentId:'b',itemId:'two',title:'章节测试',status:'overdue',progressPercent:0,reason:'超过计划时间',assignmentId:null},{studentId:'a',itemId:'three',title:'阶段考试',status:'pending_grading',progressPercent:null,reason:'已提交，等待批改。',assignmentId:'exam'}];
    const plan={id:'plan',status:'published',studentIds:['a','b'],execution,progress:{completedCount:1,totalCount:3,overdueCount:1,pendingGradingCount:1,unavailableCount:0}};
    const access={app:{slug:'korean'},scope:'platform',globalRole:'platform_owner',appPath:'/platform/dashboard/admin/apps/korean',capabilities:{manageStudents:true,manageAssessments:true,manageContent:true}};
    createRoot(document.getElementById('root')).render(<main><h1>教学与考核</h1><TeachingOperationsNavigation access={access} section="learning-plans"/><PlanExecutionPanel plan={plan} items={[{id:'four',title:'期末考试',sourceType:'assessment_paper'}]} students={[{id:'a',name:'学生甲'},{id:'b',name:'学生乙'}]} space="fixture" appSlug="korean"/></main>);`,resolveDir:process.cwd(),loader:"tsx" },
  outfile:join(directory,"app.js"),bundle:true,platform:"browser",jsx:"automatic",
  plugins:[{name:"fixtures",setup(plugin){
    plugin.onResolve({filter:/^next\/link$|^\.\.\/actions$/},args=>({path:args.path,namespace:"fixture"}));
    plugin.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:args.path === "next/link" ? 'import React from "react";export default function Link(props){return React.createElement("a",props)}' : 'export async function dispatchCurriculumExamAction(){window.dispatchCount=(window.dispatchCount||0)+1}',loader:"js",resolveDir:process.cwd()}));
  }}],
});
const stylesheet=(await Promise.all((await readdir(".next/static/chunks")).filter(f=>f.endsWith(".css")).map(f=>readFile(join(".next/static/chunks",f),"utf8")))).join("\n");
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>main{padding:16px;max-width:1050px;margin:auto}h1{font-size:24px;margin-bottom:20px}</style><div id="root"></div><script src="/app.js"></script></html>';
const server=createServer(async(req,res)=>{res.setHeader("Content-Type",req.url==="/app.js"?"text/javascript":req.url==="/styles.css"?"text/css":"text/html");res.end(req.url==="/app.js"?await readFile(join(directory,"app.js")):req.url==="/styles.css"?stylesheet:html)});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await page.locator('nav [aria-current="page"]').textContent(),"标准学习计划");
  await page.getByText("查看学生执行明细",{exact:true}).click();
  await page.getByLabel("执行状态",{exact:true}).selectOption("overdue");
  await page.getByText("学生乙 · 章节测试",{exact:true}).waitFor();
  assert.equal(await page.getByText("学生甲 · 第一章教材",{exact:true}).count(),0);
  await page.getByLabel("执行状态",{exact:true}).selectOption("all");
  await page.getByLabel("学生或安排",{exact:true}).fill("学生甲");
  assert.equal(await page.getByText("学生乙 · 章节测试",{exact:true}).count(),0);
  assert.equal(await page.getByRole("link",{name:"处理考试"}).getAttribute("href"),"/fixture/dashboard/admin/assignments/exam");
  await page.getByRole("button",{name:"查看详细说明",exact:true}).focus();
  await page.getByRole("tooltip").waitFor();
  await page.keyboard.press("Escape");
  page.once("dialog",dialog=>dialog.dismiss());
  await page.getByRole("button",{name:"按计划布置考试",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.dispatchCount||0),0);
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"按计划布置考试",exact:true}).click();
  await page.waitForFunction(()=>window.dispatchCount===1);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(directory,"mobile.png"),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log("PASS: execution filtering, student search, grading links, navigation, keyboard hint, dispatch confirmation and mobile overflow.");
  console.log(`Screenshot: ${directory}/mobile.png`);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}

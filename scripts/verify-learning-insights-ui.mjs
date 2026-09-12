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
    import {InsightBoard} from './src/features/platform-learning-insights/InsightBoard';
    import {buildInsightReport,emptyFacts,parseInsightFilters} from './src/features/platform-learning-insights/model';
    const facts=emptyFacts();facts.tenants=[{id:'a',name:'机构甲',slug:'a',status:'active'},{id:'b',name:'机构乙',slug:'b',status:'active'}];
    const report=buildInsightReport(facts,parseInsightFilters({}),'records');
    createRoot(document.getElementById('root')).render(<main><h1>学习记录</h1><InsightBoard mode="records" days={30} report={report}/></main>);`,resolveDir:process.cwd(),loader:"tsx" },
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
  await page.getByRole("button",{name:"机构甲",exact:true}).click();
  await page.getByText("机构甲 · 汇总明细",{exact:true}).waitFor();
  await page.getByRole("button",{name:"收起明细",exact:true}).click();
  await page.getByLabel("搜索机构",{exact:true}).fill("机构乙");
  assert.equal(await page.getByRole("button",{name:"机构甲",exact:true}).count(),0);
  await page.getByRole("button",{name:"活跃学生统计说明",exact:true}).focus();
  await page.getByRole("tooltip").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("tooltip").count(),0);
  await page.getByLabel("搜索机构",{exact:true}).fill("");
  await page.getByRole("button",{name:"活跃学生 ↕",exact:true}).click();
  assert.equal(await page.locator('th[aria-sort="descending"]').count(),1);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(directory,"mobile.png"),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log("PASS: institution search, sorting, detail expansion, keyboard hints and mobile overflow.");
  console.log(`Screenshot: ${directory}/mobile.png`);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}

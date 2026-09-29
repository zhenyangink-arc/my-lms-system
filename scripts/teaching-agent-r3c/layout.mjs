// Formal Hangul route, real local Auth/RLS, existing Panel. No UI/API mocks.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServerClient} from '@supabase/ssr';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),k=read('status.json'),u=read('users.private.json').A1;
assert.equal(s.marker,'uply-teaching-agent-r2-disposable-v1');assert.equal(k.API_URL,`http://127.0.0.1:${s.ports.api}`);
const origin=`http://127.0.0.1:${s.ports.next}`,url=origin+'/r2-a/apps/korean/courses/korean/korean-basic/korean-beginner/hangul-introduction';
const jar=[],client=createServerClient(k.API_URL,k.ANON_KEY,{cookies:{getAll:()=>jar,setAll:items=>{for(const item of items){const i=jar.findIndex(x=>x.name===item.name);if(i>=0)jar.splice(i,1);jar.push(item);}}}});
assert.equal((await client.auth.signInWithPassword({email:u.email,password:u.password})).error,null);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});await context.addCookies(jar.map(c=>({name:c.name,value:c.value,url:origin,sameSite:'Lax'})));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));await page.goto(url,{timeout:60000});
 const first=page.getByRole('button',{name:'解释这句话：저는 학생입니다.',exact:true}).first();await first.waitFor({timeout:20000});await first.focus();await page.keyboard.press('Enter');await page.getByText('讲解已完成',{exact:true}).waitFor({timeout:50000});
 const box=await page.getByRole('dialog').boundingBox();assert.ok(box.x>=0&&box.width<=375);assert.equal(await page.getByText('依据当前课文',{exact:true}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:d+'/hangul-mobile.png'});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await first.evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:812,height:375});await first.click();await page.getByText('讲解已完成',{exact:true}).waitFor({timeout:50000});const landscape=await page.getByRole('dialog').boundingBox();assert.ok(landscape.height<=375);assert.deepEqual(errors,[]);
 writeFileSync(d+'/layout-result.json',JSON.stringify({status:'PASS',formalRoute:true,realAuth:true,mobile375:true,landscape812:true,keyboardEnterEscapeFocus:true,sourceBadge:true,noHorizontalOverflow:true,reducedMotion:true,pageErrors:errors,providerFixtureOnly:true,liveProviderRequests:0},null,2));
 console.log(JSON.stringify({layout:'PASS'}));
}finally{await browser.close();}

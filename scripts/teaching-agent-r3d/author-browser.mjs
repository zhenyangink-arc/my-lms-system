import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n));
const state=read('state.json'),keys=read('status.json'),users=read('users.private.json'),ids=read('fixture.json');
if(state.marker!=='uply-teaching-agent-r2-disposable-v1'||keys.API_URL!==`http://127.0.0.1:${state.ports.api}`)throw Error('OWNED_LOCAL_REQUIRED');
const origin=`http://127.0.0.1:${state.ports.next}`,base='/platform/dashboard/admin/apps/korean';
// Observer reads only. Every target write below is a click in a formal product UI.
const observer=createClient(state.url,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const result=existsSync(d+'/r3d-author-result.json')?read('r3d-author-result.json'):{steps:[],realAuth:true,formalProductUI:true,authoringWrites:'EXPECTED',liveProviderRequests:0};
const save=()=>writeFileSync(d+'/r3d-author-result.json',JSON.stringify(result,null,2));
const step=name=>{if(!result.steps.includes(name))result.steps.push(name);save();};
const one=async(table,id)=>{const r=await observer.from(table).select('*').eq('id',id).single();assert.equal(r.error,null);return r.data;};
const query=async(table,key,id)=>{const r=await observer.from(table).select('*').eq(key,id);assert.equal(r.error,null);return r.data;};
const poll=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('DATABASE_OBSERVATION_TIMEOUT');};
let browser,page;
try{
 browser=await chromium.launch({headless:true});const jar=[];
 const auth=createServerClient(state.url,keys.ANON_KEY,{cookies:{getAll:()=>jar,setAll:entries=>{for(const e of entries){const i=jar.findIndex(c=>c.name===e.name);if(i>=0)jar.splice(i,1);jar.push(e);}}}});
 assert.equal((await auth.auth.signInWithPassword({email:users.PO.email,password:users.PO.password})).error,null);
 const context=await browser.newContext();await context.addCookies(jar.map(c=>({name:c.name,value:c.value,url:origin,sameSite:'Lax'})));page=await context.newPage();
 const books=await query('digital_textbooks','lesson_id',ids.alesson);
 if(!books.length){
  result.initialCounts=read('r3d-catalog.json');assert.equal(result.initialCounts.textbooks,0);
  await page.goto(origin+base+'/textbooks',{timeout:60000});
  const form=page.getByRole('region',{name:'创建教学内容'});await form.waitFor({timeout:30000});
  await form.locator('select[name="lesson_id"]').selectOption(ids.alesson);
  await form.locator('[name="chapter_title"]').fill('认识韩语句子');
  await form.locator('[name="objectives"]').fill('理解话题助词与自我介绍。');
  await page.screenshot({path:d+'/author-before-create.png'});
  assert.equal((await query('digital_textbooks','lesson_id',ids.alesson)).length,0);
  await form.getByRole('button',{name:'创建教学内容草稿',exact:true}).click();
  await form.getByRole('link',{name:'进入教学脚本'}).waitFor({timeout:30000});
  step('from-zero formal create action');
 }
 const textbook=(await query('digital_textbooks','lesson_id',ids.alesson))[0];assert.ok(textbook);ids.atextbook=textbook.id;
 const version=(await query('digital_textbook_versions','textbook_id',textbook.id))[0];ids.atextbookVersion=version.id;
 const chapter=(await query('digital_textbook_chapters','version_id',version.id))[0];ids.achapter=chapter.id;
 const moduleRow=(await query('digital_textbook_modules','chapter_id',chapter.id))[0];ids.amodule=moduleRow.id;
 const lesson=(await query('learning_agent_lessons','module_id',moduleRow.id))[0];ids.ateachingLesson=lesson.id;
 assert.equal(textbook.agent_profile_id,ids.profile);assert.equal(lesson.agent_profile_id,ids.profile);
 assert.deepEqual(lesson.objectives,{'zh-CN':['理解话题助词与自我介绍。']});
 if(!result.steps.includes('skeleton draft verified')){
  for(const row of [textbook,version,chapter,lesson])assert.equal(row.status,'draft');
  assert.equal((await query('learning_agent_script_versions','lesson_id',lesson.id)).length,0);step('skeleton draft verified');
 }
 const studio=origin+base+'/teaching-scripts?chapter='+chapter.id;
 await page.goto(studio,{timeout:60000});
 let scripts=await query('learning_agent_script_versions','lesson_id',lesson.id);
 if(!scripts.length){await page.getByRole('button',{name:'新建教学脚本',exact:true}).click();await poll(async()=> (await query('learning_agent_script_versions','lesson_id',lesson.id)).length===1);step('existing createTeachingScriptDraftAction');}
 scripts=await query('learning_agent_script_versions','lesson_id',lesson.id);
 if(!scripts.some(s=>s.status==='draft')){
  const published=scripts.find(s=>s.status==='published');
  if(published&&(await query('learning_agent_script_nodes','script_version_id',published.id)).some(n=>n.teacher_script['ko-KR']!=='저는 학생입니다.')){
   await page.getByRole('button',{name:'编辑已发布版本',exact:true}).click();
   await poll(async()=>(await query('learning_agent_script_versions','lesson_id',lesson.id)).some(s=>s.status==='draft'));
   await page.reload();step('existing published-to-draft continuation');
  }
 }
 scripts=await query('learning_agent_script_versions','lesson_id',lesson.id);const script=scripts.find(s=>s.status==='draft')??scripts.find(s=>s.status==='published');ids.ascriptVersion=script.id;
 assert.equal(script.created_by,users.PO.id);
 if(script.status==='draft'){
  for(let index=0;index<2;index++){
   let nodes=(await query('learning_agent_script_nodes','script_version_id',script.id)).sort((a,b)=>a.sort_order-b.sort_order);
   if(nodes.length<=index){await page.getByRole('button',{name:'新增小节',exact:true}).click();await poll(async()=>(await query('learning_agent_script_nodes','script_version_id',script.id)).length>index);await page.waitForTimeout(500);}
   nodes=(await query('learning_agent_script_nodes','script_version_id',script.id)).sort((a,b)=>a.sort_order-b.sort_order);const node=nodes[index];
   if(node.teacher_script['zh-CN']==='저는 학생입니다.'&&node.teacher_script['ko-KR']==='저는 학생입니다.'&&node.configuration.terminal===(index===1))continue;
   // Newly added section is selected by the existing Studio; resume via its visible title.
   if(await page.locator('[name="node_id"]').inputValue()!==node.id){await page.getByRole('combobox',{name:'选择教学小节'}).selectOption(node.id);}
   await page.locator('#teaching-script-panel select').filter({has:page.locator('option[value="legacy"]')}).selectOption('legacy');
   await page.locator('[name="title_zh"]').fill('自我介绍 '+(index+1));
   await page.locator('[name="script_zh"]').first().fill('저는 학생입니다.');
   await page.locator('[name="script_ko"]').fill('저는 학생입니다.');
   const details=page.locator('details').filter({has:page.locator('[name="script_voice"]')}).first();
   if(await details.count()){if((await details.getAttribute('open'))===null)await details.locator('summary').click();await details.locator('[name="script_voice"]').selectOption('off');}
   if(index===1){await page.locator('#teaching-flow-tab').click();await page.getByRole('radio',{name:/结束当前学习步骤/}).click();}
   await page.getByRole('button',{name:'保存当前小节',exact:true}).click();
   await poll(async()=>{const n=await one('learning_agent_script_nodes',node.id);return n.teacher_script['zh-CN']==='저는 학생입니다.'&&n.teacher_script['ko-KR']==='저는 학생입니다.'&&n.configuration.terminal===(index===1);});
   step('existing node author/save '+index);
  }
  await page.locator('summary').filter({hasText:'复核与发布检查'}).click();
  await page.getByRole('button',{name:'读取复核内容',exact:true}).click();
  const confirmation=page.getByRole('checkbox',{name:/我已对照教材内容与活动/});
  await confirmation.check();await page.getByRole('button',{name:'确认复核',exact:true}).click();
  await page.getByText('已确认教材与脚本一致。后续编辑会要求重新复核。',{exact:true}).waitFor();
  step('existing source review confirmation');
  await page.locator('summary').filter({hasText:'发布学习步骤'}).click();
  await page.locator('[name="change_note"]').fill('隔离环境从零流程验证');await page.getByRole('button',{name:'校验并发布',exact:true}).click();
  await poll(async()=>(await one('learning_agent_script_versions',script.id)).status==='published');step('existing validation and script publication');
 }
 await page.goto(origin+base+'/textbooks?chapter='+chapter.id,{timeout:60000});
 if((await one('digital_textbook_chapters',chapter.id)).status!=='published'){
  await page.getByRole('button',{name:/发布章节/}).click();await page.getByRole('button',{name:'确认发布',exact:true}).click();
  await poll(async()=>(await one('digital_textbook_chapters',chapter.id)).status==='published');step('existing chapter/root/version publish action');
 }
 for(const [table,id] of [['digital_textbooks',textbook.id],['digital_textbook_versions',version.id],['digital_textbook_chapters',chapter.id],['learning_agent_lessons',lesson.id],['learning_agent_script_versions',script.id]])assert.equal((await one(table,id)).status,'published');
 ids.anodes=(await query('learning_agent_script_nodes','script_version_id',script.id)).sort((a,b)=>a.sort_order-b.sort_order).map(n=>n.id);
 const logs=await query('learning_agent_publish_logs','lesson_id',lesson.id);assert.ok(logs.length>=5);assert.ok(logs.every(l=>l.actor_id===users.PO.id));
 result.auditActions=logs.map(l=>l.action);result.auditActorVerified=true;result.published={root:true,version:true,chapter:true,teachingLesson:true,script:true,nodes:ids.anodes.length};
 writeFileSync(d+'/fixture.json',JSON.stringify(ids,null,2));await page.screenshot({path:d+'/author-published.png'});result.status='PASS';delete result.error;save();
}catch(e){result.status='FAIL';result.error=e.message;save();if(page){writeFileSync(d+'/author-page.private.txt',await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:d+'/author-failure.png'}).catch(()=>{});}process.exitCode=1;}
finally{await browser?.close();}
console.log(JSON.stringify(result));

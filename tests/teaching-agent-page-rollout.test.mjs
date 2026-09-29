import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { koreanHarness } from './fixtures/teaching-agent/student-runtime.mjs';
import { ids } from './fixtures/teaching-agent/student-domain.mjs';
// Execute the exact TSX Server Component loader. Only its client component leaf
// is replaced; React element props and every policy/repository query remain real.
registerHooks({resolve(specifier,context,next){if(specifier==='../../components/StudentAiTeacherIntegration'&&context.parentURL?.endsWith('/lesson-slots.tsx'))return {url:'data:text/javascript,export function StudentAiTeacherIntegration(){throw new Error("Client leaf must not execute on server");}',shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url.endsWith('/lesson-slots.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText};return next(url,context);}});
const {loadStudentTeachingSlots}=await import('../src/features/teaching-agent/server/page-projection/lesson-slots.tsx');
function readonlyClient(rows){const calls=[];return {calls,from(table){const plan={table,filters:[],columns:'',limit:Infinity};calls.push(plan);const result=()=>{let selected=(table==='student_learning_agent_script_nodes'?rows.learning_agent_script_nodes.map(r=>({...r,segments:r.configuration?.scriptSegments,video_mode:r.configuration?.teacherVideo?.mode})):rows[table]).filter(r=>plan.filters.every(([key,values])=>values.includes(r[key])));if(plan.order)selected.sort((a,b)=>(a[plan.order]-b[plan.order])*(plan.desc?-1:1));return selected.slice(0,plan.limit).map(r=>Object.fromEntries(plan.columns.split(',').map(s=>{const [alias,path]=s.includes(':')?s.split(':'):[s,s];const bits=path.split(/->>?/);let value=r[bits[0]];for(const k of bits.slice(1))value=value?.[k];return [alias,value??null];})));};return {select(c){plan.columns=c;return this;},eq(k,v){plan.filters.push([k,[v]]);return this;},in(k,v){plan.filters.push([k,v]);return this;},limit(n){plan.limit=n;return this;},order(k,o){plan.order=k;plan.desc=o?.ascending===false;return this;},abortSignal(){return this;},async maybeSingle(){const data=result();return {data:data.length===1?data[0]:null,error:data.length>1?{message:'ambiguous'}:null};},then(resolve,reject){return Promise.resolve({data:result(),error:null}).then(resolve,reject);}};}};}
test('actual page slot loader: empty/denied lists never mount UI; authorized identity still must pass Student Policy',async()=>{
 const keys=['TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED','TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const h=koreanHarness(),base={actorId:ids.A1,tenantId:ids.A,lessonId:h.locator.lessonId,moduleIds:[h.locator.moduleId]};
 async function load(discover=false){const client=readonlyClient(h.rows);return {slots:await loadStudentTeachingSlots({...base,moduleIds:discover?undefined:base.moduleIds,supabase:client}),calls:client.calls};}
 try{
  for(const key of keys)delete process.env[key];process.env[keys[0]]='true';assert.equal((await load()).slots,undefined);assert.equal((await load()).calls.length,0);
  process.env[keys[1]]=ids.A;process.env[keys[2]]=h.rows.courses[0].id;process.env[keys[3]]=ids.A1;
  const good=await load();assert.ok(good.slots?.[h.locator.moduleId]?.['zh-CN']);assert.ok(good.slots[h.locator.moduleId]['zh-CN'].props.pins.length>0);
  assert.equal(good.calls[0].table,'lessons');
  const discovered=await load(true);assert.ok(discovered.slots?.[h.locator.moduleId]?.['zh-CN']);
  h.rows.digital_textbook_versions[0].status='draft';assert.equal((await load(true)).slots,undefined);h.rows.digital_textbook_versions[0].status='published';
  process.env[keys[2]]=h.rows.courses[1].id;const wrongCourse=await load();assert.equal(wrongCourse.slots,undefined);assert.equal(wrongCourse.calls.length,1);
  process.env[keys[2]]=h.rows.courses[0].id;base.tenantId=ids.B;assert.equal((await load()).slots,undefined);base.tenantId=ids.A;
  h.rows.lessons[0].unlock_mode='prerequisite_passed';assert.equal((await load()).slots,undefined);h.rows.lessons[0].unlock_mode='immediate';
  h.rows.student_app_enrollments[0].status='inactive';assert.equal((await load()).slots,undefined);
  process.env[keys[0]]='false';const off=await load();assert.equal(off.slots,undefined);assert.equal(off.calls.length,0);const offDiscovery=await load(true);assert.equal(offDiscovery.slots,undefined);assert.equal(offDiscovery.calls.length,0);
 }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

/** Real Auth/JWT/PostgREST checks. No writes; no production URL accepted. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n));
const s=read('state.json'),k=read('status.json'),u=read('users.private.json'),ids=read('fixture.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||k.API_URL!==`http://127.0.0.1:${s.ports.api}`)throw Error('LOCAL_STAGE_REQUIRED');
const result={matrix:[],errors:[],writes:0};
const client=(label)=>createClient(s.url,k.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:label?{Authorization:'Bearer '+u[label].session.access_token}:{},fetch:async(url,init)=>{assert.equal(new URL(url).origin,s.url);assert.equal(init?.method??'GET','GET');return fetch(url,init);}}});
const safe='student_learning_agent_script_nodes';
async function check(label,table,id,expected,columns='*'){
 const r=await client(label).from(table).select(columns).eq('id',id);
 const count=r.data?.length??0,serialized=JSON.stringify(r.data??[]);
 const privateLeak=/SYNTHETIC-(PRIVATE|ANSWER|FUTURE|DRAFT)/.test(serialized);
 const row={actor:label??'anon',table,columns,scope:id===ids.bnodes[0]?'B node':Object.entries(ids).find(([,v])=>v===id)?.[0]??'A node',rows:count,error:r.error?.code??null,privateLeak};result.matrix.push(row);
 assert.equal(count,expected,JSON.stringify(row));if(expected>0)assert.equal(r.error,null,JSON.stringify(row));
 if(label!=='PO')assert.equal(privateLeak,false,JSON.stringify(row));
 if(table===safe&&count){assert.deepEqual(Object.keys(r.data[0]).sort(),['id','script_version_id','updated_at','sort_order','teacher_script','segments','video_mode'].sort());assert(!serialized.includes('configuration'));assert.deepEqual(Object.keys(r.data[0].teacher_script).sort(),['ko-KR','zh-CN']);}
}
try{
 for(const label of ['A1','A2','B1','EX','IN','TA','AA']){
  const ownA=['A1','TA','AA'].includes(label)?1:0,ownB=label==='B1'?1:0;
  for(const [table,a,b] of [['digital_textbook_modules',ids.amodule,ids.bmodule],['learning_agent_script_versions',ids.ascriptVersion,ids.bscriptVersion],[safe,ids.anodes[0],ids.bnodes[0]],['digital_textbooks',ids.atextbook,ids.btextbook]]){
   await check(label,table,a,ownA);await check(label,table,b,ownB);
  }
  for(const id of [ids.anodes[0],ids.bnodes[0],ids.adraftNode]){await check(label,'learning_agent_script_nodes',id,0);await check(label,'learning_agent_script_nodes',id,0,'id,configuration');}
  await check(label,'learning_agent_script_versions',ids.adraftVersion,0);await check(label,safe,ids.adraftNode,0);
 }
 for(const [table,id] of [['learning_agent_sessions',ids.a2Session],['learning_agent_sessions',ids.bSession],['courses',ids.bcourse],['lessons',ids.blesson]])await check('A1',table,id,0);
 for(const label of ['A1','B1','TA','AA']){await check(label,'digital_textbook_modules',ids.gmodule,1);await check(label,'learning_agent_script_versions',ids.gscriptVersion,1);await check(label,safe,ids.gnodes[0],1);}
 for(const label of ['A2','EX','IN'])await check(label,safe,ids.gnodes[0],0);
 await check('A1','learning_agent_sessions',ids.ownSession,1,'id');
 for(const [table,id] of [['learning_agent_script_nodes',ids.anodes[0]],['learning_agent_script_nodes',ids.adraftNode],['learning_agent_script_versions',ids.adraftVersion],['digital_textbook_modules',ids.amodule]])await check('PO',table,id,1);
 await check(null,safe,ids.anodes[0],0);await check(null,'learning_agent_script_nodes',ids.anodes[0],0);
 const invalid=await client('A1').from(safe).select('configuration');assert(invalid.error);result.configurationNotAViewColumn=true;
 // Synthetic secrets must still exist behind the boundary; removing test data is not a fix.
 const privileged=createClient(s.url,k.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const raw=await privileged.from('learning_agent_script_nodes').select('configuration').eq('id',ids.anodes[0]).single();assert.equal(raw.error,null);
 result.rawSentinelsPreserved=['SYNTHETIC-PRIVATE-R2','SYNTHETIC-ANSWER-R2'].every(x=>JSON.stringify(raw.data).includes(x));assert(result.rawSentinelsPreserved);
 result.status='PASS';
}catch(e){result.status='FAIL';result.errors.push(String(e.message));process.exitCode=1;}
writeFileSync(d+'/security-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,checks:result.matrix.length,errors:result.errors}));

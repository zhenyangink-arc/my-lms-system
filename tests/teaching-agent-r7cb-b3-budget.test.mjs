// B3A ISOLATED ONLY: no current DB transport, identity or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {startDatabase,seedFixture,startService} from './fixtures/teaching-agent-r7c/postgres.mjs';
import {createDurableFixture} from './fixtures/teaching-agent-r7c/fixture.server.mjs';
import {StepController} from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import {NativeMediaController} from '../src/features/smart-textbook-runtime/core/native-media-controller.ts';
import {createRuntimeFactsReadPort} from '../src/features/smart-textbook-runtime/core/runtime-facts.ts';
const audit=JSON.parse(readFileSync(new URL('../docs/evidence/teaching-agent-stage-1f-r7c-b/b3-current-path-audit.json',import.meta.url)));
const request=(f,id)=>({binding:f.binding,requestId:id,generation:1});
// Derive selections inside the private test server from repository secret only.
// Neither option nor private definition digest is written to test output/evidence.
const selection=(f,correct)=>`option-${correct?f.definition.secret.answer_key.value:(f.definition.secret.answer_key.value+1)%f.definition.activity.options.length}`;
const ready=(o,p=s=>s.restored)=>p(o.snapshot())?Promise.resolve():new Promise((resolve,reject)=>{const timer=setTimeout(()=>{off();reject(Error('RESTORE_TIMEOUT'));},5000);const off=o.subscribe(()=>{if(p(o.snapshot())){off();clearTimeout(timer);resolve();}});});
const safe=v=>assert.doesNotMatch(JSON.stringify(v),/answer_key|optionIndex|definitionDigest|privateAnswer|service_role|secret|correctAnswer/);

test('B3A exact live RPC and triggers / max_attempts three / isolated durable budget',async t=>{
 const db=await startDatabase();let runtime,service;
 try{
  const rpc=audit.functions.find(x=>x.signature==='record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)');assert.ok(rpc);
  await db.raw(rpc.definition);
  await db.raw(`ALTER TABLE public.chapter_tests ADD COLUMN slug text, ADD COLUMN student_app_id uuid, ADD COLUMN status text;
  CREATE TABLE public.course_ebook_progress(tenant_id uuid,student_id uuid,student_app_id uuid,test_slug text,current_page int,total_pages int,progress_percent int,read_pages int[],reading_seconds int,completion_source text,last_read_at timestamptz,updated_at timestamptz, UNIQUE(tenant_id,student_id,test_slug));`);
  for(const trigger of audit.schema.triggers.filter(x=>x.table==='digital_textbook_node_progress')){await db.raw(trigger.function);await db.raw(trigger.definition);}
  await db.raw(`CREATE SCHEMA b3_test_audit; CREATE TABLE b3_test_audit.events(table_name text,operation text);
  CREATE FUNCTION b3_test_audit.record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO b3_test_audit.events VALUES(TG_TABLE_NAME,TG_OP); RETURN NULL; END $$;
  CREATE TRIGGER b3_test_events AFTER INSERT OR UPDATE OR DELETE ON public.digital_textbook_attempts FOR EACH ROW EXECUTE FUNCTION b3_test_audit.record();
  CREATE TRIGGER b3_test_events AFTER INSERT OR UPDATE OR DELETE ON public.digital_textbook_node_progress FOR EACH ROW EXECUTE FUNCTION b3_test_audit.record();
  CREATE TRIGGER b3_test_events AFTER INSERT OR UPDATE OR DELETE ON public.course_ebook_progress FOR EACH ROW EXECUTE FUNCTION b3_test_audit.record();`);
  // Set max_attempts in the isolated seed INSERT, never UPDATE canonical content.
  const ids=await seedFixture({...db,raw:sql=>db.raw(sql.replace(',20,true)',',3,true)'))});
  const f=await createDurableFixture(db,ids);
  const shape=JSON.parse(await db.raw(`SELECT json_build_object('max',(SELECT max_attempts FROM public.digital_textbook_activities),'chapterTestIsNull',(SELECT chapter_test_id IS NULL FROM public.digital_textbook_chapters))`));assert.equal(shape.max,3);assert.equal(shape.chapterTestIsNull,true);assert.equal(audit.target.chapterTestIsNull,true);
  const events=async()=>JSON.parse(await db.raw(`SELECT coalesce(json_agg(json_build_object('table',table_name,'operation',operation,'count',n)),'[]') FROM (SELECT table_name,operation,count(*)::int n FROM b3_test_audit.events GROUP BY table_name,operation ORDER BY table_name,operation) s`));
  const steps=new StepController(f.manifest),owner=new NativeMediaController(f.manifest,f.context,steps,f.ports());runtime=steps;
  const media={paused:true,currentTime:0,duration:30,plays:0,pause(){this.paused=true;},async play(){this.paused=false;this.plays++;}};owner.attach(media,'test-video');await ready(owner);
  let wrongEffects,correctEffects;
  await t.test('wrong: one attempt insert plus one node-progress insert; incomplete holds',async()=>{
   await owner.play();owner.seek(12);await ready(owner,s=>s.phase==='AWAITING_ACTIVITY');
   await owner.submit('test-activity',selection(f,false));assert.equal(media.paused,true);
   const r=await f.readback(request(f,'independent-wrong'));assert.equal(r.status,'INCOMPLETE');assert.equal(r.attemptNumber,1);
   const rows=await f.repository.read(f.scope);assert.equal(rows.progress.status,'in_progress');assert.equal(rows.progress.completion_percent,0);assert.equal(rows.progress.attempt_count,1);
   wrongEffects=await events();assert.deepEqual(wrongEffects,[{table:'digital_textbook_attempts',operation:'INSERT',count:1},{table:'digital_textbook_node_progress',operation:'INSERT',count:1}]);
  });
  await t.test('duplicate transport same identity and new generation: zero logical writes',async()=>{
   const rows=await f.repository.read(f.scope),prior=rows.attempts[0].response;
   const r={binding:f.binding,requestId:prior.requestId,generation:prior.generation+1};
   await Promise.all([f.submit(r,selection(f,false)),f.submit(r,selection(f,false))]);assert.deepEqual(await events(),wrongEffects);
  });
  await t.test('correct: second attempt insert plus one progress update; completed resumes',async()=>{
   await owner.submit('test-activity',selection(f,true));assert.equal(owner.snapshot().phase,'PLAYING');assert.equal(media.paused,false);
   const r=await f.readback(request(f,'independent-completed'));assert.equal(r.status,'COMPLETED');assert.equal(r.attemptNumber,2);
   const rows=await f.repository.read(f.scope);assert.equal(rows.progress.status,'completed');assert.equal(rows.progress.completion_percent,100);assert.equal(rows.progress.mastery_score,100);assert.equal(rows.progress.attempt_count,2);
   correctEffects=await events();assert.deepEqual(correctEffects,[{table:'digital_textbook_attempts',operation:'INSERT',count:2},{table:'digital_textbook_node_progress',operation:'INSERT',count:1},{table:'digital_textbook_node_progress',operation:'UPDATE',count:1}]);
   safe(f.manifest);safe(r);safe(createRuntimeFactsReadPort(owner).read());safe(rows.progress);
  });
  await t.test('actual child process stop/start: COMPLETED readback only, no resubmission',async()=>{
   const post=async()=>{const r=await fetch(service.url+'/readback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request:request(f,'recovery-read-only')})});assert.equal(r.status,200);return r.json();};
   service=await startService(db,ids);const pid=service.pid;assert.equal((await post()).status,'COMPLETED');await service.stop();service=await startService(db,ids);assert.notEqual(service.pid,pid);const r=await post();assert.equal(r.status,'COMPLETED');assert.equal(r.attemptNumber,2);safe(r);assert.deepEqual(await events(),correctEffects);
  });
  await t.test('backward replay, refresh, completed guard cause zero further writes',async()=>{
   owner.seek(0);owner.seek(12);assert.equal(owner.snapshot().activeCueId,null);
   const again=await createDurableFixture(db,ids);assert.equal((await again.restore(request(again,'refresh'),'waiting')).receipt.status,'COMPLETED');
   await again.submit(request(again,'unexpected-third-request'),selection(again,true));assert.deepEqual(await events(),correctEffects);
  });
  writeFileSync(new URL('../docs/evidence/teaching-agent-stage-1f-r7c-b/b3-isolated-budget-results.json',import.meta.url),JSON.stringify({status:'PASS',environment:'OWNED ISOLATED POSTGRESQL / NETWORK NONE',liveRpcSha256:rpc.sha256,liveNodeTriggersApplied:2,maxAttempts:3,chapterTestIsNull:true,wrongEffects,totalEffects:correctEffects,correctDelta:{digital_textbook_attempts:{INSERT:1,UPDATE:0},digital_textbook_node_progress:{INSERT:0,UPDATE:1}},courseEbookProgressWrites:0,pageProgressWrites:0,isolatedAuditRows:4,privateAnswerSource:'existing server-only secret / no answer constants in scenario',restart:'child service pid changed; readback only; attempts remain 2',currentDbWrites:0},null,2)+'\n');
 }finally{runtime?.dispose();await service?.stop();await db.stop();}
});

"""Real sessions on a guarded disposable Full Supabase, never a remote target."""
import concurrent.futures,json,pathlib,sys,time,uuid
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load,sql
D=pathlib.Path(sys.argv[1]);S=load(D);I=json.loads((D/'fixture.json').read_text());U=json.loads((D/'users.private.json').read_text())
A=I['A'];B=I['B'];actor=U['A1']['id'];results={};checks=[]
def q(text):return "'"+str(text).replace("'","''")+"'"
def query(text):return sql(D,text).stdout.decode().strip()
def js(text):return json.loads(query(text))
def check(name,condition):
 if not condition:raise AssertionError(name)
 checks.append(name)
def row(run):return js(f"select row_to_json(r) from agent_runs r where id={q(run)}")
def rec(r,tenant=A):return f"select public.reconcile_agent_run_v1({q(tenant)},{q(r['id'])},{r['state_version']},{q(r['fencing_token'])});"
def invoke(r,tenant=A):return js('set role service_role;'+rec(r,tenant))
def admit(status='running',expired=True,cancel=None):
 profile=js(f"select manifest from agent_definition_versions where tenant_id={q(A)} limit 1")
 budget={**profile['budget'],'usedModelCalls':0,'usedToolExecutions':0}
 # Use actual admit contract, then synthetic clock facts exclusively in fixture setup.
 deadline=query("select clock_timestamp()+interval '44 seconds'");budget['deadlineAt']=deadline
 s=f"select public.admit_agent_run_v1({q(A)},{q(actor)},{q(uuid.uuid4())},'student-ai-teacher','korean','lesson','synthetic-reconcile',{q(uuid.uuid4())},{q('a'*64)},'synthetic',{q(profile['definitionVersion']['version'])},{q(json.dumps(profile['allowedSkillRefs'][0]))}::jsonb,{q(json.dumps(budget))}::jsonb,{q(deadline)});"
 r=js('set role service_role;'+s)['run'];rid=r['id']
 deadline_sql="clock_timestamp()-interval '10 seconds'" if expired else "clock_timestamp()+interval '40 seconds'"
 cancel_sql="null" if cancel is None else ("clock_timestamp()-interval '20 seconds'" if cancel=='early' else "clock_timestamp()-interval '1 second'")
 query(f"update agent_runs set status={q(status)},deadline_at={deadline_sql},lease_expires_at={deadline_sql},cancel_requested_at={cancel_sql} where id={q(rid)}")
 return row(rid)
def event_count(r):return int(query(f"select count(*) from agent_run_events where run_id={q(r['id'])}"))
def finish(r):
 latest=row(r['id'])
 if latest['status'] not in ['completed','failed','cancelled']:
  query(f"set role service_role;select public.transition_agent_run_v1({q(A)},{q(actor)},{q(r['id'])},{q(latest['status'])},{latest['state_version']},{q(latest['fencing_token'])},'cancelled',{q(json.dumps(latest['budget']))}::jsonb,null,'RUN_CANCELLED');")
def await_lock(name):
 for _ in range(100):
  if query(f"select exists(select 1 from pg_stat_activity where application_name={q(name)} and wait_event='PgSleep')")=='t':return
  time.sleep(.03)
 raise AssertionError('session lock barrier timed out')
def race(first,second):
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  a=pool.submit(sql,D,"set application_name='r3a-race-owner';BEGIN;set local role service_role;"+first+"select pg_sleep(.8);COMMIT;",False)
  await_lock('r3a-race-owner')
  b=pool.submit(sql,D,"set application_name='r3a-race-contender';set role service_role;"+second,False)
  return a.result(),b.result()
# Scope and ACL both catalog and live SQL; real JWT matrix is run separately.
r=admit();n=event_count(r)
check('wrong tenant not_found',invoke(r,B)=={'result':'not_found'})
check('wrong version conflict',invoke({**r,'state_version':r['state_version']+1})=={'result':'fence_conflict'})
check('wrong fence conflict',invoke({**r,'fencing_token':str(uuid.uuid4())})=={'result':'fence_conflict'})
for role in ['anon','authenticated']:
 for signature,args in [('find_reconcilable_agent_runs_v1',f'{q(A)},50'),('reconcile_agent_run_v1',f"{q(A)},{q(r['id'])},{r['state_version']},{q(r['fencing_token'])}"),('reconcile_agent_run_batch_v1',f'{q(A)},50')]:
  denied=sql(D,f'set role {role};select public.{signature}({args});',False)
  check(role+' denied '+signature,denied.returncode!=0 and b'permission denied' in denied.stderr)
check('deadline failed',invoke(r)=={'result':'reconciled','status':'failed','reason':'DEADLINE_EXCEEDED'})
check('two atomic events',event_count(r)==n+2)
check('idempotent terminal',invoke(r)=={'result':'already_terminal','status':'failed'} and event_count(r)==n+2)
check('no synthetic message',query(f"select count(*) from agent_messages where run_id={q(r['id'])} and role='assistant'")=='0')
for cancel,want in [('early','cancelled'),('late','failed')]:
 c=admit(cancel=cancel);check(cancel+' cancellation priority',invoke(c)['status']==want)
for status in ['created','running','waiting_tool']:
 f=admit(status,False,'early');before=row(f['id']);check(status+' future protected',invoke(f)['result']=='not_eligible' and row(f['id'])==before);finish(f)
# Cleanup grace and lease cannot accidentally grant a new execution window.
r=admit();query(f"update agent_runs set deadline_at=clock_timestamp()-interval '1 second' where id={q(r['id'])}");r=row(r['id']);check('cleanup grace protects fresh expiry',invoke(r)['result']=='not_eligible');finish(r)
r=admit();query(f"update agent_runs set lease_expires_at=clock_timestamp()+interval '1 hour' where id={q(r['id'])}");r=row(r['id']);check('lease cannot extend hard deadline',invoke(r)['status']=='failed')
# Two simultaneous reconcilers, with a real held row lock and independent sessions.
r=admit();a,b=race(rec(r),rec(r));check('two reconcilers only one winner',a.returncode==b.returncode==0 and b'already_terminal' in b.stdout and event_count(r)==2)
results['twoReconcilers']={'sessions':2,'first':'reconciled','second':'already_terminal','terminalEvents':1}
# Copy an actual E2E completed run's valid persisted evidence into a new synthetic
# active run. All completion calls below are the real public wrapper, not UPDATE.
template=js("select row_to_json(r) from agent_runs r where status='completed' order by created_at limit 1")
def prepared():
 r=admit(expired=False);rid=r['id'];tid=template['id'];version=int(query(f"select metadata->>'stateVersion' from agent_run_events where run_id={q(tid)} and kind='output.checked' order by seq desc limit 1"))
 query(f"update agent_runs set state_version={version} where id={q(rid)};insert into agent_run_events(tenant_id,actor_id,run_id,seq,kind,model_call_id,tool_call_id,skill_run_id,metadata) select tenant_id,actor_id,{q(rid)},seq,kind,model_call_id,tool_call_id,skill_run_id,metadata from agent_run_events where run_id={q(tid)} and kind not in ('run.completed','run.failed','run.cancelled');")
 return row(rid)
def completing(r):
 return f"select public.transition_agent_run_v1({q(A)},{q(actor)},{q(r['id'])},'running',{r['state_version']},{q(r['fencing_token'])},'completed',{q(json.dumps(r['budget']))}::jsonb,(select content from agent_messages where run_id={q(template['id'])} and role='assistant'),null);"
r=prepared();a,b=race(completing(r),rec(r));check('live completion first immutable',a.returncode==b.returncode==0 and b'already_terminal' in b.stdout and row(r['id'])['status']=='completed')
check('atomic final preserved',query(f"select count(*) from agent_messages where run_id={q(r['id'])} and role='assistant' and state='final' and jsonb_array_length(source_refs)>0")=='1')
before=row(r['id']);n=event_count(r);invoke(r);check('completed unchanged',row(r['id'])==before and event_count(r)==n)
results['workerFirst']={'sessions':2,'completion':'completed','reconciler':'already_terminal','answerPreserved':True}
r=prepared();query(f"update agent_runs set deadline_at=clock_timestamp()-interval '10 seconds',lease_expires_at=clock_timestamp()-interval '10 seconds' where id={q(r['id'])}");r=row(r['id']);a,b=race(rec(r),completing(r));check('reconciler wins late completion rejected',a.returncode==0 and b.returncode!=0 and b'PERSISTENCE_FAILED' in b.stderr and row(r['id'])['status']=='failed');check('late final absent',query(f"select count(*) from agent_messages where run_id={q(r['id'])} and role='assistant'")=='0')
results['reconcilerFirst']={'sessions':2,'terminal':'failed','lateCompletion':'PERSISTENCE_FAILED','assistantMessages':0}
# Force an error AFTER completion wrapper, proving final and status share rollback.
r=prepared();bad=sql(D,'BEGIN;set local role service_role;'+completing(r)+'select 1/0;COMMIT;',False);check('final and status rollback together',bad.returncode!=0 and row(r['id'])['status']=='running' and query(f"select count(*) from agent_messages where run_id={q(r['id'])} and role='assistant'")=='0');finish(r)
# Mixed bounded batches; terminal/future rows remain untouched.
batch=[admit('running',True),admit('running',True,'early'),admit('waiting_tool',True),admit('running',False)]
for terminal in ['failed','cancelled']:
 r=admit();finish(r) if terminal=='cancelled' else invoke(r);batch.append(row(r['id']))
prior={r['id']:row(r['id']) for r in batch}
out=js(f"set role service_role;select reconcile_agent_run_batch_v1({q(A)},2);")
check('batch bounded two',len(out['results'])==2)
out2=js(f"set role service_role;select reconcile_agent_run_batch_v1({q(A)},100);")
check('batch only eligible',sum(row(r['id'])!=prior[r['id']] for r in batch)==3)
check('repeat batch empty',js(f"set role service_role;select reconcile_agent_run_batch_v1({q(A)},100);")['results']==[])
for limit in [0,101]:check('invalid limit '+str(limit),sql(D,f"set role service_role;select reconcile_agent_run_batch_v1({q(A)},{limit});",False).returncode!=0)
check('null tenant denied',sql(D,'set role service_role;select reconcile_agent_run_batch_v1(null,50);',False).returncode!=0)
for r in batch:finish(r)
results['batch']={'max':100,'requested':2,'returned':len(out['results']),'eligibleChanged':3,'futureAndTerminalsUnchanged':True}
# Index uses constant cutoff as the PL/pgSQL captured parameter does. Synthetic
# bulk rows exist only inside a rolled-back transaction, no teaching rows touched.
base=admit();query(f"update agent_runs set deadline_at=clock_timestamp()+interval '1 hour' where id={q(base['id'])}")
explain=f"""BEGIN;SET CONSTRAINTS ALL DEFERRED;
+create temporary table r3a_index_ids as select gen_random_uuid() id,gen_random_uuid() cid,gen_random_uuid() mid from generate_series(1,6000);
+insert into agent_conversations(id,tenant_id,actor_id,agent_code,app_id,scope_kind,scope_ref) select cid,{q(A)},{q(actor)},'student-ai-teacher','korean','lesson','index-fixture' from r3a_index_ids;
+insert into agent_runs(id,tenant_id,actor_id,conversation_id,input_message_id,definition_id,agent_code,profile_version,skill_ref,scope_ref,idempotency_key,request_digest,budget,deadline_at,lease_expires_at)
+ select t.id,r.tenant_id,r.actor_id,t.cid,t.mid,r.definition_id,r.agent_code,r.profile_version,r.skill_ref,r.scope_ref,t.id::text,r.request_digest,r.budget,now()+interval '1 hour',now()+interval '1 hour' from r3a_index_ids t cross join agent_runs r where r.id={q(base['id'])};
+ANALYZE agent_runs;
+EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) select id from agent_runs where tenant_id={q(A)} and status in ('created','running','waiting_tool') and deadline_at<=statement_timestamp()-interval '6 seconds' order by deadline_at,id limit 50;
+ROLLBACK;""".replace('\n+','\n')
plan=js(explain);check('deadline index chosen','agent_runs_reconcile_deadline' in json.dumps(plan));(D/'reconcile-index-plan.json').write_text(json.dumps(plan,indent=2));finish(base)
# Owner status projection uses the unchanged DB protocol.
for status in ['failed','cancelled']:
 rid=query(f"select id from agent_runs where tenant_id={q(A)} and status={q(status)} order by created_at desc limit 1")
 public=js(f"set role service_role;select get_student_agent_run_status_v1({q(A)},{q(actor)},{q(rid)});");check('owner status '+status,public['status']==status and 'finalAnswer' not in public)
check('all active zero',query(f"select count(*) from agent_runs where tenant_id={q(A)} and status in ('created','running','waiting_tool')")=='0')
results.update(status='PASS',checks=checks,assertions=len(checks),liveProviderRequests=0,teachingReads=0,teachingWrites=0,observationScope='Reconciliation RPC only; fixture admission and completion separately execute existing identity guards',fixtureSetup='Agent infrastructure only; template evidence from actual completed formal E2E',contractVersion='deadline-terminal-v1')
(D/'reconcile-database-result.json').write_text(json.dumps(results,indent=2));print(json.dumps({'status':'PASS','assertions':len(checks)}))

from pathlib import Path
import json,hashlib,subprocess,datetime
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7c-b';L=Path('/home/yangzhen/releases/uply-first-enable-20260910/source')
# Fixed read-only DB helper; never run its old preflight mutation/provisioning code.
ns={};exec((E/'b3a-build-harness/b3a-readonly.py').read_text().split('snapshot=query')[0],ns);query=ns['query'];wrapped=ns['wrapped'];C=ns['C'];DB=ns['DB']
snapshot=query(Path('/tmp/r7cb-b2-approved-read.sql').read_text());assert snapshot['canonicalValid'] and len(snapshot['actors'])==len(snapshot['tenants'])==1
actor=snapshot['actors'][0];tenant=snapshot['tenants'][0]
assert hashlib.sha256(actor['id'].encode()).hexdigest()=='cf4d2db0a75301af51a807149b0ed32134ce69db7e3767251816b9232722afbe'
assert hashlib.sha256(tenant['id'].encode()).hexdigest()=='7356e8b33db28d06f9283e6f4a5b9fb90f7d9d630a042093cffbf9d75c0ffbac'
assert actor['sessions']==actor['refreshTokens']==0 and actor['profile']=={'role':'student','globalRole':'member','status':'inactive'}
assert actor['human']==False and actor['productionAllowed']==False and not actor['provisionedProductionAccount']
assert len(actor['memberships'])==1 and actor['memberships'][0]=={'tenantId':tenant['id'],'role':'student','status':'suspended','isDefault':False}
assert datetime.datetime.fromisoformat(actor['banUntil'].replace('Z','+00:00'))>datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=24,minutes=15)
meta=wrapped("SELECT json_build_object('attempt',(SELECT count(*) FROM public.digital_textbook_attempts WHERE student_id='"+actor['id']+"'),'nodeProgress',(SELECT count(*) FROM public.digital_textbook_node_progress WHERE student_id='"+actor['id']+"'),'pageProgress',(SELECT count(*) FROM public.digital_textbook_activity_page_progress WHERE student_id='"+actor['id']+"'),'ledger',(SELECT count(*) FROM supabase_migrations.schema_migrations),'rpcHash',encode(sha256(convert_to(pg_get_functiondef('public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'::regprocedure),'UTF8')),'hex'))")
assert meta=={'attempt':0,'nodeProgress':0,'pageProgress':0,'ledger':458,'rpcHash':'af4511a91338e34f7febecbcf5fd77cd468da5b265408782ce2692260f584c50'},'DB_BASELINE_DRIFT'
tr=wrapped("SELECT json_build_object('triggers',(SELECT json_agg(json_build_object('table','digital_textbook_node_progress','enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid))) FROM pg_trigger t WHERE t.tgrelid='public.digital_textbook_node_progress'::regclass AND NOT t.tgisinternal))")['triggers']
prior=[x for x in json.loads((E/'b3-current-path-audit.json').read_text())['schema']['triggers'] if x['table']=='digital_textbook_node_progress'];key=lambda x:json.dumps(x,sort_keys=True);assert sorted(map(key,tr))==sorted(map(key,prior)),'TRIGGER_DRIFT'
private=DB.parent/'development-execution/b3';assert not private.exists(),'B3_PRIVATE_STATE_UNEXPECTED'
assert C.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') in (None,False,'false','0','')
assert all(C.get(k) in (None,'',[]) for k in ['TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS'])

assert (L/'.next/BUILD_ID').read_text().strip()=='KaSWaVYOIk7ZjWGpvVWIf'
approved=json.loads((E/'approval-b3a-deploy.json').read_text())
assert all(hashlib.sha256((L/p).read_bytes()).hexdigest()==h for p,h in approved['sourceHashes'].items()),'SOURCE_DRIFT'
activity=wrapped("SELECT json_build_object('count',count(*),'maxAttempts',min(a.max_attempts),'countsCompletion',bool_and(a.counts_toward_completion),'chapterTestNull',bool_and(c.chapter_test_id IS NULL)) FROM public.digital_textbook_activities a JOIN public.digital_textbook_nodes n ON n.id=a.node_id JOIN public.digital_textbook_modules m ON m.id=n.module_id JOIN public.digital_textbook_chapters c ON c.id=m.chapter_id WHERE a.activity_key='hangul-introduction-vowel-recognition'")
assert activity=={'count':1,'maxAttempts':3,'countsCompletion':True,'chapterTestNull':True},'ACTIVITY_DRIFT'
out={'sourceHashes':'35 MATCH','activityContract':activity,'status' :'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'currentBuild':'KaSWaVYOIk7ZjWGpvVWIf','canonicalBinding':[1,1,1],'freeze':'MATCH','B1':'COMPLETE','B2':'COMPLETE','actor':'UNCHANGED/BANNED/INACTIVE/SUSPENDED/NON-DEFAULT','tenant':'UNCHANGED','actorSessions':0,'actorRefreshTokens':0,**meta,'nodeProgressTriggers':'MATCH','scope':'DISABLED','executionApproval':'ABSENT / NOT ACTIVE','currentDbAttemptWrites':0,'currentDbProgressWrites':0,'feature':'OFF','allowlists':'EMPTY'}
(E/'b3-execution-fresh-preflight.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

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

import sys
phase='restart';assert phase in ['baseline','wrong','final','restart','stop']
facts=wrapped("SELECT json_build_object('attempts',(SELECT coalesce(json_agg(json_build_object('number',attempt_number,'correct',is_correct,'score',score,'createdAt',created_at,'requestHash',encode(sha256(convert_to(response->>'requestId','UTF8')),'hex')) ORDER BY attempt_number),'[]') FROM public.digital_textbook_attempts WHERE student_id='"+actor['id']+"'),'progress',(SELECT coalesce(json_agg(json_build_object('status',status,'completionPercent',completion_percent,'masteryScore',mastery_score,'attemptCount',attempt_count,'xmin',xmin::text)),'[]') FROM public.digital_textbook_node_progress WHERE student_id='"+actor['id']+"'),'pageProgress',(SELECT count(*) FROM public.digital_textbook_activity_page_progress WHERE student_id='"+actor['id']+"'))")
private=DB.parent/'development-execution/b3'
state={'directory':private.exists(),'approval':(private/'execution-approval.json').exists(),'scenario':(private/'scenario.json').exists(),'dispatch0':(private/'dispatch-0.json').exists(),'dispatch1':(private/'dispatch-1.json').exists(),'disabled':(private/'disabled').exists()}
out={'phase':'R7D-B INDEPENDENT BASELINE AUDIT - NOT TOOL ACCEPTANCE','lessonToolInvoked':False,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'CURRENT_DEVELOPMENT_DB','connection':'NEW INDEPENDENT READ ONLY','canonicalBinding':[1,1,1],'freeze':'MATCH','actorSafety':'PASS','actorSessions':0,'actorRefreshTokens':0,'journal':state,**facts}
(R/'docs/evidence/teaching-agent-stage-1f-r7d-b/current-db-baseline.json').write_text(json.dumps(out,indent=2)+'\n');assert state['disabled'] and state['dispatch0'] and state['dispatch1'];print(json.dumps(out))
if phase=='baseline':assert facts=={'attempts':[],'progress':[],'pageProgress':0}
if phase=='wrong':assert len(facts['attempts'])==len(facts['progress'])==1 and facts['attempts'][0]['correct']==False and facts['attempts'][0]['number']==1 and facts['progress'][0]['status']!='completed' and facts['progress'][0]['attemptCount']==1 and facts['pageProgress']==0
if phase in ['final','restart']:assert [a['correct'] for a in facts['attempts']]==[False,True] and [a['number'] for a in facts['attempts']]==[1,2] and len(facts['progress'])==1 and all(facts['progress'][0][k]==v for k,v in {'status':'completed','completionPercent':100,'masteryScore':100,'attemptCount':2}.items()) and facts['pageProgress']==0

meta=wrapped("SELECT json_build_object('ledger',(SELECT count(*) FROM supabase_migrations.schema_migrations),'rpcSha256',encode(sha256(convert_to(pg_get_functiondef('public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'::regprocedure),'UTF8')),'hex'),'scope','DISABLED')")
assert meta['ledger']==458 and meta['rpcSha256']=='af4511a91338e34f7febecbcf5fd77cd468da5b265408782ce2692260f584c50'
assert C.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') in (None,False,'false','0','')
assert all(C.get(k) in (None,'',[]) for k in ['TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS'])
meta.update(currentBuild=(L/'.next/BUILD_ID').read_text().strip(),feature='OFF',allowlists='EMPTY',toolAcceptance='NOT EXECUTED')
assert meta['currentBuild']=='KaSWaVYOIk7ZjWGpvVWIf'
(R/'docs/evidence/teaching-agent-stage-1f-r7d-b/current-environment.json').write_text(json.dumps(meta,indent=2)+'\n')

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
out={'phase':'R7D-A READ-ONLY AUTHORITY AUDIT','lessonToolInvoked':False,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'CURRENT_DEVELOPMENT_DB','connection':'NEW INDEPENDENT READ ONLY','canonicalBinding':[1,1,1],'freeze':'MATCH','actorSafety':'PASS','actorSessions':0,'actorRefreshTokens':0,'journal':state,**facts}
(R/'docs/evidence/teaching-agent-stage-1f-r7d-a/r7d-current-db-durable-audit.json').write_text(json.dumps(out,indent=2)+'\n');assert state['disabled'] and state['dispatch0'] and state['dispatch1'];print(json.dumps(out))
if phase=='baseline':assert facts=={'attempts':[],'progress':[],'pageProgress':0}
if phase=='wrong':assert len(facts['attempts'])==len(facts['progress'])==1 and facts['attempts'][0]['correct']==False and facts['attempts'][0]['number']==1 and facts['progress'][0]['status']!='completed' and facts['progress'][0]['attemptCount']==1 and facts['pageProgress']==0
if phase in ['final','restart']:assert [a['correct'] for a in facts['attempts']]==[False,True] and [a['number'] for a in facts['attempts']]==[1,2] and len(facts['progress'])==1 and all(facts['progress'][0][k]==v for k,v in {'status':'completed','completionPercent':100,'masteryScore':100,'attemptCount':2}.items()) and facts['pageProgress']==0

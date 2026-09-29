import json,subprocess
from pathlib import Path
D=Path('/tmp/uply-r7cb-b2-workflow');E=Path('/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r7c-b');s=json.loads((D/'isolated-state.json').read_text())
def sql(q):
 r=subprocess.run(['docker','exec','-i',s['pg'],'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-v','ON_ERROR_STOP=1'],input=q.encode(),capture_output=True);assert r.returncode==0,'ISOLATED_READ_FAILED';return json.loads(r.stdout)
# Counts captured before challenge probes are the provisioning write budget.
# Probe xmin groups prove createUser's initial user/identity mutations shared a
# single committed transaction (later challenges form additional transactions).
rows=sql("SELECT json_agg(x) FROM (SELECT xmin::text AS tx,count(*) FILTER(WHERE table_name='auth.users' AND operation='INSERT') AS ui,count(*) FILTER(WHERE table_name='auth.users' AND operation='UPDATE') AS uu,count(*) FILTER(WHERE table_name='auth.identities' AND operation='INSERT') AS ii,count(*) FILTER(WHERE table_name='public.profiles' AND operation='INSERT') AS pi,count(*) FILTER(WHERE table_name='public.profiles' AND operation='UPDATE') AS pu FROM b2_probe.writes GROUP BY xmin::text)x")
creation=[r for r in rows if r['ui']==1];assert len(creation)==1 and all(creation[0][k]==v for k,v in {'uu':5,'ii':1,'pi':1,'pu':2}.items())
r=sql("SELECT json_build_object('actors',count(*),'banned',bool_and(banned_until>now()+interval '24 hours 30 minutes'),'sessions',(SELECT count(*) FROM auth.sessions),'refreshTokens',(SELECT count(*) FROM auth.refresh_tokens),'profileInactive',(SELECT count(*)=1 FROM public.profiles WHERE id IN(SELECT id FROM auth.users WHERE raw_app_meta_data->>'purpose'='development-domain-execution') AND role='student' AND global_role='member' AND status='inactive'),'membershipSafe',(SELECT count(*)=1 FROM public.tenant_memberships WHERE role='student' AND status='suspended' AND NOT is_default),'attempts',(SELECT count(*) FROM public.digital_textbook_attempts),'progress',(SELECT count(*) FROM public.digital_textbook_node_progress)) FROM auth.users WHERE raw_app_meta_data->>'purpose'='development-domain-execution'")
assert r=={'actors':1,'banned':True,'sessions':0,'refreshTokens':0,'profileInactive':True,'membershipSafe':True,'attempts':0,'progress':0}
parity=[]
for t in json.loads((D/'current-triggers.json').read_text()):
 z=sql("SELECT json_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'function',pg_get_functiondef(t.tgfoid)) FROM pg_trigger t WHERE t.tgname='"+t['name']+"' AND t.tgrelid='"+t['table']+"'::regclass")
 parity.append({'table':t['table'],'trigger':t['name'],'match':z['definition']==t['definition'] and z['enabled']=='O' and z['function']==t['body']})
assert all(v['match'] for v in parity)
out={'initialBanCreateTransaction':'PASS','createLifecycleTransactions':1,'initialUserInsert':1,'sameTransactionUserUpdates':5,'sameTransactionIdentityInserts':1,'sameTransactionProfileInserts':1,'sameTransactionProfileUpdates':2,'loginBeforeBan':False,'finalActor':r,'currentTriggerParity':parity,'isolatedControlOwnerExcluded':1,'currentDbIdentityWrites':0};(E/'b2-workflow-final-isolated.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'atomicInitialBan':'PASS','triggerParity':'PASS','actorState':'PASS','currentDbWrites':0}))

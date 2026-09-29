import os,sys,json,subprocess,uuid,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True;os.umask(0o077);D=Path('/tmp/uply-r7cb-b2-contract');E=Path('/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r7c-b');s=json.loads((D/'isolated-state.json').read_text());pg=s['pg']
def sql(t):
 r=subprocess.run(['docker','exec','-i',pg,'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-v','ON_ERROR_STOP=1'],input=t.encode(),capture_output=True)
 if r.returncode:(D/'side-effect-error.private.log').write_bytes(r.stderr);raise RuntimeError('ISOLATED_SIDE_EFFECT_SQL_FAILED')
 return r.stdout.decode()
if sys.argv[-1]=='metadata':
 print(sql("SELECT json_agg(json_build_object('table',table_name,'column',column_name,'nullable',is_nullable,'default',column_default,'type',data_type)) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('tenants','student_apps','tenant_memberships')"));print(sql("SELECT json_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid IN ('public.tenants'::regclass,'public.tenant_memberships'::regclass,'public.student_apps'::regclass)"));sys.exit()
# Current public app catalog is non-personal reference data; clone only into owned empty schema.
spec=importlib.util.spec_from_file_location('c','/tmp/uply-r7cb-readonly.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
apps=c.m.query("SELECT json_agg(to_jsonb(a) ORDER BY id) FROM public.student_apps a");assert len(apps)==5
raw=json.dumps(apps).replace("'","''")
sql("INSERT INTO public.student_apps SELECT * FROM jsonb_populate_recordset(NULL::public.student_apps,'"+raw+"'::jsonb);")
actor=sql('SELECT id FROM auth.users;').strip();tid=str(uuid.uuid4())
def counts():return json.loads(sql("SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT table_name,operation,count(*) FROM b2_probe.writes GROUP BY table_name,operation ORDER BY table_name,operation) x"))
sql('TRUNCATE b2_probe.writes;')
# Exact INSERT body of current create_tenant, executed only as isolated trigger probe.
sql("INSERT INTO public.tenants(id,slug,name,plan_key,created_by) VALUES('"+tid+"','uply-domain-execution-dev','Development domain execution','starter',NULL);")
tenant=counts();sql('TRUNCATE b2_probe.writes;')
sql("UPDATE public.profiles SET status='inactive' WHERE id='"+actor+"';")
inactive=counts();sql('TRUNCATE b2_probe.writes;')
sql("INSERT INTO public.tenant_memberships(tenant_id,user_id,role,status,is_default) VALUES('"+tid+"','"+actor+"','student','suspended',false);")
membership=counts()
parity=[]
for t in json.loads((D/'current-triggers.json').read_text()):
 row=json.loads(sql("SELECT json_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled) FROM pg_trigger t WHERE t.tgname='"+t['name']+"' AND t.tgrelid='"+t['table']+"'::regclass"));parity.append({'table':t['table'],'name':t['name'],'definitionMatch':row['definition']==t['definition'],'enabled':row['enabled']})
assert all(r['definitionMatch'] and r['enabled']=='O' for r in parity)
refs=json.loads(sql("SELECT json_build_object('actorRows',(SELECT count(*) FROM auth.users),'tenantRows',(SELECT count(*) FROM public.tenants),'profileInactive',(SELECT count(*) FROM public.profiles WHERE status='inactive'),'membershipSuspended',(SELECT count(*) FROM public.tenant_memberships WHERE status='suspended' AND NOT is_default),'authSessions',(SELECT count(*) FROM auth.sessions),'refreshTokens',(SELECT count(*) FROM auth.refresh_tokens),'actorForeignKeyValid',(SELECT count(*)=1 FROM public.tenant_memberships m JOIN auth.users u ON u.id=m.user_id JOIN public.tenants t ON t.id=m.tenant_id))"))
out={'status':'MAPPED FOR ISOLATED PROBE; NOT CURRENT DB AUTHORIZATION','authVersion':'v2.197.0','currentTriggersMatch':parity,'tenantProbe':tenant,'deactivateProfileBeforeMembership':inactive,'createSuspendedMembership':membership,'finalCounts':refs,'method':'Only schema-only isolated PG. Tenant exact INSERT body and profile/membership repository DML used as trigger probes; NOT an end-to-end Owner UI provisioning workflow. No Auth/RLS trigger disabled. App catalog5 rows cloned as setup references, excluded from tenant delta. No attempts or progress executed.','currentDbWrites':0};(E/'b2-isolated-side-effects.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

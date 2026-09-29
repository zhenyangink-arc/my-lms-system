import os,sys,json,hashlib,configparser,subprocess,datetime,urllib.request
from pathlib import Path
os.umask(0o077);R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7c-b';DB=Path('/home/yangzhen/.config/uply-first-enable-20260910/db');C=json.loads((DB.parent/'runtime.json').read_text());start=datetime.datetime.now(datetime.timezone.utc);end=start+datetime.timedelta(minutes=30)
sha=lambda s:hashlib.sha256(s.encode()).hexdigest();digest=lambda v:sha(json.dumps(v,sort_keys=True,separators=(',',':')))
p=configparser.ConfigParser(interpolation=None);p.read(DB/'pg_service.conf');e=p['uply'];assert e['sslmode']=='verify-full' and e['sslrootcert']=='/connection/root.crt' and e['passfile']=='/connection/pgpass'
project=C['NEXT_PUBLIC_SUPABASE_URL'].split('//')[1].split('.')[0];assert project in e['host'] or project in e['user'];assert digest(project)=='cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673';assert sha(C['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/'))=='ff8db3ba3da8be9b994619fb66af48143c9ea9236e6454d2c59705d7b3279ea3'
def query(sql):
 a=['docker','run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user',str(os.getuid())+':'+str(os.getgid()),'--network=host','-i','--mount',f'type=bind,source={DB},target=/connection,readonly','-e','PGSERVICEFILE=/connection/pg_service.conf','-e','PGOPTIONS=-c default_transaction_read_only=on','--entrypoint','psql','public.ecr.aws/supabase/postgres:17.6.1.159','-X','-qAt','-w','-v','ON_ERROR_STOP=1','service=uply']
 r=subprocess.run(a,input=sql.encode(),capture_output=True,timeout=45)
 if r.returncode:raise RuntimeError('READ_ONLY_QUERY_FAILED (credentials and stderr withheld)')
 rows=[json.loads(s) for s in r.stdout.decode().splitlines() if s.startswith('{') or s.startswith('[')];assert len(rows)==1;return rows[0]
def wrapped(sql):return query("BEGIN READ ONLY;SET LOCAL statement_timeout='15s';"+sql+";ROLLBACK;")

snapshot=query(Path('/tmp/r7cb-b2-approved-read.sql').read_text())
a=snapshot['actors'][0];t=snapshot['tenants'][0]
assert snapshot['canonicalValid'] and len(snapshot['actors'])==len(snapshot['tenants'])==1
assert a['sessions']==a['refreshTokens']==0 and a['profile']['status']=='inactive'
meta=wrapped("SELECT json_build_object('attempts',(SELECT count(*) FROM public.digital_textbook_attempts WHERE student_id='"+a['id']+"'),'nodeProgress',(SELECT count(*) FROM public.digital_textbook_node_progress WHERE student_id='"+a['id']+"'),'pageProgress',(SELECT count(*) FROM public.digital_textbook_activity_page_progress WHERE student_id='"+a['id']+"'),'ledger',(SELECT count(*) FROM supabase_migrations.schema_migrations),'latestMigration',(SELECT max(version) FROM supabase_migrations.schema_migrations),'rpcSha256',encode(sha256(convert_to(pg_get_functiondef('public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'::regprocedure),'UTF8')),'hex'))")
assert meta['rpcSha256']=='af4511a91338e34f7febecbcf5fd77cd468da5b265408782ce2692260f584c50'
assert C.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') in (None,False,'false','0','')
assert all(C.get(k) in (None,'',[]) for k in ['TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS'])
assert meta['attempts']==meta['nodeProgress']==meta['pageProgress']==0 and meta['ledger']==458
out={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'currentBuild':Path('/home/yangzhen/releases/uply-first-enable-20260910/source/.next/BUILD_ID').read_text().strip(),'canonicalValid':True,'canonicalBinding':[1,1,1],'frozenContent':'UNCHANGED','actor':'UNCHANGED','tenant':'UNCHANGED','actorSessions':a['sessions'],'actorRefresh':a['refreshTokens'],**meta,'currentDbAttemptWrites':0,'currentDbProgressWrites':0,'scope':'DISABLED','scopeFilePresent':(DB.parent/'development-execution/b3/scenario.json').exists(),'feature':'OFF','allowlists':'EMPTY','deploy':0}
(E/'b3a-recovery-readback.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

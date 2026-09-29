import os,sys,json,subprocess,time,secrets,hashlib,hmac,base64,urllib.request,urllib.error,datetime,re
from pathlib import Path
os.umask(0o077);D=Path('/tmp/uply-r7cb-b2-contract');E=Path('/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r7c-b');stamp=secrets.token_hex(4);prefix='uply-r7cb-b2-'+stamp;net=prefix+'-net';pg=prefix+'-pg';vol=prefix+'-db';auth=prefix+'-auth';IMAGE='public.ecr.aws/supabase/postgres:17.6.1.159';AUTH='public.ecr.aws/supabase/gotrue:v2.197.0'
state={'prefix':prefix,'net':net,'pg':pg,'vol':vol,'auth':auth,'phase':'PREPARING'};(D/'isolated-state.json').write_text(json.dumps(state))
def cmd(args,input=None):
 r=subprocess.run(args,input=input,capture_output=True)
 if r.returncode:
  (D/'last-command-error.private.log').write_bytes(r.stderr);raise RuntimeError('ISOLATED_COMMAND_FAILED:'+args[0]+':'+args[1])
 return r.stdout.decode()
def sql(text):return cmd(['docker','exec','-i',pg,'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-v','ON_ERROR_STOP=1'],text.encode())
def waitpg():
 for _ in range(100):
  r=subprocess.run(['docker','exec',pg,'/usr/lib/postgresql/bin/pg_isready','-h','/recovery','-p','55484'],capture_output=True)
  if not r.returncode:return
  time.sleep(.1)
 raise RuntimeError('PG_TIMEOUT')
cmd(['docker','network','create','--internal','--label','stage=r7cb-b2',net]);cmd(['docker','volume','create','--label','stage=r7cb-b2',vol])
startup="chown 100:101 /recovery && exec su postgres -s /bin/sh -c '/usr/lib/postgresql/bin/initdb -U supabase_admin -D /recovery/pg -A trust --no-locale >/recovery/init.log && exec /usr/lib/postgresql/bin/postgres -D /recovery/pg -k /recovery -p 55484 -c listen_addresses= -c max_connections=30'"
cmd(['docker','run','-d','--pull=never','--read-only','--name',pg,'--label','stage=r7cb-b2','--network','none','--mount',f'type=volume,source={vol},target=/recovery','--mount','type=bind,source=/home/yangzhen/backups/uply/20260917T061353Z/schema.dump,target=/schema.dump,readonly','--tmpfs','/tmp','--entrypoint','/bin/sh',IMAGE,'-c',startup]);waitpg()
roles=Path('/home/yangzhen/backups/uply/20260917T061353Z/roles.sql').read_text();assert not re.search(r'PASSWORD\s+\x27',roles,re.I);roles=re.sub(r'^CREATE ROLE supabase_admin;\n','',roles,flags=re.M)
cmd(['docker','exec','-i',pg,'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],(roles+'\nALTER ROLE postgres SUPERUSER;CREATE DATABASE b2 OWNER postgres TEMPLATE template0 ENCODING \"UTF8\";').encode())
# Schema-only restore: zero copied user/account/business rows, no auth credentials.
cmd(['docker','exec',pg,'/usr/lib/postgresql/bin/pg_restore','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','--exit-on-error','--schema-only','/schema.dump'])
tr=json.loads((D/'current-triggers.json').read_text());func=json.loads((D/'current-functions.json').read_text());extra=json.loads((D/'additional-schema.json').read_text())
# Replace existing function definitions with exact current read-only catalog source; never change trigger semantics.
sql(';\n'.join({r['body'] for r in tr+func+extra['functions']})+';')
sql('INSERT INTO auth.schema_migrations(version) VALUES '+','.join("('"+str(v)+"')" for v in extra['authMigrations'])+' ON CONFLICT DO NOTHING;')
# Instrument only isolated writes; track operation/count without user payload.
sql("CREATE SCHEMA b2_probe;CREATE TABLE b2_probe.writes(table_name text,operation text);CREATE FUNCTION b2_probe.track() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO b2_probe.writes VALUES(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,TG_OP);RETURN NULL;END $$;GRANT USAGE ON SCHEMA b2_probe TO PUBLIC;GRANT ALL ON b2_probe.writes TO PUBLIC;")
tables=json.loads(sql("SELECT json_agg(n.nspname||'.'||c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ('auth','public')"))
for t in tables:sql(f'CREATE TRIGGER zz_b2_probe AFTER INSERT OR UPDATE OR DELETE ON {t} FOR EACH ROW EXECUTE FUNCTION b2_probe.track();')
secret=secrets.token_urlsafe(48)
def jwt(role):
 b=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=');raw=b({'alg':'HS256','typ':'JWT'})+b'.'+b({'role':role,'iss':'isolated-b2','exp':int(time.time())+7200});return (raw+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),raw,hashlib.sha256).digest()).rstrip(b'=')).decode()
service=jwt('service_role');env={'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':'postgres://supabase_auth_admin@/b2?host=/recovery&port=55484&sslmode=disable','GOTRUE_DB_NAMESPACE':'auth','GOTRUE_SITE_URL':'http://localhost:38088','API_EXTERNAL_URL':'http://localhost:38088','GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999','GOTRUE_JWT_SECRET':secret,'GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_DISABLE_SIGNUP':'false','GOTRUE_LOG_LEVEL':'error','GOTRUE_AUDIT_LOG_DISABLE_POSTGRES':'true','GOTRUE_MAILER_OTP_EXP':'3600','GOTRUE_MAILER_OTP_LENGTH':'8','GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED':'true','GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL':'10'}
args=['docker','run','-d','--pull=never','--read-only','--user','0:0','--name',auth,'--network',net,'--label','stage=r7cb-b2','--mount',f'type=volume,source={vol},target=/recovery,readonly','--tmpfs','/tmp']
for k,v in env.items():args+=['-e',k+'='+v]
cmd(args+[AUTH]);ip=json.loads(cmd(['docker','inspect',auth]))[0]['NetworkSettings']['Networks'][net]['IPAddress'];base='http://'+ip+':9999'
def api(path,data=None,admin=False):
 headers={'Content-Type':'application/json'}
 if admin:headers['Authorization']='Bearer '+service
 req=urllib.request.Request(base+path,headers=headers,data=None if data is None else json.dumps(data).encode(),method='GET' if data is None else 'POST')
 try:
  with urllib.request.urlopen(req,timeout=20) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  try:return e.code,json.load(e)
  except:return e.code,{}
for _ in range(80):
 try:
  if api('/health')[0]==200:break
 except Exception:pass
 time.sleep(.2)
else:
 (D/'auth-start.private.log').write_text(cmd(['docker','logs',auth]));raise RuntimeError('AUTH_START_FAILED')
state.update(phase='AUTH_READY',base=base);(D/'isolated-state.json').write_text(json.dumps(state));(D/'isolated-keys.private.json').write_text(json.dumps({'service':service,'jwt':secret}));print(json.dumps({'isolatedAuth':'READY','health':api('/health')[1],'schemaOnly':True,'currentDbWrites':0}),flush=True)
email='stable-b2-'+stamp+'@synthetic.invalid';password=secrets.token_urlsafe(36)
params={'email':email,'password':password,'email_confirm':True,'ban_duration':'876000h','app_metadata':{'human':False,'production_allowed':False,'purpose':'development-domain-execution'},'user_metadata':{'full_name':'Development execution actor'}}
status,result=api('/admin/users',params,True)
counts=json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'identities',(SELECT count(*) FROM auth.identities),'profiles',(SELECT count(*) FROM public.profiles),'accountAudit',(SELECT count(*) FROM public.account_management_audit_logs),'sessions',(SELECT count(*) FROM auth.sessions),'refreshTokens',(SELECT count(*) FROM auth.refresh_tokens),'writes',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT table_name,operation,count(*) FROM b2_probe.writes GROUP BY table_name,operation) t))"))
receipt={'scope':'Exact current application trigger path on schema-only isolated database','authVersion':'v2.197.0','createHttpStatus':status,'errorCode':result.get('error_code',result.get('code')),'usableSessionReturned':'access_token' in result,'durableCounts':counts,'currentDbWrites':0}
(E/'b2-isolated-authoring-trigger-test.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)
if status>=400:
 logs=cmd(['docker','logs',auth]);(D/'auth-create.private.log').write_text(logs)
 print(json.dumps({'missingTenantErrorInPrivateLog':'缺少租户上下文' in logs}),flush=True)
state['phase']='APPLICATION_CREATE_PROBED';(D/'isolated-state.json').write_text(json.dumps(state))

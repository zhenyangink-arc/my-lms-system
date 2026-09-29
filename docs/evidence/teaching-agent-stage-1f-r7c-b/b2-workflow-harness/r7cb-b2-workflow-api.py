import os,json,subprocess,time,secrets,base64,hmac,hashlib,urllib.request,importlib.util,sys
from pathlib import Path
os.umask(0o077);sys.dont_write_bytecode=True;D=Path('/tmp/uply-r7cb-b2-workflow');s=json.loads((D/'isolated-state.json').read_text());k=json.loads((D/'isolated-keys.private.json').read_text())
def cmd(a,input=None):
 r=subprocess.run(a,input=input,capture_output=True)
 if r.returncode:(D/'api-setup-error.private.log').write_bytes(r.stderr);raise RuntimeError('ISOLATED_SETUP_FAILED')
 return r.stdout.decode()
def sql(t):return cmd(['docker','exec','-i',s['pg'],'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-v','ON_ERROR_STOP=1'],t.encode())
spec=importlib.util.spec_from_file_location('c','/tmp/uply-r7cb-readonly.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
apps=c.m.query('SELECT json_agg(to_jsonb(a) ORDER BY id) FROM public.student_apps a');assert len(apps)==5
sql("INSERT INTO public.student_apps SELECT * FROM jsonb_populate_recordset(NULL::public.student_apps,'"+json.dumps(apps).replace("'","''")+"'::jsonb);")
req=urllib.request.Request(s['base']+'/admin/users',data=json.dumps({'email':'isolated-owner-control@synthetic.invalid','password':secrets.token_urlsafe(40),'email_confirm':True,'ban_duration':'876000h'}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+k['service']})
with urllib.request.urlopen(req) as r:owner=json.load(r)['id']
sql("UPDATE public.profiles SET role='platform_super_admin',global_role='platform_owner' WHERE id='"+owner+"';TRUNCATE b2_probe.writes;")
b=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=');raw=b({'alg':'HS256','typ':'JWT'})+b'.'+b({'sub':owner,'role':'authenticated','aud':'authenticated','exp':int(time.time())+7200});k['owner']=(raw+b'.'+base64.urlsafe_b64encode(hmac.new(k['jwt'].encode(),raw,hashlib.sha256).digest()).rstrip(b'=')).decode();(D/'isolated-keys.private.json').write_text(json.dumps(k))
rest=s['prefix']+'-rest';s['rest']=rest
cmd(['docker','run','-d','--pull=never','--read-only','--name',rest,'--network',s['net'],'--label','stage=r7cb-b2','--mount',f'type=volume,source={s["vol"]},target=/recovery,readonly','-e','PGRST_DB_URI=postgres://authenticator@/b2?host=/recovery&port=55484','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+k['jwt'],'public.ecr.aws/supabase/postgrest:v16.1'])
ip=json.loads(cmd(['docker','inspect',rest]))[0]['NetworkSettings']['Networks'][s['net']]['IPAddress'];s['restBase']='http://'+ip+':3000';(D/'isolated-state.json').write_text(json.dumps(s))
for _ in range(100):
 try:
  with urllib.request.urlopen(s['restBase']+'/') as r:
   if r.status==200:break
 except Exception:time.sleep(.1)
else:raise RuntimeError('REST_UNAVAILABLE')
print(json.dumps({'rest':'READY','isolatedControlOwner':1,'actor':0,'tenant':0,'currentDbWrites':0}))

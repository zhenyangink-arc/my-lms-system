import json,os,subprocess,urllib.request,urllib.error,urllib.parse,time,hashlib,hmac,base64,secrets
from pathlib import Path
os.umask(0o077);D=Path('/tmp/uply-r7cb-b2-workflow');E=Path('/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r7c-b');s=json.loads((D/'isolated-state.json').read_text());keys=json.loads((D/'isolated-keys.private.json').read_text());pg=s['pg'];auth=s['auth'];net=s['net'];base=s['base']
def cmd(a,input=None):
 r=subprocess.run(a,input=input,capture_output=True)
 if r.returncode:(D/'negative-error.private.log').write_bytes(r.stderr);raise RuntimeError('ISOLATED_COMMAND_ERROR')
 return r.stdout.decode()
def sql(t):return cmd(['docker','exec','-i',pg,'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-v','ON_ERROR_STOP=1'],t.encode())
actor=json.loads(sql("SELECT json_build_object('id',id,'email',email,'banned',banned_until>now()+interval '90 years') FROM auth.users WHERE raw_app_meta_data->>'purpose'='development-domain-execution'"));assert actor['banned'];email=actor['email']
# Isolated mail sink, internal network, no published host ports or external delivery.
mail=s['prefix']+'-mail';cmd(['docker','run','-d','--pull=never','--read-only','--name',mail,'--network',net,'--label','stage=r7cb-b2','--tmpfs','/tmp','-e','MP_DATABASE=/tmp/mailpit.db','public.ecr.aws/supabase/mailpit:v1.30.2']);s['mail']=mail;(D/'isolated-state.json').write_text(json.dumps(s))
obj=json.loads(cmd(['docker','inspect',auth]))[0];assert obj['Config']['Labels']['stage']=='r7cb-b2';env=dict(v.split('=',1) for v in obj['Config']['Env'] if v.startswith(('GOTRUE_','API_EXTERNAL_URL=')));env.update(GOTRUE_SMTP_HOST=mail,GOTRUE_SMTP_PORT='1025',GOTRUE_SMTP_ADMIN_EMAIL='no-reply@synthetic.invalid',GOTRUE_SMTP_SENDER_NAME='Isolated Test Only',GOTRUE_SMTP_MAX_FREQUENCY='0',GOTRUE_RATE_LIMIT_EMAIL_SENT='100',GOTRUE_RATE_LIMIT_OTP='100')
cmd(['docker','rm','-f',auth]);args=['docker','run','-d','--pull=never','--read-only','--user','0:0','--name',auth,'--network',net,'--label','stage=r7cb-b2','--mount',f'type=volume,source={s["vol"]},target=/recovery,readonly','--tmpfs','/tmp']
for k,v in env.items():args+=['-e',k+'='+v]
cmd(args+['public.ecr.aws/supabase/gotrue:v2.197.0']);ip=json.loads(cmd(['docker','inspect',auth]))[0]['NetworkSettings']['Networks'][net]['IPAddress'];base='http://'+ip+':9999';s['base']=base;(D/'isolated-state.json').write_text(json.dumps(s))
def api(path,data=None,admin=False,token=None):
 headers={'Content-Type':'application/json','Origin':'http://localhost:38088'}
 if admin or token:headers['Authorization']='Bearer '+(token or keys['service'])
 req=urllib.request.Request(base+path,headers=headers,data=None if data is None else json.dumps(data).encode(),method='GET' if data is None else 'POST')
 try:
  with urllib.request.urlopen(req,timeout=20) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  try:return e.code,json.load(e)
  except:return e.code,{}
for _ in range(100):
 try:
  if api('/health')[0]==200:break
 except Exception:pass
 time.sleep(.2)
else:raise RuntimeError('AUTH_UNAVAILABLE')
results=[]
def result(name,response,expected=None):
 code,data=response;has=bool(data.get('access_token') or data.get('refresh_token') or data.get('session'));row={'case':name,'http':code,'code':data.get('error_code',data.get('error')),'usableSession':has,'pass':not has and (code>=400 if expected is None else code in expected)};results.append(row);return data
result('password grant: banned enforcement before password validation',api('/token?grant_type=password',{'email':email,'password':'Known-test-challenge-that-must-not-matter'}))
result('public magic-link issuance (may issue unusable token)',api('/magiclink',{'email':email}),[200,400,403,429])
status,link=api('/admin/generate_link',{'type':'magiclink','email':email},True)
assert status==200 and link.get('hashed_token') and link.get('email_otp'),'VALID_CHALLENGE_UNAVAILABLE'
result('verify valid magic-link hash while banned',api('/verify',{'type':'magiclink','token_hash':link['hashed_token']}))
result('verify valid email OTP while banned',api('/verify',{'type':'email','email':email,'token':link['email_otp']}))
result('public OTP issuance (may issue unusable token)',api('/otp',{'email':email,'create_user':False}),[200,400,403,429])
result('refresh without any issued refresh grant',api('/token?grant_type=refresh_token',{'refresh_token':'123456789012'}))
result('PKCE without a valid auth-code grant',api('/token?grant_type=pkce',{'auth_code':secrets.token_urlsafe(24),'code_verifier':secrets.token_urlsafe(48)}))
result('SMS OTP disabled provider',api('/otp',{'phone':'+15555550199','create_user':False}))
counts=json.loads(sql("SELECT json_build_object('sessions',(SELECT count(*) FROM auth.sessions),'refreshTokens',(SELECT count(*) FROM auth.refresh_tokens),'bannedActors',(SELECT count(*) FROM auth.users WHERE banned_until>now()+interval '90 years'),'authAudit',(SELECT count(*) FROM auth.audit_log_entries),'identities',(SELECT count(*) FROM auth.identities),'profiles',(SELECT count(*) FROM public.profiles))"));assert counts['sessions']==0 and counts['refreshTokens']==0
assert all(r['pass'] for r in results),results
assert all(r['code']=='user_banned' for r in results if r['case'].startswith(('password grant','verify valid'))),results
out={'status':'PASS FOR ACTIVE BAN — ISSUANCE IS NOT DISABLED','authVersion':'v2.197.0','ownedIsolated':True,'applicationTriggers':'Current definitions, active unchanged','initialActorSessions':0,'initialActorRefreshTokens':0,'tests':results,'finalCounts':counts,'scopeLimits':['No previously issued valid refresh grant exists; random-refresh and zero-grant invariant tested, not a login-then-ban scenario','Browser-origin requests exercise enabled auth API; no separate application browser login UI was run','Admin magic-link challenge generated only in isolated environment and never exported','Hosted SMTP credentials/signing keys not cloned; local mail sink and isolated signing secret used'],'currentDbWrites':0};(E/'b2-workflow-login-tests.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

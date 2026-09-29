import sys,os,json,urllib.request,urllib.error,hashlib,datetime,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True;os.umask(0o077)
s=importlib.util.spec_from_file_location('c','/tmp/uply-r7cb-readonly.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
R=c.R;E=c.E;D=Path('/tmp/uply-r7cb-b2-contract');D.mkdir(exist_ok=True,mode=0o700)
def save(n,x):c.save(n,x)
cfg=json.loads(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text());url=cfg['NEXT_PUBLIC_SUPABASE_URL'];project=url.split('//')[1].split('.')[0]
def get(url,headers):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers,method='GET'),timeout=30) as r:return {'status':r.status,'data':json.load(r)}
 except urllib.error.HTTPError as e:return {'status':e.code}
health=get(url+'/auth/v1/health',{'apikey':cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']});settings=get(url+'/auth/v1/settings',{'apikey':cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']})
token=(Path.home()/'.supabase/access-token').read_text().strip();mg=get('https://api.supabase.com/v1/projects/'+project+'/config/auth',{'Authorization':'Bearer '+token})
# Only booleans/numbers and named safe enums. No emails, redirect domains, keys, credentials or headers persisted.
data=mg.get('data',{});safe={k:v for k,v in data.items() if isinstance(v,(bool,int,float)) and any(t in k for t in ['enable','disable','autoconfirm','confirm','otp','expiry','exp','rotation','refresh','session','password','rate_limit','audit'])}
for k in ['mailer_otp_length','mailer_otp_exp','password_min_length','password_required_characters','security_refresh_token_reuse_interval']:
 if k in data and isinstance(data[k],(str,int,bool)):safe[k]=data[k]
external=settings.get('data',{}).get('external',{})
inv={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'health':health,'publicSettings':{k:v for k,v in settings.get('data',{}).items() if isinstance(v,(bool,int,float))},'externalProviders':external,'managementConfigStatus':mg['status'],'safeManagementConfig':safe,'currentDbWrites':0}
save('b2-auth-environment-inventory',inv)
# Current installed trigger definitions, function closure and constraints; schema only, no auth principal data.
tr=c.m.query("SELECT coalesce(json_agg(json_build_object('table',n.nspname||'.'||cl.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'function',p.oid::regprocedure::text,'body',pg_get_functiondef(p.oid)) ORDER BY n.nspname,cl.relname,t.tgname),'[]'::json) FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND ((n.nspname='auth') OR (n.nspname='public' AND cl.relname IN ('profiles','tenants','tenant_memberships','user_permission_grants','account_management_audit_logs','tenant_provisioned_accounts')))")
(D/'current-triggers.json').write_text(json.dumps(tr,ensure_ascii=False,indent=2))
funcs=c.m.query("SELECT coalesce(json_agg(json_build_object('name',p.oid::regprocedure::text,'body',pg_get_functiondef(p.oid))),'[]'::json) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND (p.proname IN ('create_tenant','is_platform_tenant_manager','current_app_role','is_platform_owner') OR p.proname LIKE '%sync%profile%' OR p.proname LIKE '%sync%membership%')")
(D/'current-functions.json').write_text(json.dumps(funcs,ensure_ascii=False,indent=2))
(D/'audit-start.json').write_text(json.dumps({'schema':c.m.schema(),'business':c.m.fingerprints(),'startedAt':inv['observedAt']}))
print(json.dumps({'health':health,'providers':external,'managementStatus':mg['status'],'safeConfig':safe,'triggers':[{'table':t['table'],'function':t['function']} for t in tr]}))

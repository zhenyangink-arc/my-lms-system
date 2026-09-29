"""Owned PostgREST/Auth services on an internal network, backed by isolated Unix socket."""
import base64,hashlib,hmac,json,os,secrets,socket,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent));import runner
D=Path(sys.argv[1]);s=json.loads((D/'state.json').read_text());runner.IsolatedPsql(s).guard()
def cmd(args):
 r=subprocess.run(args,capture_output=True)
 if r.returncode:raise RuntimeError('OWNED_SERVICE_COMMAND_FAILED')
 return r.stdout.decode()
def token(secret,role):
 b=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=')
 raw=b({'alg':'HS256','typ':'JWT'})+b'.'+b({'role':role,'iss':'r5b-isolated','exp':int(time.time())+7200})
 return (raw+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),raw,hashlib.sha256).digest()).rstrip(b'=')).decode()
net=s['container']+'-services';cmd(['docker','network','create','--internal','--label','stage=stage1f-r5b',net])
jwt=secrets.token_urlsafe(48);keys={'jwt':jwt,'anon':token(jwt,'anon'),'service':token(jwt,'service_role')};ports=[]
for _ in range(2):
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));ports.append(sock.getsockname()[1])
services={'network':net,'containerPrefix':s['container'],'gatewayPort':ports[0],'nextPort':ports[1],'services':{}}
(D/'services.private.json').write_text(json.dumps(services));(D/'keys.private.json').write_text(json.dumps(keys));os.chmod(D/'keys.private.json',0o600)
for name,image,env in [
 ('rest','public.ecr.aws/supabase/postgrest:v16.1',{'PGRST_DB_URI':'postgres://authenticator@/uply_r5b_foundation?host=/recovery&port=55483','PGRST_DB_SCHEMAS':'public','PGRST_DB_EXTRA_SEARCH_PATH':'public,extensions','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':jwt,'PGRST_SERVER_PORT':'3000','PGRST_DB_POOL':'5'}),
 ('auth','public.ecr.aws/supabase/gotrue:v2.195.0',{'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':'postgres://supabase_auth_admin@/uply_r5b_foundation?host=/recovery&port=55483&sslmode=disable','GOTRUE_DB_NAMESPACE':'auth','GOTRUE_SITE_URL':f'http://127.0.0.1:{ports[1]}','API_EXTERNAL_URL':f'http://127.0.0.1:{ports[0]}','GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999','GOTRUE_JWT_SECRET':jwt,'GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'true','GOTRUE_DISABLE_SIGNUP':'false','GOTRUE_LOG_LEVEL':'error'})]:
 cname=s['container']+'-'+name
 args=['docker','run','-d','--pull=never','--read-only','--user','0:0','--name',cname,'--network',net,'--label','stage=stage1f-r5b','--label','purpose=isolated-foundation-service','--mount',f'type=volume,source={s["volume"]},target=/recovery,readonly','--tmpfs','/tmp:rw,size=32m,mode=1777']
 for k,v in env.items():args+=['-e',k+'='+v]
 cid=cmd(args+[image]).strip();obj=json.loads(cmd(['docker','inspect',cid]))[0]
 ip=obj['NetworkSettings']['Networks'][net]['IPAddress'];services['services'][name]={'container':cname,'id':cid,'ip':ip,'port':3000 if name=='rest' else 9999}
 (D/'services.private.json').write_text(json.dumps(services))
print(json.dumps({'services':'CREATED','networkInternal':True,'dbSocketOnly':True,'productionCredentials':False,'hostPortsPublished':False}))

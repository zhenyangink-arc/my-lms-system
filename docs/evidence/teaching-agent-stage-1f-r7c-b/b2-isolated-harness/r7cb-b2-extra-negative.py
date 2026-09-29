import json,subprocess,urllib.request,urllib.error
from pathlib import Path
D=Path('/tmp/uply-r7cb-b2-contract');E=Path('/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r7c-b');s=json.loads((D/'isolated-state.json').read_text())
email=subprocess.check_output(['docker','exec',s['pg'],'/usr/lib/postgresql/bin/psql','-h','/recovery','-p','55484','-U','supabase_admin','-d','b2','-X','-qAt','-c','SELECT email FROM auth.users;']).decode().strip()
results=[]
for name,path,body in [('email OTP issuance after rate window','/otp',{'email':email,'create_user':False}),('legacy-format nonexistent refresh grant','/token?grant_type=refresh_token',{'refresh_token':'123456789012'})]:
 req=urllib.request.Request(s['base']+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=15) as res:code=res.status;data=json.load(res)
 except urllib.error.HTTPError as err:code=err.code;data=json.load(err)
 results.append({'case':name,'http':code,'code':data.get('error_code',data.get('error')),'usableSession':bool(data.get('access_token') or data.get('refresh_token'))})
p=E/'b2-isolated-login-tests.json';x=json.loads(p.read_text());x['additionalTests']=results;p.write_text(json.dumps(x,indent=2)+'\n');print(json.dumps(results))

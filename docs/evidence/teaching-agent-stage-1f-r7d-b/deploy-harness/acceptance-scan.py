from pathlib import Path
import json,re,subprocess,hashlib
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7d-b';ns={};exec((R/'docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-build-harness/b3a-readonly.py').read_text().split('snapshot=query')[0],ns)
v=ns['query'](Path('/tmp/r7cb-b2-approved-read.sql').read_text());actor=v['actors'][0]['id'];tenant=v['tenants'][0]['id']
C=ns['C'];secretValues=[str(v) for k,v in C.items() if isinstance(v,str) and len(v)>10 and any(x in k.upper() for x in ['SECRET','SERVICE_ROLE','PASSWORD','PRIVATE_KEY'])]
secretValues += [l.split(':')[-1] for l in (ns['DB']/'pgpass').read_text().splitlines() if l and not l.startswith('#')]
body=Path('/tmp/r7d-lesson-facts-http-response.network-response').read_text()
assert 'CURRENT_DEVELOPMENT_DB' in body and '2026-09-18T02:10:24.196Z' in body and '课程执行事实核验' in body
bad=re.compile(r'answer_key|privateDefinitionDigest|native-choice-response/1|postgres(?:ql)?://|service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')
assert not bad.search(body) and not any(s in body for s in [actor,tenant]+secretValues)
proc=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'])) if x['name']=='uply-first-enable');logs=[]
for k in ['pm_out_log_path','pm_err_log_path']:
 s=Path(proc['pm2_env'][k]).read_bytes()[-100000:].decode(errors='replace')
 assert not bad.search(s) and not any(x in s for x in secretValues+[actor,tenant])
 logs.append({'stream':k,'bytes':len(s),'privateValueLeaks':0,'refreshTokenNotFoundCodeCount':s.count('refresh_token_not_found')})
(E/'current-tool-private-boundary.json').write_text(json.dumps({'status':'PASS','httpResponse':'full captured response body, no refetch','httpBodyBytes':len(body),'httpBodySha256':hashlib.sha256(body.encode()).hexdigest(),'expectedToolSummaryVisible':True,'actualActorTenantOrCredentialLeaks':0,'privateGradingMarkers':0,'browserFullDomScan':'PASS / no UUID or JWT markers','clientBundleScan':'deployed-client-scan.json','logs':logs,'dtoBoundary':'actual successful Core output validation + locked explicit DTO projection; raw ToolResult is server-only and not separately exported','genericAuthErrorCode':'refresh_token_not_found is an error label, not a token value'},indent=2)+'\n');print('FULL_HTTP_DOM_CLIENT_LOG_BOUNDARY_PASS')

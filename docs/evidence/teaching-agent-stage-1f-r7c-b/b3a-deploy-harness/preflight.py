from pathlib import Path
import json,hashlib,tarfile,subprocess,datetime,os,stat
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7c-b';L=Path('/home/yangzhen/releases/uply-first-enable-20260910/source');A=json.loads((E/'approval-b3a-deploy.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected={'candidate-build.tar.gz':'5d0b773125450bca5372085c142b2b524907f962ddc73837183615ffeb764c9e','candidate-dependencies.tar.gz':'3c2b871724cc349414031f1471e05504f0b969596d8d07f25e162e6704012ae9','candidate-source.tar.gz':'c76868ac77b5fec44c0d8a072396a2aea2174af79f03664b26068594b0914ae7'}
F=A['sourceHashes'];dep=A['dependencies']['exactAddedPackages'];assert len(F)==35 and len(dep)==15
assert A['approvedFutureScenarioBudget']=={'INSERT':3,'UPDATE':1,'DELETE':0}
assert (L/'.next/BUILD_ID').read_text().strip()=='vZokoJqpKDRZxnpQcQpah'
archives={};depfiles={}
for name,h in expected.items():
 p=R/'build/r7cb-b3a-candidate'/name;assert sha(p)==h,name;archives[name]=h
 with tarfile.open(p) as tar:
  names=set()
  for m in tar.getmembers():
   assert not m.name.startswith('/') and '..' not in Path(m.name).parts and (m.isfile() or m.isdir()),m.name
   if m.isfile():
    assert m.name not in names;names.add(m.name);data=tar.extractfile(m).read();digest=hashlib.sha256(data).hexdigest()
    if name=='candidate-source.tar.gz':assert m.name in F and digest==F[m.name]
    if name=='candidate-dependencies.tar.gz':assert any(m.name.startswith(d+'/') for d in dep);depfiles[m.name]={'sha256':digest,'mode':m.mode}
    if name=='candidate-build.tar.gz':
     assert m.name.startswith('.next/')
     if m.name=='.next/BUILD_ID':assert data.decode().strip()=='KaSWaVYOIk7ZjWGpvVWIf'
  if name=='candidate-source.tar.gz':assert names==set(F)
for p,h in F.items():assert sha(R/p)==h==sha(Path(A['sourceDirectory'])/p),p
for p in dep:
 f=L/p
 if f.exists():
  actual={str(x.relative_to(L)):{'sha256':sha(x),'mode':stat.S_IMODE(x.stat().st_mode)} for x in f.rglob('*') if x.is_file()};wanted={n:v for n,v in depfiles.items() if n.startswith(p+'/')};assert actual==wanted,'EXISTING_DEPENDENCY_DIFFERS:'+p
assert all(not (L/p).is_symlink() for p in dep)
old=json.loads((L/'package-lock.json').read_text());new=json.loads((Path(A['sourceDirectory'])/'package-lock.json').read_text());assert set(new['packages'])-set(old['packages'])==set(dep)
assert all(old['packages'][k]==v for k,v in new['packages'].items() if k and k in old['packages'])
oldp=json.loads((L/'package.json').read_text());newp=json.loads((Path(A['sourceDirectory'])/'package.json').read_text());newp['dependencies'].pop('pg');newp['devDependencies'].pop('@types/pg');assert oldp==newp
source=json.loads((E/'b3a-candidate-source-lock.json').read_text())['allCandidateSources']
# Compare against the actual previous BUILD's source provenance, not its
# historically partially materialized source tree. No unapproved file is copied.
oldSource={p:v['sha256'] for p,v in json.loads((E/'b1c-candidate-source-manifest.json').read_text())['files'].items()}
oldSource['src/features/digital-textbook/server/native-activity-authoring.server.ts']=json.loads((E/'b1d-source-lock.json').read_text())['files'][0]['sha256']
oldSource.update(json.loads((E/'b2a-build-results.json').read_text())['sourceHashes'])
buildDiff={p for p in set(source)|set(oldSource) if source.get(p)!=oldSource.get(p)};assert buildDiff==set(F),'UNAPPROVED_BUILD_SOURCE_CHANGE'
historical=json.loads(Path('/home/yangzhen/operations/uply/teaching-agent/r7cb-b2a/20260917T100034Z/boundary-before.json').read_text())['src']
for p,h in source.items():
 if p in F or not p.startswith('src/'):continue
 actual=sha(L/p) if (L/p).exists() else None
 if actual!=h:assert actual==historical.get(p[4:]),'NEW_LIVE_SOURCE_DRIFT:'+p
# Fixed read-only DB helper; never run its old preflight mutation/provisioning code.
ns={};exec((E/'b3a-build-harness/b3a-readonly.py').read_text().split('snapshot=query')[0],ns);query=ns['query'];wrapped=ns['wrapped'];C=ns['C'];DB=ns['DB']
snapshot=query(Path('/tmp/r7cb-b2-approved-read.sql').read_text());assert snapshot['canonicalValid'] and len(snapshot['actors'])==len(snapshot['tenants'])==1
actor=snapshot['actors'][0];tenant=snapshot['tenants'][0]
assert hashlib.sha256(actor['id'].encode()).hexdigest()=='cf4d2db0a75301af51a807149b0ed32134ce69db7e3767251816b9232722afbe'
assert hashlib.sha256(tenant['id'].encode()).hexdigest()=='7356e8b33db28d06f9283e6f4a5b9fb90f7d9d630a042093cffbf9d75c0ffbac'
assert actor['sessions']==actor['refreshTokens']==0 and actor['profile']=={'role':'student','globalRole':'member','status':'inactive'}
assert actor['human']==False and actor['productionAllowed']==False and not actor['provisionedProductionAccount']
assert len(actor['memberships'])==1 and actor['memberships'][0]=={'tenantId':tenant['id'],'role':'student','status':'suspended','isDefault':False}
assert datetime.datetime.fromisoformat(actor['banUntil'].replace('Z','+00:00'))>datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=24)
meta=wrapped("SELECT json_build_object('attempt',(SELECT count(*) FROM public.digital_textbook_attempts WHERE student_id='"+actor['id']+"'),'nodeProgress',(SELECT count(*) FROM public.digital_textbook_node_progress WHERE student_id='"+actor['id']+"'),'pageProgress',(SELECT count(*) FROM public.digital_textbook_activity_page_progress WHERE student_id='"+actor['id']+"'),'ledger',(SELECT count(*) FROM supabase_migrations.schema_migrations),'rpcHash',encode(sha256(convert_to(pg_get_functiondef('public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'::regprocedure),'UTF8')),'hex'))")
assert meta=={'attempt':0,'nodeProgress':0,'pageProgress':0,'ledger':458,'rpcHash':'af4511a91338e34f7febecbcf5fd77cd468da5b265408782ce2692260f584c50'},'DB_BASELINE_DRIFT'
tr=wrapped("SELECT json_build_object('triggers',(SELECT json_agg(json_build_object('table','digital_textbook_node_progress','enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid))) FROM pg_trigger t WHERE t.tgrelid='public.digital_textbook_node_progress'::regclass AND NOT t.tgisinternal))")['triggers']
prior=[x for x in json.loads((E/'b3-current-path-audit.json').read_text())['schema']['triggers'] if x['table']=='digital_textbook_node_progress'];key=lambda x:json.dumps(x,sort_keys=True);assert sorted(map(key,tr))==sorted(map(key,prior)),'TRIGGER_DRIFT'
private=DB.parent/'development-execution/b3';assert not private.exists(),'B3_PRIVATE_STATE_UNEXPECTED'
assert C.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') in (None,False,'false','0','')
assert all(C.get(k) in (None,'',[]) for k in ['TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS'])
procs=json.loads(subprocess.check_output(['pm2','jlist']));app=next(p for p in procs if p['name']=='uply-first-enable');assert app['pm2_env']['status']=='online' and app['pm2_env']['pm_cwd']==str(L)
serve=json.loads(subprocess.check_output(['tailscale','serve','status','--json']));assert serve['Web']['kmgwak-system-product-name.taila18cd5.ts.net:8443']['Handlers']['/']['Proxy']=='http://127.0.0.1:3000'
protected={str(p):sha(p) for p in [DB.parent/'runtime.json',Path(app['pm2_env']['pm_exec_path'])]}
# Keep complete manifests private to this local audit; evidence contains hashes, no credentials.
def tree(root):return {str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and not p.is_symlink()}
protected['publicTreeHash']=hashlib.sha256(json.dumps(tree(L/'public'),sort_keys=True).encode()).hexdigest();protected['tailscaleServeHash']=hashlib.sha256(json.dumps(serve,sort_keys=True).encode()).hexdigest()
out={'status':'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'currentBuild':'vZokoJqpKDRZxnpQcQpah','candidateBuild':'KaSWaVYOIk7ZjWGpvVWIf','archives':archives,'sourceFiles':35,'dependencies':15,'dependencyExistingIdentical':sum((L/p).exists() for p in dep),'canonicalBinding':[1,1,1],'freeze':'MATCH','actor':'EXACT / BANNED / INACTIVE / SUSPENDED / NON-DEFAULT','actorSessions':0,'actorRefresh':0,**meta,'nodeProgressTriggers':'MATCH','triggerHashes':[hashlib.sha256(key(x).encode()).hexdigest() for x in sorted(tr,key=key)],'scope':'DISABLED','privateB3State':'ABSENT','scenarioBudget':{'INSERT':3,'UPDATE':1,'DELETE':0},'protected':protected,'pm2':{'name':'uply-first-enable','status':'online','pid':app['pid'],'cwd':str(L)},'feature':'OFF','allowlists':'EMPTY','dbWrites':0,'deployMutation':0}
(E/'b3a-deploy-fresh-preflight.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

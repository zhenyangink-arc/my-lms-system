from pathlib import Path
import json,hashlib,tarfile,subprocess,datetime,stat
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7d-b';L=Path('/home/yangzhen/releases/uply-first-enable-20260910/source');A=json.loads((E/'approval-r7d-lesson-tool-deploy.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert A['currentBuild']=='KaSWaVYOIk7ZjWGpvVWIf' and A['candidateBuild']=='PjpaYHAz0asyvwh0G-lBo'
assert (L/'.next/BUILD_ID').read_text().strip()==A['currentBuild']
expected={'candidate-build.tar.gz':'c95ba807a5e4094062a2af1e465d01e3ec5413765a31fd14359a84499eb046fd','candidate-source.tar.gz':'2cd8714bad62443c813d436267b8dd37f3a330e0f9723b8febc075be139fda7d'}
sourceModes={}
for n,h in expected.items():
 a=A['artifacts'][n];assert sha(Path(a['path']))==a['sha256']==h
 with tarfile.open(a['path']) as t:
  names=[]
  for m in t.getmembers():
   assert not m.name.startswith('/') and '..' not in Path(m.name).parts and (m.isfile() or m.isdir()),'ARCHIVE_PATH'
   if not m.isfile():continue
   names.append(m.name);data=t.extractfile(m).read()
   if n=='candidate-source.tar.gz':
    assert m.name in A['sourceHashes'] and hashlib.sha256(data).hexdigest()==A['sourceHashes'][m.name] and sha(R/m.name)==A['sourceHashes'][m.name]
    sourceModes[m.name]=m.mode;assert stat.S_IMODE((R/m.name).stat().st_mode)==m.mode
   else:
    assert m.name.startswith('.next/')
    if m.name=='.next/BUILD_ID':assert data.decode().strip()==A['candidateBuild']
  assert len(names)==len(set(names))
  if n=='candidate-source.tar.gz':assert set(names)==set(A['sourceHashes']) and len(names)==8
for p,v in A['rollback']['paths'].items():
 f=L/p;assert not f.is_symlink();actual={'exists':f.exists(),'mode':oct(stat.S_IMODE(f.stat().st_mode)) if f.exists() else None,'sha256':sha(f) if f.exists() else None};assert actual==v,'LIVE_SOURCE_DRIFT:'+p
new=json.loads((E/'candidate-source-lock.json').read_text())['allCandidateSources'];old=json.loads((R/'docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-candidate-source-lock.json').read_text())['allCandidateSources'];assert {p for p in set(old)|set(new) if old.get(p)!=new.get(p)}==set(A['sourceHashes'])
for p in ['package.json','package-lock.json']:assert sha(L/p)==new[p]==old[p]
r=subprocess.run(['python3',str(E/'readonly-baseline.py')],capture_output=True,timeout=90);assert r.returncode==0,'DB_BASELINE_FAILED'
snapshot=json.loads((E/'current-db-baseline.json').read_text());assert snapshot['freeze']=='MATCH' and snapshot['actorSessions']==snapshot['actorRefreshTokens']==0
ns={};exec((R/'docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-build-harness/b3a-readonly.py').read_text().split('snapshot=query')[0],ns)
tr=ns['wrapped']("SELECT json_build_object('triggers',(SELECT json_agg(json_build_object('table','digital_textbook_node_progress','enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid))) FROM pg_trigger t WHERE t.tgrelid='public.digital_textbook_node_progress'::regclass AND NOT t.tgisinternal))")['triggers']
prior=[x for x in json.loads((R/'docs/evidence/teaching-agent-stage-1f-r7c-b/b3-current-path-audit.json').read_text())['schema']['triggers'] if x['table']=='digital_textbook_node_progress'];key=lambda x:json.dumps(x,sort_keys=True);assert sorted(map(key,tr))==sorted(map(key,prior))
proc=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'])) if x['name']=='uply-first-enable');assert proc['pm2_env']['status']=='online' and proc['pm2_env']['pm_cwd']==str(L)
serve=json.loads(subprocess.check_output(['tailscale','serve','status','--json']));assert serve['Web']['kmgwak-system-product-name.taila18cd5.ts.net:8443']['Handlers']['/']['Proxy']=='http://127.0.0.1:3000'
def tree(p):return {str(f.relative_to(p)):sha(f) for f in p.rglob('*') if f.is_file() and not f.is_symlink()}
def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()
protected={str(p):sha(p) for p in [ns['DB'].parent/'runtime.json',Path(proc['pm2_env']['pm_exec_path']),L/'package.json',L/'package-lock.json']}
protected.update(publicTree=digest(tree(L/'public')),b3Private=digest(tree(ns['DB'].parent/'development-execution/b3')),tailscale=digest(serve))
assert json.loads((ns['DB'].parent/'development-execution/b3/disabled').read_text())['state']=='DISABLED'
out={'status':'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'currentBuild':A['currentBuild'],'candidateBuild':A['candidateBuild'],'archiveHashes':expected,'sourceHashes':'MATCH','sourceModes':sourceModes,'livePresence':A['rollback']['paths'],'sourceBuildDiff':'8 EXACT','DB':json.loads((E/'current-environment.json').read_text()),'baseline':snapshot,'nodeProgressTriggers':'MATCH','protected':protected,'pm2':{'name':'uply-first-enable','status':'online','pid':proc['pid']},'writes':0}
(E/'deploy-fresh-preflight.json').write_text(json.dumps(out,indent=2)+'\n');print('FRESH_PREFLIGHT_PASS')

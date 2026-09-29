# Approval B3A-Deploy only. No database mutation, execution config or B3 dispatch.
from pathlib import Path
import os,json,hashlib,tarfile,shutil,subprocess,datetime,urllib.request,time,stat
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7c-b';H=E/'b3a-deploy-harness';L=Path('/home/yangzhen/releases/uply-first-enable-20260910/source');A=json.loads((E/'approval-b3a-deploy.json').read_text());os.umask(0o077)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def digest_tree(root):return {str(p.relative_to(root)):{'sha256':sha(p),'mode':stat.S_IMODE(p.stat().st_mode)} for p in root.rglob('*') if p.is_file() and not p.is_symlink()}
def safe_pm2(action):
 assert action in ['stop','start'];r=subprocess.run(['pm2',action,'uply-first-enable'],capture_output=True,timeout=30)
 if r.returncode:raise RuntimeError('PM2_'+action.upper()+'_FAILED')
# Read-only fresh preflight finishes before ANY live mutation or rollback write.
r=subprocess.run(['python3',str(H/'preflight.py')],capture_output=True,timeout=90);assert r.returncode==0,'FRESH_PREFLIGHT_FAILED (see independent read-only preflight)'
P=json.loads((E/'b3a-deploy-fresh-preflight.json').read_text());assert P['status']=='PASS'
O=Path('/home/yangzhen/operations/uply/teaching-agent/r7cb-b3a')/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');B=O/'rollback';S=O/'staged';B.mkdir(parents=True,mode=0o700);S.mkdir(mode=0o700)
for name,h in P['archives'].items():
 arc=R/'build/r7cb-b3a-candidate'/name;assert sha(arc)==h
 with tarfile.open(arc) as tar:tar.extractall(S,filter='data')
assert (S/'.next/BUILD_ID').read_text().strip()==A['candidateBuild']
assert all(sha(S/p)==h for p,h in A['sourceHashes'].items())
manifest={'source':{},'dependencies':{},'privateB3':{'path':'/home/yangzhen/.config/uply-first-enable-20260910/development-execution/b3','existed':False},'previousBuild':A['currentBuild'],'candidateBuild':A['candidateBuild'],'protected':P['protected']}
for p in A['deployedFilesExact']:
 f=L/p;assert not f.is_symlink();exists=f.exists();manifest['source'][p]={'existed':exists,'mode':stat.S_IMODE(f.stat().st_mode) if exists else None,'sha256':sha(f) if exists else None}
 if exists:t=B/'source'/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,t)
for p in A['dependencies']['exactAddedPackages']:
 f=L/p;exists=f.exists();state=digest_tree(f) if exists else None
 if exists:assert state==digest_tree(S/p),'DEPENDENCY_DRIFT';shutil.copytree(f,B/'dependencies'/p,symlinks=True)
 manifest['dependencies'][p]={'existed':exists,'files':state}
private=Path(manifest['privateB3']['path']);assert not private.exists()
shutil.copytree(L/'.next',B/'.next',symlinks=True)
manifest['previousNextFiles']=digest_tree(B/'.next');assert (B/'.next/BUILD_ID').read_text().strip()==A['currentBuild']
(B/'presence.json').write_text(json.dumps(manifest,indent=2)+'\n')
beforeSrc=digest_tree(L/'src');(B/'source-tree-before.json').write_text(json.dumps(beforeSrc,indent=2)+'\n')
receipt={'status':'ROLLBACK_PRESERVED','operationsDirectory':str(O),'rollback':str(B),'currentBuild':A['currentBuild'],'candidateBuild':A['candidateBuild'],'dbWrites':0,'scope':'DISABLED','executionApprovalCreated':False,'pm2Target':'uply-first-enable'}
def save(): (E/'b3a-deployment-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
save();print('ROLLBACK_PRESERVED',str(B),flush=True)
stopped=False;switched=False
try:
 assert (L/'.next/BUILD_ID').read_text().strip()==A['currentBuild'];assert not private.exists()
 for p,v in manifest['source'].items():assert (L/p).exists()==v['existed'] and (not v['existed'] or sha(L/p)==v['sha256']),'LIVE_SOURCE_CHANGED'
 safe_pm2('stop');stopped=True
 os.rename(L/'.next',O/'displaced-next');os.rename(S/'.next',L/'.next');switched=True
 for p in A['deployedFilesExact']:
  target=L/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(S/p,target);assert sha(target)==A['sourceHashes'][p]
 for p,v in manifest['dependencies'].items():
  if not v['existed']:assert not (L/p).exists();(L/p).parent.mkdir(parents=True,exist_ok=True);shutil.copytree(S/p,L/p,symlinks=True)
  assert digest_tree(L/p)==digest_tree(S/p)
 assert not private.exists()
 safe_pm2('start');stopped=False
 ready=False
 for _ in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:3000/',timeout=2) as response:ready=response.status==200
   if ready:break
  except Exception:pass
  time.sleep(.5)
 assert ready,'HEALTH_FAILED'
 procs=json.loads(subprocess.check_output(['pm2','jlist']));app=next(x for x in procs if x['name']=='uply-first-enable');assert app['pm2_env']['status']=='online'
 after=digest_tree(L/'src');changed={p for p in set(beforeSrc)|set(after) if beforeSrc.get(p)!=after.get(p)};assert changed=={p[4:] for p in A['deployedFilesExact'] if p.startswith('src/')},'UNEXPECTED_SOURCE_MUTATION'
 for p,h in P['protected'].items():
  if p.startswith('/'):assert sha(Path(p))==h
 public={str(p.relative_to(L/'public')):sha(p) for p in (L/'public').rglob('*') if p.is_file() and not p.is_symlink()};assert hashlib.sha256(json.dumps(public,sort_keys=True).encode()).hexdigest()==P['protected']['publicTreeHash']
 serve=json.loads(subprocess.check_output(['tailscale','serve','status','--json']));assert hashlib.sha256(json.dumps(serve,sort_keys=True).encode()).hexdigest()==P['protected']['tailscaleServeHash']
 assert not private.exists()
 receipt.update(status='DEPLOYED_PENDING_OWNER_READ_ONLY_VALIDATION',currentBuild=(L/'.next/BUILD_ID').read_text().strip(),files=35,dependencyDirectories=15,sourceHashes='MATCH',dependencyHashes='MATCH',pm2='online',pid=app['pid'],httpRoot=200,protected='UNCHANGED',migration=0,attemptWrites=0,progressWrites=0,scope='DISABLED');save();print(json.dumps(receipt),flush=True)
except Exception as ex:
 receipt['failure']=str(ex) if isinstance(ex,AssertionError) else type(ex).__name__;receipt['status']='DEPLOYMENT_FAILED_ROLLBACK_REQUIRED';save()
 if stopped or switched:
  safe_pm2('stop')
  if (L/'.next').exists():os.rename(L/'.next',O/'failed-next')
  shutil.copytree(B/'.next',L/'.next',symlinks=True)
  for p,v in manifest['source'].items():
   f=L/p
   if v['existed']:f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(B/'source'/p,f)
   elif f.exists():assert not f.is_symlink() and sha(f)==A['sourceHashes'][p];f.unlink()
  for p,v in manifest['dependencies'].items():
   f=L/p
   if not v['existed'] and f.exists():assert digest_tree(f)==digest_tree(S/p);shutil.rmtree(f)
  assert not private.exists();safe_pm2('start');receipt['status']='ROLLED_BACK';receipt['currentBuild']=A['currentBuild'];save()
 raise

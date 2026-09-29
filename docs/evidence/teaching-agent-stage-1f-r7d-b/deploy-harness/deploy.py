# Exact user-approved R7D-B deployment. No DB writes, no execution scope changes.
from pathlib import Path
import os,json,hashlib,tarfile,shutil,subprocess,datetime,stat,time,urllib.request
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7d-b';L=Path('/home/yangzhen/releases/uply-first-enable-20260910/source');A=json.loads((E/'approval-r7d-lesson-tool-deploy.json').read_text());os.umask(0o077)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p):return {str(f.relative_to(p)):{'sha256':sha(f),'mode':stat.S_IMODE(f.stat().st_mode)} for f in p.rglob('*') if f.is_file() and not f.is_symlink()}
def pm(action):
 assert action in ['stop','start'];r=subprocess.run(['pm2',action,'uply-first-enable'],capture_output=True,timeout=30);assert r.returncode==0,'PM2_'+action+'_FAILED'
r=subprocess.run(['python3',str(E/'deploy-harness/preflight.py')],capture_output=True,timeout=90);assert r.returncode==0,'FRESH_PREFLIGHT_FAILED'
P=json.loads((E/'deploy-fresh-preflight.json').read_text());assert P['status']=='PASS' and Path('/tmp/r7d-db-preflight.json').exists()
O=Path('/home/yangzhen/operations/uply/teaching-agent/r7d-b')/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');B=O/'rollback';S=O/'staged';B.mkdir(parents=True,mode=0o700);S.mkdir(mode=0o700)
for a in A['artifacts'].values():
 assert sha(Path(a['path']))==a['sha256']
 with tarfile.open(a['path']) as t:t.extractall(S,filter='data')
assert (S/'.next/BUILD_ID').read_text().strip()==A['candidateBuild']
# Python data filter narrows group-write bits. Restore only the eight explicitly
# approved archive modes, validating hash first, before stopping the application.
for p,h in A['sourceHashes'].items():
 assert sha(S/p)==h
 os.chmod(S/p,P['sourceModes'][p])
 assert stat.S_IMODE((S/p).stat().st_mode)==P['sourceModes'][p]
manifest={'previousBuild':A['currentBuild'],'candidateBuild':A['candidateBuild'],'paths':{},'protected':P['protected']}
for p,h in A['sourceHashes'].items():
 assert sha(S/p)==h;f=L/p;v=A['rollback']['paths'][p];assert f.exists()==v['exists'] and (not f.exists() or sha(f)==v['sha256'])
 manifest['paths'][p]=v
 if f.exists():t=B/'source'/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,t)
shutil.copytree(L/'.next',B/'.next',symlinks=True);manifest['previousNext']=tree(B/'.next');assert manifest['previousNext']==tree(L/'.next')
(B/'presence.json').write_text(json.dumps(manifest,indent=2)+'\n');before=tree(L/'src');(B/'source-tree-before.json').write_text(json.dumps(before))
receipt={'status':'ROLLBACK_PRESERVED','operations':str(O),'rollback':str(B),'currentBuild':A['currentBuild'],'candidateBuild':A['candidateBuild'],'files':8,'dbWrites':0,'scope':'DISABLED','pm2Target':'uply-first-enable','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
def save():(E/'deployment-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
save();print('ROLLBACK_PRESERVED',str(B),flush=True)
stopped=False;displaced=False
try:
 assert (L/'.next/BUILD_ID').read_text().strip()==A['currentBuild']
 pm('stop');stopped=True
 os.rename(L/'.next',O/'displaced-next');displaced=True;os.rename(S/'.next',L/'.next')
 for p,h in A['sourceHashes'].items():
  f=L/p;f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(S/p,f);assert sha(f)==h and stat.S_IMODE(f.stat().st_mode)==P['sourceModes'][p]
 pm('start');stopped=False
 ready=False
 for i in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:3000/',timeout=2) as res:ready=res.status==200
   if ready:break
  except Exception:pass
  time.sleep(.5)
 assert ready,'ROOT_HEALTH_FAILED'
 proc=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'])) if x['name']=='uply-first-enable');assert proc['pm2_env']['status']=='online'
 after=tree(L/'src');assert {p for p in set(before)|set(after) if before.get(p)!=after.get(p)}=={p[4:] for p in A['sourceHashes']}
 for p,h in P['protected'].items():
  if p.startswith('/'):assert sha(Path(p))==h,'PROTECTED_FILE_CHANGED'
 def oldtree(p):return {k:v['sha256'] for k,v in tree(p).items()}
 def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()
 assert digest(oldtree(L/'public'))==P['protected']['publicTree']
 assert digest(oldtree(Path('/home/yangzhen/.config/uply-first-enable-20260910/development-execution/b3')))==P['protected']['b3Private']
 assert digest(json.loads(subprocess.check_output(['tailscale','serve','status','--json'])))==P['protected']['tailscale']
 receipt.update(status='DEPLOYED_PENDING_READ_ONLY_ACCEPTANCE',currentBuild=(L/'.next/BUILD_ID').read_text().strip(),pm2='online',pid=proc['pid'],rootHttp=200,files='8 EXACT',protected='UNCHANGED',deployedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());save();print(json.dumps(receipt),flush=True)
except Exception as ex:
 receipt.update(status='DEPLOYMENT_FAILED',failure=str(ex) if isinstance(ex,AssertionError) else type(ex).__name__);save()
 if stopped or displaced:
  pm('stop')
  if displaced:
   if (L/'.next').exists():os.rename(L/'.next',O/'failed-next')
   shutil.copytree(B/'.next',L/'.next',symlinks=True)
  for p,v in manifest['paths'].items():
   f=L/p
   if v['exists']:f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(B/'source'/p,f)
   elif f.exists():assert not f.is_symlink() and sha(f)==A['sourceHashes'][p];f.unlink()
  pm('start');receipt.update(status='ROLLED_BACK',currentBuild=A['currentBuild']);save()
 raise

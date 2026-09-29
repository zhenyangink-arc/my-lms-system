from pathlib import Path
import json,hashlib,shutil,subprocess,os,datetime as dt
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7c-b';prior=json.loads(Path('/tmp/r7cb-b1d-build-state.json').read_text());old=Path(prior['directory']);dest=Path('/tmp/uply-r7cb-b2-workflow-build');dest.mkdir(mode=0o700,exist_ok=True);hashes={}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for p,h in prior['sourceHashes'].items():
 source=old/p;assert sha(source)==h
 target=dest/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target);hashes[p]=h
for source in (R/'src/features/development-execution/server').glob('*.ts'):
 p=str(source.relative_to(R));target=dest/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target);hashes[p]=sha(target)
if not (dest/'node_modules').exists():(dest/'node_modules').symlink_to(R/'node_modules',target_is_directory=True)
config=json.loads(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text());env={k:v for k,v in os.environ.items() if not any(t in k for t in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])};env.update({k:config[k] for k in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']});env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
with Path('/tmp/b2-workflow-build.log').open('w') as log:r=subprocess.run(['node',str(dest/'node_modules/next/dist/bin/next'),'build','--webpack'],cwd=dest,env=env,stdout=log,stderr=subprocess.STDOUT)
assert r.returncode==0,'BUILD_FAILED'
assert all(sha(dest/p)==h for p,h in hashes.items())
refs=(dest/'.next/server/server-reference-manifest.json').read_text();routes=(dest/'.next/server/app-paths-manifest.json').read_text();assert 'development-execution' not in refs+routes and 'provisionDevelopmentExecutionAction' not in refs
out={'status':'PASS','build':(dest/'.next/BUILD_ID').read_text().strip(),'sourceHashes':{p:h for p,h in hashes.items() if 'development-execution/' in p},'productionActionExposed':False,'productionIssuerLoaded':False,'deploy':0,'newDependencies':0,'logHash':sha(Path('/tmp/b2-workflow-build.log'))};(E/'b2-workflow-build.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

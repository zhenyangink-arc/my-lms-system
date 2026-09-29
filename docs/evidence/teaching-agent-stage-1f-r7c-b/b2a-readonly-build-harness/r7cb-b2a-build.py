from pathlib import Path
import json,hashlib,shutil,subprocess,os,datetime
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7c-b';live=Path('/home/yangzhen/releases/uply-first-enable-20260910/source');dest=Path('/tmp/uply-r7cb-b2a-candidate');dest.mkdir(mode=0o700,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((E/'b1c-candidate-source-manifest.json').read_text())['files'];locks={};changed='src/features/digital-textbook/server/native-activity-authoring.server.ts';b1hash=json.loads((E/'b1d-source-lock.json').read_text())['files'][0]['sha256']
for p,v in base.items():
 f=(R/p) if p==changed else Path('/home/yangzhen/operations/uply/teaching-agent/r7cb-b1c/20260917T061353Z/candidate-source')/p;assert sha(f)==(b1hash if p==changed else v['sha256']),p
 t=dest/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,t);locks[p]=sha(t)
files=sorted([str(p.relative_to(R)) for p in (R/'src/features/development-execution').rglob('*.ts')]+[str(p.relative_to(R)) for p in (R/'src/features/development-execution').rglob('*.tsx')]+['src/app/[space]/dashboard/admin/development-execution/page.tsx'])
for p in files:
 t=dest/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/p,t);locks[p]=sha(t)
if not (dest/'node_modules').exists():(dest/'node_modules').symlink_to(R/'node_modules',target_is_directory=True)
C=json.loads(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text());env={k:v for k,v in os.environ.items() if not any(s in k for s in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])};env.update({k:C[k] for k in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']});env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
with Path('/tmp/b2a-build.log').open('w') as log:r=subprocess.run(['node',str(dest/'node_modules/next/dist/bin/next'),'build','--webpack'],cwd=dest,env=env,stdout=log,stderr=subprocess.STDOUT)
assert r.returncode==0,'BUILD_FAILED';assert all(sha(dest/p)==v for p,v in locks.items())
route='[space]/dashboard/admin/development-execution';paths=json.loads((dest/'.next/server/app-paths-manifest.json').read_text());assert any(route in p for p in paths)
refs=(dest/'.next/server/server-reference-manifest.json').read_text();assert 'provisionDevelopmentExecutionAction' in refs
hits=[]
for f in (dest/'.next/static').rglob('*.js'):
 s=f.read_text()
 if any(x in s for x in ['SUPABASE_SERVICE_ROLE_KEY','/connection/pgpass','DB_SERVICE_SHA256','CSPRNG password','876000h']):hits.append(str(f.relative_to(dest)))
assert not hits,hits
with (dest/'candidate-build.tar.gz').open('wb') as out:subprocess.run(['tar','-czf','-','.next'],cwd=dest,stdout=out,check=True)
result={'status':'PASS','currentBuild':(live/'.next/BUILD_ID').read_text().strip(),'candidateBuild':(dest/'.next/BUILD_ID').read_text().strip(),'candidateDirectory':str(dest),'sourceHashes':{p:locks[p] for p in files},'productFilesRelativeToLive':files,'archive':str(dest/'candidate-build.tar.gz'),'archiveSha256':sha(dest/'candidate-build.tar.gz'),'typeScript':'PASS','routePresent':True,'serverActionPresent':True,'environmentGate':'REQUIRED; config absent/invalid fails closed','publicBundleSecretHits':0,'deploy':0,'migration':0,'logSha256':sha(Path('/tmp/b2a-build.log'))};(E/'b2a-build-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

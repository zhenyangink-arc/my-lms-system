from pathlib import Path
import json,hashlib,shutil,subprocess,os
R=Path('/home/yangzhen/projects/my-lms-system');E=R/'docs/evidence/teaching-agent-stage-1f-r7d-b';base=Path('/tmp/uply-r7cb-b3a-candidate');dest=Path('/tmp/uply-r7d-b-candidate');dest.mkdir(mode=0o700,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
locks=json.loads((R/'docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-candidate-source-lock.json').read_text())['allCandidateSources']
files=json.loads((E/'product-files.json').read_text())
for p,h in locks.items():
 assert sha(base/p)==h,'BASELINE_SOURCE_CHANGED:'+p
 t=dest/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(base/p,t)
for p in files:
 t=dest/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/p,t);locks[p]=sha(t)
if not (dest/'node_modules').exists():(dest/'node_modules').symlink_to(R/'node_modules',target_is_directory=True)
(E/'candidate-source-lock.json').write_text(json.dumps({'files':{p:locks[p] for p in files},'allCandidateSources':locks},indent=2)+'\n')
C=json.loads(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text());env={k:v for k,v in os.environ.items() if not any(s in k for s in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])};env.update({k:C[k] for k in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']});env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
for label,args in [('typegen',['node',str(dest/'node_modules/next/dist/bin/next'),'typegen']),('typecheck',['node',str(dest/'node_modules/typescript/bin/tsc'),'--noEmit','--incremental','false']),('lint',['node',str(dest/'node_modules/eslint/bin/eslint.js'),*files]),('build',['node',str(dest/'node_modules/next/dist/bin/next'),'build','--webpack'])]:
 with Path('/tmp/r7d-'+label+'.log').open('w') as log:r=subprocess.run(args,cwd=dest,env=env,stdout=log,stderr=subprocess.STDOUT)
 print(label,r.returncode,flush=True)
 assert r.returncode==0,label+'_FAILED'
assert all(sha(dest/p)==h for p,h in locks.items())
print('CANDIDATE_BUILD', (dest/'.next/BUILD_ID').read_text().strip(),flush=True)

"""Build original source with public production config; never starts or deploys it."""
import hashlib,json,os,pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import ROOT,load
d=pathlib.Path(sys.argv[1]);load(d);dest=d/'next'
if (dest/'src/app/r2-lesson').exists():raise ValueError('INSTRUMENTED_SOURCE_FORBIDDEN')
config=json.loads(pathlib.Path(sys.argv[2]).read_text())
env={k:v for k,v in os.environ.items() if not any(x in k for x in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])}
for key in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']:
    if not config.get(key):raise ValueError('PUBLIC_BUILD_CONFIG_MISSING')
    env[key]=config[key]
env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
start=time.monotonic()
with (d/'candidate-build.private.log').open('w') as log:
    r=subprocess.run(['node',str(ROOT/'node_modules/next/dist/bin/next'),'build','--webpack'],cwd=dest,env=env,stdout=log,stderr=subprocess.STDOUT)
result={'exit':r.returncode,'seconds':round(time.monotonic()-start,2),'instrumented':False,'publicConfigMatchesProduction':True,'productionDeploy':False,'liveProviderCalls':0}
if not r.returncode:
    result['buildId']=(dest/'.next/BUILD_ID').read_text().strip()
    files={str(p.relative_to(dest)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((dest/'.next').rglob('*')) if p.is_file() and 'cache' not in p.relative_to(dest/'.next').parts}
    result['artifactDigest']=hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    result['artifactFiles']=len(files)
    (d/'candidate-files.json').write_text(json.dumps(files,sort_keys=True))
    # Freeze this build before any test-only injection. No secrets/config files are archived.
    r=subprocess.run(['tar','-czf',str(d/'candidate-build.tar.gz'),'--exclude=.next/cache','-C',str(dest),'.next','public','package.json','next.config.ts'],capture_output=True)
    if r.returncode:raise ValueError('ARTIFACT_ARCHIVE_FAILED')
    result['archiveDigest']=hashlib.sha256((d/'candidate-build.tar.gz').read_bytes()).hexdigest()
(d/'candidate-build-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));raise SystemExit(result['exit'])

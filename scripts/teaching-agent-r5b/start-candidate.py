"""Start exact extracted R3D candidate in private directory with no production network."""
import hashlib,json,os,signal,subprocess,sys,tarfile,time
from pathlib import Path
sys.dont_write_bytecode=True;sys.path.insert(0,str(Path(__file__).parent));import runner
D=Path(sys.argv[1]);state=json.loads((D/'state.json').read_text());runner.IsolatedPsql(state).guard()
s=json.loads((D/'services.private.json').read_text());keys=json.loads((D/'keys.private.json').read_text())
os.umask(0o077)
root=runner.ROOT;candidate=D/'candidate';candidate.mkdir(mode=0o700,exist_ok=True)
archive=Path('/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz')
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28'
with tarfile.open(archive) as t:t.extractall(candidate,filter='data')
if not (candidate/'node_modules').exists():
 (candidate/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
assert (candidate/'.next/BUILD_ID').read_text().strip()=='6IhDHN8Dm1nCewiCEZnV5'
assert json.loads((candidate/'node_modules/next/package.json').read_text())['version']=='16.2.10'
# Only the public build origin is read; no production key/session copied to runtime.
config=json.loads(Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text())
(D/'build-origin.private.json').write_text(json.dumps({'origin':config['NEXT_PUBLIC_SUPABASE_URL']}));(D/'build-origin.private.json').chmod(0o600)
config.clear()
env={k:v for k,v in os.environ.items() if not any(part in k for part in ['SUPABASE','TEACHING_AGENT','NEXT_PUBLIC','DEEPSEEK','OPENAI','ANTHROPIC','NODE_OPTIONS','PGPASSWORD','DATABASE_URL'])}
env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',NEXT_PUBLIC_SUPABASE_URL=f'http://127.0.0.1:{s["gatewayPort"]}',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=keys['anon'],SUPABASE_SERVICE_ROLE_KEY=keys['service'],TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0',TEACHING_AGENT_ALLOWED_TENANTS='',TEACHING_AGENT_ALLOWED_COURSES='',TEACHING_AGENT_ALLOWED_USERS='',UPLY_R5B_DIRECTORY=str(D))
processes=[]
for name,cmd,cwd in [('gateway',['node',str(root/'scripts/teaching-agent-r5b/gateway.mjs'),str(D)],D),('candidate',['node','--require',str(root/'scripts/teaching-agent-r5b/network-guard.cjs'),str(root/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',str(s['nextPort'])],candidate)]:
 with (D/(name+'.private.log')).open('w') as out:
  proc=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
 processes.append({'name':name,'pid':proc.pid,'argv':cmd,'cwd':str(cwd)})
 (D/'processes.private.json').write_text(json.dumps(processes))
print(json.dumps({'started':['gateway','candidate'],'buildId':'6IhDHN8Dm1nCewiCEZnV5','feature':'OFF','allowlists':'EMPTY','productionCredentials':False,'providerKeyInjected':False,'artifactModified':False,'publicBuildOriginTransportRedirectedToClone':True}))
sys.stdout.flush()
# Keep the tool-owned session alive until explicit owned cleanup; no PM2.
try:
 while True:
  time.sleep(1)
  if any(not Path('/proc/'+str(p['pid'])).exists() for p in processes):
   raise RuntimeError('CANDIDATE_CHILD_EXITED')
except KeyboardInterrupt:
 pass
finally:
 for p in processes:
  try:os.killpg(p['pid'],signal.SIGTERM)
  except ProcessLookupError:pass

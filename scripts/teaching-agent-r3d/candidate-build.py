"""Rebuild unchanged product in a private copy; no serving, deploy or env edits."""
import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]);dest=pathlib.Path(tempfile.mkdtemp(prefix='uply-r3d-build-'))
sha=lambda b:hashlib.sha256(b).hexdigest()
try:
 for name in set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')):
  if not name or name.startswith(('.next','.env')) or not (ROOT/name).is_file():continue
  if pathlib.Path(name).parts[0] in ['.agents','.codex','.ai','supabase','docs','assets']:continue
  target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,target)
 (dest/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 config=json.loads(pathlib.Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json').read_text())
 env={k:v for k,v in os.environ.items() if not any(s in k for s in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])}
 for key in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']:
  assert config.get(key);env[key]=config[key]
 env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
 start=time.monotonic()
 with (dest/'build.private.log').open('w') as log:r=subprocess.run(['node',str(ROOT/'node_modules/next/dist/bin/next'),'build','--webpack'],cwd=dest,env=env,stdout=log,stderr=subprocess.STDOUT)
 result={'exit':r.returncode,'seconds':round(time.monotonic()-start,2),'productionDeploy':False,'publicConfigMatchesProduction':True,'sourceChanged':False,'liveProviderRequests':0}
 if r.returncode:
  shutil.copyfile(dest/'build.private.log','/tmp/uply-r3d-build-failure.private.log')
 else:
  files={str(p.relative_to(dest)):sha(p.read_bytes()) for p in sorted((dest/'.next').rglob('*')) if p.is_file() and 'cache' not in p.relative_to(dest/'.next').parts}
  result.update(buildId=(dest/'.next/BUILD_ID').read_text().strip(),artifactFiles=len(files),artifactDigest=sha(json.dumps(files,sort_keys=True,separators=(',',':')).encode()),candidateDecision='R3D engineering candidate only; NOT Production Ready')
  archive=out.parent/'candidate-build.tar.gz'
  subprocess.run(['tar','-czf',str(archive),'--exclude=.next/cache','-C',str(dest),'.next','public','package.json','next.config.ts'],check=True)
  result['archiveDigest']=sha(archive.read_bytes())
finally:shutil.rmtree(dest)
result['privateBuildCopyRemoved']=not dest.exists();out.write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(result['exit'])

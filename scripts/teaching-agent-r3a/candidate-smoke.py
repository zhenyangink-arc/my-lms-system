"""OFF smoke of frozen original artifact, isolated loopback and denied egress."""
import hashlib,json,os,pathlib,shutil,socket,subprocess,sys,tarfile,tempfile,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]);m=json.loads((out/'release-candidate-manifest.json').read_text());archive=out/'candidate-build.tar.gz'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==m['archiveDigest']
d=pathlib.Path(tempfile.mkdtemp(prefix='uply-r3a-artifact-smoke-'));p=None
try:
 with tarfile.open(archive) as tar:tar.extractall(d,filter='data')
 (d/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 chunks=list((d/'.next/static').rglob('*.js'));forbidden=[b'reconcile_agent_run_v1',b'find_reconcilable_agent_runs_v1',b'reconcile_agent_run_batch_v1',b'deadline-terminal-v1']
 assert not any(token in f.read_bytes() for f in chunks for token in forbidden)
 (d/'deny.cjs').write_text("const net=require('node:net');const old=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const a=args[0],host=typeof a==='object'?a.host:args[1];if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('EGRESS_DISABLED');return old.apply(this,args)};globalThis.fetch=async()=>{throw Error('EGRESS_DISABLED')};")
 s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close()
 env={k:v for k,v in os.environ.items() if not any(x in k for x in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])};env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='0')
 with (d/'private.log').open('w') as log:
  p=subprocess.Popen(['node','--require',str(d/'deny.cjs'),str(ROOT/'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',str(port)],cwd=d,env=env,stdout=log,stderr=subprocess.STDOUT)
 for _ in range(100):
  assert p.poll() is None
  with socket.socket() as s:
   if s.connect_ex(('127.0.0.1',port))==0:break
  time.sleep(.1)
 origin=f'http://127.0.0.1:{port}'
 try:response=urllib.request.urlopen(urllib.request.Request(origin+'/api/teaching-agent/runs',data=b'{}',headers={'Content-Type':'application/json','Origin':origin}),timeout=10);code=response.status
 except urllib.error.HTTPError as e:code=e.code
 assert code==404
 result={'status':'PASS','originalArtifact':True,'buildId':m['buildId'],'artifactDigest':m['artifactDigest'],'postOff':code,'clientChunks':len(chunks),'operatorCapabilityInClient':False,'externalNetwork':'DENIED','productionDeploy':False}
finally:
 if p and p.poll() is None:p.terminate();p.wait(timeout=15)
 shutil.rmtree(d)
result['ownedSmokeDirectoryRemoved']=not d.exists();(out/'candidate-smoke-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

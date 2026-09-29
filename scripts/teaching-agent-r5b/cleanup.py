"""Remove only explicitly registered R5B disposable resources and private credentials."""
import json,os,re,shutil,signal,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True;sys.path.insert(0,str(Path(__file__).parent));import runner as r

def inspect(kind,name):
 result=subprocess.run(['docker',kind,'inspect',name],capture_output=True)
 if result.returncode:return None
 return json.loads(result.stdout)[0]
def run(args):
 result=subprocess.run(args,capture_output=True)
 if result.returncode:raise RuntimeError('OWNED_CLEANUP_COMMAND_FAILED')

def cleanup(directory):
 d=Path(directory)
 if not re.fullmatch(r'/tmp/uply-r5b-private-[a-zA-Z0-9_]+',str(d)) or d.is_symlink() or d.stat().st_uid!=os.getuid():raise RuntimeError('PRIVATE_DIRECTORY_OWNERSHIP_REQUIRED')
 state=json.loads((d/'state.json').read_text());assert state['directory']==str(d)
 supervisors=set();process_count=0
 if (d/'processes.private.json').exists():
  for p in json.loads((d/'processes.private.json').read_text()):
   proc=Path('/proc')/str(p['pid'])
   if not proc.exists():continue
   assert (proc/'cwd').resolve()==Path(p['cwd']) and Path(p['cwd']).is_relative_to(d),'PROCESS_CWD_MISMATCH'
   assert proc.stat().st_uid==os.getuid() and os.getpgid(p['pid'])==p['pid'],'PROCESS_OWNER_MISMATCH'
   status=(proc/'status').read_text();parent=int(re.search(r'^PPid:\s+(\d+)',status,re.M)[1]);supervisors.add(parent)
   os.killpg(p['pid'],signal.SIGTERM);process_count+=1
  for pid in supervisors:
   proc=Path('/proc')/str(pid)
   if not proc.exists():continue
   argv=(proc/'cmdline').read_bytes().split(b'\0')
   if b'scripts/teaching-agent-r5b/start-candidate.py' not in argv or str(d).encode() not in argv:raise RuntimeError('SUPERVISOR_IDENTITY_MISMATCH')
   os.kill(pid,signal.SIGTERM)
  time.sleep(.3)
 service_count=0;network_removed=True
 if (d/'services.private.json').exists():
  svc=json.loads((d/'services.private.json').read_text());net=inspect('network',svc['network'])
  assert net and net['Internal'] and net['Labels'].get('stage')=='stage1f-r5b'
  for item in svc['services'].values():
   obj=inspect('container',item['container'])
   if obj:
    assert obj['Id']==item['id'] and obj['Config']['Labels'].get('stage')=='stage1f-r5b'
    run(['docker','rm','-f',item['container']]);service_count+=1
  run(['docker','network','rm',svc['network']]);network_removed=inspect('network',svc['network']) is None
 obj=inspect('container',state['container'])
 if obj:
  r.IsolatedPsql(state).guard(False);run(['docker','rm','-f',state['container']])
 volume=inspect('volume',state['volume'])
 if volume:
  assert volume['Labels'].get('stage')=='stage1f-r5b' and volume['Labels'].get('purpose')=='isolated-foundation'
  run(['docker','volume','rm',state['volume']])
 assert inspect('container',state['container']) is None and inspect('volume',state['volume']) is None
 # rmtree does not traverse candidate/node_modules symlink. Shared dependencies retained.
 shutil.rmtree(d)
 return {'privateDirectoryRemoved':not d.exists(),'databaseContainerRemoved':True,'volumeRemoved':True,'servicesRemoved':service_count,'networkRemoved':network_removed,'ownedProcessesStopped':process_count,'temporaryCredentialsRemoved':True}

if __name__=='__main__':
 results=[cleanup(p) for p in sys.argv[1:]]
 assert len(results)>0
 out={'status':'PASS','environments':results,'persistentArtifactRetained':Path('/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz').is_file(),'r4dBackupRetained':Path('/home/yangzhen/backups/uply/20260915T063124Z/database.dump').is_file(),'sharedNodeModulesRetained':(r.ROOT/'node_modules/next/package.json').is_file(),'productionChanges':0}
 (r.ROOT/'docs/evidence/teaching-agent-stage-1f-r5b/cleanup.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

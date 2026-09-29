"""Restore sealed R4D backup into owned network-none PG17. Never connect production.

Only reads the existing backup. All mutable state/logs/credentials go to a unique
0700 temporary directory, the disposable DB volume, or sanitized R5B evidence.
"""
import argparse,datetime,hashlib,importlib.util,json,os,re,secrets,subprocess,sys,tempfile,time
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent))
import runner
ROOT=runner.ROOT;EV=ROOT/'docs/evidence/teaching-agent-stage-1f-r5b'
BACKUP=Path('/home/yangzhen/backups/uply/20260915T063124Z')
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.159'
DUMP_SHA='41dfcc96b933b0893df3457d9c9c0c16ba82fdd58cb7d848b4ca7f7719a2aaa4'

def write(path,data):path.write_text(json.dumps(data,indent=2)+'\n');path.chmod(0o600)
def publish(name,data):write(EV/name,data)
def sha(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def qid(value):return '"'+value.replace('"','""')+'"'
def q(value):return runner.quote(value)

def verified_backup():
 old=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r4d/backup-summary.json').read_text())
 manifest=BACKUP/'metadata/manifest.json'
 assert not BACKUP.is_symlink() and sha(manifest)==old['manifestSha256'],'BACKUP_MANIFEST_DRIFT'
 data=json.loads(manifest.read_text());assert data['status']=='VALID' and data['ledgerCount']==449
 assert sha(BACKUP/'database.dump')==DUMP_SHA
 for row in data['files']:
  path=BACKUP/row['path'];assert path.resolve().is_relative_to(BACKUP) and not path.is_symlink()
  assert sha(path)==row['sha256'] and path.stat().st_size==row['bytes'],'BACKUP_FILE_DRIFT'
 sums=(BACKUP/'metadata/SHA256SUMS').read_text().splitlines()
 for line in sums:
  digest,name=line.split('  ',1);path=BACKUP/name
  assert path.resolve().is_relative_to(BACKUP) and sha(path)==digest,'BACKUP_SEAL_DRIFT'
 publish('backup-input.json',{'status':'PASS','path':str(BACKUP),'databaseDumpSha256':DUMP_SHA,'manifestSha256':sha(manifest),'sealSha256':sha(BACKUP/'metadata/SHA256SUMS'),'sealedFilesVerified':len(data['files']),'snapshotStart':data['snapshotStart'],'newBackupCreated':False,'backupModified':False})
 return json.loads((BACKUP/'private/source-catalog.json').read_text())

class Environment:
 def __init__(self,state):
  self.state=state;self.batch=Path(state['directory']);self.database=state['database'];self.container=state['container'];self.container_id=state.get('containerId');self.volume=state['volume'];self.timings={};self.receipts=[]
  self.pre={'database':{'ledgerSha256':runner.BASE_SHA}}
 def command(self,args,label,input=None,timeout=300):
  start=time.monotonic()
  with (self.batch/'private'/f'{label}.stdout.log').open('wb') as out,(self.batch/'private'/f'{label}.stderr.log').open('wb') as err:
   result=subprocess.run(args,input=input,stdout=out,stderr=err,timeout=timeout)
  if result.returncode:raise RuntimeError('ISOLATED_COMMAND_FAILED:'+label)
  print(json.dumps({'step':label,'status':'PASS','seconds':round(time.monotonic()-start,2)}),flush=True)
  return (self.batch/'private'/f'{label}.stdout.log').read_bytes()
 def guard(self,require_marker=True):
  runner.IsolatedPsql(self.state).guard(require_marker)
 def local_sql(self,sql,label,db=None,marker=True):
  self.guard(marker);db=db or self.database
  assert db in ('postgres',self.database)
  return self.command(['docker','exec','-i',self.container,runner.PG+'psql','-h','/recovery','-p','55483','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],label,sql.encode())
 def restore_archive(self,list_path,label):
  self.guard()
  return self.command(['docker','exec','-i',self.container,runner.PG+'pg_restore','-h','/recovery','-p','55483','-U','supabase_admin','-d',self.database,'--exit-on-error','--single-transaction','--use-list='+list_path],label,(BACKUP/'database.dump').read_bytes())
 def restore(self):
  self.source=verified_backup()
  self.command(['docker','volume','create','--label','stage=stage1f-r5b','--label','purpose=isolated-foundation',self.volume],'volume-create')
  startup="chown 100:101 /recovery && exec su postgres -s /bin/sh -c '/usr/lib/postgresql/bin/initdb -U supabase_admin -D /recovery/pg -A trust --no-locale >/recovery/init.log && exec /usr/lib/postgresql/bin/postgres -D /recovery/pg -k /recovery -p 55483 -c listen_addresses= -c max_connections=30'"
  raw=self.command(['docker','run','-d','--pull=never','--read-only','--name',self.container,'--label','stage=stage1f-r5b','--label','purpose=isolated-foundation','--network=none','--tmpfs','/tmp:rw,size=128m,mode=1777','--mount',f'type=volume,source={self.volume},target=/recovery','--entrypoint','/bin/sh',IMAGE,'-c',startup],'container-create')
  self.state['containerId']=self.container_id=raw.decode().strip();write(self.batch/'state.json',self.state)
  self.guard(False)
  for _ in range(100):
   r=subprocess.run(['docker','exec',self.container,runner.PG+'pg_isready','-h','/recovery','-p','55483','-U','supabase_admin'],capture_output=True)
   if not r.returncode:break
   time.sleep(.2)
  else:raise RuntimeError('ISOLATED_PG_START_TIMEOUT')
  roles=(BACKUP/'roles.sql').read_text();assert not re.search(r'PASSWORD\s+\x27',roles,re.I)
  roles=re.sub(r'^CREATE ROLE supabase_admin;\n','',roles,flags=re.M)
  self.local_sql(roles,'restore-roles','postgres',False)
  source=self.source['extra']['database']
  self.local_sql(f"ALTER ROLE postgres SUPERUSER; CREATE DATABASE {qid(self.database)} OWNER postgres TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE {q(source['datlocale'])} LC_COLLATE {q(source['datcollate'])} LC_CTYPE {q(source['datctype'])}; COMMENT ON DATABASE {qid(self.database)} IS {q(runner.MARKER)};",'create-database','postgres',False)
  toc=self.command(['docker','run','--rm','--pull=never','--network=none','--read-only','--mount',f'type=bind,source={BACKUP}/database.dump,target=/archive,readonly','--entrypoint','pg_restore',IMAGE,'--list','/archive'],'archive-toc').decode()
  lines=toc.splitlines()
  for name,selected in [('schemas',[l for l in lines if re.match(r'^\d+; \d+ \d+ SCHEMA ',l)]),('remaining',[l for l in lines if not re.match(r'^\d+; \d+ \d+ (SCHEMA |EXTENSION )',l)])]:
   self.command(['docker','exec','-i',self.container,'/bin/sh','-c','umask 077; cat > /tmp/'+name+'.list'],'prepare-'+name,('\n'.join(selected)+'\n').encode())
  self.restore_archive('/tmp/schemas.list','restore-schemas')
  extensions='\n'.join(f"SET ROLE {qid(e['owner'])}; CREATE EXTENSION IF NOT EXISTS {qid(e['name'])} WITH SCHEMA {qid(e['schema'])} VERSION {q(e['version'])}; RESET ROLE;" for e in self.source['extra']['extensions'] if e['name']!='plpgsql')
  self.local_sql(extensions,'restore-extensions');self.restore_archive('/tmp/remaining.list','restore-remaining')
  self.local_sql('ALTER ROLE postgres NOSUPERUSER;','restore-role-reset')
  # Reuse only reviewed ACL supplement and complete read-only verification methods.
  spec=importlib.util.spec_from_file_location('r4d_restore_helpers',ROOT/'scripts/teaching-agent-r4d/execute.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  module.EV=EV
  module.Execution.permissions(self);module.Execution.verify(self)
  self.guard()
  snap=runner.IsolatedPsql(self.state).snapshot();runner.verify_snapshot(snap,runner.load_package(),0)
  publish('isolated-start.json',{'status':'PASS','ledger':449,'latest':'202609130003','orderedLedgerSha256':runner.digest(snap['ledger']),'fullOldLedgerDigest':snap['baseFullDigest'],'network':'none','portsPublished':[],'databaseMarker':runner.MARKER,'productionCredentials':False,'container':self.container,'containerId':self.container_id,'volume':self.volume})
 def cleanup(self):
  self.guard(False)
  self.command(['docker','rm','-f',self.container],'cleanup-container')
  volume=json.loads(subprocess.check_output(['docker','volume','inspect',self.volume]))[0]
  assert volume['Labels'].get('stage')=='stage1f-r5b'
  self.command(['docker','volume','rm',self.volume],'cleanup-volume')
  publish('cleanup-db.json',{'containerRemoved':True,'volumeRemoved':True,'backupRetained':(BACKUP/'database.dump').exists(),'status':'PASS'})

def main():
 os.umask(0o077);p=argparse.ArgumentParser();p.add_argument('mode',choices=['create','cleanup']);p.add_argument('--state',type=Path);args=p.parse_args()
 if args.mode=='create':
  directory=Path(tempfile.mkdtemp(prefix='uply-r5b-private-'));(directory/'private').mkdir();(directory/'metadata').mkdir()
  name='uply-r5b-'+secrets.token_hex(6)
  state={'directory':str(directory),'container':name,'volume':name+'-data','database':'uply_r5b_foundation'};write(directory/'state.json',state)
  publish('isolated-owned-resources.json',{'statePath':str(directory/'state.json'),'container':name,'volume':state['volume'],'cleanupRequired':True})
  env=Environment(state)
  try:env.restore()
  except Exception as error:
   publish('restore-failure.json',{'status':'STOP','reason':type(error).__name__,'detail':str(error) if isinstance(error,(RuntimeError,AssertionError)) else 'PRIVATE_DIAGNOSTIC','ownedState':str(directory/'state.json')})
   raise
  print(json.dumps({'statePath':str(directory/'state.json'),'status':'RESTORED_449'}))
 else:
  if not args.state:raise RuntimeError('OWNED_STATE_REQUIRED')
  Environment(json.loads(args.state.read_text())).cleanup()
if __name__=='__main__':main()

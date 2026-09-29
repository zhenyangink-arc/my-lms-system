"""Future production transport: unavailable without explicit window-bound authorization.

Never invoked by the R5B rehearsal. Only the fixed eight-migration engine can use
this transport. Reads a private libpq service/passfile; no inline URI/password.
"""
import configparser,datetime as dt,hashlib,json,os,stat,subprocess
from pathlib import Path
import runner as r

APPROVAL='APPROVED FOR DEVELOPMENT FOUNDATION INSTALL'
RUNTIME=Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json')
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.159'

def file_sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def utc(value):
 value=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
 if value.utcoffset() is None:raise r.Rejected('EXPLICIT_TIMEZONE_REQUIRED')
 return value

def private_file(path):
 value=path.lstat()
 if not stat.S_ISREG(value.st_mode) or path.is_symlink() or value.st_uid!=os.getuid() or stat.S_IMODE(value.st_mode)!=0o600:raise r.Rejected('PRIVATE_FILE_REQUIRED')

def check_authorization(a,observed,now):
 if a.get('status')!=APPROVAL or a.get('operator')!='杨震' or not a.get('explicitUserAuthorizationReference'):raise r.Rejected('EXPLICIT_PRODUCTION_AUTHORIZATION_REQUIRED')
 if a.get('migrationVersions')!=list(r.VERSIONS):raise r.Rejected('AUTHORIZED_RANGE_MISMATCH')
 for field in ('runnerSha256','maintenanceTransportSha256','packageSha256','projectIdentitySha256','hostIdentitySha256','runtimeSha256'):
  if a.get(field)!=observed[field]:raise r.Rejected('AUTHORIZED_LOCK_MISMATCH:'+field)
 if not utc(a['windowStartUtc'])<=now<=utc(a['windowEndUtc']):raise r.Rejected('OUTSIDE_AUTHORIZED_WINDOW')
 if a.get('feature')!='OFF' or a.get('allowlists')!='EMPTY' or a.get('providerRequests')!=0 or a.get('agentRuns')!=0:raise r.Rejected('SAFETY_AUTHORIZATION_MISMATCH')

class MaintenancePsql:
 def __init__(self,connection,authorization):
  self.connection=Path(connection).resolve();self.authorization=Path(authorization)
  # Fail before reading connection or contacting DB when there is no signed record.
  private_file(self.authorization)
  self.approval=json.loads(self.authorization.read_text())
  if self.approval.get('status')!=APPROVAL:raise r.Rejected('EXPLICIT_PRODUCTION_AUTHORIZATION_REQUIRED')
  if self.connection.stat().st_uid!=os.getuid() or stat.S_IMODE(self.connection.stat().st_mode)!=0o700:raise r.Rejected('PRIVATE_CONNECTION_DIRECTORY_REQUIRED')
  for name in ('pg_service.conf','pgpass','root.crt'):private_file(self.connection/name)
  self.connectionHashes={name:file_sha(self.connection/name) for name in ('pg_service.conf','pgpass','root.crt')}
  config=configparser.ConfigParser(interpolation=None);config.read(self.connection/'pg_service.conf')
  if config.sections()!=['foundation']:raise r.Rejected('EXPLICIT_FOUNDATION_SERVICE_REQUIRED')
  entry=config['foundation'];allowed={'host','port','dbname','user','sslmode','sslrootcert','passfile','application_name'}
  if set(entry)!=allowed or entry['sslmode']!='verify-full' or entry['sslrootcert']!='/connection/root.crt' or entry['passfile']!='/connection/pgpass' or entry['dbname']!='postgres':raise r.Rejected('FIXED_TLS_SERVICE_REQUIRED')
  self.entry=dict(entry)
  self.args=['docker','run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user',f'{os.getuid()}:{os.getgid()}','--network=host','-i','--mount',f'type=bind,source={self.connection},target=/connection,readonly','-e','PGSERVICEFILE=/connection/pg_service.conf','--entrypoint','psql',IMAGE,'-X','-At','-w','-v','ON_ERROR_STOP=1','service=foundation']
  self.guard()
  identity=self.raw_execute("BEGIN READ ONLY;SELECT json_build_object('database',current_database(),'server',current_setting('server_version_num'),'expiryValid',(select rolvaliduntil is null or rolvaliduntil>now() from pg_roles where rolname=session_user));ROLLBACK;")
  if identity['code']!=0:raise r.Rejected('READ_ONLY_MAINTENANCE_IDENTITY_FAILED')
  parsed=[json.loads(line) for line in identity['stdout'].splitlines() if line.startswith('{')]
  if len(parsed)!=1 or parsed[0]['database']!='postgres' or not 170000<=int(parsed[0]['server'])<180000 or not parsed[0]['expiryValid']:raise r.Rejected('MAINTENANCE_IDENTITY_OR_EXPIRY_MISMATCH')
 def guard(self):
  for name,value in self.connectionHashes.items():
   private_file(self.connection/name)
   if file_sha(self.connection/name)!=value:raise r.Rejected('CONNECTION_FILES_CHANGED')
  private_file(self.authorization);a=json.loads(self.authorization.read_text())
  if a!=self.approval:raise r.Rejected('AUTHORIZATION_CHANGED_DURING_EXECUTION')
  runtime=json.loads(RUNTIME.read_text())
  if runtime.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') not in (None,False,'0','false',''):raise r.Rejected('FEATURE_MUST_BE_OFF')
  if any(runtime.get(k) not in (None,'',[]) for k in ('TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS')):raise r.Rejected('ALLOWLISTS_MUST_BE_EMPTY')
  project=runtime['NEXT_PUBLIC_SUPABASE_URL'].split('//')[1].split('.')[0]
  expected=json.loads((r.ROOT/'docs/evidence/teaching-agent-stage-1f-r5b/production-preflight.json').read_text())['database']
  observed={'runnerSha256':file_sha(Path(r.__file__)),'maintenanceTransportSha256':file_sha(Path(__file__)),'packageSha256':file_sha(r.PACKAGE),'projectIdentitySha256':r.digest(project),'hostIdentitySha256':r.digest(self.entry['host']),'runtimeSha256':file_sha(RUNTIME)}
  if observed['projectIdentitySha256']!=expected['projectIdentitySha256'] or observed['hostIdentitySha256']!=expected['hostIdentitySha256'] or not(project in self.entry['host'] or project in self.entry['user']):raise r.Rejected('PRODUCTION_TARGET_MISMATCH')
  now=dt.datetime.now(dt.timezone.utc);check_authorization(a,observed,now)
  if subprocess.check_output(['docker','image','inspect',IMAGE,'--format','{{.Id}}']).decode().strip()!=r.IMAGE_ID:raise r.Rejected('CLIENT_IMAGE_CHANGED')
  backup=Path(a['freshBackupPath'])
  if backup.is_symlink() or not backup.resolve().is_relative_to('/home/yangzhen/backups/uply'):raise r.Rejected('APPROVED_FRESH_BACKUP_REQUIRED')
  manifest=backup/'metadata/manifest.json';data=json.loads(manifest.read_text())
  if file_sha(manifest)!=a.get('freshBackupManifestSha256') or data.get('status')!='VALID' or data.get('ledgerCount')!=449 or data.get('ledgerLatest')!='202609130003':raise r.Rejected('BACKUP_SEAL_INVALID')
  record=next((x for x in data['files'] if x['path']=='database.dump'),None)
  if not record or file_sha(backup/'database.dump')!=record['sha256']:raise r.Rejected('FRESH_BACKUP_DUMP_DRIFT')
  max_age=900
  if 'rpoExceptionSeconds' in a:
   if not a.get('explicitRpoExceptionReference') or not isinstance(a['rpoExceptionSeconds'],int) or a['rpoExceptionSeconds']<900:raise r.Rejected('EXPLICIT_RPO_EXCEPTION_REQUIRED')
   max_age=a['rpoExceptionSeconds']
  if not 0<=(now-utc(data['snapshotStart'])).total_seconds()<=max_age:raise r.Rejected('FRESH_BACKUP_EXPIRED')
 def raw_execute(self,sql,timeout=150):
  try:child=subprocess.Popen(self.args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  except OSError:return {'code':None,'stdout':'','dispatched':False}
  try:
   out,_=child.communicate(sql.encode(),timeout=timeout)
   return {'code':child.returncode,'stdout':out.decode(),'dispatched':True}
  except subprocess.TimeoutExpired:
   child.kill();child.communicate();return {'code':None,'stdout':'','dispatched':True}
 def execute(self,sql,timeout=150):
  self.guard();return self.raw_execute(sql,timeout)
 def snapshot(self):
  result=self.execute(r.SNAPSHOT_SQL)
  if result['code']!=0:raise r.Rejected('READ_ONLY_VERIFY_FAILED')
  return r.parse_snapshot(result['stdout'])

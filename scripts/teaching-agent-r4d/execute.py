#!/usr/bin/env python3
"""Authorized R4D backup + isolated restore. No production mutation interface.

Reuses the 2026-09-13 catalog queries and schema/extension/ACL restore sequence.
All private output stays in a unique 0700 batch; only summaries reach evidence.
Any failed command/integrity gate terminates this run and invokes owned cleanup.
"""
import configparser
import datetime as dt
import json
import os
from pathlib import Path
import pwd
import grp
import re
import selectors
import subprocess
import sys
import tempfile
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'teaching-agent-r4c'))
import inventory as audit

ROOT=audit.ROOT
EV=ROOT/'docs/evidence/teaching-agent-stage-1f-r4d'
HIST=Path('/home/yangzhen/backups/uply-first-enable-20260910/grammar-2026-09-13T02-56-47-448Z.yjN7w6')
IMAGE=audit.IMAGE
IMAGE_ID='sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f'
MARKER='UPLY_R4D_ISOLATED_RECOVERY'
PG='/usr/lib/postgresql/bin/'
os.umask(0o077)

def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');path.chmod(0o600)
def publish(name,value):write(EV/name,value)
def qi(s):return '"'+s.replace('"','""')+'"'
def ql(s):return "'"+s.replace("'","''")+"'"
def norm(x,key=None):
    if key=='acl' and isinstance(x,str):return sorted(x[1:-1].split(','))
    if isinstance(x,list):return sorted([norm(v) for v in x],key=lambda v:json.dumps(v,sort_keys=True))
    if isinstance(x,dict):return {k:norm(v,k) for k,v in sorted(x.items())}
    return x

LEDGER="SELECT json_agg(x ORDER BY version) FROM (SELECT version,name FROM supabase_migrations.schema_migrations) x;"
COLUMNS="""SELECT json_agg(x ORDER BY schema,table_name,column_order) FROM (
 SELECT n.nspname AS schema,c.relname AS table_name,
 row_number() OVER (PARTITION BY c.oid ORDER BY a.attnum) AS column_order,
 a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,
 a.attidentity AS identity,a.attgenerated AS generated,
 pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attacl::text AS acl,
 CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END AS collation
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
 AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema') x;"""

class Execution:
    def __init__(self):
        self.started=now();self.clock=time.monotonic();self.receipts=[];self.batch=None
        self.container=None;self.volume=None;self.container_id=None;self.session=None
        self.snapshot_info=None;self.success=False;self.failure=None;self.timings={}
        self.private_connection=None;self.snapshot_log=None
        self.backup_accepted=False

    def command(self,args,label,input=None,output=None,timeout=300):
        begin=time.monotonic();stamp=now()
        output=output or self.batch/'private'/f'{label}.stdout.log'
        error=self.batch/'private'/f'{label}.stderr.log'
        with output.open('wb') as out,error.open('wb') as err:
            result=subprocess.run(args,input=input,stdout=out,stderr=err,timeout=timeout)
        receipt={'step':label,'startedAt':stamp,'exit':result.returncode,'durationSeconds':time.monotonic()-begin,
                 'outputBytes':output.stat().st_size}
        self.receipts.append(receipt)
        write(self.batch/'metadata/command-receipts.json',self.receipts)
        print(json.dumps(receipt),flush=True)
        if result.returncode:raise RuntimeError('COMMAND_FAILED:'+label)
        return output.read_bytes()

    def preflight(self):
        db=audit.database();ops=audit.operations()
        old=json.loads((audit.EVIDENCE/'database-end.json').read_text())
        oldops=json.loads((audit.EVIDENCE/'operations-end.json').read_text())
        keys=['serverVersion','migrationLedgerCount','latestMigration','ledgerSha256','agentTables','agentPrefixedTables','projectIdentitySha256','hostIdentitySha256']
        checks={k:db[k]==old[k] for k in keys}
        checks.update({k:ops[k]==oldops[k] for k in ['pm2','runtime','launcherSha256','tailscale']})
        release=Path('/home/yangzhen/releases/uply-first-enable-20260910/source')
        archive=Path('/tmp/uply-r3d-release-candidate/candidate-build.tar.gz')
        checks['knownGoodBuild']=(release/'.next/BUILD_ID').read_text().strip()=='LuAZe2VMY32YjOo1WvtrC'
        checks['candidateSha']=audit.sha(archive)=='1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28'
        checks['imageId']=audit.run(['docker','image','inspect',IMAGE,'--format','{{.Id}}']).strip()==IMAGE_ID
        record={'database':db,'operations':ops,'checks':checks,'pass':all(checks.values()),'observedAt':now(),
                'knownGoodPath':str(release),'knownGoodBuildId':(release/'.next/BUILD_ID').read_text().strip(),
                'candidatePath':str(archive),'candidateSha256':audit.sha(archive)}
        publish('preflight.json',record)
        if not record['pass']:raise RuntimeError('PRODUCTION STATE CHANGED')
        self.pre=record

    def make_batch(self):
        parent=Path('/home/yangzhen/backups/uply')
        if parent.exists():
            assert not parent.is_symlink() and parent.stat().st_uid==os.getuid() and parent.stat().st_mode&0o777==0o700
        else:parent.mkdir(mode=0o700)
        name=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        self.batch=parent/name;self.batch.mkdir(mode=0o700)
        for child in ['private','metadata']:(self.batch/child).mkdir(mode=0o700)
        assert self.batch.resolve().parent==parent and self.batch.stat().st_mode&0o777==0o700
        assert self.batch.stat().st_uid==os.getuid()
        v=os.statvfs(parent);assert v.f_bavail*v.f_frsize>1024**3
        record={'path':str(self.batch),'owner':pwd.getpwuid(os.getuid()).pw_name,'group':grp.getgrgid(os.getgid()).gr_name,
                'mode':'0700','createdAt':now(),'retention':'At least 7 days AND through stable Stage1G Pilot; no automatic deletion',
                'offHost':'NOT CONFIRMED; not required for R4D, required before broader production rollout'}
        write(self.batch/'metadata/batch.json',record);publish('backup-directory.json',record)
        write(self.batch/'metadata/release-summary.json',{k:self.pre[k] for k in ['knownGoodPath','knownGoodBuildId','candidatePath','candidateSha256']})
        for key,name in [('runtime','runtime'),('pm2','pm2'),('tailscale','tailscale')]:
            write(self.batch/f'metadata/{name}-summary.json',self.pre['operations'][key])
        write(self.batch/'metadata/launcher-summary.json',{'sha256':self.pre['operations']['launcherSha256']})

    def connect(self):
        self.private_connection=tempfile.TemporaryDirectory(prefix='uply-r4d-connection-')
        directory=Path(self.private_connection.name)
        config=configparser.ConfigParser(interpolation=None);config.read(audit.SERVICE);entry=config['audit']
        assert entry['sslmode']=='verify-full'
        secret=None
        for line in (ROOT/'.env.local').read_text().splitlines():
            if line.startswith('SUPABASE_DB_PASSWORD='):
                secret=line.partition('=')[2].strip()
                if secret[:1] in ('"',"'") and secret[-1:]==secret[:1]:secret=secret[1:-1]
        assert secret and '\n' not in secret and '\r' not in secret
        esc=lambda x:x.replace('\\','\\\\').replace(':','\\:')
        (directory/'pgpass').write_text(':'.join(esc(v) for v in [entry['host'],entry['port'],entry['dbname'],entry['user'],secret])+'\n')
        (directory/'pgpass').chmod(0o600)
        (directory/'root.crt').write_bytes(audit.SERVICE.with_name('root.crt').read_bytes())
        entry['passfile']='/connection/pgpass';entry['sslrootcert']='/connection/root.crt';entry['application_name']='uply_r4d_backup_readonly'
        with (directory/'pg_service.conf').open('w') as f:config.write(f,space_around_delimiters=False)
        (directory/'pg_service.conf').chmod(0o600)
        self.client=['docker','run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
          '--network=host','--user',f'{os.getuid()}:{os.getgid()}','-i','-v',str(directory)+':/connection:ro',
          '-e','PGSERVICEFILE=/connection/pg_service.conf','-e','PGSERVICE=audit',
          '-e','PGOPTIONS=-c default_transaction_read_only=on']

    def source_query(self,sql,label,snapshot):
        assert self.session.poll() is None,'SNAPSHOT_SESSION_ENDED'
        text=f"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT {ql(snapshot)}; SET LOCAL search_path=pg_catalog; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='2s';\n{sql}\nROLLBACK;"
        raw=self.command(self.client+['--entrypoint','psql',IMAGE,'-X','-qAt','-w','-v','ON_ERROR_STOP=1'],label,text.encode())
        return json.loads(raw)

    def backup(self):
        began=time.monotonic();self.connect()
        self.snapshot_log=(self.batch/'private/snapshot.stderr.log').open('wb')
        self.session=subprocess.Popen(self.client+['--entrypoint','psql',IMAGE,'-X','-qAt','-w','-v','ON_ERROR_STOP=1'],
                                      stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.snapshot_log)
        self.session.stdin.write(b'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n');self.session.stdin.flush()
        selector=selectors.DefaultSelector();selector.register(self.session.stdout,selectors.EVENT_READ)
        ready=selector.select(30);selector.close();assert ready,'SNAPSHOT_EXPORT_TIMEOUT'
        snapshot=self.session.stdout.readline().decode().strip();assert re.fullmatch(r'[0-9A-F]+-[0-9A-F]+-\d+',snapshot)
        self.snapshot_info={'snapshotIdentifier':snapshot,'snapshotStart':now(),'exporterAlive':True,'consistentArtifacts':[]}
        write(self.batch/'metadata/source-snapshot.json',self.snapshot_info)
        for name,options in [('database',['--format=custom','--compress=gzip']),('schema',['--schema-only','--format=custom','--compress=gzip'])]:
            assert self.session.poll() is None,'SNAPSHOT_SESSION_ENDED'
            label='dump' if name=='database' else 'schema'
            self.command(self.client+['--entrypoint','pg_dump',IMAGE,'--no-password',*options,'--snapshot='+snapshot,
                        '--lock-wait-timeout=15000'],label,output=self.batch/(name+'.dump'))
            (self.batch/f'private/{label}.stdout.log').write_text('Archive stdout redirected to '+name+'.dump\n')
            self.snapshot_info['consistentArtifacts'].append(name+'.dump')
        ledger=self.source_query(LEDGER,'ledger',snapshot)
        assert len(ledger)==449 and ledger[-1]['version']=='202609130003' and audit.digest(ledger)==self.pre['database']['ledgerSha256'],'LEDGER_MISMATCH'
        write(self.batch/'metadata/migration-ledger.json',ledger);self.snapshot_info['consistentArtifacts'].append('migration-ledger.json')
        self.source={}
        for name,file in [('main','inventory-query.sql'),('extra','extra-inventory-query.sql'),('additional','additional-catalog-query.sql')]:
            self.source[name]=self.source_query((HIST/file).read_text(),'source-'+name,snapshot)
        self.source['columns']=self.source_query(COLUMNS,'source-columns',snapshot)
        self.snapshot_info['consistentArtifacts'].append('catalog-and-counts')
        write(self.batch/'private/source-catalog.json',self.source)
        summary={name:{k:{'sha256':audit.digest(norm(v,k)),'count':len(v) if isinstance(v,(list,dict)) else v} for k,v in value.items()}
                 if isinstance(value,dict) else {'sha256':audit.digest(norm(value)),'count':len(value)} for name,value in self.source.items()}
        write(self.batch/'metadata/catalog-summary.json',summary)
        assert self.session.poll() is None,'SNAPSHOT_SESSION_ENDED'
        self.session.stdin.write(b"SELECT 'R4D_SNAPSHOT_ALIVE';\nROLLBACK;\n");self.session.stdin.flush()
        self.session.stdin.close();tail=self.session.stdout.read().decode();exit_code=self.session.wait(timeout=30)
        assert exit_code==0 and 'R4D_SNAPSHOT_ALIVE' in tail,'SNAPSHOT_INVALID'
        self.snapshot_info.update(snapshotEnd=now(),snapshotExit=exit_code,valid=True)
        write(self.batch/'metadata/source-snapshot.json',self.snapshot_info)
        publish('snapshot-summary.json',{k:v for k,v in self.snapshot_info.items() if k!='snapshotIdentifier'})
        roles_at=now()
        self.command(self.client+['--entrypoint','pg_dumpall',IMAGE,'--no-password','--roles-only','--no-role-passwords'],'roles',output=self.batch/'roles.sql')
        (self.batch/'private/roles.stdout.log').write_text('SQL stdout redirected to roles.sql\n')
        self.timings['backupSeconds']=time.monotonic()-began
        result={'status':'PASS','rolesCapturedAt':roles_at,'rolesAtomicWithDatabaseSnapshot':False,'backupSeconds':self.timings['backupSeconds'],
                'ledgerCount':len(ledger),'ledgerLatest':ledger[-1],'ledgerSha256':audit.digest(ledger),'productionDatabaseWrites':0}
        write(self.batch/'metadata/backup-result.json',result)
        self.private_connection.cleanup();self.private_connection=None
        db=audit.database();ops=audit.operations();stable=self.state_matches(db,ops)
        write(self.batch/'metadata/source-end-state.json',{'database':db,'operations':ops,'stable':stable})
        publish('source-end-state.json',{'database':db,'operations':ops,'stable':stable})
        assert stable,'PRODUCTION CHANGED DURING BACKUP WINDOW'
        self.archive={}
        for name in ['database','schema']:
            toc=self.command(['docker','run','--rm','--pull=never','--read-only','--network=none','--cap-drop=ALL',
                '--user',f'{os.getuid()}:{os.getgid()}','-v',str(self.batch/(name+'.dump'))+':/archive:ro',
                '--entrypoint','pg_restore',IMAGE,'--list','/archive'],'list-'+name).decode()
            header={}
            for label in ['Archive created at','Dump Version','Format','Compression','Dumped from database version','Dumped by pg_dump version']:
                line=next(l for l in toc.splitlines() if label in l);header[label]=line.split(label,1)[1].lstrip(': ').strip()
            self.archive[name]={'exit':0,'header':header,'tocEntries':len(re.findall(r'^\d+;',toc,re.M)),
                                'tableDataEntries':len(re.findall(r'^\d+; \d+ \d+ TABLE DATA ',toc,re.M))}
            if name=='database':self.toc=toc
        assert self.archive['database']['tableDataEntries']>0 and self.archive['schema']['tableDataEntries']==0
        publish('archive-validation.json',self.archive)
        self.backup_accepted=True
        self.seal('VALID')

    def state_matches(self,db,ops):
        keys=['serverVersion','migrationLedgerCount','latestMigration','ledgerSha256','agentTables','agentPrefixedTables','projectIdentitySha256','hostIdentitySha256']
        return all(db[k]==self.pre['database'][k] for k in keys) and all(ops[k]==self.pre['operations'][k] for k in ['pm2','runtime','launcherSha256','tailscale'])

    def seal(self,status):
        rows=[]
        for p in sorted(self.batch.rglob('*')):
            assert not p.is_symlink(),'BACKUP_SYMLINK'
            if p.is_dir():assert p.stat().st_mode&0o777==0o700;continue
            assert p.stat().st_mode&0o777==0o600 and p.stat().st_uid==os.getuid(),'BACKUP_PERMISSION_INVALID'
            if p.name in ['manifest.json','SHA256SUMS']:continue
            s=p.stat();rows.append({'path':str(p.relative_to(self.batch)),'sha256':audit.sha(p),'bytes':s.st_size,
                                  'mode':'0600','owner':pwd.getpwuid(s.st_uid).pw_name,'mtime':dt.datetime.fromtimestamp(s.st_mtime,dt.timezone.utc).isoformat()})
        manifest={'status':status,'sealedAt':now(),'batch':self.batch.name,'sourceIdentitySha256':self.pre['database']['projectIdentitySha256'],
                  'postgresVersion':'17.6','snapshotStart':self.snapshot_info['snapshotStart'],'snapshotEnd':self.snapshot_info.get('snapshotEnd'),
                  'ledgerCount':449,'ledgerLatest':'202609130003','ledgerSha256':self.pre['database']['ledgerSha256'],
                  'reportVersion':'stage1f-r4d-v1','files':rows}
        write(self.batch/'metadata/manifest.json',manifest)
        sums=''.join(r['sha256']+'  '+r['path']+'\n' for r in rows)+audit.sha(self.batch/'metadata/manifest.json')+'  metadata/manifest.json\n'
        (self.batch/'metadata/SHA256SUMS').write_text(sums)
        assert all(audit.sha(self.batch/r['path'])==r['sha256'] for r in rows)
        publish('backup-summary.json',{'path':str(self.batch),'seal':status,'sealedAt':manifest['sealedAt'],'snapshotStart':manifest['snapshotStart'],
                'files':[r for r in rows if r['path'] in ['database.dump','schema.dump','roles.sql']],
                'manifestSha256':audit.sha(self.batch/'metadata/manifest.json'),'sealedFileCount':len(rows),
                'freshR4dRecoveryPoint':'CREATED','goLiveRpoValidity':'TIME-BOUND — RECHECK REQUIRED'})

    def guard(self,require_marker=True):
        obj=json.loads(audit.run(['docker','inspect',self.container]))[0]
        assert obj['Id']==self.container_id and obj['Name']=='/'+self.container
        assert obj['Config']['Labels'].get('purpose')=='isolated-recovery' and obj['Config']['Labels'].get('stage')=='stage1f-r4d'
        assert obj['HostConfig']['NetworkMode']=='none' and not obj['HostConfig']['PortBindings']
        assert obj['Image']==IMAGE_ID
        assert all(m['Type']=='volume' and m['Name']==self.volume and m['Destination']=='/recovery' for m in obj['Mounts']) and len(obj['Mounts'])==1
        assert not any(k.split('=',1)[0] in ['PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGPASSFILE','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY','DEEPSEEK_API_KEY'] for k in obj['Config']['Env'])
        if require_marker:
            raw=audit.run(['docker','exec',self.container,PG+'psql','-h','/tmp','-p','55483','-U','supabase_admin','-d',self.database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',"SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()"])
            assert raw.strip()==MARKER,'RECOVERY_MARKER_MISMATCH'
        return obj

    def local_sql(self,sql,label,db=None,marker=True):
        self.guard(marker)
        target=db or self.database
        assert target in ['postgres',self.database]
        return self.command(['docker','exec','-i',self.container,PG+'psql','-h','/tmp','-p','55483','-U','supabase_admin','-d',target,'-X','-qAt','-v','ON_ERROR_STOP=1'],label,sql.encode())

    def restore_archive(self,list_path,label):
        self.guard()
        # The only pg_restore -d call in this helper: fixed local socket/marked DB.
        self.command(['docker','exec','-i',self.container,PG+'pg_restore','-h','/tmp','-p','55483','-U','supabase_admin',
                      '-d',self.database,'--exit-on-error','--single-transaction','--use-list='+list_path],label,(self.batch/'database.dump').read_bytes())

    def restore(self):
        setup=time.monotonic();suffix=self.batch.name.lower()
        self.container='uply-r4d-recovery-'+suffix;self.volume=self.container+'-data';self.database='uply_r4d_recovery'
        assert not audit.run(['docker','container','ls','-a','--filter','name=^/'+self.container+'$','--format','{{.ID}}']).strip()
        assert not audit.run(['docker','volume','ls','--filter','name=^'+self.volume+'$','--format','{{.Name}}']).strip()
        self.command(['docker','volume','create','--label','purpose=isolated-recovery','--label','stage=stage1f-r4d',self.volume],'volume-create')
        startup="chown 100:101 /recovery && exec su postgres -s /bin/sh -c '/usr/lib/postgresql/bin/initdb -U supabase_admin -D /recovery/pg -A trust --no-locale >/recovery/init.log && exec /usr/lib/postgresql/bin/postgres -D /recovery/pg -k /tmp -p 55483 -c listen_addresses= -c max_connections=20'"
        raw=self.command(['docker','run','-d','--pull=never','--read-only','--name',self.container,'--label','purpose=isolated-recovery',
             '--label','stage=stage1f-r4d','--network=none','--tmpfs','/tmp:rw,size=128m,mode=1777',
             '--mount','type=volume,source='+self.volume+',target=/recovery','--entrypoint','/bin/sh',IMAGE,'-c',startup],'container-create')
        self.container_id=raw.decode().strip();self.guard(False)
        for _ in range(100):
            ready=subprocess.run(['docker','exec',self.container,PG+'pg_isready','-h','/tmp','-p','55483','-U','supabase_admin'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if ready.returncode==0:break
            time.sleep(.2)
        else:raise RuntimeError('RECOVERY_START_TIMEOUT')
        self.timings['setupSeconds']=time.monotonic()-setup
        start=time.monotonic()
        roles=(self.batch/'roles.sql').read_text();assert not re.search(r'PASSWORD\s+\x27',roles,re.I)
        roles=re.sub(r'^CREATE ROLE supabase_admin;\n','',roles,flags=re.M)
        self.local_sql(roles,'restore-roles','postgres',False)
        source_db=self.source['extra']['database']
        assert source_db['datlocprovider']=='i' and source_db['encoding']==6 and source_db['owner']=='postgres'
        create=f"ALTER ROLE postgres SUPERUSER; CREATE DATABASE {qi(self.database)} OWNER postgres TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE {ql(source_db['datlocale'])} LC_COLLATE {ql(source_db['datcollate'])} LC_CTYPE {ql(source_db['datctype'])}; COMMENT ON DATABASE {qi(self.database)} IS {ql(MARKER)};"
        self.local_sql(create,'restore-create-database','postgres',False)
        obj=self.guard()
        publish('restore-isolation.json',{'container':self.container,'containerId':self.container_id,'volume':self.volume,'database':self.database,
                'marker':MARKER,'network':'none','publishedPorts':[],'productionCredentialsInjected':False,'bindMounts':[],
                'image':IMAGE,'imageId':obj['Image'],'labels':obj['Config']['Labels'],'pass':True})
        lines=self.toc.splitlines()
        for name,selected in [('schemas',[l for l in lines if re.match(r'^\d+; \d+ \d+ SCHEMA ',l)]),
                              ('remaining',[l for l in lines if not re.match(r'^\d+; \d+ \d+ (SCHEMA |EXTENSION )',l)])]:
            content=('\n'.join(selected)+'\n').encode();self.guard()
            self.command(['docker','exec','-i',self.container,'/bin/sh','-c','umask 077; cat > /tmp/'+name+'.list'],'prepare-'+name,content)
        self.restore_archive('/tmp/schemas.list','restore-schemas')
        extensions='\n'.join(f"SET ROLE {qi(e['owner'])}; CREATE EXTENSION IF NOT EXISTS {qi(e['name'])} WITH SCHEMA {qi(e['schema'])} VERSION {ql(e['version'])}; RESET ROLE;" for e in self.source['extra']['extensions'] if e['name']!='plpgsql')
        self.local_sql(extensions,'restore-extensions')
        self.restore_archive('/tmp/remaining.list','restore-remaining')
        self.local_sql('ALTER ROLE postgres NOSUPERUSER;','restore-role-reset')
        self.permissions()
        self.timings['restoreSeconds']=time.monotonic()-start
        self.verify()

    def permissions(self):
        statements=['BEGIN;']
        def grants(acl,object_,mapping):
            if acl is None:return
            for item in acl if isinstance(acl,list) else acl[1:-1].split(','):
                match=re.fullmatch(r'([^=]*)=([^/]+)/([^/]+)',item);assert match,'UNSUPPORTED_ACL'
                grantee=qi(match[1]) if match[1] else 'PUBLIC'
                statements.append('SET ROLE '+qi(match[3])+';')
                for token in re.findall(r'[A-Za-z]\*?',match[2]):
                    assert token[0] in mapping,'UNSUPPORTED_ACL_PRIVILEGE'
                    statements.append(f"GRANT {mapping[token[0]]} ON {object_} TO {grantee}"+(' WITH GRANT OPTION' if token.endswith('*') else '')+';')
                statements.append('RESET ROLE;')
        # Generalizes historical explicit-owner ACL supplement to every recorded
        # non-null table/schema ACL; never invents privileges or removes policies.
        for row in self.source['main']['schemaAcl']:grants(row['acl'],'SCHEMA '+qi(row['schema']),{'U':'USAGE','C':'CREATE'})
        for row in self.source['main']['tables']:
            grants(row['acl'],'TABLE '+qi(row['schema'])+'.'+qi(row['table']),{'a':'INSERT','r':'SELECT','w':'UPDATE','d':'DELETE','D':'TRUNCATE','x':'REFERENCES','t':'TRIGGER','m':'MAINTAIN'})
        grants(self.source['extra']['database']['datacl'],'DATABASE '+qi(self.database),{'C':'CREATE','T':'TEMPORARY','c':'CONNECT'})
        for row in self.source['extra']['databaseSettings'] or []:
            assert row['role']=='unknown (OID=0)','UNEXPECTED_DATABASE_ROLE_SETTINGS'
            for setting in row['config']:
                key,_,value=setting.partition('=');statements.append(f'ALTER DATABASE {qi(self.database)} SET {qi(key)} TO {ql(value)};')
        statements.append('COMMIT;')
        self.local_sql('\n'.join(statements),'restore-acl-settings')

    def verify(self):
        begin=time.monotonic();self.guard();restored={}
        for name,file in [('main','inventory-query.sql'),('extra','extra-inventory-query.sql'),('additional','additional-catalog-query.sql')]:
            restored[name]=json.loads(self.local_sql('BEGIN READ ONLY;SET LOCAL search_path=pg_catalog;'+(HIST/file).read_text()+'ROLLBACK;','verify-'+name))
        restored['columns']=json.loads(self.local_sql('BEGIN READ ONLY;SET LOCAL search_path=pg_catalog;'+COLUMNS+'ROLLBACK;','verify-columns'))
        ledger=json.loads(self.local_sql('BEGIN READ ONLY;'+LEDGER+'ROLLBACK;','verify-ledger'))
        checks={};hashes={}
        for section in self.source:
            if section=='columns':pairs=[('columns',self.source[section],restored[section])]
            else:pairs=[(section+'.'+k,v,restored[section][k]) for k,v in self.source[section].items() if not(section=='extra' and k=='publications')]
            for key,left,right in pairs:
                if key=='extra.database':left={**left,'datname':'ISOLATED_NAME'};right={**right,'datname':'ISOLATED_NAME'}
                a,b=audit.digest(norm(left)),audit.digest(norm(right));checks[key]=a==b;hashes[key]={'sourceSha256':a,'restoredSha256':b}
        checks['ledger']=len(ledger)==449 and ledger[-1]['version']=='202609130003' and audit.digest(ledger)==self.pre['database']['ledgerSha256']
        checks['agentTablesAbsent']=not any(t['schema']=='public' and t['table'].startswith('agent_') for t in restored['main']['tables'])
        checks['rolesCleanup']=next(r for r in restored['extra']['roles'] if r['rolname']=='postgres')['rolsuper'] is False
        self.timings['verificationSeconds']=time.monotonic()-begin
        record={'status':'PASS' if all(checks.values()) else 'FAIL','verifiedAt':now(),'checks':checks,'hashes':hashes,
                'ledgerCount':len(ledger),'ledgerLatest':ledger[-1],'ledgerSha256':audit.digest(ledger),
                'tableCount':len(restored['main']['tables']),'dataIntegrity':'Per-table counts plus complete archive COPY restore; no full-row hashes',
                'normalization':'Collection order and ACL-entry order; isolated database name only. Extra publications OIDs replaced by additional owner-normalized catalog.',
                'databaseLogicalRestoreVerified':all(checks.values()),'entireSupabasePlatformRestoreVerified':False}
        write(self.batch/'metadata/restore-result.json',record);publish('restore-verification.json',record)
        print(json.dumps({'verification':record['status'],'checks':checks}),flush=True)
        assert all(checks.values()),'RESTORE_INTEGRITY_MISMATCH'

    def cleanup(self):
        if self.session and self.session.poll() is None:
            self.session.stdin.write(b'ROLLBACK;\n');self.session.stdin.close();self.session.wait(timeout=30)
        if self.snapshot_log:self.snapshot_log.close()
        if self.private_connection:self.private_connection.cleanup();self.private_connection=None
        record={'container':self.container,'volume':self.volume,'containerRemoved':False,'volumeRemoved':False,'hostPortsEverPublished':False,'backupRetained':bool(self.batch and self.batch.exists())}
        if self.container_id:
            self.guard(False);self.command(['docker','rm','-f',self.container],'cleanup-container')
            record['containerRemoved']=not audit.run(['docker','container','ls','-a','--filter','id='+self.container_id,'--format','{{.ID}}']).strip()
        if self.volume:
            found=audit.run(['docker','volume','ls','--filter','name=^'+self.volume+'$','--format','{{.Name}}']).strip()
            if found:
                obj=json.loads(audit.run(['docker','volume','inspect',self.volume]))[0]
                assert obj['Labels'].get('purpose')=='isolated-recovery' and obj['Labels'].get('stage')=='stage1f-r4d'
                self.command(['docker','volume','rm',self.volume],'cleanup-volume')
            record['volumeRemoved']=not audit.run(['docker','volume','ls','--filter','name=^'+self.volume+'$','--format','{{.Name}}']).strip()
        record['pass']=not self.container_id or record['containerRemoved'] and record['volumeRemoved']
        publish('cleanup.json',record)
        if self.batch:write(self.batch/'metadata/cleanup.json',record)
        assert record['pass'],'CLEANUP_FAILED'

    def execute(self):
        try:
            self.preflight();self.make_batch();self.backup();self.restore();self.success=True
        except Exception as error:
            self.failure=str(error) if isinstance(error,(AssertionError,RuntimeError)) else type(error).__name__
            self.success=False
            publish('failure.json',{'at':now(),'stageFailure':self.failure,'action':'STOP; owned cleanup; no production remediation'})
        finally:
            try:self.cleanup()
            except Exception:
                self.success=False;publish('cleanup-failure.json',{'status':'FAIL','action':'Manual owned-resource cleanup required','container':self.container,'volume':self.volume})
            db=audit.database();ops=audit.operations();stable=self.state_matches(db,ops) if hasattr(self,'pre') else False
            publish('production-end-state.json',{'database':db,'operations':ops,'unchanged':stable,'productionDatabaseWrites':0,'productionMigration':'NOT APPLIED','liveProviderRequests':0})
            self.timings.update(totalExerciseSeconds=time.monotonic()-self.clock,startedAt=self.started,endedAt=now(),
                rtoTargetSeconds=3600,rtoAssessment='SUPPORTED BY ISOLATED EXERCISE' if self.success and time.monotonic()-self.clock<=3600 else 'NOT PROVEN')
            if self.snapshot_info:self.timings['backupAgeSecondsAtCompletion']=(dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(self.snapshot_info['snapshotStart'])).total_seconds()
            publish('timing.json',self.timings)
            if self.batch:
                write(self.batch/'metadata/timing.json',self.timings)
                if not self.success or not stable:write(self.batch/'metadata/stage-failure.json',{'status':'FAIL','reason':self.failure,'productionUnchanged':stable})
                if self.backup_accepted:self.seal('VALID' if stable else 'NOT ACCEPTED')
            print(json.dumps({'overall':'GO' if self.success and stable else 'NO-GO','batch':str(self.batch),'failure':self.failure,'timings':self.timings}),flush=True)
        return 0 if self.success and stable else 1

if __name__=='__main__':
    assert sys.argv[1:]==['run'],'ONLY_EXPLICIT_RUN_SUPPORTED'
    sys.exit(Execution().execute())

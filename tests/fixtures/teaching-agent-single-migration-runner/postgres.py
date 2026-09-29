"""OWNED_ISOLATED_FIXTURE. Full immutable app baseline, not a current DB clone."""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import uuid
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/teaching-agent-r7d-c3b'))
from backup_adapter import OwnedCluster,capture_backup
from maintenance_transport import _docker,IMAGE_ID
from plan_contract import Plan,registry,package_hashes
from receipts import sha,canonical,strict_json,safe_file
from checks import observe,descriptor,fingerprint


def q(s):return "'"+s.replace("'","''")+"'"


class Fixture:
    def __init__(self):
        self.cluster=OwnedCluster();self.transport=self.cluster.transport;self.name=self.cluster.name
        self.tmp=tempfile.TemporaryDirectory(prefix='uply-runner-i1-');self.root=Path(self.tmp.name)
        try:self.bootstrap()
        except Exception:self.close();raise

    def sql(self,sql):
        return _docker(['exec','-i',self.name,'psql','-h','/tmp','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],sql.encode(),300).decode().strip()

    def bootstrap(self):
        init=[]
        for n in ['00000000000000-initial-schema.sql','00000000000001-auth-schema.sql','00000000000002-storage-schema.sql']:
            init.append(_docker(['run','--rm','--pull=never','--network','none','--entrypoint','cat',IMAGE_ID,'/docker-entrypoint-initdb.d/init-scripts/'+n]).decode())
        self.sql('create role supabase_admin superuser;'+ '\n'.join(init))
        self.sql("""create schema if not exists extensions;create extension if not exists btree_gist with schema public;
        create table storage.objects(id uuid primary key,bucket_id text,name text);create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
        create schema realtime;create table realtime.messages(id bigint,extension text,topic text,private boolean);create function realtime.topic() returns text language sql as $$select ''::text$$;
        create publication supabase_realtime_messages_publication;
        create or replace function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
        alter default privileges for role postgres in schema public revoke all on functions from postgres,anon,authenticated,service_role;
        alter default privileges for role postgres in schema public revoke all on tables from postgres,anon,authenticated,service_role;
        alter default privileges for role postgres in schema public revoke all on sequences from postgres,anon,authenticated,service_role;
        """)
        m=json.loads((ROOT/'supabase/bootstrap/baseline-manifest.json').read_text())
        baseline=(ROOT/'supabase/bootstrap/app-schema-baseline.sql').read_bytes()
        assert sha(baseline)==m['baselineSqlDigest']
        self.sql("set uply.bootstrap_mode='new-environment';"+baseline.decode())
        self.sql('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text not null primary key,statements text[],name text)')
        rows=json.loads((ROOT/'supabase/bootstrap/migration-ledger-baseline.json').read_text());assert len(rows)==449
        self.sql('insert into supabase_migrations.schema_migrations(version,name) values '+','.join('('+q(x['version'])+','+q(x.get('name') or '')+')' for x in rows))
        names=[x['filename'] for x in m['postBaselineMigrations']]+['202609170001_teaching_lesson_activity_binding.sql']
        for n in names:
            raw=(ROOT/'supabase/migrations'/n).read_text();self.sql(raw)
            self.sql('insert into supabase_migrations.schema_migrations values('+q(n[:12])+',ARRAY['+q(raw)+'],'+q(n[13:-4])+')')
        assert len(self.state()['ledger'])==458

    def state(self):
        with self.transport._session(True) as s:
            state=observe(s);s._rollback();return state

    def plan(self,v='202609180000'):
        r=registry();p=json.loads((ROOT/'scripts/teaching-agent-r7d-c3b/plans/acl-000-v1.json').read_text());state=self.state()
        p.update(planId='owned-'+v, targetProfile='OWNED_ISOLATED_FIXTURE',status='READY_FOR_INSTALL')
        entry=r['migrations'][v]
        p['migration']={'version':v,'name':entry['name'],'path':entry['path'],'sha256':entry['rawSha256'],'envelopeRef':'reviewed-outer-envelope/1'}
        vs=[x['version'] for x in state['ledger']]
        p['ledger'].update(expectedCount=len(vs),expectedPriorVersions=vs,versionsSha256=sha(canonical(vs)),sourcePrefixSha256=state['prefix'],expectedLatest=vs[-1],followingAbsent=[x for x in r['migrations'] if x>v])
        p.update(copy.deepcopy(r['checkTemplates'][v]))
        p['scope']['allowedDeltaProfile']={'202609180000':'chapter-practice-acl/1','202609180001':'agent-completion-v2/1','202609180002':'native-publication-v2/1'}[v]
        raw=canonical(p);plan=Plan(raw,sha(raw),_fixture=True)
        now=time.time()
        auth={'contract':'exact-single-operator-authorization/1','scope':'SINGLE_MIGRATION_APPLY','planId':p['planId'],'planSha256':plan.digest,
              'migrationVersion':v,'migrationSha256':entry['rawSha256'],'packageHashes':package_hashes(),
              'targetProfile':'OWNED_ISOLATED_FIXTURE','targetIdentity':copy.deepcopy(self.transport.identity),'observedAt':now,'expiresAt':now+899,
              'operatorUid':os.getuid(),'userApprovalRef':'OWNED_ISOLATED_FIXTURE_APPROVAL_NOT_PRODUCTION','userApprovalSha256':sha(b'OWNED_ISOLATED_FIXTURE'),
              'nonce':uuid.uuid4().hex,'ledgerDescriptorSha256':descriptor(state),'catalogBeforeSha256':fingerprint(state),
              'backupManifestSha256':None,'backupDirectory':None,'credentialIdentitySha256':None,
              'runtimeBoundary':{'buildId':'PjpaYHAz0asyvwh0G-lBo','feature':'OFF','allowlists':'EMPTY'}}
        return plan,auth

    def backup(self,plan,auth):
        backup_auth=copy.deepcopy(auth);backup_auth['scope']='BACKUP_READ_EXPORT'
        directory=capture_backup(plan,backup_auth,self.transport,self.root/'backups')
        auth['backupDirectory']=str(directory);auth['backupManifestSha256']=sha(safe_file(directory/'metadata/manifest.json',True))
        return directory

    def close(self):
        self.cluster.close();self.tmp.cleanup()
    def __enter__(self):return self
    def __exit__(self,*_):self.close()

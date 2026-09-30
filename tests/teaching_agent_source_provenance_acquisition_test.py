"""D19 exact64, D26 exact20 and SESSION exact30 definitions; no production endpoints.

D26 defines the direct contract additions; fresh execution is a separate task. Existing sealed
recovery tests/fixtures remain untouched. Mocks below are test-local unit seams,
not a validation-driver replacement for operational semantics.
"""
import ast
import base64
import copy
import contextlib
from datetime import datetime
import io
import json
import os
from pathlib import Path
import re
import stat
import shutil
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch, Mock
import uuid

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/teaching-agent-r7d-c3b'))
import provenance_acquisition as a
from receipts import canonical,sha,Failure

SESSION_SPEC_PATH=ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-design.json'
SESSION_SPEC_RAW=SESSION_SPEC_PATH.read_bytes()
SESSION_SPEC_SHA='b445df04c4ee6a46f066d0ecd2b050e2200a8b3827e421a1622c3d5278c3ebfa'
if len(SESSION_SPEC_RAW)!=462053 or sha(SESSION_SPEC_RAW)!=SESSION_SPEC_SHA:
    raise AssertionError('FROZEN_SESSION_TEST_DEFINITION_DRIFT')
SESSION_SPEC=json.loads(SESSION_SPEC_RAW)


def schema_fixture(name, spec=None, field=''):
    """Schema-shaped ISOLATED UNIT input. Never build/runtime/authority evidence.

    Constants come from the independently frozen specification. Tests below
    mutate concrete protocol fields and hash joins, rather than using the
    controller's serializer to manufacture a passing expected result.
    """
    spec=SESSION_SPEC['contractSchemas']['$defs'][name] if spec is None else spec
    if '$ref' in spec:return schema_fixture(spec['$ref'].rsplit('/',1)[1],field=field)
    if 'const' in spec:return copy.deepcopy(spec['const'])
    if 'enum' in spec:return copy.deepcopy(spec['enum'][0])
    if 'oneOf' in spec:return schema_fixture(name,spec['oneOf'][0],field)
    kind=spec.get('type')
    if kind=='object':return {k:schema_fixture(name,v,k) for k,v in spec['properties'].items() if k in spec['required']}
    if kind=='array':
        if 'prefixItems' in spec:return [schema_fixture(name,v,field) for v in spec['prefixItems']]
        return [schema_fixture(name,spec['items'],field) for _ in range(spec.get('minItems',0))]
    if kind=='integer':return spec.get('minimum',1)
    if kind=='number':return max(100,spec.get('minimum',0))
    if kind=='boolean':return False
    if kind=='null':return None
    if kind=='string':
        pattern=spec.get('pattern','')
        if field=='path' and 'proof-staging' in pattern:
            return 'proof-staging/'+'a'*32+'/'+'b'*32+('/producer.env' if 'producer' in pattern else '/readonly.json')
        if 'sha256:' in pattern:return 'sha256:'+sha(b'ISOLATED_UNIT_IMAGE_NOT_BUILT')
        if '{64}' in pattern:return sha(b'ISOLATED_UNIT_HASH_NOT_OBSERVED')
        if '{32}' in pattern:return 'a'*32
        if 'libpq' in pattern:return a.EXPORTER_PREFIX+'/lib/libpq.so.5'
        if field=='name':return 'libc.so.6'
        if field=='path':
            return a.EXPORTER_PREFIX+'/lib/libc.so.6' if '/opt/' in pattern else 'unit-private/not-executed.json'
        if field=='cipher':return 'TLS_AES_256_GCM_SHA384'
        if field in ('applicationName',):return 'spa_roles_'+'a'*32
        if field=='backendPid' or '[1-9]' in pattern:return '123'
        return 'ISOLATED_UNIT_NOT_EXECUTED'
    raise AssertionError('UNIT_SPECIMEN_REQUIRES_EXPLICIT_VALUE:'+name+':'+field)


UNIT_BUILD_TRANSCRIPT=b'SYNTHETIC_UNIT_BUILD_NOT_EXECUTED\n'


def unit_artifact_lock():
    """Synthetic BUILT shape for parser tests only; never written to formal lock."""
    lock=schema_fixture('ArtifactLock');lock['status']='BUILT'
    output=SESSION_SPEC['contractSchemas']['$defs']['ArtifactLock']['properties']['outputs']['oneOf'][1]
    lock['outputs']=schema_fixture('ArtifactLock',output)
    pq=lock['outputs']['libpq']
    lock['outputs']['runtimeDependencies'].append(dict(name='libpq.so.5',bytes=pq['bytes'],sha256=pq['sha256']))
    lock['outputs']['runtimeDependencies'].sort(key=lambda item:item['name'])
    lock['outputs']['buildCommandTranscriptRawSha256']=sha(UNIT_BUILD_TRANSCRIPT)
    return lock


def unit_source_closure():
    result={}
    for name in SESSION_SPEC['sourceClosurePolicy']['futurePaths']:
        p=ROOT/name
        result[name]=sha(canonical(unit_artifact_lock())) if p==a.ARTIFACT_LOCK_PATH else (
            sha(p.read_bytes()) if p.is_file() else sha(('ISOLATED_UNIT_ABSENT:'+name).encode()))
    return result


def unit_build_evidence(implementation):
    value=schema_fixture('BuildEvidence');lock=unit_artifact_lock();raw=canonical(lock)
    common=SESSION_SPEC['schemaRequiredFieldsets']['BuildEvidence'][:14]
    value.update({k:copy.deepcopy(implementation[k]) for k in common})
    value.update(recordedAt=100,artifactLockRef=dict(path=str(a.ARTIFACT_LOCK_PATH.relative_to(ROOT)),sha256=sha(raw),bytes=len(raw)),
                 actualRuntimeImageId=lock['outputs']['runtimeImageId'],actualOutputs=lock['outputs'])
    for key in ('buildCommandTranscriptRef','dependencyInspectionRef','smokeValidationRef'):
        value[key]=dict(path='docs/evidence/teaching-agent-stage-1f-r7d-c/UNIT_NOT_EXECUTED_'+key+'.json',
                        sha256=sha(UNIT_BUILD_TRANSCRIPT),bytes=len(UNIT_BUILD_TRANSCRIPT))
    return value


def synthetic_admission_bundle():
    """In-memory CURRENT /3 validation+/4 completion fixture, never evidence.

    All 915 transcripts are invented UNIT INPUTS, not executed tests. No file is
    published, no formal artifact lock is created, and no promotion occurs.
    """
    package=a.pc.package_hashes();sources=a.closure();context=a.context_hashes()
    lock_raw=canonical(unit_artifact_lock())
    common=dict(d19DesignSha256=a.DESIGN_SHA,d26DesignSha256=a.FORWARD_DESIGN_SHA,
        sessionDesignSha256=SESSION_SPEC_SHA,operationalPackageHashes=package,operationalPackageDigest=a.PACKAGE_DIGEST,
        acquisitionSourceHashes=sources,acquisitionSourceDigest=sha(canonical(sources)),validationContextHashes=context,
        queryRegistrySha256=a.QUERY_SHA,rolesGateRegistrySha256=a.ROLES_REGISTRY_SHA,
        acquisitionProfileSha256={'DIRECT':a.DIRECT_PROFILE_SHA,'SESSION':a.SESSION_PROFILE_SHA},
        transportPolicySha256={'DIRECT':a.DIRECT_TRANSPORT_SHA,'SESSION':a.SESSION_TRANSPORT_SHA},
        exporterArtifactLockSha256=sha(lock_raw),exactTestSelectionSha256=SESSION_SPEC['validationPlan']['selectionSha256'])
    imp=schema_fixture('FinalImplementationEvidence');imp.update(common,recordedAt=100)
    after=dict(sources,**context)
    imp['fileChanges']=[dict(path=x,beforeSha256=SESSION_SPEC['repositoryBeforeBindings'][x]['sha256'],afterSha256=after[x])
        for x in SESSION_SPEC['futureImplementation']['modifyPaths']]
    imp['fileChanges'] += [dict(path=x,beforeSha256=None,afterSha256=sources[x]) for x in SESSION_SPEC['futureImplementation']['addPaths']]
    build=unit_build_evidence(imp)
    v=schema_fixture('FreshValidation3');v.update(common,recordedAt=200,implementationEvidenceSha256=sha(canonical(imp)),
        buildEvidenceSha256=sha(canonical(build)),artifactLockRef=build['artifactLockRef'],phases=[])
    for selection in a.expected_selections():
        ids=selection['testIds']
        transcript=''.join(t.split('.')[-1]+' ('+t+') ... ok\n' for t in ids)
        transcript+='\n'+'-'*70+'\nRan '+str(len(ids))+' tests in 0.001s\n\nOK\n'
        raw=transcript.encode()
        v['phases'].append(dict(name=selection['name'],startedAt=110,endedAt=120,returnCode=0,
            command=['SYNTHETIC_UNIT_SCHEMA_FIXTURE_NOT_EXECUTED'],stdoutBase64='',stdoutSha256=sha(b''),
            stderrBase64=base64.b64encode(raw).decode(),stderrSha256=sha(raw),
            results=[dict(testId=t,result='PASS',startedAt=111,endedAt=119,errorTextSha256=sha(b'')) for t in ids]))
    leaf=schema_fixture('Completion4');leaf.update(common,publishedAt=300)
    for key,stage,value in [('implementationEvidenceRef','implementation',imp),('buildEvidenceRef','build',build),
                            ('validationEvidenceRef','validation',v)]:
        raw=canonical(value);leaf[key]=dict(path=a.SESSION_SLOTS[stage],sha256=sha(raw),bytes=len(raw))
    leaf['artifactLockRef']=build['artifactLockRef']
    return leaf,imp,v,package,sources,context



def check_synthetic_admission_bundle(leaf,imp,v,package,sources,context):
    """Rebind UNIT bytes to reach semantic joins; never external authority."""
    leaf=copy.deepcopy(leaf);v=copy.deepcopy(v);iraw=canonical(imp)
    build=unit_build_evidence(imp);braw=canonical(build);lock_raw=canonical(unit_artifact_lock())
    v['implementationEvidenceSha256']=sha(iraw);v['buildEvidenceSha256']=sha(braw);vraw=canonical(v)
    for key,raw in [('implementationEvidenceRef',iraw),('buildEvidenceRef',braw),('validationEvidenceRef',vraw)]:
        if key in leaf:
            leaf[key].update(sha256=sha(raw),bytes=len(raw))
    parsed=a._validate_admission_bundle(leaf,iraw,vraw,package,sources,context,build_raw=braw,lock_raw=lock_raw)
    a.validate_validation_evidence(parsed,sha(iraw),sha(braw))



def synthetic_values(encoding='UTF8'):
    role=['postgres',True,True,True,True,True,True,True,-1,None,None]
    bootstrap={'database':'postgres','session_user':'postgres','current_user':'postgres','serverVersionNum':170006,
        'serverVersion':'17.6','serverEncoding':encoding,'clientEncoding':encoding,
        'bootstrapRows':[{'bootstrapOid':'10','bootstrapName':'postgres','roleTuple':role}]}
    return {'sessionReadOnly':{'transactionReadOnly':'on','defaultTransactionReadOnly':'on','transactionIsolation':'repeatable read'},
        'sessionIdentity':{'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,'readOnly':'on','roleExpiry':None},
        'backendTlsObservation':True,'bootstrapIdentity':bootstrap,
        'sourceCatalogAndMigrationLedger':{'roles':[role],'memberships':[],'extensions':[['plpgsql','1.0','pg_catalog','postgres']]},
        'plpgsqlExpectedState':copy.deepcopy(a.ba._PLPGSQL_TEMPLATE),
        'databaseAclBeforeCapture':{'name':'postgres','owner':'postgres','aclRaw':None,'effectiveAcl':[
            ['postgres','PUBLIC','CONNECT',False],['postgres','PUBLIC','TEMPORARY',False],
            ['postgres','postgres','CONNECT',False],['postgres','postgres','CREATE',False],['postgres','postgres','TEMPORARY',False]]},
        'unsupportedRoleFamilies':{k:[] for k in ['roleComments','roleSecurityLabels','databaseRoleSettings','parameterAcl']},
        'extensionRecoveryExpectedState.extensionState':{k:[] for k in a.ba._EXTENSION_FAMILIES},
        'extensionRecoveryExpectedState.archiveAclContextGuard':{'owners':[],'acls':[],'expandedAcl':[], 'extensionMembers':[],'databaseOwner':'postgres'},
        'globalRoleSettings':[], 'localeCatalog':{'lcCollate':'C','lcCtype':'C','localeProvider':'c','localeName':None},
        'schemaEnvironment':[['11','pg_catalog','postgres'],['2200','public','postgres']]}


def observation(values,phase='PRE',aid='a'*32,target='b'*64,start=10):
    rows=[]
    for i,key in enumerate(a.PRE_ORDER if phase=='PRE' else a.POST_ORDER):
        value=copy.deepcopy(values[key])
        rows.append({'queryId':key,'querySha256':sha(a.QUERIES[key].encode()),'sequence':i+1,
            'startedAt':start+i,'completedAt':start+i+.1,'canonicalResponse':value,'canonicalResponseSha256':sha(canonical(value)),'sqlstate':'00000'})
    oid=values['bootstrapIdentity']['bootstrapRows'][0]['bootstrapOid']
    return a.obj('source-provenance-observation/1',acquisitionId=aid,phase=phase,sourceTargetId=target,
        invocationId=('c' if phase=='PRE' else 'd')*32,queryRegistrySha256=a.QUERY_SHA,responses=rows,
        canonicalSnapshotSha256=sha(canonical(a._raw_snapshot(rows))),bootstrapRawOid=oid,
        bootstrapRawOidType=type(oid).__name__,normalizedBootstrapOid=10,rawResponseAvailable=False,rawResponseSha256=None)


class ContextFixture:
    def __init__(self,*,unit=True,transport_kind='DIRECT'):
        self.seams=contextlib.ExitStack()
        if unit:
            self.seams.enter_context(patch.object(a,'closure',side_effect=unit_source_closure))
            self.seams.enter_context(patch.object(a,'load_artifact_lock',side_effect=lambda:(unit_artifact_lock(),canonical(unit_artifact_lock()))))
        else:
            a.load_artifact_lock()  # Real future BUILT lock; fail before resources.
        self.transport_kind=transport_kind
        self.tmp=tempfile.TemporaryDirectory(prefix='pa-unit-');self.base=Path(self.tmp.name)
        self.root=self.base/'authority';self.creds=self.base/'credentials'
        for p in [self.root,self.creds,self.root/'approvals']:
            p.mkdir(mode=0o700)
        self.token=uuid.uuid4().hex;self.network='uply-pa-test-'+self.token;self.host='uply-pa-source-'+self.token
        self.target=a.direct_target(sha(canonical(self.host)),fixture=True,project_sha=sha(b'LOCAL_SYNTHETIC_ONLY'))
        if transport_kind=='SESSION':
            lock,lock_raw=a.load_artifact_lock()
            self.target=a.session_target(sha(canonical(self.host)),sha(canonical('postgres.'+self.token)),sha(lock_raw),lock['outputs']['runtimeImageId'],fixture=True,project_sha=sha(canonical(self.token)))
        self.ctx=a._Context(self.root,self.creds,self.target,{},True,self.network,self.network,transport_kind,fixture_pooler_input_sha256=sha(b'ISOLATED_UNIT_POOL_INPUT') if transport_kind=='SESSION' else '')
        self.put_credentials(b'SYNTHETIC_CA_NOT_FOR_CONNECTION')
        self.authorize()

    def put_credentials(self,ca):
        data={'pg_service.conf':('[uply]\nhost='+self.host+'\nport=5432\ndbname=postgres\nuser='+('postgres.'+self.token if self.transport_kind=='SESSION' else 'postgres')+'\nsslmode=verify-full\nsslrootcert=/connection/root.crt\npassfile=/connection/pgpass\nconnect_timeout=15\n').encode(),
              'pgpass':(self.host+':5432:postgres:'+('postgres.'+self.token if self.transport_kind=='SESSION' else 'postgres')+':synthetic-only\n').encode(),'root.crt':ca}
        for name,raw in data.items():
            p=self.creds/name;p.write_bytes(raw);p.chmod(0o600)
        self.credential_hashes={k:sha(v) for k,v in data.items()}

    def authorize(self):
        self.approval=uuid.uuid4().hex;self.aid=uuid.uuid4().hex
        leaf={'fixture':True,'scope':a.TEST_SCOPE,'designSha256':a.DESIGN_SHA,
              'acquisitionSourceHashes':a.closure(),'validationContextHashes':a.context_hashes(),
              'forwardDesignSha256':a.FORWARD_DESIGN_SHA,'sessionDesignSha256':SESSION_SPEC_SHA,'transportKind':self.transport_kind,
              'acquisitionProfileSha256':a.DIRECT_PROFILE_SHA if self.transport_kind=='DIRECT' else a.SESSION_PROFILE_SHA,
              'transportPolicySha256':a.DIRECT_TRANSPORT_SHA if self.transport_kind=='DIRECT' else a.SESSION_TRANSPORT_SHA}
        path=self.root/'fixture-eligibility.json';path.write_bytes(canonical(leaf)+b'\n');path.chmod(0o600)
        self.eligible=sha(path.read_bytes())
        intent=(a.direct_intent if self.transport_kind=='DIRECT' else a.session_intent)(self.target,fixture=True)
        bindings={'contract':'source-provenance-approval-bindings/3','schemaVersion':3,'transportKind':self.transport_kind,
            'd19DesignSha256':a.DESIGN_SHA,'d26DesignSha256':a.FORWARD_DESIGN_SHA,'sessionDesignSha256':SESSION_SPEC_SHA,
            'acquisitionEligibilitySha256':self.eligible,'operationalLineage':a.operational_lineage(fixture=True),
            'acquisitionSourceHashes':a.closure(),'acquisitionSourceDigest':sha(canonical(a.closure())),
            'validationContextHashes':a.context_hashes(),'queryRegistrySha256':a.QUERY_SHA,
            'acquisitionIntent':intent,'acquisitionIntentSha256':sha(canonical(intent)),
            'credentialFileHashes':self.credential_hashes,'credentialIdentitySha256':sha(canonical(self.credential_hashes)),
            'caIdentitySha256':self.credential_hashes['root.crt'],
            'acquisitionProfileSha256':a.DIRECT_PROFILE_SHA if self.transport_kind=='DIRECT' else a.SESSION_PROFILE_SHA,
            'transportPolicySha256':a.DIRECT_TRANSPORT_SHA if self.transport_kind=='DIRECT' else a.SESSION_TRANSPORT_SHA}
        if self.transport_kind=='SESSION':
            _,lr=a.load_artifact_lock()
            bindings.update(exporterArtifactLockSha256=sha(lr),rolesGateRegistrySha256=a.ROLES_REGISTRY_SHA,
                exporterArtifactLockRef=dict(path=str(a.ARTIFACT_LOCK_PATH.relative_to(ROOT)),sha256=sha(lr),bytes=len(lr)))
        now=time.time()
        common={'approvalId':self.approval,'acquisitionId':self.aid,'scope':a.TEST_SCOPE,'operatorUid':os.getuid(),
                'issuedAt':now-1,'notBefore':now-1,'expiresAt':now+898,'bindings':bindings,'permissions':a.permissions(),'budgets':a.BUDGETS}
        self.human=a.obj('source-provenance-human-approval/3',**common,explicitApproval=True,outputPolicy='PRIVATE_SOURCE_ACQUISITION_ONLY')
        self.human_raw=canonical(self.human)+b'\n'
        self.auth=a.obj('source-provenance-authorization/3',**common,humanApprovalSha256=sha(self.human_raw),nonce=uuid.uuid4().hex)
        self.persist()

    def persist(self):
        self.human_raw=canonical(self.human)+b'\n'
        self.auth['humanApprovalSha256']=sha(self.human_raw)
        for suffix,value in [('human.json',self.human),('json',self.auth)]:
            p=self.root/'approvals'/(self.approval+'.'+suffix);p.write_bytes(canonical(value)+b'\n');p.chmod(0o600)
        self.raw=(self.root/'approvals'/(self.approval+'.json')).read_bytes();self.digest=sha(self.raw)

    def run(self):
        return a._Run(self.ctx,self.approval,self.digest)

    def validate(self):
        a.validate_authorization(self.auth,self.human,sha(self.human_raw),self.ctx,self.eligible)

    def close(self):
        try:self.tmp.cleanup()
        finally:self.seams.close()


class UnitBase(unittest.TestCase):
    def setUp(self):
        self.f=ContextFixture();self.addCleanup(self.f.close)
    def reject(self,fn,code=None):
        with self.assertRaises(Failure) as cm:fn()
        if code:self.assertEqual(cm.exception.code,code)
    def consumed(self):
        run=self.f.run();self.addCleanup(run.unlock);run.consume();return run
    def profile(self,values=None):
        return a.source_profile(observation(values or synthetic_values())['responses'])


class OwnedSource(ContextFixture):
    """Fresh actual TLS source, private internal network, no destination/host ports."""
    SOURCE_MEMORY_BYTES=None  # Shared DIRECT fixture keeps its original argv.
    def __init__(self,encoding='UTF8',wrong_ca=False,wrong_hostname=False):
        super().__init__(unit=False);self.created_network=False;self.created_source=False
        self.label=['--label','uply.provenance-test='+self.network]
        try:
            self.docker(['image','inspect',a.IMAGE])
            cert=self.base/'cert';cert.mkdir(mode=0o700)
            openssl=shutil.which('openssl') or '/home/yangzhen/miniconda3/bin/openssl'
            def oss(args):
                p=subprocess.run([openssl,*args],cwd=cert,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
                if p.returncode:raise AssertionError('OWNED_CERTIFICATE_CREATION_FAILED')
            oss(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Owned Acquisition Test CA','-keyout','ca.key','-out','ca.crt'])
            oss(['req','-new','-newkey','rsa:2048','-nodes','-subj','/CN='+self.host,'-keyout','server.key','-out','server.csr'])
            (cert/'ext').write_text('subjectAltName=DNS:'+('wrong-owned-host' if wrong_hostname else self.host)+'\nextendedKeyUsage=serverAuth\n')
            oss(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','ext','-out','server.crt'])
            ca=(cert/'ca.crt').read_bytes()
            if wrong_ca:
                oss(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Wrong Owned CA','-keyout','wrong.key','-out','wrong.crt'])
                ca=(cert/'wrong.crt').read_bytes()
            self.put_credentials(ca);self.authorize()
            self.docker(['network','create','--internal',*self.label,self.network]);self.created_network=True
            self.docker(['run','-d','--name',self.host,'--pull=never','--read-only','--tmpfs','/tmp:rw,mode=1777',
                         '--tmpfs','/var/lib/postgresql/data:rw,mode=1777','--user','postgres',
                         *(['--memory',str(self.SOURCE_MEMORY_BYTES)] if self.SOURCE_MEMORY_BYTES is not None else []),'--network',self.network,
                         *self.label,'--entrypoint','/bin/sh',a.IMAGE,'-c','sleep 900']);self.created_source=True
            if self.SOURCE_MEMORY_BYTES is not None:
                configured=json.loads(self.docker(['container','inspect',self.host,'--format','{{json .HostConfig.Memory}}']))
                if type(configured) is not int or configured!=self.SOURCE_MEMORY_BYTES:
                    raise AssertionError('OWNED_SESSION_SOURCE_MEMORY_MISMATCH')
            self.docker(['exec',self.host,'mkdir','-m','700','/tmp/tls'])
            for name in ['server.crt','server.key']:
                self.docker(['exec','-i',self.host,'/bin/sh','-c','umask 077; cat > /tmp/tls/'+name],(cert/name).read_bytes())
            self.docker(['exec',self.host,'initdb','-D','/tmp/pg','-U','postgres','--auth=trust','--no-locale','--encoding='+encoding])
            config=b"\nlisten_addresses='*'\nssl=on\nssl_cert_file='/tmp/tls/server.crt'\nssl_key_file='/tmp/tls/server.key'\n"
            self.docker(['exec','-i',self.host,'/bin/sh','-c','cat >> /tmp/pg/postgresql.conf'],config)
            self.docker(['exec','-i',self.host,'/bin/sh','-c','cat >> /tmp/pg/pg_hba.conf'],
                        b'\nhostssl all all 0.0.0.0/0 trust\nhostssl all all ::/0 trust\n')
            self.docker(['exec',self.host,'pg_ctl','-D','/tmp/pg','-l','/tmp/pg.log','-o','-k /tmp','-w','start'])
            self.sql("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]); CREATE SCHEMA app; CREATE ROLE app_role; ALTER ROLE app_role SET search_path TO app; ALTER ROLE app_role SET statement_timeout TO '3s';")
        except BaseException:
            self.close();raise

    def docker(self,args,data=None):
        p=subprocess.run(['docker',*args],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90,env=a.SAFE_ENV)
        if p.returncode:raise AssertionError('OWNED_SOURCE_DOCKER_FAILED:'+sha(p.stderr))
        return p.stdout

    def sql(self,sql):
        return self.docker(['exec','-i',self.host,'psql','-XqAt','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],sql.encode())

    def execute(self):
        return a.acquire(self.ctx,self.approval,self.digest)

    def close(self):
        try:
            if getattr(self,'created_source',False):
                self.docker(['container','rm','-f','-v',self.host]);self.created_source=False
            if getattr(self,'created_network',False):
                self.docker(['network','rm',self.network]);self.created_network=False
        finally:super().close()


class IntegrationBase(unittest.TestCase):
    def source(self,**kw):
        source=OwnedSource(**kw);self.addCleanup(source.close);return source
    def report(self,s,result):
        self.assertEqual(result['status'],a.SUCCESS)
        report=a.validate_artifacts(s.root/'acquisitions'/s.aid,s.raw,fixture=True)
        self.assertEqual(report['observedCounters']['destinationClusters'],0)
        self.assertEqual(report['cleanup'],{'status':'PASS','ownedContainersRemaining':0})
        return report


def synthetic_success(f,terminal=True):
    """Private fixture-marked artifact, not a real transport/production receipt."""
    run=f.run();run.consume();base=time.time()+.01
    try:
        values=synthetic_values();target=sha(canonical(f.target))
        pre=observation(values,'PRE',f.aid,target,base+2)
        post=observation(values,'POST',f.aid,target,base+20)
        roles=b'-- Synthetic unit input\nCREATE ROLE postgres;\nALTER ROLE postgres WITH SUPERUSER;\n'
        records={}
        for i,kind in enumerate(['PRE','ROLES','POST'],1):
            obs=pre if kind=='PRE' else post
            invocation=obs['invocationId'] if kind!='ROLES' else 'e'*32
            start=base+({'PRE':1,'ROLES':16,'POST':19}[kind]);end=base+({'PRE':18,'ROLES':17,'POST':34}[kind])
            dispatch=a.obj('source-provenance-dispatch/1',acquisitionId=f.aid,authorizationSha256=f.digest,
                consumedSha256=run.consumed_ref['sha256'],sequence=i,invocationId=invocation,kind=kind,issuedAt=start-.1,
                argvSha256=sha(('SYNTHETIC_UNIT_ARGV_'+kind).encode()),queryIds=a.PRE_ORDER if kind=='PRE' else a.POST_ORDER if kind=='POST' else [],
                environmentPolicySha256=sha(canonical(SESSION_SPEC['runtimeEnvironment'] if f.transport_kind=='SESSION' and kind=='ROLES' else a.DESIGN['transportContract']['envPolicy'])))
            ref=a.write_json(f.root/'dispatches'/f.aid/(f'{i:02d}-'+kind.lower()+'.json'),dispatch)
            output=roles if kind=='ROLES' else canonical(obs['responses'])
            proof=dict(contract='source-provenance-client-proof/3',schemaVersion=3,transportKind='DIRECT',
                acquisitionProfileSha256=a.DIRECT_PROFILE_SHA,transportPolicySha256=a.DIRECT_TRANSPORT_SHA,
                acquisitionIntentSha256=f.auth['bindings']['acquisitionIntentSha256'],
                applicationName=a.application_name(kind,invocation),readOnlyEnforcement='FIXED_LIBPQ_OPTIONS_ON_EVERY_CONNECTION',acquisitionId=f.aid,authorizationSha256=f.digest,
                dispatchSha256=ref['sha256'],invocationId=invocation,kind=kind,fixture=True,sourceTargetId=target,
                targetProfile=f.target['targetProfile'],acquisitionSourceDigest=f.auth['bindings']['acquisitionSourceDigest'],
                operationalPackageDigest=a.PACKAGE_DIGEST,queryRegistrySha256=a.QUERY_SHA,toolImageId=a.IMAGE,
                tool='pg_dumpall' if kind=='ROLES' else 'psql',clientVersion='17.6',startedAt=start,completedAt=end,returnCode=0,
                argvSha256=dispatch['argvSha256'],credentialIdentitySha256=f.auth['bindings']['credentialIdentitySha256'],
                caIdentitySha256=f.credential_hashes['root.crt'],sslmode='verify-full',gssencmode='disable',
                proofKind='REAL_INVOCATION_LIBPQ_ENFORCEMENT' if kind=='ROLES' else 'PSQL_SAME_SESSION_METADATA',
                clientTlsObservation={'version':None,'cipher':None} if kind=='ROLES' else {'version':'TLSv1.3','cipher':'TLS_AES_256_GCM_SHA384'},
                backendObservedSsl='unavailable' if kind=='ROLES' else True,outputSha256=sha(output),outputBytes=len(output),
                stderrSha256=sha(b''),truncated=False,profileInputBindings={'rawRolesSha256':sha(roles)} if kind=='ROLES' else
                [{'queryId':r['queryId'],'querySha256':r['querySha256']} for r in obs['responses']])
            if f.transport_kind=='SESSION':
                proof.update(transportKind='SESSION',acquisitionProfileSha256=a.SESSION_PROFILE_SHA,
                    transportPolicySha256=a.SESSION_TRANSPORT_SHA,
                    readOnlyEnforcement='OWN_SESSION_SET_BEFORE_BEGIN_AND_SAME_SESSION_MEASUREMENT')
                if kind=='ROLES':
                    lock,lock_raw=a.load_artifact_lock()
                    binding=dict(acquisitionId=f.aid,invocationId=invocation,dispatchSha256=ref['sha256'],
                        artifactLockSha256=sha(lock_raw),sourceTargetId=target,rolesGateRegistrySha256=a.ROLES_REGISTRY_SHA,
                        argvSha256=dispatch['argvSha256'])
                    receipt=producer_receipt_fixture();receipt['bindings']=binding
                    rr=canonical(receipt)+b'\n';env=a.producer_environment(binding)
                    parent,pfd=a._aux_parent(f.root,f.aid,invocation,create=True)
                    try:
                        a._write_producer_environment(pfd,env);a.durable(parent/'readonly.json',rr)
                        _,envref=a.read_auxiliary_staging(f.root,f.aid,invocation,'producer.env',held_parent_fd=pfd)
                        _,rref=a.read_auxiliary_staging(f.root,f.aid,invocation,'readonly.json',held_parent_fd=pfd)
                    finally:os.close(pfd)
                    extra=schema_fixture('RolesExporterProof')
                    extra.update(artifactLockRawSha256=sha(lock_raw),runtimeImageId=lock['outputs']['runtimeImageId'],
                        sourceTargetId=target,dispatchRawSha256=ref['sha256'],argvSha256=dispatch['argvSha256'],
                        environmentPolicySha256=sha(canonical(SESSION_SPEC['runtimeEnvironment'])),
                        producerEnvironmentRef=envref,producerEnvironmentRawSha256=sha(env),measurementReceiptRef=rref,
                        measurementReceiptRawSha256=sha(rr),measurementReceiptCanonicalSha256=sha(canonical(receipt)),
                        measurementReceipt=receipt,rawRolesSha256=sha(roles),rawRolesBytes=len(roles),stderrSha256=sha(b''),stderrBytes=0)
                    proof.update(toolImageId=lock['outputs']['runtimeImageId'],tool='PG176_SESSION_READONLY_ROLES_EXPORTER',
                        proofKind='ACTUAL_OWN_PGCONN_INIT_GATE_PRIVATE_RECEIPT',rolesExporterProof=extra,
                        clientTlsObservation={'version':receipt['frontendTls']['protocol'],'cipher':receipt['frontendTls']['cipher']},
                        readOnlyEnforcement='OWN_PGCONN_THREE_SET_MEASURE_BEFORE_CATALOG')
            a.closed(proof,'source-provenance-client-proof/3')
            records[kind]={'proof':proof,'canonicalProofSha256':sha(canonical(proof))}
        review=a.profile_report(pre,post,roles)
        bundle=a.obj('source-provenance-proof-bundle/3',acquisitionId=f.aid,authorizationSha256=f.digest,sourceTargetId=target,records=records)
        files={}
        for name,value in [('pre.json',pre),('post.json',post),('transport-proofs.json',bundle),('profile-review.json',review)]:
            ref=a.write_json(run.attempt/name,value);files[name]={'sha256':ref['sha256'],'bytes':ref['bytes']}
        ref=a.durable(run.attempt/'roles.sql',roles);files['roles.sql']={'sha256':ref['sha256'],'bytes':ref['bytes']}
        counters={k:0 for k in a.COUNTERS};counters.update(measurementSessionAttempts=2,rolesToolInvocationAttempts=1,controllerSelectStatements=27,
            toolInternalSQLStatements='NOT_OBSERVABLE',physicalServerConnections='NOT_OBSERVABLE')
        report=a.obj('source-provenance-acquisition/1',acquisitionId=f.aid,authorizationSha256=f.digest,
            humanApprovalSha256=f.auth['humanApprovalSha256'],consumedSha256=run.consumed_ref['sha256'],
            acquisitionSourceDigest=f.auth['bindings']['acquisitionSourceDigest'],operationalPackageDigest=a.PACKAGE_DIGEST,
            queryRegistrySha256=a.QUERY_SHA,sourceTargetId=target,recoveryCandidateName=a.ba.RECOVERY_CANDIDATE,recoveryCandidateVersion=4,
            status=a.SUCCESS,startedAt=run.start,completedAt=base+35,files=files,observedCounters=counters,
            failurePhase=None,failureCode=None,cleanup={'status':'PASS','ownedContainersRemaining':0},productionAdoptionReady=False,
            backupAuthorized=False,restoreAuthorized=False)
        ref=a.write_json(run.attempt/'acquisition.json',report)
        if terminal:
            a.write_json(f.root/'terminal'/(f.aid+'.json'),a.obj('source-provenance-terminal/1',acquisitionId=f.aid,
                authorizationSha256=f.digest,consumedSha256=run.consumed_ref['sha256'],
                reportRef=dict(ref,path='acquisitions/'+f.aid+'/acquisition.json'),status=a.SUCCESS,
                terminalAt=base+36,cleanupStatus='PASS',failureCode=None))
        return run.attempt
    finally:run.unlock()


class ProvenanceAcquisitionAuthorization(UnitBase):
    def test_PROVENANCE_ACQUISITION_V1_001_missing_authorization(self):
        self.f.auth_path = self.f.root/'approvals'/(self.f.approval+'.json')
        self.f.auth_path.unlink()
        with patch.object(a._Run,'credentials',side_effect=AssertionError('credential read')):
            with self.assertRaises(FileNotFoundError):self.f.run()

    def test_PROVENANCE_ACQUISITION_V1_002_closed_types(self):
        for key,value in [('extra',True),('schemaVersion',True),('issuedAt',float('nan'))]:
            with self.subTest(key=key):
                old=copy.deepcopy(self.f.auth);self.f.auth[key]=value
                self.reject(self.f.validate);self.f.auth=old
        self.reject(lambda:a.strict_json(b'{"a":1,"a":2}'))

    def test_PROVENANCE_ACQUISITION_V1_003_scope_separation(self):
        for scope in ['BACKUP_READ_EXPORT','SINGLE_MIGRATION_APPLY','READ_ONLY_BASELINE_CAPTURE']:
            with self.subTest(scope=scope):
                self.f.auth['scope']=self.f.human['scope']=scope;self.f.persist()
                self.reject(self.f.validate,'ACQUISITION_ARTIFACT_INVALID')
        with self.subTest(scope=a.SCOPE):
            self.f.auth['scope']=self.f.human['scope']=a.SCOPE;self.f.persist()
            self.reject(self.f.validate,'ACQUISITION_SCOPE_MISMATCH')

    def test_PROVENANCE_ACQUISITION_V1_004_human_binding(self):
        self.f.auth['humanApprovalSha256']='0'*64
        self.reject(self.f.validate)
        self.f.auth['humanApprovalSha256']=sha(self.f.human_raw);self.f.human['explicitApproval']=False
        self.reject(self.f.validate)

    def test_PROVENANCE_ACQUISITION_V1_005_time_uid(self):
        for change in [{'expiresAt':0},{'notBefore':time.time()+1000},{'expiresAt':time.time()+10000},{'operatorUid':True}]:
            old=(copy.deepcopy(self.f.auth),copy.deepcopy(self.f.human))
            for key,value in change.items():self.f.auth[key]=self.f.human[key]=value
            self.f.persist();self.reject(self.f.validate)
            self.f.auth,self.f.human=old
        self.f.persist()
        run=self.f.run();run.start+=5
        self.reject(run.time_guard,'ACQUISITION_AUTH_EXPIRED')

    def test_PROVENANCE_ACQUISITION_V1_006_target_plan(self):
        with self.subTest(targetField='database'):
            self.f.auth['bindings']['acquisitionIntent']['target']=dict(self.f.target,database='other')
            self.f.human['bindings']=copy.deepcopy(self.f.auth['bindings']);self.f.persist()
            self.reject(self.f.validate,'ACQUISITION_ARTIFACT_INVALID')
        with self.subTest(targetField='hostIdentitySha256'):
            host_sha='0'*64 if self.f.target['hostIdentitySha256']!='0'*64 else '1'*64
            target=dict(self.f.target,hostIdentitySha256=host_sha)
            intent=a.direct_intent(target,fixture=True)
            self.f.auth['bindings'].update(acquisitionIntent=intent,acquisitionIntentSha256=sha(canonical(intent)))
            self.f.human['bindings']=copy.deepcopy(self.f.auth['bindings']);self.f.persist()
            self.reject(self.f.validate,'ACQUISITION_TARGET_MISMATCH')

    def test_PROVENANCE_ACQUISITION_V1_007_sealed_v4_dependencies(self):
        self.assertEqual(sha(canonical(a.pc.package_hashes())),a.PACKAGE_DIGEST)
        plan=a.pc.load_plan('acl-000-v1')
        self.assertEqual(a.ca.BackupLifecycle(plan).authority()['digest'],a.PACKAGE_DIGEST)
        self.assertEqual(a.ADMISSION_REVIEW['currentPackage']['digest'],a.PACKAGE_DIGEST)
        self.assertEqual(a.DESIGN_SHA,a.ADMISSION['baseOperationalDesignBinding']['sha256'])
        self.assertNotIn('source-provenance-acquisition-validation-completion/2',a.FIELDS)
        self.assertEqual(a.FIELDS['source-provenance-authorization/3'],
            frozenset(SESSION_SPEC['schemaRequiredFieldsets']['Authorization3']))
        with patch.object(a.pc,'package_hashes',return_value={'bad':'0'*64}):
            self.reject(self.f.validate,'ACQUISITION_SOURCE_DRIFT')

    def test_PROVENANCE_ACQUISITION_V1_008_companion_closure(self):
        for key in ['acquisitionEligibilitySha256','queryRegistrySha256','acquisitionSourceDigest']:
            old=copy.deepcopy(self.f.auth['bindings']);self.f.auth['bindings'][key]='0'*64
            self.f.human['bindings']=self.f.auth['bindings'];self.f.persist();self.reject(self.f.validate)
            self.f.auth['bindings']=old;self.f.human['bindings']=old
        leaf,imp,v,package,sources,context=synthetic_admission_bundle()
        for family in ['acquisitionSourceHashes','validationContextHashes']:
            bad=copy.deepcopy(imp);key=next(iter(bad[family]));bad[family][key]='0'*64
            self.reject(lambda:check_synthetic_admission_bundle(leaf,bad,v,package,sources,context),
                        'ACQUISITION_AUTHORITY_INVALID')

    def test_PROVENANCE_ACQUISITION_V1_009_risk_runtime(self):
        run=self.f.run()
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);runtime=p/'runtime';launcher=p/'launcher';build=p/'build'
            data={'TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED':True,'NEXT_PUBLIC_SUPABASE_URL':'https://local.example'}
            for path,raw in [(runtime,canonical(data)),(launcher,b'local'),(build,b'local')]:path.write_bytes(raw);path.chmod(0o600)
            profile={'runtimePath':str(runtime),'runtimeSha256':sha(runtime.read_bytes()),'launcherPath':str(launcher),
                     'launcherSha256':sha(b'local'),'buildPath':str(build),'buildId':'local','projectIdentitySha256':sha(canonical('local'))}
            run.ctx=a._Context(self.f.root,self.f.creds,self.f.target,profile,True,self.f.network,self.f.network)
            self.reject(run.runtime_guard,'ACQUISITION_RUNTIME_BOUNDARY')

    def test_PROVENANCE_ACQUISITION_V1_010_credential_dispatch_order(self):
        run=self.f.run()
        self.reject(run.credentials,'ACQUISITION_AUTH_INVALID')
        run.consume();self.addCleanup(run.unlock);run.credentials()
        self.assertEqual(run.counter['credentialFilesRead'],3)
        self.assertTrue((self.f.root/'consumed'/(self.f.aid+'.json')).exists())

    def test_PROVENANCE_ACQUISITION_V1_011_cli_closed(self):
        with patch.object(a,'production_context',side_effect=AssertionError('CLI guard bypass')):
            for argv in [['backup'],['acquire','--approval-id','a'*32,'--approval-sha256','b'*64,'--fixture']]:
                with self.assertRaises(SystemExit):a.main(argv)

    def test_PROVENANCE_ACQUISITION_V1_012_approval_toctou(self):
        run=self.f.run();self.f.auth['nonce']=uuid.uuid4().hex;self.f.persist()
        self.reject(run.guard,'ACQUISITION_AUTH_INVALID')



class ProvenanceAcquisitionLifecycle(UnitBase):
    def test_PROVENANCE_ACQUISITION_V1_013_claims_replay(self):
        run=self.consumed()
        self.assertEqual(len(list((self.f.root/'claims').glob('*/*.json'))),4)
        run.unlock()
        self.reject(lambda:self.f.run().consume(),'ACQUISITION_REPLAY')

    def test_PROVENANCE_ACQUISITION_V1_014_concurrent_lock(self):
        first=self.consumed()
        other=ContextFixture();self.addCleanup(other.close)
        # A separate open file description contends on the same private authority lock.
        fd=os.open(self.f.root/'acquisition.lock',os.O_RDWR)
        self.addCleanup(os.close,fd)
        with self.assertRaises(BlockingIOError):a.fcntl.flock(fd,a.fcntl.LOCK_EX|a.fcntl.LOCK_NB)
        self.assertIsNotNone(first.consumed_ref)

    def test_PROVENANCE_ACQUISITION_V1_015_claim_crash(self):
        run=self.f.run();self.addCleanup(run.unlock)
        real=a.write_json;seen=[]
        def crash(path,value):
            seen.append(path)
            if len(seen)==2:raise OSError('synthetic claim crash')
            return real(path,value)
        with patch.object(a,'write_json',side_effect=crash):
            with self.assertRaises(OSError):run.consume()
        self.assertIsNone(run.consumed_ref);self.assertEqual(run.counter['credentialFilesRead'],0)
        run.unlock()
        other=self.f.run();self.addCleanup(other.unlock)
        self.reject(other.consume,'ACQUISITION_REPLAY')

    def test_PROVENANCE_ACQUISITION_V1_016_consume_crash(self):
        run=self.consumed();run.unlock()
        self.assertEqual(run.counter['credentialFilesRead'],0)
        self.assertFalse((self.f.root/'terminal'/(self.f.aid+'.json')).exists())
        self.reject(lambda:self.f.run().consume(),'ACQUISITION_REPLAY')

    def test_PROVENANCE_ACQUISITION_V1_017_dispatch_budget(self):
        run=self.consumed();run.credentials()
        with patch.object(run,'guard'),patch.object(a,'_Process',side_effect=OSError('spawn failed')):
            with self.assertRaises(OSError):run.dispatch('PRE')
            self.assertEqual(len(run.dispatches),1)
            self.reject(lambda:run.dispatch('PRE'),'ACQUISITION_REPLAY')

    def test_PROVENANCE_ACQUISITION_V1_018_partial_failure(self):
        with patch.object(a._Run,'image_preflight'),patch.object(a._Run,'fixture_guard'),patch.object(a,'_ReadonlySession',side_effect=Failure('X','ACQUISITION_QUERY_FAILED')):
            result=a.acquire(self.f.ctx,self.f.approval,self.f.digest)
        self.assertEqual(result['status'],a.FAILED)
        p=self.f.root/'acquisitions'/self.f.aid
        self.assertTrue((p/'failure.json').exists());self.assertFalse((p/'transport-proofs.json').exists())
        self.assertTrue((self.f.root/'consumed'/(self.f.aid+'.json')).exists())

    def test_PROVENANCE_ACQUISITION_V1_019_terminal_order(self):
        path=synthetic_success(self.f,terminal=False)
        a.validate_artifacts(path,self.f.raw,fixture=True,require_terminal=False)
        self.reject(lambda:a.validate_artifacts(path,self.f.raw,fixture=True),'ACQUISITION_FILE_IDENTITY')

    def test_PROVENANCE_ACQUISITION_V1_020_file_identity(self):
        p=self.f.base/'private';a.durable(p,b'value')
        p.chmod(0o644);self.reject(lambda:a.private_read(p),'ACQUISITION_FILE_IDENTITY');p.chmod(0o600)
        link=self.f.base/'link';link.symlink_to(p)
        with self.assertRaises(OSError):a.private_read(link)
        link.unlink();os.link(p,link)
        self.reject(lambda:a.private_read(p),'ACQUISITION_FILE_IDENTITY')

    def test_PROVENANCE_ACQUISITION_V1_021_exclusive_durability(self):
        p=self.f.base/'new';a.durable(p,b'value')
        with self.assertRaises(FileExistsError):a.durable(p,b'overwrite')
        self.assertEqual(p.read_bytes(),b'value')
        with patch.object(a.os,'fsync',side_effect=OSError('synthetic fsync')):
            with self.assertRaises(OSError):a.durable(self.f.base/'not-durable',b'x')

    def test_PROVENANCE_ACQUISITION_V1_022_private_public_boundary(self):
        secret='postgres://user:synthetic@host/db'
        with patch.object(a,'production_context',side_effect=ValueError(secret)),patch('builtins.print') as output:
            self.assertEqual(a.main(['acquire','--approval-id','a'*32,'--approval-sha256','b'*64]),2)
        self.assertNotIn(secret,str(output.call_args));self.assertNotIn('nonce',str(output.call_args))
        stderr=io.StringIO()
        with contextlib.redirect_stderr(stderr),self.assertRaises(SystemExit):
            a.main(['acquire','--dsn',secret])
        self.assertNotIn(secret,stderr.getvalue())

    def test_PROVENANCE_ACQUISITION_V1_023_cleanup_ownership(self):
        run=self.f.run();owned='uply-provenance-'+run.id+'-pre';run.names={owned}
        run.owner_tokens[owned]='a'*32
        labels={'uply.provenance-acquisition':run.id,'uply.provenance-owner':'a'*32}
        inspect=canonical([{'Config':{'Labels':labels}}])
        with patch.object(run,'docker',side_effect=[(0,(owned+'\n').encode(),b''),(0,inspect,b''),(0,b'',b''),(0,b'',b'')]) as docker:
            self.assertEqual(run.cleanup(),{'status':'PASS','ownedContainersRemaining':0})
            self.assertEqual(docker.call_args_list[2].args[0],['container','rm','-f',owned])
        with patch.object(run,'docker',side_effect=[(0,(owned+'\n').encode(),b''),(0,canonical([{'Config':{'Labels':{}}}]),b'')]) as docker:
            self.assertEqual(run.cleanup(),{'status':'FAIL','ownedContainersRemaining':0})
            self.assertFalse(any(c.args[0][:2]==['container','rm'] for c in docker.call_args_list))

    def test_PROVENANCE_ACQUISITION_V1_024_timeout_no_commit(self):
        run=self.f.run();run.deadline=time.monotonic()-1
        self.reject(run.time_guard,'ACQUISITION_AUTH_EXPIRED')
        controls=a.DESIGN['transportContract']['readonlySessionControls']
        self.assertNotIn('COMMIT;',controls);self.assertIn('ROLLBACK;',controls)



class ProvenanceAcquisitionTransport(UnitBase):
    def test_PROVENANCE_ACQUISITION_V1_025_fixed_image_no_pull(self):
        run=self.f.run()
        with patch.object(run,'docker',return_value=(1,b'',b'absent')) as command:
            self.reject(run.image_preflight,'ACQUISITION_IMAGE_UNAVAILABLE')
        self.assertEqual(command.call_count,1);self.assertEqual(command.call_args.args[0][:2],['image','inspect'])

    def test_PROVENANCE_ACQUISITION_V1_026_argv_no_shell(self):
        run=self.consumed();run.credentials();name,argv=run.argv('ROLES','e'*32)
        self.assertIn('--no-role-passwords',argv);self.assertIn('--no-password',argv)
        self.assertNotIn('--single-transaction',argv);self.assertNotIn('shell=True',repr(argv))
        conn=argv[argv.index('-d')+1];self.assertIn("dbname='postgres'",conn)
        self.assertEqual(name,'uply-provenance-'+self.f.aid+'-roles')

    def test_PROVENANCE_ACQUISITION_V1_027_libpq_environment(self):
        run=self.consumed();run.credentials();_,argv=run.argv('ROLES','e'*32)
        for value in ['PGSSLMODE=verify-full','PGGSSENCMODE=disable','PGSERVICEFILE=/dev/null','PGPASSFILE=/connection/pgpass']:
            self.assertIn(value,argv)
        self.assertNotIn('PGPASSWORD',a.SAFE_ENV)
        self.assertIn('PGHOSTADDR',argv)

    def test_PROVENANCE_ACQUISITION_V1_028_credential_integrity(self):
        run=self.consumed();run.credentials()
        (self.f.creds/'pgpass').write_bytes(b'changed')
        self.reject(run.credentials,'ACQUISITION_CREDENTIAL_BINDING')

    def test_PROVENANCE_ACQUISITION_V1_029_psql_tls_identity(self):
        text='You are connected to database "postgres" as user "postgres" on host "'+self.f.host+'" at port "5432".\nSSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384, compression: off)'
        self.assertTrue(a._conninfo(text,self.f.host,'postgres')['enabled'])
        self.reject(lambda:a._conninfo(text.splitlines()[0],self.f.host,'postgres'))
        self.reject(lambda:a._conninfo(text,'wrong','postgres'))

    def test_PROVENANCE_ACQUISITION_V1_030_roles_proof_limits(self):
        path=synthetic_success(self.f)
        bundle=json.loads((path/'transport-proofs.json').read_bytes());proof=bundle['records']['ROLES']['proof']
        self.assertEqual(proof['clientTlsObservation'],{'version':None,'cipher':None})
        self.assertEqual(proof['proofKind'],'REAL_INVOCATION_LIBPQ_ENFORCEMENT')
        self.assertEqual(proof['backendObservedSsl'],'unavailable')

    def test_PROVENANCE_ACQUISITION_V1_031_readonly_protocol(self):
        session=a._ReadonlySession.__new__(a._ReadonlySession);session.kind='PRE';session.responses=[]
        self.reject(lambda:session.query('DROP DATABASE postgres'),'ACQUISITION_SCOPE_MISMATCH')
        self.assertEqual(a.PRE_ORDER[0],'sessionReadOnly')

    def test_PROVENANCE_ACQUISITION_V1_032_tool_allowlist(self):
        run=self.consumed();run.credentials()
        for kind in ['RESTORE','FULL','SCHEMA','APPLY']:self.reject(lambda:run.argv(kind,'e'*32),'ACQUISITION_SCOPE_MISMATCH')
        _,argv=run.argv('ROLES','e'*32);self.assertEqual(argv[-6:],['-d',argv[-5],'-l','postgres','--roles-only','--no-role-passwords'])

    def test_PROVENANCE_ACQUISITION_V1_033_bounded_io(self):
        proc=a._Process.__new__(a._Process);proc.guard=lambda:None;proc.deadline=time.monotonic()+5
        proc.out=bytearray();proc.err=bytearray();proc.cap=2
        key=Mock();key.fileobj=Mock();key.fileobj.fileno.return_value=9;key.data='out'
        proc.selector=Mock();proc.selector.select.return_value=[(key,None)]
        with patch.object(a.os,'read',return_value=b'123'):
            self.reject(proc.pump,'ACQUISITION_SIZE_LIMIT')
        self.assertEqual(proc.out,bytearray())

    def test_PROVENANCE_ACQUISITION_V1_034_framing_error(self):
        proc=a._Process.__new__(a._Process);proc.out=bytearray();proc.selector=Mock();proc.selector.get_map.return_value={}
        with patch.object(proc,'send'):
            self.reject(lambda:proc.exchange(b'SELECT 1;'),'ACQUISITION_QUERY_FAILED')
        for raw in [b'',b'{}\n{}',b'{bad}']:self.reject(lambda:a.strict_json(raw))

    def test_PROVENANCE_ACQUISITION_V1_035_version_encoding(self):
        for key,value in [('serverVersionNum',170005),('clientEncoding','LATIN1')]:
            v=synthetic_values()['bootstrapIdentity'];v[key]=value
            self.reject(lambda:a.ba._identity(v))
        self.assertEqual(a.ba._identity(synthetic_values('SQL_ASCII')['bootstrapIdentity'])['bootstrapOid'],10)

    def test_PROVENANCE_ACQUISITION_V1_036_proof_join(self):
        path=synthetic_success(self.f)
        a.validate_artifacts(path,self.f.raw,fixture=True)
        bundle=json.loads((path/'transport-proofs.json').read_bytes());bundle['records']['ROLES']['proof']['acquisitionId']='0'*32
        self.reject(lambda:a.validate_payloads(json.loads((path/'pre.json').read_bytes()),json.loads((path/'post.json').read_bytes()),
            (path/'roles.sql').read_bytes(),bundle,json.loads((path/'profile-review.json').read_bytes()),self.f.auth,self.f.digest,True))



class ProvenanceAcquisitionMeasurement(UnitBase):
    def test_PROVENANCE_ACQUISITION_V1_037_registry_exact(self):
        self.assertEqual(len(a.QUERY_RECORDS),13);self.assertEqual(len(a.PRE_ORDER)+len(a.POST_ORDER),27)
        self.assertEqual(sha(canonical(a.QUERY_RECORDS)),a.QUERY_SHA)
        for q in a.QUERY_RECORDS:self.assertEqual(sha(q['sql'].encode()),q['sha256'])

    def test_PROVENANCE_ACQUISITION_V1_038_locale_catalog(self):
        self.profile()
        q=a.QUERIES['localeCatalog'];self.assertIn('pg_catalog.pg_database',q);self.assertEqual(len(q.encode()),226)
        self.assertNotIn("current_setting('lc_collate')",q)
        self.assertIsNone(synthetic_values()['localeCatalog']['localeName'])

    def test_PROVENANCE_ACQUISITION_V1_039_bootstrap_oid(self):
        for value in [True,10.0,' 10','+10','010',0]:
            v=synthetic_values()['bootstrapIdentity'];v['bootstrapRows'][0]['bootstrapOid']=value
            self.reject(lambda:a.ba._identity(v))
        for rows in [[],[{},{}]]:
            v=synthetic_values()['bootstrapIdentity'];v['bootstrapRows']=rows;self.reject(lambda:a.ba._identity(v))

    def test_PROVENANCE_ACQUISITION_V1_040_before_after_drift(self):
        values=synthetic_values();pre=observation(values);after=copy.deepcopy(values);after['localeCatalog']['lcCtype']='changed'
        post=observation(after,'POST',start=50)
        self.reject(lambda:a.profile_report(pre,post,b'CREATE ROLE postgres;'),'ACQUISITION_SOURCE_DRIFT')

    def test_PROVENANCE_ACQUISITION_V1_041_roles_memberships(self):
        values=synthetic_values();values['sourceCatalogAndMigrationLedger']['memberships']=[['postgres','postgres','postgres',True,True,'true']]
        self.reject(lambda:self.profile(values),'ACQUISITION_PROFILE_UNSUPPORTED')
        values=synthetic_values();values['sourceCatalogAndMigrationLedger']['roles'].append([a.ba.OWNED_RESTORE_ADMIN,True,True,True,True,True,True,True,-1,None,None])
        self.reject(lambda:self.profile(values))

    def test_PROVENANCE_ACQUISITION_V1_042_global_settings(self):
        v=synthetic_values();v['sourceCatalogAndMigrationLedger']['roles'][0][10]=['search_path=public']
        v['globalRoleSettings']=[['0','10','postgres',['search_path=public']]]
        self.profile(v);v['globalRoleSettings'][0][0]='123'
        self.reject(lambda:self.profile(v),'ACQUISITION_PROFILE_UNSUPPORTED')

    def test_PROVENANCE_ACQUISITION_V1_043_schema_environment(self):
        v=synthetic_values();v['sourceCatalogAndMigrationLedger']['roles'][0][10]=['search_path=missing, public']
        v['globalRoleSettings']=[['0','10','postgres',['search_path=missing, public']]]
        _,_,env=self.profile(v)
        self.assertEqual(env,[{'role':'postgres','orderedComponents':['missing','public'],'componentExists':[False,True]}])

    def test_PROVENANCE_ACQUISITION_V1_044_private_metadata(self):
        self.assertEqual(a.QUERIES['sourceCatalogAndMigrationLedger'],a.checks.CATALOG_SQL)
        self.assertIn('supabase_migrations.schema_migrations',a.checks.CATALOG_SQL)
        self.assertNotIn('counts',a.QUERIES)
        self.assertTrue(all(q.lstrip().lower().startswith(('select','with')) for q in a.QUERIES.values()))

    def test_PROVENANCE_ACQUISITION_V1_045_chronology(self):
        obs=observation(synthetic_values());obs['responses'][1]['startedAt']=0
        self.reject(lambda:a._validate_observation(obs,'PRE',obs['sourceTargetId'],obs['acquisitionId']))

    def test_PROVENANCE_ACQUISITION_V1_046_json_truth(self):
        obs=observation(synthetic_values());self.assertFalse(obs['rawResponseAvailable']);self.assertIsNone(obs['rawResponseSha256'])
        self.assertEqual(obs['bootstrapRawOidType'],'str');self.assertEqual(obs['bootstrapRawOid'],'10')
        obs['bootstrapRawOid']=10
        self.reject(lambda:a._validate_observation(obs,'PRE',obs['sourceTargetId'],obs['acquisitionId']))



class ProvenanceAcquisitionProfileArtifact(UnitBase):
    def test_PROVENANCE_ACQUISITION_V1_047_config_boundaries(self):
        for config in [None,[],['statement_timeout=3s'],['search_path=decoy, app','statement_timeout=3s']]:
            before=copy.deepcopy(config);self.assertTrue(a.ba._role_config_supported(config));self.assertEqual(config,before)
        for config in [['work_mem=1MB'],['search_path=pg_catalog'],['search_path=app,app'],['search_path=app','search_path=app']]:
            self.assertFalse(a.ba._role_config_supported(config))

    def test_PROVENANCE_ACQUISITION_V1_048_plpgsql_extensions(self):
        self.profile();v=synthetic_values();v['plpgsqlExpectedState']['plpgsqlLanguage'][1]='other'
        self.reject(lambda:self.profile(v))
        v=synthetic_values();v['extensionRecoveryExpectedState.extensionState']['extensions']=[{'name':'unknown'}]
        self.reject(lambda:self.profile(v))

    def test_PROVENANCE_ACQUISITION_V1_049_database_acl(self):
        self.profile();v=synthetic_values();v['databaseAclBeforeCapture']['aclRaw']='{=CTc/evil}'
        self.reject(lambda:self.profile(v))

    def test_PROVENANCE_ACQUISITION_V1_050_lexical_bootstrap(self):
        raw=b'-- comment\n\\restrict X\nCREATE ROLE "post""gres";\nALTER ROLE "post""gres" SET search_path TO app;\n\\unrestrict X\n'
        r=a.lexical_precheck(raw,{'bootstrapName':'post"gres'})
        self.assertEqual(raw[slice(*r['span'])],b'CREATE ROLE "post""gres";');self.assertEqual(r['matchCount'],1)

    def test_PROVENANCE_ACQUISITION_V1_051_lexical_rejection(self):
        for raw in [b'CREATE ROLE other;',b'CREATE ROLE postgres;CREATE ROLE postgres;',b'CREATE ROLE postgres',b'CREATE ROLE postgres; ALTER ROLE postgres PASSWORD \'x\';',b'CREATE ROLE \xff;']:
            self.reject(lambda:a.lexical_precheck(raw,{'bootstrapName':'postgres'}))

    def test_PROVENANCE_ACQUISITION_V1_052_raw_roles_preserved(self):
        raw=b'-- prefix\r\nCREATE ROLE postgres;\r\nALTER ROLE postgres SET search_path TO app;\r\n'
        old=bytes(raw);r=a.lexical_precheck(raw,{'bootstrapName':'postgres'})
        self.assertEqual(raw,old);self.assertEqual(r['statementSha256'],sha(b'CREATE ROLE postgres;'))
        self.assertIn(b'ALTER ROLE postgres SET search_path TO app;',raw)

    def test_PROVENANCE_ACQUISITION_V1_053_artifact_tree(self):
        path=synthetic_success(self.f);a.validate_artifacts(path,self.f.raw,fixture=True)
        (path/'roles.sql').write_bytes(b'changed')
        self.reject(lambda:a.validate_artifacts(path,self.f.raw,fixture=True),'ACQUISITION_ARTIFACT_INVALID')

    def test_PROVENANCE_ACQUISITION_V1_054_not_backup_provenance(self):
        path=synthetic_success(self.f);report=a.validate_artifacts(path,self.f.raw,fixture=True)
        self.assertNotEqual(report['contract'],a.ba.PROVENANCE_CONTRACT)
        self.assertFalse(report['backupAuthorized']);self.assertFalse(report['restoreAuthorized'])
        self.assertNotIn('destination',report);self.assertNotIn('database.dump',[p.name for p in path.iterdir()])

    def test_PROVENANCE_ACQUISITION_V1_055_eligibility_acyclic(self):
        selections=a.expected_selections();self.assertEqual((sum(len(p['testIds']) for p in selections),len({t for p in selections for t in p['testIds']})),(915,613))
        self.assertEqual(a.ELIGIBILITY_PATH,a.ROOT/a.SESSION_SLOTS['completion'])
        self.assertNotEqual(a.ELIGIBILITY_PATH,a.ROOT/a.FORWARD_SLOTS['completion'])
        self.assertNotEqual(a.ELIGIBILITY_PATH,a.ROOT/a.ADMISSION['oldCompletionPathMustRemainAbsent'])
        with patch.object(a,'ELIGIBILITY_PATH',self.f.base/'absent'):
            self.reject(lambda:a.eligibility(a.pc.load_plan('acl-000-v1')),'ACQUISITION_AUTHORITY_INVALID')
        leaf,imp,v,package,sources,context=synthetic_admission_bundle()
        check_synthetic_admission_bundle(leaf,imp,v,package,sources,context)
        leaf_cases=[('contract','source-provenance-acquisition-validation-completion/3'),('schemaVersion',True),
            ('schemaVersion',4.0),('d19DesignSha256','0'*64),('d26DesignSha256','0'*64),('sessionDesignSha256','0'*64),
            ('methodExecutions',True),('pass',914),('skip',1),('productionExecutionAuthorized',True),
            ('publishedAt',-1),('publishedAt',True),('queryRegistrySha256','0'*64),('exactTestSelectionSha256','0'*64),('unexpected',0)]
        for key,value in leaf_cases:
            with self.subTest(leafField=key):
                bad=copy.deepcopy(leaf);bad[key]=value;self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        for key in ('status','buildEvidenceRef','artifactLockRef'):
            bad=copy.deepcopy(leaf);del bad[key];self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        # Malformed reference inputs enter the reader unchanged, without UNIT rebinding.
        for key in ('implementationEvidenceRef','buildEvidenceRef','validationEvidenceRef'):
            for field in ('path','sha256','bytes'):
                with self.subTest(reference=key,missingField=field):
                    bad=copy.deepcopy(leaf);del bad[key][field]
                    self.reject(lambda:a._validate_admission_bundle(bad,canonical(imp),canonical(v),package,sources,context,
                        build_raw=canonical(unit_build_evidence(imp)),lock_raw=canonical(unit_artifact_lock())),
                        'ACQUISITION_ARTIFACT_INVALID')
        for stage,key in [('implementation','implementationEvidenceRef'),('validation','validationEvidenceRef')]:
            bad=copy.deepcopy(leaf);bad[key]['path']=a.FORWARD_SLOTS[stage];self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        for key,value in [('status','IMPLEMENTED_UNBUILT_NOT_FRESH_VALIDATED'),('schemaVersion',True),('formalRepositoryTestsRun',False),
                          ('actualModifyPaths',[]),('addedImplementationPaths',[]),('fileChanges',[]),('unexpected',1)]:
            bad=copy.deepcopy(imp);bad[key]=value;self.reject(lambda:check_synthetic_admission_bundle(leaf,bad,v,package,sources,context))
        for field in ('path','sha256','bytes'):
            bad=copy.deepcopy(imp);bad['predecessorEvidenceBindings']['D26Implementation'][field]='bad' if field!='bytes' else 1
            self.reject(lambda:check_synthetic_admission_bundle(leaf,bad,v,package,sources,context))
        for key,value in [('contract','source-provenance-acquisition-fresh-validation/2'),('recordedAt',True),
                          ('repositoryUnchanged',False),('phases',[]),('unexpected',1)]:
            bad=copy.deepcopy(v);bad[key]=value;self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))
        for state in ('FAIL','ERROR','SKIP','NOT_RUN'):
            bad=copy.deepcopy(v);bad['phases'][0]['results'][0]['result']=state
            self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))
        for key,value in [('stderrSha256','0'*64),('stderrBase64','!invalid'),('returnCode',True)]:
            bad=copy.deepcopy(v);bad['phases'][0][key]=value;self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))
        bad=copy.deepcopy(v);bad['phases'][0]['results'].reverse();self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))
        # Public UNIT receipt read seam; sealed lineage and risk still checked.
        with synthetic_production_admission() as eligible:
            self.assertEqual(a.eligibility(a.pc.load_plan('acl-000-v1')),eligible)
        bad_sources=dict(sources);bad_sources[next(iter(bad_sources))]='0'*64
        self.reject(lambda:a._validate_admission_bundle(leaf,canonical(imp),canonical(v),package,bad_sources,context,
            build_raw=canonical(unit_build_evidence(imp)),lock_raw=canonical(unit_artifact_lock())))


    def test_PROVENANCE_ACQUISITION_V1_056_counter_status(self):
        path=synthetic_success(self.f);report=a.validate_artifacts(path,self.f.raw,fixture=True)
        self.assertEqual(report['observedCounters']['physicalServerConnections'],'NOT_OBSERVABLE')
        self.assertEqual(report['observedCounters']['productionClientInvocations'],0)
        self.assertFalse(report['productionAdoptionReady'])



class ProvenanceAcquisitionLocalTLSIntegration(IntegrationBase):
    def test_PROVENANCE_ACQUISITION_V1_057_supported_utf8(self):
        s=self.source();result=s.execute();report=self.report(s,result)
        self.assertEqual(report['observedCounters']['measurementSessionAttempts'],2)
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],1)
        roles=(s.root/'acquisitions'/s.aid/'roles.sql').read_bytes()
        self.assertIn(b'ALTER ROLE app_role SET search_path',roles)

    def test_PROVENANCE_ACQUISITION_V1_058_supported_sql_ascii(self):
        s=self.source(encoding='SQL_ASCII');self.report(s,s.execute())
        pre=json.loads((s.root/'acquisitions'/s.aid/'pre.json').read_bytes())
        v=next(r['canonicalResponse'] for r in pre['responses'] if r['queryId']=='bootstrapIdentity')
        self.assertEqual(v['serverEncoding'],'SQL_ASCII');self.assertFalse(pre['rawResponseAvailable'])

    def test_PROVENANCE_ACQUISITION_V1_059_wrong_ca(self):
        s=self.source(wrong_ca=True);result=s.execute()
        self.assertEqual(result['status'],a.FAILED)
        report=json.loads((s.root/'acquisitions'/s.aid/'acquisition.json').read_bytes())
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],0)
        self.assertEqual(report['cleanup']['ownedContainersRemaining'],0)

    def test_PROVENANCE_ACQUISITION_V1_060_wrong_hostname(self):
        s=self.source(wrong_hostname=True);result=s.execute()
        self.assertEqual(result['status'],a.FAILED)
        report=json.loads((s.root/'acquisitions'/s.aid/'acquisition.json').read_bytes())
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],0)
        self.assertEqual(report['observedCounters']['automaticRetries'],0)

    def test_PROVENANCE_ACQUISITION_V1_061_profile_rejected(self):
        s=self.source();s.sql('ALTER ROLE app_role IN DATABASE postgres SET search_path TO app;')
        result=s.execute();self.assertEqual(result['status'],a.REJECTED)
        self.assertEqual(result['failureCode'],'ACQUISITION_PROFILE_UNSUPPORTED')

    def test_PROVENANCE_ACQUISITION_V1_062_source_drift(self):
        s=self.source();fired=[]
        def observer(frame,event,arg):
            if event=='call' and frame.f_code is a._ReadonlySession.__init__.__code__ and frame.f_locals.get('kind')=='POST' and not fired:
                fired.append(True);s.sql("ALTER ROLE app_role SET statement_timeout TO '4s';")
            return observer
        old=sys.gettrace();sys.settrace(observer)
        try:result=s.execute()
        finally:sys.settrace(old)
        self.assertEqual(fired,[True]);self.assertEqual(result['status'],a.FAILED)
        self.assertEqual(result['failureCode'],'ACQUISITION_SOURCE_DRIFT')

    def test_PROVENANCE_ACQUISITION_V1_063_roles_tool_failure(self):
        s=self.source();fired=[]
        def observer(frame,event,arg):
            if event=='call' and frame.f_code is a._Process.__init__.__code__ and 'pg_dumpall' in frame.f_locals.get('argv',[]) and not fired:
                fired.append(True);s.docker(['stop',s.host])
            return observer
        old=sys.gettrace();sys.settrace(observer)
        try:result=s.execute()
        finally:sys.settrace(old)
        self.assertEqual(fired,[True]);self.assertEqual(result['status'],a.FAILED)
        report=json.loads((s.root/'acquisitions'/s.aid/'acquisition.json').read_bytes())
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],1)
        self.assertEqual(report['observedCounters']['automaticRetries'],0)

    def test_PROVENANCE_ACQUISITION_V1_064_production_boundary(self):
        s=self.source();self.report(s,s.execute())
        path=s.root/'acquisitions'/s.aid
        with self.assertRaises(Failure):a.validate_artifacts(path,s.raw,fixture=False)
        self.assertFalse(json.loads((path/'acquisition.json').read_bytes())['productionAdoptionReady'])


def rebind_synthetic_authorization(f,path,changes):
    """Rehash every dependency to isolate envelope semantics from hash failures.

    Unit artifacts only. This helper never changes source or real authority.
    """
    for key,value in changes.items():
        f.auth[key]=copy.deepcopy(value)
        if key in f.human:f.human[key]=copy.deepcopy(value)
    f.persist()
    def save(p,value):
        raw=canonical(value)+b'\n';p.write_bytes(raw);p.chmod(0o600)
        return {'path':str(p.relative_to(f.root)),'sha256':sha(raw),'bytes':len(raw)}
    consumed_path=f.root/'consumed'/(f.aid+'.json');consumed=json.loads(consumed_path.read_bytes())
    for ref in consumed['claimRefs']:
        p=f.root/ref['path'];claim=json.loads(p.read_bytes());claim['authorizationSha256']=f.digest
        if claim['claimKind']=='authorizationSha256':
            p.unlink();p=p.parent/(f.digest+'.json');claim['claimKey']=f.digest
        elif claim['claimKind']=='nonceSha256':
            p.unlink();p=p.parent/(sha(str(f.auth['nonce']).encode())+'.json');claim['claimKey']=sha(str(f.auth['nonce']).encode())
        ref.update(save(p,claim))
    consumed.update(authorizationSha256=f.digest,humanApprovalSha256=f.auth['humanApprovalSha256'])
    cref=save(consumed_path,consumed)
    bundle_path=path/'transport-proofs.json';bundle=json.loads(bundle_path.read_bytes());bundle['authorizationSha256']=f.digest
    for i,kind in enumerate(['PRE','ROLES','POST'],1):
        p=f.root/'dispatches'/f.aid/(f'{i:02d}-'+kind.lower()+'.json');dispatch=json.loads(p.read_bytes())
        dispatch.update(authorizationSha256=f.digest,consumedSha256=cref['sha256']);dref=save(p,dispatch)
        record=bundle['records'][kind];record['proof'].update(authorizationSha256=f.digest,dispatchSha256=dref['sha256'])
        record['canonicalProofSha256']=sha(canonical(record['proof']))
    bref=save(bundle_path,bundle)
    p=path/'acquisition.json';report=json.loads(p.read_bytes())
    report.update(authorizationSha256=f.digest,humanApprovalSha256=f.auth['humanApprovalSha256'],consumedSha256=cref['sha256'])
    report['files']['transport-proofs.json']={k:bref[k] for k in ['sha256','bytes']};rref=save(p,report)
    p=f.root/'terminal'/(f.aid+'.json');terminal=json.loads(p.read_bytes())
    terminal.update(authorizationSha256=f.digest,consumedSha256=cref['sha256'],reportRef=rref);save(p,terminal)
    return f.raw


@contextlib.contextmanager
def synthetic_production_admission():
    """UNIT read seam, real sealed authority/risk remain enabled; never publish."""
    leaf,imp,v,_,_,_=synthetic_admission_bundle();real=a.safe_file
    build=unit_build_evidence(imp)
    documents={a.ELIGIBILITY_PATH:canonical(leaf),a.ROOT/a.SESSION_SLOTS['implementation']:canonical(imp),
               a.ROOT/a.SESSION_SLOTS['validation']:canonical(v),a.ROOT/a.SESSION_SLOTS['build']:canonical(build)}
    for key in ('buildCommandTranscriptRef','dependencyInspectionRef','smokeValidationRef'):
        documents[a.ROOT/build[key]['path']]=UNIT_BUILD_TRANSCRIPT
    def read(path,private=False):
        if Path(path) in documents:return documents[Path(path)]
        return real(path,private=private)
    with patch.object(a,'safe_file',side_effect=read):yield sha(documents[a.ELIGIBILITY_PATH])



def production_envelope_fixture(f,eligible):
    """Local temp envelopes, no credentials accessed and no endpoint connected."""
    root=f.base/'authority'/'source-bootstrap-provenance-direct';root.mkdir(mode=0o700)
    (root/'approvals').mkdir(mode=0o700)
    target=a.direct_target('a'*64,project_sha=a.DIRECT_PROJECT_SHA)
    profile={'authorizationDirectory':str(f.base/'authority'),'connectionDirectory':str(f.base/'db-pooled'),
             'projectIdentitySha256':a.DIRECT_PROJECT_SHA}
    ctx=a._Context(root,f.base/'db-source-provenance-direct',target,profile)
    auth=copy.deepcopy(f.auth);human=copy.deepcopy(f.human)
    intent=a.direct_intent(target)
    auth['scope']=human['scope']=a.SCOPE
    auth['bindings'].update(acquisitionEligibilitySha256=eligible,operationalLineage=a.operational_lineage(),
                            acquisitionIntent=intent,acquisitionIntentSha256=sha(canonical(intent)))
    human['bindings']=copy.deepcopy(auth['bindings']);human_raw=canonical(human)+b'\n'
    auth['humanApprovalSha256']=sha(human_raw);raw=canonical(auth)+b'\n'
    for name,data in [(f.approval+'.json',raw),(f.approval+'.human.json',human_raw)]:
        p=root/'approvals'/name;p.write_bytes(data);p.chmod(0o600)
    return ctx,auth,human,raw,human_raw


class DirectOwnedSource(OwnedSource):
    """Owned-only native LOGIN observer; formal acquisition remains unmodified."""
    def __init__(self,**kw):
        super().__init__(**kw)
        try:
            config=b"\nlog_destination='jsonlog'\nlogging_collector=on\nlog_directory='/tmp/direct-log'\nlog_filename='direct'\nlog_rotation_age=0\nlog_rotation_size=0\nlog_connections=on\nlog_disconnections=on\nlog_statement='all'\nlog_min_messages='log'\n"
            self.docker(['exec','-i',self.host,'/bin/sh','-c','cat >> /tmp/pg/postgresql.conf'],config)
            self.docker(['exec',self.host,'pg_ctl','-D','/tmp/pg','-m','fast','-w','restart'])
            self.sql("""CREATE SCHEMA direct_fixture;
CREATE FUNCTION direct_fixture.observe_login() RETURNS event_trigger LANGUAGE plpgsql AS $body$
BEGIN
 RAISE LOG 'DIRECT_LOGIN %', json_build_object(
  'pid',pg_backend_pid(),'user',session_user,'database',current_database(),
  'applicationName',current_setting('application_name'),
  'defaultTransactionReadOnly',current_setting('default_transaction_read_only'),
  'loginTransactionReadOnly',current_setting('transaction_read_only'))::text;
END; $body$;
CREATE EVENT TRIGGER direct_observe_login ON login EXECUTE FUNCTION direct_fixture.observe_login();""")
        except BaseException:
            self.close();raise

    def native_rows(self):
        raw=self.docker(['exec',self.host,'cat','/tmp/direct-log/direct.json'])
        return [json.loads(line) for line in raw.splitlines() if line.strip()]


class DirectGateProcess:
    """Bounded pure response seam; never a DB/runtime proof."""
    def __init__(self,response):
        self.response=canonical(response);self.sent=[]
        assert len(self.response)<4096
    def exchange(self,raw):
        self.sent.append(raw)
        if raw in [x.encode() for x in a.QUERIES.values()]:return self.response
        return b''


class ProvenanceAcquisitionDirectContract(UnitBase):
    def service_case(self,changes):
        """Rebind synthetic approval hashes so malformed services reach the parser."""
        f=ContextFixture();self.addCleanup(f.close)
        path=f.creds/'pg_service.conf';lines=path.read_text().splitlines()
        values=dict(line.split('=',1) for line in lines[1:])
        values.update(changes)
        path.write_text('[uply]\n'+''.join(k+'='+v+'\n' for k,v in values.items()))
        f.credential_hashes['pg_service.conf']=sha(path.read_bytes());f.authorize()
        run=f.run();self.addCleanup(run.unlock);run.consume()
        return run

    def gate_session(self,response,kind='PRE'):
        run=self.f.run();proc=DirectGateProcess(response)
        # Only process dispatch is synthetic. Actual readonly controls, query parser,
        # authorization/source guard and counters execute unmodified.
        with patch.object(run,'dispatch',return_value=(proc,{},None,time.time())):
            session=a._ReadonlySession(run,kind)
        return session,proc

    def payload_fixture(self):
        path=synthetic_success(self.f)
        values=[json.loads((path/n).read_bytes()) for n in ['pre.json','post.json']]
        values += [(path/'roles.sql').read_bytes(),json.loads((path/'transport-proofs.json').read_bytes()),
                   json.loads((path/'profile-review.json').read_bytes()),self.f.auth,self.f.digest,True]
        return path,values

    def test_DIRECT_001_direct_profile_closed(self):
        self.assertEqual(a.validate_direct_profile(a.DIRECT_PROFILE,a.DIRECT_TRANSPORT),
                         (sha(canonical(a.DIRECT_PROFILE)),sha(canonical(a.DIRECT_TRANSPORT))))
        for original,family in [(a.DIRECT_PROFILE,'profile'),(a.DIRECT_TRANSPORT,'transport')]:
            for key in original:
                bad=copy.deepcopy(original);del bad[key]
                args=(bad,a.DIRECT_TRANSPORT) if family=='profile' else (a.DIRECT_PROFILE,bad)
                self.reject(lambda:a.validate_direct_profile(*args),'ACQUISITION_TARGET_MISMATCH')
            for key,value in [('extra',None),('schemaVersion',True),('schemaVersion',1.0)]:
                bad=copy.deepcopy(original);bad[key]=value
                args=(bad,a.DIRECT_TRANSPORT) if family=='profile' else (a.DIRECT_PROFILE,bad)
                self.reject(lambda:a.validate_direct_profile(*args),'ACQUISITION_TARGET_MISMATCH')
        for key,value in [('operationalLineageRequired',1),('arbitraryEndpointAllowed',0),('productionExecutionAuthorized',0)]:
            self.reject(lambda:a.validate_direct_profile(dict(a.DIRECT_PROFILE,**{key:value}),a.DIRECT_TRANSPORT))
        for key,value in [('port',5432.0),('connectTimeoutSeconds',True),('hostaddrAllowed',0),('prePostBackendSslRequired',1)]:
            self.reject(lambda:a.validate_direct_profile(a.DIRECT_PROFILE,dict(a.DIRECT_TRANSPORT,**{key:value})))
        for key,value in [('schemaVersion',True),('port',5432.0),('serverMajor',17.0),('fixture',1),('extra',None)]:
            self.reject(lambda:a.validate_direct_target(dict(self.f.target,**{key:value}),fixture=True))

    def test_DIRECT_002_direct_host_project(self):
        project='abcdefghijklmnopqrst';host='db.'+project+'.supabase.co'
        # Synthetic identity pin changes no I/O and never addresses this hostname.
        with patch.object(a,'DIRECT_PROJECT_SHA',sha(canonical(project))):
            target=a.direct_target(sha(canonical(host)),project_sha=sha(canonical(project)))
            self.assertEqual(a.validate_direct_host(host,target),host)
            other='db.abcdefghijklmnopqrsu.supabase.co'
            bad=dict(target,hostIdentitySha256=sha(canonical(other)))
            self.reject(lambda:a.validate_direct_host(other,bad),'ACQUISITION_CREDENTIAL_BINDING')
            self.reject(lambda:a.validate_direct_target(dict(target,projectIdentitySha256='0'*64)))
        self.assertEqual(a.validate_direct_host(self.f.host,self.f.target,fixture=True),self.f.host)
        self.reject(lambda:a.validate_direct_target(self.f.target))

    def test_DIRECT_003_endpoint_reject(self):
        for host in ['aws-0-ap.pooler.supabase.com','alias.example','127.0.0.1','::1','/tmp',
                     self.f.host+',other',self.f.host+' other',self.f.host+'.','db.ABCDEFGHIJKLMNOPQRST.supabase.co']:
            with self.subTest(host=host):
                target=dict(self.f.target,hostIdentitySha256=sha(canonical(host)))
                self.reject(lambda:a.validate_direct_host(host,target,fixture=True),'ACQUISITION_CREDENTIAL_BINDING')
                production_target=a.direct_target(sha(canonical(host)))
                self.reject(lambda:a.validate_direct_host(host,production_target),'ACQUISITION_CREDENTIAL_BINDING')
        for changes in [{'port':'6543'},{'hostaddr':'127.0.0.1'},{'host':self.f.host+',other'},
                        {'host':'/tmp'},{'service':'pooled'},{'application_name':'caller'},{'options':'-c default_transaction_read_only=off'}]:
            self.reject(self.service_case(changes).credentials,'ACQUISITION_CREDENTIAL_BINDING')

    def test_DIRECT_004_direct_user_tls(self):
        for changes in [{'user':'postgres.project'},{'user':'other'},{'dbname':'other'},
                        {'sslmode':'require'},{'sslmode':'disable'},{'gssencmode':'prefer'},
                        {'connect_timeout':'0'},{'sslrootcert':'/tmp/other'},{'passfile':'/tmp/other'}]:
            self.reject(self.service_case(changes).credentials,'ACQUISITION_CREDENTIAL_BINDING')
        for key,value in [('role','postgres.project'),('currentRole','other'),('database','other'),
                          ('sslmode','require'),('connectionKind','SESSION_POOLER')]:
            self.reject(lambda:a.validate_direct_target(dict(self.f.target,**{key:value}),fixture=True))

    def test_DIRECT_005_intent_crosshash(self):
        intent=copy.deepcopy(self.f.auth['bindings']['acquisitionIntent'])
        self.assertEqual(a.validate_direct_intent(intent,fixture=True),self.f.target)
        for key,value in [('sourceTargetId','0'*64),('directProfileSha256','0'*64),('transportPolicySha256','0'*64),
                          ('directTransportExplicitlyApproved',1),('AgentRunAuthorized',True),('productionAdoptionReady',True),
                          ('schemaVersion',True),('unexpected',True)]:
            self.reject(lambda:a.validate_direct_intent(dict(intent,**{key:value}),fixture=True))
        for key in ['hostIdentitySha256','directProfileSha256','transportPolicySha256']:
            bad=copy.deepcopy(intent);bad['target'][key]='0'*64
            self.reject(lambda:a.validate_direct_intent(bad,fixture=True))
        self.f.auth['bindings']['acquisitionIntentSha256']='0'*64
        self.reject(lambda:a._validate_direct_bindings(self.f.auth,fixture=True))

    def test_DIRECT_006_legacy_mixed_auth(self):
        for family in ['auth','human']:
            original=copy.deepcopy(getattr(self.f,family))
            old=copy.deepcopy(original);old['contract']=old['contract'].replace('/3','/1');old['schemaVersion']=1
            setattr(self.f,family,old);self.f.persist();self.reject(self.f.validate)
            setattr(self.f,family,original);self.f.persist()
        for field in ['target','sourceTargetId','transportRiskAcceptance','planId']:
            bad=copy.deepcopy(self.f.auth);bad['bindings'][field]='legacy'
            self.reject(lambda:a._validate_direct_bindings(bad,fixture=True))
        bad=copy.deepcopy(self.f.auth);bad['bindings']['acquisitionIntent']['transportRiskAcceptance']={'fixture':True}
        self.reject(lambda:a._validate_direct_bindings(bad,fixture=True))

    def test_DIRECT_007_lineage_and_direct_gates(self):
        self.f.validate()
        for family in ['operationalLineage','acquisitionIntent']:
            for key in self.f.auth['bindings'][family]:
                bad=copy.deepcopy(self.f.auth);del bad['bindings'][family][key]
                self.reject(lambda:a._validate_direct_bindings(bad,fixture=True))
        for key in ['acquisitionEligibilitySha256','d26DesignSha256']:
            original=copy.deepcopy(self.f.auth);self.f.auth['bindings'][key]='0'*64
            self.f.human['bindings']=copy.deepcopy(self.f.auth['bindings']);self.f.persist()
            self.reject(self.f.validate);self.f.auth=original
            self.f.human['bindings']=copy.deepcopy(original['bindings']);self.f.persist()
        plan=a.pc.load_plan('acl-000-v1')
        with synthetic_production_admission() as eligible:
            ctx,auth,human,raw,human_raw=production_envelope_fixture(self.f,eligible)
            a.validate_authorization(auth,human,sha(human_raw),ctx,eligible,plan)
            # Only the closure marker's existence is injected. Real risk_guard
            # must observe it and fail; no success bypass of authority/risk.
            real=a.os.path.lexists
            def expired(path):
                return str(path).endswith('/R7D-C3B.release-completed.json') or real(path)
            with patch.object(a.os.path,'lexists',side_effect=expired):
                self.reject(lambda:a.validate_authorization(auth,human,sha(human_raw),ctx,eligible,plan),
                            'RISK_ACCEPTANCE_SCOPE_EXPIRED')
            with patch.object(a,'ELIGIBILITY_PATH',self.f.base/'missing-completion'):
                self.reject(lambda:a._Run(ctx,self.f.approval,sha(raw),plan),'ACQUISITION_AUTHORITY_INVALID')
            broken=copy.deepcopy(auth);broken['bindings']['acquisitionIntentSha256']='0'*64
            self.reject(lambda:a.validate_authorization(broken,human,sha(human_raw),ctx,eligible,plan))

    def test_DIRECT_008_completion_forward(self):
        bundle=synthetic_admission_bundle();check_synthetic_admission_bundle(*bundle)
        leaf,imp,v,package,sources,context=bundle
        for version in [1,2,3,True,4.0]:
            bad=copy.deepcopy(leaf);bad['contract']='source-provenance-acquisition-validation-completion/'+str(version);bad['schemaVersion']=version
            self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        for key in ['d26DesignSha256','acquisitionProfileSha256','transportPolicySha256']:
            bad=copy.deepcopy(leaf);bad[key]='0'*64
            self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        for field in ['acquisitionSourceHashes','validationContextHashes']:
            bad=copy.deepcopy(leaf);bad[field][next(iter(bad[field]))]='0'*64
            self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        for field in ['implementationEvidenceRef','validationEvidenceRef']:
            for path in ['latest.json','/tmp/caller.json',a.ADMISSION['fixedFutureEvidencePaths']['completion']]:
                bad=copy.deepcopy(leaf);bad[field]['path']=path
                self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))

    def test_DIRECT_009_acyclic_fixed_slots(self):
        self.assertEqual(a.FORWARD_SLOTS,a.FORWARD_DESIGN['fixedFutureEvidencePaths'])
        self.assertEqual(a.ELIGIBILITY_PATH,a.ROOT/a.SESSION_SLOTS['completion'])
        self.assertEqual(len(set(a.SESSION_SLOTS.values())),5)
        self.assertTrue(set(a.FORWARD_SLOTS.values()).isdisjoint(a.CLOSURE_PATHS))
        self.assertTrue(set(a.FORWARD_SLOTS.values()).isdisjoint(a.CONTEXT_PATHS))
        source=Path(a.__file__).read_text();own=sha(source.encode())
        self.assertNotIn(own,source)
        tree=ast.parse(source)
        for node in tree.body:
            if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id.startswith(('ELIGIBILITY','FORWARD_')) for t in node.targets):
                self.assertNotIn('getenv',ast.unparse(node));self.assertNotIn('latest',ast.unparse(node))
        leaf,imp,v,package,sources,context=synthetic_admission_bundle()
        for field in ['implementationEvidenceSha256','validationEvidenceSha256','selfSha256']:
            bad=copy.deepcopy(imp);bad[field]='0'*64
            self.reject(lambda:check_synthetic_admission_bundle(leaf,bad,v,package,sources,context))

    def test_DIRECT_010_credential_consume_binding(self):
        run=self.f.run();reads=[];real=a.private_read
        def read(path,*args):
            reads.append(Path(path));return real(path,*args)
        with patch.object(a,'private_read',side_effect=read):
            self.reject(run.credentials);self.assertEqual(reads,[])
            run.consume();self.addCleanup(run.unlock)
            self.assertFalse(any(p.parent==self.f.creds for p in reads))
            run.credentials()
        self.assertEqual(run.counter['credentialFilesRead'],3)
        for name in ['pg_service.conf','pgpass','root.crt']:
            path=self.f.creds/name;raw=path.read_bytes();path.write_bytes(raw+b'changed')
            self.reject(run.credentials,'ACQUISITION_CREDENTIAL_BINDING');path.write_bytes(raw)
        self.reject(self.service_case({'host':'uply-pa-source-'+'0'*32}).credentials,'ACQUISITION_CREDENTIAL_BINDING')
        bad=copy.deepcopy(self.f.auth);bad['bindings']['caIdentitySha256']='0'*64
        self.reject(lambda:a._validate_direct_bindings(bad,fixture=True),'ACQUISITION_CREDENTIAL_BINDING')

    def test_DIRECT_011_all_three_argv(self):
        run=self.consumed();run.credentials();tags=[]
        required='PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000'
        for kind,invocation in [('PRE','a'*32),('ROLES','b'*32),('POST','c'*32)]:
            _,argv=run.argv(kind,invocation);conn=argv[argv.index('-d')+1];tag='spa_'+kind.lower()+'_'+invocation;tags.append(tag)
            self.assertEqual(argv.count(required),1)
            for value in ['PGSSLMODE=verify-full','PGGSSENCMODE=disable','PGSERVICEFILE=/dev/null']:
                self.assertEqual(argv.count(value),1)
            for value in ["application_name='"+tag+"'","user='postgres'","dbname='postgres'","port='5432'",
                          "sslmode='verify-full'","gssencmode='disable'","connect_timeout='15'"]:
                self.assertIn(value,conn)
            for key in ['PGHOSTADDR','PGSERVICE','PGPASSWORD']:self.assertEqual(argv[argv.index(key)-1],'-u')
            self.assertNotIn('hostaddr=',conn);self.assertIn('--pull=never',argv)
            self.assertIn('pg_dumpall' if kind=='ROLES' else 'psql',argv)
        self.assertEqual(len(set(tags)),3)
        for invocation in ['caller','a'*31,'A'*32,True]:self.reject(lambda:run.argv('PRE',invocation))
        run.endpoint['user']='postgres.project';self.reject(lambda:run.argv('ROLES','b'*32))

    def test_DIRECT_012_proof_v2(self):
        _,args=self.payload_fixture();a.validate_payloads(*args)
        for key,value in [('contract','source-provenance-client-proof/1'),('schemaVersion',True),
                          ('acquisitionSourceDigest','0'*64),('sourceTargetId','0'*64),('acquisitionProfileSha256','0'*64),('transportPolicySha256','0'*64),
                          ('acquisitionIntentSha256','0'*64),('applicationName','caller'),('returnCode',True),
                          ('readOnlyEnforcement','OBSERVED_ALL_TRANSACTIONS')]:
            bad=copy.deepcopy(args);record=bad[3]['records']['ROLES'];record['proof'][key]=value
            record['canonicalProofSha256']=sha(canonical(record['proof']))
            self.reject(lambda:a.validate_payloads(*bad))
        for kind in ['PRE','POST']:
            bad=copy.deepcopy(args);record=bad[3]['records'][kind];record['proof']['backendObservedSsl']='unavailable'
            record['canonicalProofSha256']=sha(canonical(record['proof']));self.reject(lambda:a.validate_payloads(*bad))
        path=self.f.root/'dispatches'/self.f.aid/'02-roles.json';raw=path.read_bytes();d=json.loads(raw);d['argvSha256']='0'*64
        path.write_bytes(canonical(d));self.reject(lambda:a.validate_artifacts(self.f.root/'acquisitions'/self.f.aid,self.f.raw,fixture=True))

    def test_DIRECT_013_retained_shape_join(self):
        path,_=self.payload_fixture();a.validate_artifacts(path,self.f.raw,fixture=True)
        for folder,name in [('claims/nonceSha256',sha(self.f.auth['nonce'].encode())+'.json'),
                            ('consumed',self.f.aid+'.json'),('dispatches/'+self.f.aid,'02-roles.json'),
                            ('terminal',self.f.aid+'.json')]:
            p=self.f.root/folder/name;raw=p.read_bytes();value=json.loads(raw)
            self.assertTrue(value['contract'].endswith('/1'))
            value['authorizationSha256']='0'*64;p.write_bytes(canonical(value))
            self.reject(lambda:a.validate_artifacts(path,self.f.raw,fixture=True));p.write_bytes(raw)
        with patch.object(a.time,'time',return_value=self.f.auth['expiresAt']+3600):
            a.validate_artifacts(path,self.f.raw,fixture=True)  # Historical records have no current-time replay gate.
        bad=copy.deepcopy(self.f.auth);bad['contract']='source-provenance-authorization/1';bad['schemaVersion']=1
        self.reject(lambda:a.validate_artifacts(path,canonical(bad),fixture=True))
        # Full dependency rebind means permissions/budget/type failures cannot
        # accidentally pass merely because an old authorization SHA remains.
        cases=[{},
               {'budgets':dict(a.BUDGETS,rolesBytesMaximum=True)},
               {'nonce':True},{'operatorUid':True},
               'overlong_window','issued_after_notbefore']
        permission_key=next(iter(a.permissions()))
        cases[0]={'permissions':dict(a.permissions(),**{permission_key:not a.permissions()[permission_key]})}
        for changes in cases:
            with self.subTest(envelope=changes):
                f=ContextFixture();self.addCleanup(f.close);p=synthetic_success(f)
                time_case=isinstance(changes,str)
                if time_case:
                    # Keep the recorded artifact window intact; only the
                    # intrinsic issuedAt duration/order constraint is invalid.
                    changes={'issuedAt':f.auth['expiresAt']-901 if changes=='overlong_window'
                             else f.auth['notBefore']+.001}
                auth_raw=rebind_synthetic_authorization(f,p,changes)
                self.reject(lambda:a.validate_artifacts(p,auth_raw,fixture=True),
                            'ACQUISITION_AUTH_EXPIRED' if time_case else None)

    def test_DIRECT_014_consumed_no_replay(self):
        # Each retained claim independently blocks reuse, even without terminal.
        for kind in ['approvalId','authorizationSha256','nonceSha256','acquisitionId']:
            f=ContextFixture();self.addCleanup(f.close);run=f.run();self.addCleanup(run.unlock)
            key={'approvalId':f.approval,'authorizationSha256':f.digest,'nonceSha256':sha(f.auth['nonce'].encode()),'acquisitionId':f.aid}[kind]
            a.write_json(f.root/'claims'/kind/(key+'.json'),{'legacyConsumed':True})
            self.reject(run.consume,'ACQUISITION_REPLAY');self.assertEqual(run.counter['credentialFilesRead'],0);run.unlock()
        for folder in ['consumed','terminal']:
            f=ContextFixture();self.addCleanup(f.close);run=f.run();self.addCleanup(run.unlock)
            a.write_json(f.root/folder/(f.aid+'.json'),{'oldOrNewConsumed':True})
            self.reject(run.consume,'ACQUISITION_REPLAY');run.unlock()
        run=self.consumed();run.credentials()
        with patch.object(run,'fixture_guard'),patch.object(a,'_Process',side_effect=OSError('failed slot')):
            with self.assertRaises(OSError):run.dispatch('PRE')
            self.reject(lambda:run.dispatch('PRE'),'ACQUISITION_REPLAY')
        self.assertEqual(run.counter['automaticRetries'],0)
        for folder in ['claims/approvalId','claims/authorizationSha256','claims/nonceSha256','claims/acquisitionId','consumed','terminal']:
            f=ContextFixture();self.addCleanup(f.close)
            with patch.object(a,'DIRECT_PROJECT_SHA',sha(canonical('synthetic'))),synthetic_production_admission() as eligible:
                ctx,auth,human,raw,human_raw=production_envelope_fixture(f,eligible)
                profile=ctx.profile
                runtime=f.base/'runtime.json';runtime.write_bytes(canonical({'TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED':False,
                    'NEXT_PUBLIC_SUPABASE_URL':'https://synthetic.invalid'}));runtime.chmod(0o600)
                launcher=f.base/'launcher';launcher.write_bytes(b'synthetic');launcher.chmod(0o600)
                build=f.base/'build';build.write_bytes(b'synthetic');build.chmod(0o600)
                profile.update(runtimePath=str(runtime),runtimeSha256=sha(runtime.read_bytes()),launcherPath=str(launcher),
                               launcherSha256=sha(launcher.read_bytes()),buildPath=str(build),buildId='synthetic')
                # Only the synthetic project's identity constant is substituted;
                # actual runtime file/hash checks and all authority/risk/consume
                # methods still execute. No production files or endpoint reads.
                run=a._Run(ctx,f.approval,sha(raw),a.pc.load_plan('acl-000-v1'));self.addCleanup(run.unlock)
                old=ctx.root.parent/'source-bootstrap-provenance'
                key={'claims/approvalId':f.approval,'claims/authorizationSha256':sha(raw),
                     'claims/nonceSha256':sha(auth['nonce'].encode())}.get(folder,f.aid)
                a.write_json(old/folder/(key+'.json'),{'retainedOldConsumed':True})
                self.reject(run.consume,'ACQUISITION_REPLAY')
                self.assertEqual(run.counter['credentialFilesRead'],0);run.unlock()

    def test_DIRECT_015_gate_not_repaired(self):
        session,proc=self.gate_session({'transactionReadOnly':'on','defaultTransactionReadOnly':'off','transactionIsolation':'repeatable read'})
        self.reject(lambda:session.query('sessionReadOnly'),'ACQUISITION_READONLY_REQUIRED')
        self.assertFalse(any(re.search(rb'\b(?:SET|RESET)\s+(?:SESSION\s+)?default_transaction_read_only',sql,re.I) for sql in proc.sent))
        for value in [None,False,1,'true']:
            session,proc=self.gate_session(value)
            session.responses=[{},{}]
            self.reject(lambda:session.query('backendTlsObservation'),'ACQUISITION_CLIENT_TLS')

    def test_DIRECT_016_fresh_validation_receipts(self):
        bundle=synthetic_admission_bundle();check_synthetic_admission_bundle(*bundle)
        leaf,imp,v,package,sources,context=bundle
        ids=[t for phase in a.expected_selections() for t in phase['testIds']]
        self.assertEqual((len(ids),len(set(ids))),(915,613))
        for contract in ['source-provenance-acquisition-fresh-validation/1','source-provenance-acquisition-fresh-validation/2','source-provenance-acquisition-fresh-validation-failure/1']:
            bad=copy.deepcopy(v);bad['contract']=contract
            self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))
        for state in ['FAIL','SKIP','ERROR','NOT_RUN']:
            bad=copy.deepcopy(v);bad['phases'][0]['results'][0]['result']=state
            self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))
        for mutation in ['copiedTranscript','reorderedReceipt','oldSource','oldProfile','missingDirectPhase']:
            bad=copy.deepcopy(v)
            if mutation=='copiedTranscript':
                raw=b'test_old (old.Class.test_old) ... ok\n\nRan 1 test in 0.001s\n\nOK\n'
                bad['phases'][0].update(stderrBase64=base64.b64encode(raw).decode(),stderrSha256=sha(raw))
            elif mutation=='reorderedReceipt':bad['phases'][0]['results'].reverse()
            elif mutation=='oldSource':bad['acquisitionSourceHashes'][next(iter(sources))]='0'*64
            elif mutation=='oldProfile':bad['acquisitionProfileSha256']='0'*64
            else:bad['phases']=[p for p in bad['phases'] if not any('.test_DIRECT_' in r['testId'] for r in p['results'])]
            self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,package,sources,context))

    def test_DIRECT_017_actual_formal_direct_tools(self):
        s=DirectOwnedSource();self.addCleanup(s.close)
        self.assertEqual(Path(a.__file__).resolve(),ROOT/'scripts/teaching-agent-r7d-c3b/provenance_acquisition.py')
        traced={}
        def observer(frame,event,arg):
            if frame.f_code is a._Process.__init__.__code__ and event=='call' and 'pg_dumpall' in frame.f_locals.get('argv',[]):
                self.assertNotIn('process',traced)
                traced.update(process=frame.f_locals['self'],argv=list(frame.f_locals['argv']),before=s.native_rows())
            if frame.f_code is a._Process.finish.__code__ and event=='return' and frame.f_locals.get('self') is traced.get('process'):
                traced['result']=arg
                # Bounded collector flush wait; no DB query or transport patch.
                for _ in range(20):
                    rows=s.native_rows()
                    if any(r.get('application_name','').startswith('spa_roles_') and r.get('message','').startswith('disconnection:') for r in rows):break
                    time.sleep(.05)
                traced['after']=rows
            return observer
        previous=sys.gettrace();sys.settrace(observer)
        try:result=s.execute()
        finally:sys.settrace(previous)
        self.assertEqual(result['status'],a.SUCCESS)
        path=s.root/'acquisitions'/s.aid;report=a.validate_artifacts(path,s.raw,fixture=True)
        self.assertEqual(report['cleanup'],{'status':'PASS','ownedContainersRemaining':0})
        self.assertEqual(report['observedCounters']['automaticRetries'],0)
        bundle=json.loads((path/'transport-proofs.json').read_bytes());rows=s.native_rows();keys=[]
        for kind in ['PRE','ROLES','POST']:
            proof=bundle['records'][kind]['proof'];tag=proof['applicationName']
            login=[r for r in rows if r.get('message','').startswith('DIRECT_LOGIN ') and json.loads(r['message'][13:])['applicationName']==tag]
            self.assertEqual(len(login),1)
            marker=login[0];obs=json.loads(marker['message'][13:]);key=(marker['session_id'],marker['pid']);keys.append(key)
            self.assertEqual(obs['pid'],key[1]);self.assertEqual(obs['user'],'postgres');self.assertEqual(obs['database'],'postgres')
            self.assertEqual((obs['defaultTransactionReadOnly'],obs['loginTransactionReadOnly']),('on','on'))
            session=[r for r in rows if (r.get('session_id'),r.get('pid'))==key]
            self.assertTrue(any('connection authorized:' in r.get('message','') and 'SSL enabled' in r['message'] for r in session))
            self.assertTrue(any(r.get('message','').startswith('disconnection:') for r in session))
            statements=[r['message'] for r in session if r.get('message','').startswith('statement:')]
            self.assertTrue(statements)
            self.assertFalse(any(re.search(r'\b(?:SET|RESET)\s+(?:SESSION\s+)?default_transaction_read_only',sql,re.I) for sql in statements))
            self.assertEqual(proof['returnCode'],0)
            if kind=='ROLES':
                self.assertTrue(any('pg_authid' in sql for sql in statements))
                self.assertEqual(proof['outputSha256'],sha((path/'roles.sql').read_bytes()))
                self.assertEqual(proof['clientTlsObservation'],{'version':None,'cipher':None})
                self.assertEqual(proof['backendObservedSsl'],'unavailable')
            else:self.assertIs(proof['backendObservedSsl'],True)
        self.assertEqual(len(set(keys)),3)
        roles_proof=bundle['records']['ROLES']['proof']
        self.assertEqual(traced['result'][0],0)
        self.assertEqual(traced['result'][1],(path/'roles.sql').read_bytes())
        self.assertEqual(sha(canonical(traced['argv'])),roles_proof['argvSha256'])
        def clients(rows):
            return {(r['session_id'],r['pid']) for r in rows if r.get('backend_type')=='client backend'}
        before=clients(traced['before']);after=clients(traced['after'])
        self.assertIn(keys[0],before)  # PRE intentionally remains open during dump.
        self.assertEqual(after-before,{keys[1]})  # No ambiguous extra dump backend.
        formal=[r for r in rows if r.get('message','').startswith('DIRECT_LOGIN ') and json.loads(r['message'][13:])['applicationName'].startswith('spa_')]
        self.assertEqual(len(formal),3)

    def test_DIRECT_018_actual_wrong_ca(self):
        s=OwnedSource(wrong_ca=True);self.addCleanup(s.close);result=s.execute()
        self.assertEqual(result['status'],a.FAILED)
        path=s.root/'acquisitions'/s.aid;report=json.loads((path/'acquisition.json').read_bytes())
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],0)
        self.assertEqual(report['cleanup'],{'status':'PASS','ownedContainersRemaining':0})
        self.assertFalse((path/'roles.sql').exists());self.assertTrue((s.root/'consumed'/(s.aid+'.json')).exists())
        with self.assertRaises(Failure):s.run()

    def test_DIRECT_019_actual_wrong_hostname(self):
        s=OwnedSource(wrong_hostname=True);self.addCleanup(s.close);result=s.execute()
        self.assertEqual(result['status'],a.FAILED)
        path=s.root/'acquisitions'/s.aid;report=json.loads((path/'acquisition.json').read_bytes())
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],0)
        self.assertEqual(report['observedCounters']['automaticRetries'],0)
        self.assertEqual(report['cleanup'],{'status':'PASS','ownedContainersRemaining':0})
        self.assertFalse((path/'roles.sql').exists());self.assertTrue((s.root/'consumed'/(s.aid+'.json')).exists())

    def test_DIRECT_020_actual_readonly_gate_failure(self):
        # Saved D24-R3 observation 7 measurement, projected onto the unchanged
        # formal query fields. Source report SHA256:
        # 1959e891d462bb7ba302f64a3b958e649780da5e4725f78c11df76680d2d5992
        # Pure bounded fake-process replay, NOT runtime proof or a /tmp dependency.
        saved=b'{"transactionReadOnly":"on","defaultTransactionReadOnly":"off","transactionIsolation":"repeatable read"}'
        session,proc=self.gate_session(json.loads(saved))
        self.reject(lambda:session.query('sessionReadOnly'),'ACQUISITION_READONLY_REQUIRED')
        self.assertEqual(session.responses[0]['canonicalResponse'],json.loads(saved))
        self.assertEqual(proc.sent[-1],a.QUERIES['sessionReadOnly'].encode())
        self.assertEqual(session.run.counter['controllerSelectStatements'],1)
        self.assertEqual(session.run.counter['rolesToolInvocationAttempts'],0)
        self.assertFalse(any(b'default_transaction_read_only' in sql and not sql.lstrip().upper().startswith(b'SELECT') for sql in proc.sent))



# Public setup inputs only, bound to the already reviewed local R2 manifest.
# No R2 executor, generated credentials, runner image or prototype binary used.
LOCAL_POOL_IMAGE='sha256:c57b1222f3ca21a3180c202dea14806cc0be67cda633eb62bcc6481efc0e7a95'
LOCAL_POOL_INPUT_BINDINGS={
    'manifestRawSha256':'3fedd7ccfb8e102cd1be0be39fa874681197d706ee0c555d747905b005dd378f',
    'startupExpressionsRawSha256':'320d76c7e9f8aaca135158b7af0851437b0c7ac248ed0464999ba85687eff1cc',
    'tenantSeedRawSha256':'996100753480bceb2c5202383e5d3bb31bcf25cf786df6656c855e008f35e2bc',
    'pgConfigRawSha256':'de14d77280d62d1a9d85f714307d499eded8ee57ee1b49fb2432d4a1f8b83fef'}


class OwnedSessionSource(OwnedSource):
    """Future actual fixture: PG17.6 + cached Supavisor2.9.13, no host ports.

    Only this fixture's fresh synthetic certificates, secrets, databases and
    labelled containers are used. Runtime promotion requires a real BUILT lock.
    P1 pool_size>=2 holds PRE; P2 pool_size=1 has no persistent PRE. Peak four
    containers (two source services plus at most two clients), one internal net.
    """
    SOURCE_MEMORY_BYTES=SESSION_SPEC['futureActualLocalValidationResources']['memoryCeilings']['postgresBytes']
    def __init__(self,*,pool_size=2,frontend_fault=None,upstream_fault=None):
        if pool_size not in (1,2):raise AssertionError('OWNED_POOL_SIZE_INVALID')
        self.pool_created=False;self.backend_host=None;self.clients=set();self.client_owner_tokens={}
        super().__init__()  # Real lock required; no unit closure or image mocks.
        try:
            backend_name='uply-pa-backend-'+self.token
            self.docker(['image','inspect',LOCAL_POOL_IMAGE])
            self.docker(['image','inspect',a.load_artifact_lock()[0]['outputs']['runtimeImageId']])
            self.docker(['container','rename',self.host,backend_name]);self.backend_host=backend_name
            self.docker(['network','disconnect',self.network,self.backend_host])
            self.docker(['network','connect','--alias',self.backend_host,self.network,self.backend_host])
            cert=self.base/'cert';openssl=shutil.which('openssl') or '/home/yangzhen/miniconda3/bin/openssl'
            def oss(args):
                r=subprocess.run([openssl,*args],cwd=cert,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
                if r.returncode:raise AssertionError('OWNED_CERTIFICATE_CREATION_FAILED')
            # Different leaf certs make frontend and upstream trust tests independent.
            for stem,hostname in [('backend',self.backend_host),('pool',self.host)]:
                cn='wrong-owned-host' if (stem=='backend' and upstream_fault=='hostname') or (stem=='pool' and frontend_fault=='hostname') else hostname
                oss(['req','-new','-newkey','rsa:2048','-nodes','-subj','/CN='+cn,'-keyout',stem+'.key','-out',stem+'.csr'])
                (cert/(stem+'.ext')).write_text('subjectAltName=DNS:'+cn+'\nextendedKeyUsage=serverAuth\n')
                oss(['x509','-req','-in',stem+'.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile',stem+'.ext','-out',stem+'.crt'])
            oss(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Wrong Local CA','-keyout','wrong.key','-out','wrong.crt'])
            oss(['x509','-in','wrong.crt' if upstream_fault=='ca' else 'ca.crt','-outform','DER','-out','upstream.der'])
            for name,src in [('server.crt','backend.crt'),('server.key','backend.key')]:
                self.docker(['exec','-i',self.backend_host,'/bin/sh','-c','umask 077; cat > /tmp/tls/'+name],(cert/src).read_bytes())
            config=b"\nlog_destination='jsonlog'\nlogging_collector=on\nlog_directory='/tmp/session-log'\nlog_filename='session'\nlog_rotation_age=0\nlog_rotation_size=0\nlog_connections=on\nlog_disconnections=on\nlog_statement='all'\nlog_min_messages='log'\nlog_parameter_max_length=0\nlog_parameter_max_length_on_error=0\n"
            self.docker(['exec','-i',self.backend_host,'/bin/sh','-c','cat >> /tmp/pg/postgresql.conf'],config)
            self.docker(['exec',self.backend_host,'pg_ctl','-D','/tmp/pg','-m','fast','-w','restart'])
            self.sql('CREATE DATABASE session_pool_metadata;')
            secret=lambda:uuid.uuid4().hex+uuid.uuid4().hex
            # Generated test-local values; never reused from a research run.
            env={'DATABASE_URL':'ecto://postgres:'+secret()+'@'+self.backend_host+':5432/session_pool_metadata?ssl=true',
                'DB_POOL_SIZE':'1','SUPAVISOR_DB_IP_VERSION':'ipv4','ECTO_IPV6':'false',
                'ERL_AFLAGS':'-proto_dist inet_tcp +S 2:2','NODE_NAME':'session_'+self.token,'NODE_IP':'127.0.0.1',
                'REGION':'local','PORT':'4000','PROXY_PORT_SESSION':'5432','PROXY_PORT_TRANSACTION':'6543',
                'NO_WARM_POOL_USERS':'','METRICS_PUSHER_ENABLED':'false','TENANT_METRICS_PUSHER_ENABLED':'false',
                'GLOBAL_DOWNSTREAM_CERT_PATH':'/lab/pool.crt','GLOBAL_DOWNSTREAM_KEY_PATH':'/lab/pool.key',
                'SECRET_KEY_BASE':secret(),'VAULT_ENC_KEY':base64.b64encode(os.urandom(24)).decode('ascii'),
                'API_JWT_SECRET':secret(),'METRICS_JWT_SECRET':secret(),'RELEASE_COOKIE':secret()}
            ep=self.base/'pool-startup.env';ep.write_text(''.join(k+'='+v+'\n' for k,v in env.items()));ep.chmod(0o600)
            self.docker(['run','-d','--pull=never','--platform=linux/amd64','--memory','2g','--restart=no','--no-healthcheck',
                '--name',self.host,*self.label,'--network',self.network,'--network-alias',self.host,'--read-only',
                '--tmpfs','/tmp:rw,mode=1777,size=268435456','--tmpfs','/lab:rw,mode=0700,uid=65534,gid=65534,size=1048576',
                '--user','65534:65534','--env','HOME=/lab','--cap-drop=ALL','--security-opt=no-new-privileges',
                '--ulimit','nofile=100000:100000','--env-file',str(ep),'--entrypoint','/bin/sh',LOCAL_POOL_IMAGE,
                '-c','umask 077; while [ ! -f /lab/.ready ]; do sleep 0.1; done; /app/bin/migrate && exec /app/bin/server'])
            self.pool_created=True
            for name in ('pool.crt','pool.key'):
                self.docker(['exec','-i',self.host,'/bin/sh','-c','umask 077; cat > /lab/'+name],(cert/name).read_bytes())
            password=secret();tenant=self.token
            input_value=dict(tenant=tenant,dbHost=self.backend_host if upstream_fault!='route' else 'unroutable-owned-'+self.token,
                poolSize=pool_size,maxClients=3,sourcePassword=password,serverVersion='17.6',
                caDer=base64.b64encode((cert/'upstream.der').read_bytes()).decode())
            seed='''input = "/lab/input.json" |> File.read!() |> JSON.decode!()
Application.ensure_all_started(:ssl)
attrs = %{external_id: input["tenant"], db_host: input["dbHost"], db_port: 5432, db_database: "postgres",
 ip_version: "v4", require_user: true, enforce_ssl: true, upstream_ssl: true, upstream_verify: "peer",
 upstream_tls_ca: Base.decode64!(input["caDer"]), default_parameter_status: %{"server_version" => input["serverVersion"]},
 default_pool_size: input["poolSize"], default_max_clients: input["maxClients"], client_heartbeat_interval: 600,
 use_jit: false, allow_list: ["0.0.0.0/0"], users: [%{"db_user" => "postgres", "db_password" => input["sourcePassword"],
 "mode_type" => "session", "pool_size" => input["poolSize"], "max_clients" => input["maxClients"],
 "pool_checkout_timeout" => 5000, "is_manager" => false}]}
case Supavisor.Tenants.create_tenant(attrs) do
 {:ok, _} -> IO.puts("OWNED_SESSION_TENANT_CREATED")
 {:error, _} -> raise "OWNED_SESSION_TENANT_SETUP_FAILED"
end
'''
            for name,raw in [('input.json',canonical(input_value)),('seed.exs',seed.encode()),('.ready',b'1')]:
                self.docker(['exec','-i',self.host,'/bin/sh','-c','umask 077; cat > /lab/'+name],raw)
            # Bounded setup wait only. No acquisition retry or fallback.
            end=time.monotonic()+90
            while True:
                r=subprocess.run(['docker','exec',self.host,'/app/bin/supavisor','rpc','IO.puts("OWNED_SESSION_RPC_READY")'],
                    stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=a.SAFE_ENV,timeout=15)
                if r.returncode==0 and b'OWNED_SESSION_RPC_READY' in r.stdout:break
                if time.monotonic()>=end:raise AssertionError('OWNED_SESSION_SETUP_NOT_READY')
                time.sleep(.25)
            seeded=self.docker(['exec',self.host,'/app/bin/supavisor','rpc','Code.eval_file("/lab/seed.exs")'])
            if b'OWNED_SESSION_TENANT_CREATED' not in seeded:raise AssertionError('OWNED_SESSION_TENANT_SETUP_FAILED')
            self.frontend_user='postgres.'+tenant
            self.transport_kind='SESSION'
            self.put_credentials((cert/('wrong.crt' if frontend_fault=='ca' else 'ca.crt')).read_bytes())
            service=self.creds/'pg_service.conf';raw=service.read_bytes().replace(b'user=postgres\n',('user='+self.frontend_user+'\n').encode())
            service.write_bytes(raw);service.chmod(0o600)
            (self.creds/'pgpass').write_text(self.host+':5432:postgres:'+self.frontend_user+':'+password+'\n');(self.creds/'pgpass').chmod(0o600)
            self.credential_hashes={p.name:sha(p.read_bytes()) for p in self.creds.iterdir()}
            lock,lr=a.load_artifact_lock()
            self.target=a.session_target(sha(canonical(self.host)),sha(canonical(self.frontend_user)),sha(lr),lock['outputs']['runtimeImageId'],
                fixture=True,project_sha=sha(canonical(tenant)))
            self.ctx=a._Context(self.root,self.creds,self.target,{},True,self.network,self.network,'SESSION',fixture_pooler_input_sha256=sha(canonical(input_value)));self.authorize()
        except BaseException:
            self.close();raise

    def sql(self,text):
        host=self.backend_host or self.host
        return self.docker(['exec','-i',host,'psql','-XqAt','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=on'],text.encode())

    def ordinary(self,sql,*,plaintext=False):
        name='uply-pa-ordinary-'+uuid.uuid4().hex;self.clients.add(name)
        conn="host='"+self.host+"' port='5432' dbname='postgres' user='"+self.frontend_user+"' sslmode='"+('disable' if plaintext else 'verify-full')+"' sslrootcert='/connection/root.crt' passfile='/connection/pgpass' gssencmode='disable' connect_timeout='15'"
        try:
            return subprocess.run(['docker','run','--rm','-i','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
                '--name',name,*self.label,'--memory',str(SESSION_SPEC['futureActualLocalValidationResources']['memoryCeilings']['stockPrePostClientBytes']),
                '--network',self.network,'--user',str(os.geteuid())+':'+str(os.getegid()),
                '--mount','type=bind,src='+str(self.creds)+',dst=/connection,readonly','--entrypoint','/usr/bin/env',a.IMAGE,
                '-i','LC_ALL=C','PATH=/usr/local/bin:/usr/bin:/bin','PGSERVICEFILE=/dev/null','PGCLIENTENCODING=UTF8',
                'psql','-XqAt','-w','-d',conn,'-v','ON_ERROR_STOP=on'],input=sql.encode(),stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,env=a.SAFE_ENV,timeout=45)
        finally:
            self.remove_owned(name);self.clients.discard(name)

    def docker(self,args,data=None,*,allow_absent=False):
        p=subprocess.run(['docker',*args],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=100,env=a.SAFE_ENV)
        if p.returncode and not allow_absent:raise AssertionError('OWNED_DOCKER_OPERATION_FAILED')
        return p.stdout

    def component(self):
        """One actual exporter PGconn; no PRE, formal capture or promotion.

        Reuses repository argv, bounded process, environment writer and parser.
        Component-only metadata deliberately cannot be a full dispatch receipt.
        """
        run=self.run();proc=None;fd=None;name=None
        try:
            run.image_preflight();run.consume();run.guard(credentials=True)
            iid=uuid.uuid4().hex;name,argv=run.argv('ROLES',iid)
            _,fd=a._aux_parent(self.root,self.aid,iid,create=True)
            descriptor=dict(contract='OWNED_EXPORTER_COMPONENT_NOT_FULL_CAPTURE',argvSha256=sha(canonical(argv)))
            bindings=dict(acquisitionId=self.aid,invocationId=iid,dispatchSha256=sha(canonical(descriptor)),
                artifactLockSha256=sha(run.artifact_lock_raw),sourceTargetId=sha(canonical(self.target)),
                rolesGateRegistrySha256=a.ROLES_REGISTRY_SHA,argvSha256=descriptor['argvSha256'])
            a._write_producer_environment(fd,a.producer_environment(bindings))
            self.clients.add(name);self.client_owner_tokens[name]=run.owner_tokens[name]
            proc=a._Process(argv,time.monotonic()+90,a.BUDGETS['rolesBytesMaximum'],run.time_guard)
            rc,out,err=proc.finish();receipt=None
            if rc==0:
                raw,_=a.read_auxiliary_staging(self.root,self.aid,iid,'readonly.json',held_parent_fd=fd)
                receipt=a.validate_producer_receipt(raw,bindings)
            elif (self.root/'proof-staging'/self.aid/iid/'readonly.json').exists():
                # A failed TLS attempt cannot leave a successful measurement.
                raw=(self.root/'proof-staging'/self.aid/iid/'readonly.json').read_bytes()
                if raw:raise AssertionError('FAILED_COMPONENT_LEFT_MEASUREMENT')
            if run.dispatches or run.counter['measurementSessionAttempts']:
                raise AssertionError('COMPONENT_LANE_ACCIDENTAL_FULL_CAPTURE')
            return rc,out,err,receipt
        finally:
            if proc is not None:proc.close()
            if name is not None:self.remove_owned(name);self.clients.discard(name)
            if fd is not None:os.close(fd)
            run.unlock()

    def remove_owned(self,name):
        # A failed name collision must never delete someone else's container.
        p=subprocess.run(['docker','container','inspect',name],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=a.SAFE_ENV,timeout=15)
        if p.returncode:
            if b'No such object' in p.stderr or b'No such container' in p.stderr:return
            raise AssertionError('OWNED_CLEANUP_INSPECTION_UNAVAILABLE')
        rows=json.loads(p.stdout)
        if len(rows)!=1:raise AssertionError('OWNED_CLEANUP_IDENTITY_INVALID')
        row=rows[0];labels=row['Config'].get('Labels') or {}
        own=labels.get('uply.provenance-test')==self.network
        if name in self.client_owner_tokens:
            own=labels.get('uply.provenance-acquisition')==self.aid and labels.get('uply.provenance-owner')==self.client_owner_tokens[name]
        if not own or row['HostConfig']['NetworkMode']!=self.network:raise AssertionError('OWNED_CLEANUP_COLLISION')
        self.docker(['container','rm','-f','-v',row['Id']])

    def native_rows(self):
        raw=self.docker(['exec',self.backend_host,'cat','/tmp/session-log/session.json'])
        return [json.loads(x) for x in raw.splitlines() if x.strip()]

    def close(self):
        try:
            for name in list(getattr(self,'clients',())):self.remove_owned(name)
            if getattr(self,'pool_created',False):self.remove_owned(self.host);self.pool_created=False
            if getattr(self,'backend_host',None) and getattr(self,'created_source',False):
                self.remove_owned(self.backend_host);self.created_source=False
        finally:super().close()


def producer_bindings_fixture():
    """Independent synthetic metadata values, never actual dispatch IDs."""
    return dict(acquisitionId='a'*32,invocationId='b'*32,dispatchSha256='c'*64,artifactLockSha256='d'*64,
                sourceTargetId='e'*64,rolesGateRegistrySha256=a.ROLES_REGISTRY_SHA,argvSha256='f'*64)


def producer_receipt_fixture():
    value=schema_fixture('ProducerReceipt');value['bindings']=producer_bindings_fixture()
    value['measurement']['actualTextValues'][2]='123';value['measurement']['normalizedValues']['backendPid']=123
    return value


class ProvenanceAcquisitionSessionContract(UnitBase):
    """30 planned definitions. Synthetic seams test rejection, never promotion.

    P1/P2/N5/N6 create actual owned services and run repository code only when a
    separately authorized formal suite executes them. No skip or mock success.
    """
    def owned(self,**kw):
        # Remove UnitBase's unit seams before any runtime fixture exists.
        if self.f is not None:self.f.close();self.f=None
        source=OwnedSessionSource(**kw);self.addCleanup(source.close);return source

    def session_unit(self):
        f=ContextFixture(transport_kind='SESSION');self.addCleanup(f.close);return f

    def reject_file(self,fn):
        with self.assertRaises((Failure,OSError)):fn()

    def mutate_receipt(self,path,value):
        r=producer_receipt_fixture();node=r
        for key in path[:-1]:node=node[key]
        node[path[-1]]=value
        self.reject(lambda:a.validate_producer_receipt(canonical(r)+b'\n',producer_bindings_fixture()))

    def actual_roles_trace(self,source,proof):
        receipt=proof['rolesExporterProof']['measurementReceipt'];pid=receipt['measurement']['normalizedValues']['backendPid']
        rows=[r for r in source.native_rows() if r.get('pid')==pid and r.get('dbname')=='postgres']
        statements=[r.get('statement') or r.get('message','').removeprefix('statement: ') for r in rows]
        positions=[]
        for op in SESSION_SPEC['readonlyInitialization']['initializers']:
            exact=op['sql'].strip();hits=[i for i,x in enumerate(statements) if x.strip()==exact]
            self.assertEqual(len(hits),1,op['operationId']);positions.append(hits[0])
        gate=SESSION_SPEC['readonlyInitialization']['measurement']['sql'].strip()
        gates=[i for i,x in enumerate(statements) if x.strip()==gate];self.assertEqual(len(gates),1)
        self.assertEqual(positions,sorted(positions));self.assertLess(positions[-1],gates[0])
        catalog=[i for i,x in enumerate(statements) if 'pg_authid' in x and i>gates[0]]
        self.assertTrue(catalog,'actual catalog SQL must follow own gate on measured PID')
        self.assertEqual(receipt['toolOperationCounts']['logicalPgconnObjects'],1)
        return pid

    def test_SESSION_001_packaged_fresh_session_receipt(self):
        s=self.owned(pool_size=2);result=s.execute();self.assertEqual(result['status'],a.SUCCESS)
        directory=s.root/'acquisitions'/s.aid;report=a.validate_artifacts(directory,s.raw,fixture=True)
        self.assertEqual(report['observedCounters']['measurementSessionAttempts'],2)
        self.assertEqual(report['observedCounters']['rolesToolInvocationAttempts'],1)
        self.assertEqual(report['cleanup'],{'status':'PASS','ownedContainersRemaining':0})
        bundle=json.loads((directory/'transport-proofs.json').read_bytes());proof=bundle['records']['ROLES']['proof']
        pid=self.actual_roles_trace(s,proof);ep=proof['rolesExporterProof']
        raw,ref=a.read_auxiliary_staging(s.root,s.aid,proof['invocationId'],'readonly.json')
        env,eref=a.read_auxiliary_staging(s.root,s.aid,proof['invocationId'],'producer.env')
        self.assertEqual(ref,ep['measurementReceiptRef']);self.assertEqual(eref,ep['producerEnvironmentRef'])
        receipt=a.validate_producer_receipt(raw,ep['measurementReceipt']['bindings'])
        self.assertEqual(a.parse_producer_environment(env,receipt['bindings']),receipt['bindings'])
        self.assertEqual(receipt['measurement']['actualTextValues'][2],str(pid))
        self.assertEqual(ep['rawRolesSha256'],sha((directory/'roles.sql').read_bytes()))
        self.assertEqual(set(report['files']),{'pre.json','post.json','roles.sql','transport-proofs.json','profile-review.json'})
        for kind in ('PRE','POST'):
            p=bundle['records'][kind]['proof'];self.assertIs(p['backendObservedSsl'],True)
            self.assertEqual(p['transportKind'],'SESSION')
            observation_raw=json.loads((directory/(kind.lower()+'.json')).read_bytes())
            self.assertFalse(observation_raw['rawResponseAvailable'])
            own_pids=set()
            for qr in observation_raw['responses']:
                exact=a.QUERIES[qr['queryId']].strip();hits=[]
                for native in s.native_rows():
                    text=native.get('statement') or native.get('message','').removeprefix('statement: ')
                    if native.get('dbname')!='postgres' or text.strip()!=exact:continue
                    stamp=datetime.fromisoformat(native['timestamp'].replace(' UTC','+00:00')).timestamp()
                    if qr['startedAt']-.2<=stamp<=qr['completedAt']+.2:hits.append(native)
                self.assertTrue(hits,qr['queryId']);own_pids.update(x['pid'] for x in hits)
            self.assertEqual(len(own_pids),1)
            if kind=='PRE':self.assertNotIn(pid,own_pids)
        preproof=bundle['records']['PRE']['proof'];postproof=bundle['records']['POST']['proof']
        self.assertLessEqual(preproof['startedAt'],proof['startedAt'])
        self.assertLessEqual(proof['completedAt'],preproof['completedAt'])
        self.assertLessEqual(preproof['completedAt'],postproof['startedAt'])
        self.assertIs(ep['backendTlsObservation'],None);self.assertFalse(ep['fullSessionReadOnlyMeasured'])
        self.assertEqual(ep['physicalConnectionAttemptsStatus'],'NOT_OBSERVABLE')

    def test_SESSION_002_session_backend_reuse_reset(self):
        s=self.owned(pool_size=1)
        observe="SELECT pg_catalog.json_build_object('pid',pg_backend_pid(),'readonly',current_setting('default_transaction_read_only'),'path',current_setting('search_path'),'statement',current_setting('statement_timeout'),'lock',current_setting('lock_timeout'))::text;\n"
        before=s.ordinary(observe+"SET SESSION default_transaction_read_only=off; SET SESSION search_path=app; SET SESSION statement_timeout=99000; SET SESSION lock_timeout=99000;\n")
        self.assertEqual(before.returncode,0);baseline=json.loads(before.stdout.splitlines()[0])
        rc,roles,err,receipt=s.component();self.assertEqual(rc,0);self.assertTrue(roles);self.assertLessEqual(len(err),1048576)
        self.assertIsNotNone(receipt)
        pid=self.actual_roles_trace(s,{'rolesExporterProof':{'measurementReceipt':receipt}})
        self.assertEqual(pid,baseline['pid'],'new PID cannot prove warm backend reuse')
        after=s.ordinary(observe);self.assertEqual(after.returncode,0);restored=json.loads(after.stdout.splitlines()[0])
        self.assertEqual(restored['pid'],pid,'disconnect/new backend cannot pass reset')
        self.assertEqual(restored,baseline,'all contaminated GUCs must reset on same warm backend')
        self.assertTrue(b'CREATE ROLE postgres;' in roles,'ROLE_SQL_MISSING_BOOTSTRAP')
        self.assertFalse((s.root/'terminal'/(s.aid+'.json')).exists())

    def _check_SESSION_003_local_argv_conn_environment(self):
        f=self.session_unit();run=f.run();self.addCleanup(run.unlock);run.consume();run.credentials()
        _,argv=run.argv('ROLES','b'*32)
        ceilings=SESSION_SPEC['futureActualLocalValidationResources']['memoryCeilings']
        for kind in ('PRE','ROLES','POST'):
            _,limited=run.argv(kind,'b'*32)
            expected=ceilings['rolesRuntimeBytes' if kind=='ROLES' else 'stockPrePostClientBytes']
            self.assertEqual(limited.count('--memory'),1);self.assertEqual(limited[limited.index('--memory')+1],str(expected))
            self.assertLess(limited.index('--memory'),limited.index('--network'))
            self.assertLess(limited.index('--memory'),limited.index('--entrypoint'))
        direct=self.f.run();self.addCleanup(direct.unlock);direct.consume();direct.credentials()
        for kind in ('PRE','ROLES','POST'):self.assertNotIn('--memory',direct.argv(kind,'b'*32)[1])
        self.assertIn('--pull=never',argv);self.assertEqual(argv.count('--env-file'),1)
        self.assertEqual(argv[argv.index('--entrypoint')+1],a.EXPORTER_PREFIX+'/entrypoint-v1.sh')
        self.assertEqual(argv[-2:],['--roles-only','--no-role-passwords'])
        conn=argv[argv.index('-d')+1]
        self.assertEqual(len(re.findall(r"[a-z_]+='[^']*'",conn)),12)
        for text in ('hostaddr=','password=','service='):self.assertNotIn(text,conn)
        for key in ('port','user','host'):
            original=run.endpoint[key];run.endpoint[key]=6543 if key=='port' else 'caller override'
            self.reject(lambda:run.argv('ROLES','b'*32));run.endpoint[key]=original
        bindings=producer_bindings_fixture();raw=a.producer_environment(bindings)
        self.assertEqual(len(raw),618);self.assertLessEqual(len(raw),1024)
        for suffix in (b'PGHOST=caller\n',b'LD_PRELOAD=caller\n',raw.splitlines(keepends=True)[0],b'--help\n'):
            self.reject(lambda:a.parse_producer_environment(raw+suffix,bindings))
        for bad in (raw.replace(b'=',b'="',1),raw.replace(b'\n',b'\r\n'),raw[::-1],b'x'*1025):
            self.reject(lambda:a.parse_producer_environment(bad,bindings))
        host='aws-0-unit.pooler.supabase.com';project='a'*20;user='postgres.'+project
        self.reject(lambda:a.session_target(sha(canonical(host)),sha(canonical(user)),sha(run.artifact_lock_raw),
            run.artifact_lock['outputs']['runtimeImageId'],project_sha=sha(canonical(project))), 'ACQUISITION_ARTIFACT_INVALID')
        return f,run

    def test_SESSION_003_reject_argv_conn_environment_overrides(self):
        f,run=self._check_SESSION_003_local_argv_conn_environment()
        # An isolated production-shaped argv input grants no authority and does
        # not read credentials or start a client. Its fixed domain stays strict.
        # User-supplied nonsecret identity values are for offline argv only.
        production=copy.copy(run);host='aws-1-ap-northeast-2.pooler.supabase.com';project='jubdbsjsalpecfvseskz';user='postgres.'+project
        target=a.session_target(sha(canonical(host)),sha(canonical(user)),sha(run.artifact_lock_raw),
            run.artifact_lock['outputs']['runtimeImageId'],project_sha=sha(canonical(project)))
        production.ctx=a._Context(f.root,f.creds,target,{},False,'host','','SESSION')
        production.endpoint=dict(host=host,user=user,port=5432)
        for kind in ('PRE','ROLES','POST'):self.assertNotIn('--memory',production.argv(kind,'b'*32)[1])

    def test_SESSION_004_reject_initializer_measurement_status_shape_values(self):
        r=producer_receipt_fixture();a.validate_producer_receipt(canonical(r)+b'\n',r['bindings'])
        for i in range(3):
            for key,bad in [('sqlRawSha256','0'*64),('resultStatus','PGRES_FATAL_ERROR'),('commandTag','SELECT'),
                            ('connectionStatus','CONNECTION_BAD'),('transactionStatus','PQTRANS_INTRANS')]:
                self.mutate_receipt(('initializerResults',i,key),bad)
        for key,value in [('rowCount',0),('columnCount',10),('resultStatus','PGRES_COMMAND_OK'),
                          ('typeOids',[19]+[25]*10),('formats',[1]+[0]*10),('isNull',[True]+[False]*10),
                          ('queryRawSha256','0'*64),('transactionStatus','PQTRANS_INERROR')]:
            self.mutate_receipt(('measurement',key),value)
        for i,bad in enumerate(['off','off','001','170005','template1','other','other','SQL_ASCII','SQL_ASCII','0','0']):
            self.mutate_receipt(('measurement','actualTextValues',i),bad)
        for pid in ('0','+123','123 ','2147483648','12345678901'):
            self.mutate_receipt(('measurement','actualTextValues',2),pid)
        self.mutate_receipt(('measurement','normalizedValues','backendPid'),124)
        self.mutate_receipt(('measurement','normalizedValues','backendPid'),True)

    def test_SESSION_005_reject_receipt_channel_identity_binding(self):
        f=self.session_unit();aid='a'*32;iid='b'*32;parent=f.root/'proof-staging'/aid/iid
        parent.mkdir(mode=0o700,parents=True);(parent.parent).chmod(0o700);(parent.parent.parent).chmod(0o700)
        raw=canonical(producer_receipt_fixture())+b'\n';p=parent/'readonly.json';p.write_bytes(raw);p.chmod(0o600)
        got,ref=a.read_auxiliary_staging(f.root,aid,iid,'readonly.json');self.assertEqual(got,raw)
        self.assertEqual(ref['bytes'],len(raw));self.assertEqual(ref['sha256'],sha(raw))
        for mode in (0o644,0o400):
            p.chmod(mode);self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,'readonly.json'))
        p.chmod(0o600);os.link(p,parent/'hardlink');self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,'readonly.json'));(parent/'hardlink').unlink()
        p.unlink();p.symlink_to(parent/'missing');self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,'readonly.json'));p.unlink()
        p.write_bytes(raw);p.chmod(0o600)
        for bad in (b'',raw[:-2],raw+b' ',b'x'*8193,raw.replace(b'"schemaVersion":1',b'"schemaVersion":1,"schemaVersion":1'),
                    raw.replace(b'"schemaVersion":1',b'"schemaVersion":1.0')):
            self.reject(lambda:a.validate_producer_receipt(bad,producer_bindings_fixture()))
        for key in producer_bindings_fixture():
            b=producer_bindings_fixture();b[key]='0'*len(b[key]);self.reject(lambda:a.validate_producer_receipt(raw,b))
        for name in ('../readonly.json','other.json','producer.env/readonly.json'):
            self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,name))
        # Replacement between same-FD reads is rejected even for identical bytes.
        real=a.os.fstat;calls=[]
        def changed(fd):
            result=real(fd);calls.append(fd)
            if len(calls)>1:return os.stat_result(tuple(result[:1])+(result.st_ino+1,)+tuple(result[2:]))
            return result
        with patch.object(a.os,'fstat',side_effect=changed):
            self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,'readonly.json'))

        env=a.producer_environment(producer_bindings_fixture());fd=os.open(parent,os.O_RDONLY|os.O_DIRECTORY)
        try:
            real_open=a.os.open
            with patch.object(a.os,'open',wraps=real_open) as opened,patch.object(a.os,'read',wraps=a.os.read) as readback:
                a._write_producer_environment(fd,env)
            call=next(x for x in opened.call_args_list if x.args[0]=='producer.env')
            flags=call.args[1];self.assertEqual(flags & os.O_ACCMODE,os.O_RDWR)
            for flag in (os.O_CREAT,os.O_EXCL,os.O_NOFOLLOW,os.O_CLOEXEC):self.assertEqual(flags & flag,flag)
            self.assertTrue(readback.called);self.assertEqual((parent/'producer.env').stat().st_mode & 0o777,0o600)
            self.reject_file(lambda:a._write_producer_environment(fd,env))
        finally:os.close(fd)

    def test_SESSION_006_reject_execution_output_terminal_mismatch(self):
        path=synthetic_success(self.f);a.validate_artifacts(path,self.f.raw,fixture=True)
        for name in ('roles.sql','transport-proofs.json','acquisition.json'):
            p=path/name;original=p.read_bytes();p.write_bytes(original[:-1]);self.reject(lambda:a.validate_artifacts(path,self.f.raw,fixture=True));p.write_bytes(original)
        bundle=json.loads((path/'transport-proofs.json').read_bytes());record=bundle['records']['ROLES']
        record['proof']['outputSha256']='0'*64;record['canonicalProofSha256']=sha(canonical(record['proof']))
        pre=json.loads((path/'pre.json').read_bytes());post=json.loads((path/'post.json').read_bytes());review=json.loads((path/'profile-review.json').read_bytes())
        self.reject(lambda:a.validate_payloads(pre,post,(path/'roles.sql').read_bytes(),bundle,review,self.f.auth,self.f.digest,True))
        terminal=self.f.root/'terminal'/(self.f.aid+'.json');original=terminal.read_bytes();v=json.loads(original)
        for key,value in [('status',a.FAILED),('cleanupStatus','FAILED'),('consumedSha256','0'*64)]:
            bad=copy.deepcopy(v);bad[key]=value;terminal.write_bytes(canonical(bad));self.reject(lambda:a.validate_artifacts(path,self.f.raw,fixture=True))
        terminal.write_bytes(original)
        for key,value in [('returnCode',1),('truncated',True),('rawRolesBytes',True)]:
            proof=schema_fixture('RolesExporterProof');proof[key]=value;self.reject(lambda:a.schema_validate(proof,'RolesExporterProof'))

        f=self.session_unit();run=f.run();self.addCleanup(run.unlock);run.consume();run.credentials()
        for result in ((1,b'partial',b'UNIT_DIAGNOSTIC'),(0,b'',b'')):
            proc=Mock();proc.finish.return_value=result
            with patch.object(run,'dispatch',return_value=(proc,{},None,time.time())):
                self.reject(run.roles,'ACQUISITION_ROLE_EXPORT_FAILED')
            self.assertNotIn('ROLES',run.records);self.assertFalse((run.attempt/'roles.sql').exists())

    def test_SESSION_007_reject_frontend_tls_ca_hostname_plaintext(self):
        for fault in ('ca','hostname'):
            with self.subTest(actualFrontendFault=fault):
                s=self.owned(frontend_fault=fault);rc,out,err,receipt=s.component()
                self.assertNotEqual(rc,0);self.assertTrue(not out,'TLS_FAILURE_MUST_HAVE_EMPTY_SQL_STDOUT');self.assertIsNone(receipt)
                self.assertTrue(err);self.assertFalse((s.root/'terminal'/(s.aid+'.json')).exists());s.close()
        s=self.owned();p=s.ordinary('SELECT 1;\n',plaintext=True)
        self.assertNotEqual(p.returncode,0);self.assertTrue(not p.stdout,'PLAINTEXT_MUST_HAVE_EMPTY_STDOUT')

    def _check_SESSION_008_observation_tls_and_proof(self):
        for phase in ('PRE','POST'):
            obs=observation(synthetic_values(),phase=phase)
            a._validate_observation(obs,phase,obs['sourceTargetId'],obs['acquisitionId'])
            for value in (False,'unavailable',None):
                values=synthetic_values();values['backendTlsObservation']=value
                obs=observation(values,phase=phase)
                self.reject(lambda:a._validate_observation(obs,phase,obs['sourceTargetId'],obs['acquisitionId']), 'ACQUISITION_CLIENT_TLS')
        p=schema_fixture('RolesExporterProof');self.assertIs(p['backendTlsObservation'],None)
        self.assertEqual(p['backendTlsObservationStatus'],'NOT_OBSERVABLE_BY_FIXED_GATE')
        p['backendTlsObservation']=True;self.reject(lambda:a.schema_validate(p,'RolesExporterProof'))

    def test_SESSION_008_reject_upstream_tls_ca_hostname_route(self):
        self._check_SESSION_008_observation_tls_and_proof()
        for fault in ('ca','hostname','route'):
            with self.subTest(actualUpstreamFault=fault):
                s=self.owned(upstream_fault=fault);rc,out,err,receipt=s.component()
                self.assertNotEqual(rc,0);self.assertTrue(not out,'TLS_FAILURE_MUST_HAVE_EMPTY_SQL_STDOUT');self.assertIsNone(receipt);self.assertTrue(err)
                self.assertFalse((s.root/'terminal'/(s.aid+'.json')).exists());s.close()

    def test_SESSION_009_reject_backend_version_identity_encoding_mode(self):
        f=self.session_unit();target=f.target;a.validate_session_target(target,fixture=True)
        for key,value in [('serverVersionNum',170005),('database','other'),('role','other'),('currentRole','other'),
                          ('serverEncoding','SQL_ASCII'),('clientEncoding','SQL_ASCII'),('poolMode','TRANSACTION'),
                          ('port',6543),('schemaVersion',True),('fixture',1)]:
            self.reject(lambda:a.validate_session_target(dict(target,**{key:value}),fixture=True))
        for key,value in [('serverVersionNum',170005),('serverEncoding','SQL_ASCII'),('session_user','other')]:
            boot=synthetic_values()['bootstrapIdentity'];boot[key]=value;self.reject(lambda:a.validate_session_bootstrap(boot))

    def test_SESSION_010_reject_package_dependency_or_public_secret_leak(self):
        lock=unit_artifact_lock();a.validate_artifact_lock(lock)
        for name in ('exporter','companion','launcher'):
            bad=copy.deepcopy(lock);bad['outputs'][name]['path']+='/../caller';self.reject(lambda:a.validate_artifact_lock(bad))
            bad=copy.deepcopy(lock);bad['outputs'][name]['bytes']=True;self.reject(lambda:a.validate_artifact_lock(bad))
        bad=copy.deepcopy(lock);bad['outputs']['libpq']['soname']='libpq.so.4';self.reject(lambda:a.validate_artifact_lock(bad))
        deps=lock['outputs']['runtimeDependencies']
        for altered in (deps+deps,[dict(deps[0],name='b.so'),dict(deps[0],name='a.so')],deps*65):
            bad=copy.deepcopy(lock);bad['outputs']['runtimeDependencies']=altered;self.reject(lambda:a.validate_artifact_lock(bad))
        # R1 F1: private inspection records must bind actual admitted locations,
        # resolved files and bytes. These are synthetic protocol inputs, not ELF
        # observations or a BUILT artifact. Runtime bodies use actual preflight.
        outputs=copy.deepcopy(lock['outputs']);pq=outputs['libpq']
        pq.update(path=a.EXPORTER_PREFIX+'/lib/libpq.so.5.17',bytes=71,sha256=sha(b'UNIT_LIBPQ_BYTES_NOT_RUNTIME'))
        outputs['runtimeDependencies']=[
            dict(name='ld-linux-x86-64.so.2',bytes=13,sha256=sha(b'UNIT_LOADER_BYTES_NOT_RUNTIME')),
            dict(name='libc.so.6',bytes=17,sha256=sha(b'UNIT_LIBC_BYTES_NOT_RUNTIME')),
            dict(name='libpq.so.5',bytes=pq['bytes'],sha256=pq['sha256'])]
        records=[]
        for dep in outputs['runtimeDependencies']:
            path='/lib64/ld-linux-x86-64.so.2' if dep['name']=='ld-linux-x86-64.so.2' else a.EXPORTER_PREFIX+'/lib/'+dep['name']
            resolved=pq['path'] if dep['name']=='libpq.so.5' else path
            records.append(dict(dep,path=path,resolvedPath=resolved))
        loaded=[record['path'] for record in records]
        self.assertEqual(a.validate_runtime_loader_binding(outputs,loaded,records),records)
        for index,path in [(1,'/usr/lib/x86_64-linux-gnu/libc.so.6'),
                           (1,a.EXPORTER_PREFIX+'/lib/subdirectory/libc.so.6'),
                           (0,a.EXPORTER_PREFIX+'/lib/ld-linux-x86-64.so.2')]:
            with self.subTest(sameNameLoadedAt=path):
                paths=loaded[:];paths[index]=path;bad=copy.deepcopy(records);bad[index]['path']=path
                bad[index]['resolvedPath']=path
                self.reject(lambda:a.validate_runtime_loader_binding(outputs,paths,bad))
        for index,key,value in [(1,'bytes',18),(1,'sha256','0'*64),
                               (2,'resolvedPath',a.EXPORTER_PREFIX+'/lib/other-libpq.so.5.17'),
                               (2,'bytes',72),(2,'sha256','0'*64),(2,'bytes',True),
                               (0,'resolvedPath','/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2')]:
            bad=copy.deepcopy(records);bad[index][key]=value
            self.reject(lambda:a.validate_runtime_loader_binding(outputs,loaded,bad))
        for changed in (records[:-1],records+[copy.deepcopy(records[-1])],list(reversed(records))):
            self.reject(lambda:a.validate_runtime_loader_binding(outputs,loaded,changed))
        # Repeated ldd paths across different tools are observations of the
        # same admitted file; the dependency/metadata inventories stay unique.
        self.assertEqual(a.validate_runtime_loader_binding(outputs,loaded+loaded[-1:],records),records)
        for changed in (loaded[:-1],loaded+['/usr/lib/caller.so']):
            self.reject(lambda:a.validate_runtime_loader_binding(outputs,changed,records))
        for key,value in [('bytes',72),('sha256','0'*64)]:
            bad=copy.deepcopy(outputs);bad['libpq'][key]=value
            self.reject(lambda:a.validate_runtime_loader_binding(bad,loaded,records))
        # Complete-looking metadata cannot compensate for omitted/wrong/duplicate
        # libpq in the candidate dependency inventory.
        for kind in ('missing','wrong','duplicate'):
            bad=copy.deepcopy(outputs);bad_records=copy.deepcopy(records);bad_loaded=loaded[:]
            if kind=='missing':
                bad['runtimeDependencies'].pop();bad_records.pop();bad_loaded.pop()
            elif kind=='wrong':bad['runtimeDependencies'][-1]['sha256']='0'*64
            else:bad['runtimeDependencies'].append(copy.deepcopy(bad['runtimeDependencies'][-1]))
            self.reject(lambda:a.validate_runtime_loader_binding(bad,bad_loaded,bad_records))
        # R2: the frozen ASCII name domain allows these leading characters;
        # assert it through both the closure join and private inspection parser.
        valid_names=('_libunit.so','.libunit.so','-libunit.so','+libunit.so','a','a'*127)
        invalid_names=('.','..','a'*128,'','bad/name','bad name','bad:name','bad\\name','bäd','bad\nname')
        for name in valid_names:
            with self.subTest(admittedDependencyName=name):
                dep=dict(name=name,bytes=19,sha256=sha(b'UNIT_NAME_BYTES_NOT_RUNTIME'))
                path=a.EXPORTER_PREFIX+'/lib/'+name;record=dict(dep,path=path,resolvedPath=path)
                named=copy.deepcopy(outputs);named['runtimeDependencies'].append(dep)
                named['runtimeDependencies'].sort(key=lambda item:item['name'])
                named_records=sorted(records+[record],key=lambda item:item['name'])
                self.assertEqual(a.validate_runtime_loader_binding(named,loaded+[path],named_records),named_records)
                wire=(name+' => '+path+' (0x1)\nUPLY_RUNTIME_FILE='+name+'\n'+path+'\n19\n'+dep['sha256']+'  '+path+'\n').encode('ascii')
                self.assertEqual(a.parse_runtime_loader_inspection(wire),([path],[record]))
        for name in invalid_names:
            with self.subTest(rejectedDependencyName=name):
                dep=dict(name=name,bytes=19,sha256=sha(b'UNIT_NAME_BYTES_NOT_RUNTIME'))
                path=a.EXPORTER_PREFIX+'/lib/'+name;record=dict(dep,path=path,resolvedPath=path)
                named=copy.deepcopy(outputs);named['runtimeDependencies'].append(dep)
                named['runtimeDependencies'].sort(key=lambda item:item['name'])
                named_records=sorted(records+[record],key=lambda item:item['name'])
                self.reject(lambda:a.validate_runtime_loader_binding(named,loaded+[path],named_records))
                self.reject(lambda:a.parse_runtime_loader_inspection((name+' => '+path+' (0x1)\n').encode('utf-8')))
                metadata=('UPLY_RUNTIME_FILE='+name+'\n'+path+'\n19\n'+dep['sha256']+'  '+path+'\n').encode('utf-8')
                self.reject(lambda:a.parse_runtime_loader_inspection(metadata))
        sentinel='UNIT_SECRET_'+uuid.uuid4().hex
        failure=Failure('ACQUISITION_FAILED',sentinel)
        self.assertNotIn(sentinel,a._failure_code(failure))

    def test_SESSION_011_closed_profile_transport_target_intent(self):
        f=self.session_unit();intent=f.auth['bindings']['acquisitionIntent'];self.assertEqual(a.validate_session_intent(intent,fixture=True),f.target)
        for family,name in [(f.target,'OwnedSessionTarget'),(intent,'SessionIntent')]:
            for key in family:
                bad=copy.deepcopy(family);del bad[key];self.reject(lambda:a.schema_validate(bad,name))
            for key,value in [('extra',1),('schemaVersion',True),('schemaVersion',1.0)]:
                self.reject(lambda:a.schema_validate(dict(family,**{key:value}),name))
        for key in ('sourceTargetId','sessionProfileSha256','transportPolicySha256'):
            bad=copy.deepcopy(intent);bad[key]='0'*64;self.reject(lambda:a.validate_session_intent(bad,fixture=True))

    def test_SESSION_012_tagged_current_auth_v3_versions(self):
        for f in (self.f,self.session_unit()):
            f.validate();self.assertEqual(f.auth['schemaVersion'],3);self.assertEqual(f.human['schemaVersion'],3)
            a.schema_validate(f.auth['bindings'],'ApprovalBindings3')
            for family in ('auth','human'):
                original=copy.deepcopy(getattr(f,family))
                for version in (1,2,True,3.0):
                    bad=copy.deepcopy(original);bad['schemaVersion']=version;bad['contract']=original['contract'].rsplit('/',1)[0]+'/'+str(version)
                    setattr(f,family,bad);f.persist();self.reject(f.validate)
                setattr(f,family,original);f.persist()
            bad=copy.deepcopy(f.auth);bad['bindings']['transportKind']='DIRECT' if f.transport_kind=='SESSION' else 'SESSION'
            self.reject(lambda:a.validate_bindings(bad,fixture=True))

    def test_SESSION_013_explicit_historical_v2_no_current_eligibility(self):
        f=self.f;old=copy.deepcopy(f.auth);old.update(contract='source-provenance-authorization/2',schemaVersion=2)
        # A current-shape object with an old tag is invalid even offline.
        self.reject(lambda:a.validate_historical_authorization(old,offline=True))
        self.reject(lambda:a.validate_historical_authorization(old))
        # Deliberate offline synthetic history uses the exact historical fieldset.
        # It remains in memory and cannot grant current acquisition eligibility.
        fields=a.DIRECT_SCHEMAS['ApprovalBindings/2']['requiredFields']
        history=copy.deepcopy(f.auth);history.update(contract='source-provenance-authorization/2',schemaVersion=2)
        available=dict(f.auth['bindings'],forwardDesignSha256=a.FORWARD_DESIGN_SHA)
        history['bindings']={k:copy.deepcopy(available[k]) for k in fields}
        history['bindings']['acquisitionSourceHashes']={k:v for k,v in available['acquisitionSourceHashes'].items() if '/roles_exporter/' not in k}
        history['bindings']['acquisitionSourceDigest']=sha(canonical(history['bindings']['acquisitionSourceHashes']))
        self.assertEqual(a.validate_historical_authorization(history,offline=True),history)
        self.reject(lambda:a._validate_authorization_envelope(history,fixture=True))
        for version in (1,2):
            self.reject(lambda:a.validate_validation_evidence({'contract':'source-provenance-acquisition-fresh-validation/'+str(version)},'0'*64,'1'*64))
        self.assertEqual(a.FIELDS['source-provenance-consumed/1'],frozenset(SESSION_SPEC['retainedLifecycleSchemas']['source-provenance-consumed/1']['requiredFields']))

    def test_SESSION_014_source_context_artifact_hash_closure(self):
        leaf,imp,v,package,sources,context=synthetic_admission_bundle();check_synthetic_admission_bundle(leaf,imp,v,package,sources,context)
        self.assertEqual(len(sources),17);self.assertEqual(len(context),2)
        self.assertEqual(set(sources),set(SESSION_SPEC['sourceClosurePolicy']['futurePaths']))
        for family in ('acquisitionSourceHashes','validationContextHashes'):
            for key in imp[family]:
                bad=copy.deepcopy(imp);bad[family][key]='0'*64;self.reject(lambda:check_synthetic_admission_bundle(leaf,bad,v,package,sources,context))
        bad=copy.deepcopy(leaf);bad['artifactLockRef']['sha256']='0'*64;self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,package,sources,context))
        with patch.object(a,'load_artifact_lock',side_effect=Failure('ACQUISITION_FAILED','ACQUISITION_IMAGE_UNAVAILABLE')):
            self.reject(lambda:a.production_context('a'*32,'b'*64,transport_kind='SESSION'))

    def test_SESSION_015_pre_post_profile_gate_no_repair(self):
        f=self.session_unit();run=f.run();self.addCleanup(run.unlock)
        for kind in ('PRE','POST'):
            proc=DirectGateProcess({'transactionReadOnly':'off','defaultTransactionReadOnly':'off','transactionIsolation':'repeatable read'})
            with patch.object(run,'dispatch',return_value=(proc,{},None,time.time())):
                session=a._ReadonlySession(run,kind)
                self.reject(lambda:session.query('sessionReadOnly'),'ACQUISITION_READONLY_REQUIRED')
            # SESSION's declared initializer is legitimate; no second repair attempt.
            self.assertLessEqual(sum(b'default_transaction_read_only' in x and b'SET SESSION' in x for x in proc.sent),1)

    def test_SESSION_016_direct_profile_semantics_preserved(self):
        self.assertEqual(a.validate_direct_profile(a.DIRECT_PROFILE,a.DIRECT_TRANSPORT),(a.DIRECT_PROFILE_SHA,a.DIRECT_TRANSPORT_SHA))
        self.assertEqual(a.direct_target(sha(canonical(self.f.host)),fixture=True,project_sha=sha(b'LOCAL_SYNTHETIC_ONLY')),self.f.target)
        self.assertEqual(a.DIRECT_TRANSPORT['port'],5432)
        run=self.f.run();self.addCleanup(run.unlock);run.consume();run.credentials()
        for kind in ('PRE','ROLES','POST'):
            _,argv=run.argv(kind,'a'*32);self.assertIn('PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000',argv)
            self.assertNotIn('--env-file',argv);self.assertIn(a.IMAGE,argv)
        responses=observation(synthetic_values('SQL_ASCII'))['responses'];a.source_profile(responses)
        self.assertEqual(next(r for r in responses if r['queryId']=='bootstrapIdentity')['canonicalResponse']['serverEncoding'],'SQL_ASCII')

    def test_SESSION_017_claim_consumption_replay_crash_lock(self):
        f=self.session_unit();run=f.run();contender=f.run();run.consume();self.addCleanup(run.unlock)
        self.addCleanup(contender.unlock);self.reject(contender.consume,'ACQUISITION_BUSY')
        run.unlock();self.reject(lambda:f.run(),'ACQUISITION_REPLAY')
        consumed=json.loads((f.root/'consumed'/(f.aid+'.json')).read_bytes())
        self.assertEqual(consumed['contract'],'source-provenance-consumed/1');self.assertEqual(len(consumed['claimRefs']),4)
        self.assertFalse((f.root/'terminal'/(f.aid+'.json')).exists())

    def test_SESSION_018_receipt_proof_v3_sidecar_binding(self):
        receipt=producer_receipt_fixture();bindings=producer_bindings_fixture();raw=canonical(receipt)+b'\n'
        self.assertEqual(a.validate_producer_receipt(raw,bindings),receipt)
        ep=schema_fixture('RolesExporterProof');ep.update(measurementReceipt=receipt,measurementReceiptRawSha256=sha(raw),
            measurementReceiptCanonicalSha256=sha(canonical(receipt)),producerEnvironmentRawSha256=sha(a.producer_environment(bindings)))
        a.schema_validate(ep,'RolesExporterProof')
        for key,value in [('backendTlsObservation',True),('fullSessionReadOnlyMeasured',True),('physicalConnectionAttempts',1),
                          ('logicalPgconnObjects',True),('controllerRetries',1),('measurementPoint','WHOLE_SESSION')]:
            self.reject(lambda:a.schema_validate(dict(ep,**{key:value}),'RolesExporterProof'))
        self.mutate_receipt(('rawResponseAvailable',),True);self.mutate_receipt(('rawResponseSha256',),'0'*64)

    def test_SESSION_019_retained_six_payload_inventory_join(self):
        f=self.session_unit();path=synthetic_success(f);self.assertEqual({p.name for p in path.iterdir()},
            {'pre.json','post.json','roles.sql','transport-proofs.json','profile-review.json','acquisition.json'})
        (path/'readonly.json').write_bytes(canonical(producer_receipt_fixture()))
        self.reject(lambda:a.validate_artifacts(path,f.raw,fixture=True));(path/'readonly.json').unlink()
        (path/'producer.env').write_bytes(a.producer_environment(producer_bindings_fixture()))
        self.reject(lambda:a.validate_artifacts(path,f.raw,fixture=True))

    def test_SESSION_020_success_artifact_reader_receipt_revalidation(self):
        f=self.session_unit();path=synthetic_success(f);a.validate_artifacts(path,f.raw,fixture=True)
        bundle=json.loads((path/'transport-proofs.json').read_bytes());proof=bundle['records']['ROLES']['proof']
        self.assertEqual(proof['schemaVersion'],3);ep=proof['rolesExporterProof']
        receipt_path=f.root/ep['measurementReceiptRef']['path'];raw=receipt_path.read_bytes()
        receipt=json.loads(raw);receipt['measurement']['normalizedValues']['backendPid']=124
        receipt_path.write_bytes(canonical(receipt)+b'\n')
        self.reject(lambda:a.validate_artifacts(path,f.raw,fixture=True));receipt_path.write_bytes(raw)
        env_path=f.root/ep['producerEnvironmentRef']['path'];env=env_path.read_bytes();env_path.write_bytes(env+b'PGHOST=caller\n')
        self.reject(lambda:a.validate_artifacts(path,f.raw,fixture=True));env_path.write_bytes(env)
        # Rebind public bundle/file hashes to bypass superficial file rejection;
        # semantic receipt->dispatch->argv binding must still reject.
        bad=copy.deepcopy(bundle);record=bad['records']['ROLES'];extra=record['proof']['rolesExporterProof']
        extra['measurementReceipt']['bindings']['argvSha256']='0'*64
        extra['measurementReceiptCanonicalSha256']=sha(canonical(extra['measurementReceipt']))
        record['canonicalProofSha256']=sha(canonical(record['proof']))
        pre=json.loads((path/'pre.json').read_bytes());post=json.loads((path/'post.json').read_bytes())
        review=json.loads((path/'profile-review.json').read_bytes())
        self.reject(lambda:a.validate_payloads(pre,post,(path/'roles.sql').read_bytes(),bad,review,f.auth,f.digest,True))

    def test_SESSION_021_completion_v4_fresh_validation_v3_admission(self):
        bundle=synthetic_admission_bundle();check_synthetic_admission_bundle(*bundle)
        leaf,imp,v,p,s,c=bundle;self.assertEqual((leaf['schemaVersion'],v['schemaVersion']),(4,3))
        for tag in (1,2,3,True,4.0):
            bad=copy.deepcopy(leaf);bad['schemaVersion']=tag;self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,p,s,c))
        for key in ('buildEvidenceRef','artifactLockRef','validationEvidenceRef'):
            bad=copy.deepcopy(leaf);bad[key]['path']='latest.json';self.reject(lambda:check_synthetic_admission_bundle(bad,imp,v,p,s,c))
        self.reject(lambda:a._validate_admission_bundle(leaf,canonical(imp),canonical(v),p,s,c))

    def test_SESSION_022_validation_exact_order_receipts_counts(self):
        phases=a.expected_selections();self.assertEqual(phases,SESSION_SPEC['validationPlan']['exactPhases'])
        self.assertEqual(sha(canonical(phases)),'57e26012c7d73c0f9166f4e409ec78c37f7e8ef4c9e6691448989f6baf10340d')
        self.assertEqual((sum(len(x['testIds']) for x in phases),len({t for x in phases for t in x['testIds']})),(915,613))
        self.assertEqual(phases[:8],a.FORWARD_DESIGN['VALIDATION PLAN']['exactPhases'])
        leaf,imp,v,p,s,c=synthetic_admission_bundle()
        for alter in ('reverse','duplicate','omit','skip','notrun','digest'):
            bad=copy.deepcopy(v);phase=bad['phases'][-1]
            if alter=='reverse':phase['results'].reverse()
            elif alter=='duplicate':phase['results'][1]=copy.deepcopy(phase['results'][0])
            elif alter=='omit':phase['results'].pop()
            elif alter in ('skip','notrun'):phase['results'][0]['result']='SKIP' if alter=='skip' else 'NOT_RUN'
            else:phase['stderrSha256']='0'*64
            self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,bad,p,s,c))

    def test_SESSION_023_helper_package_manifest_closed_schema(self):
        lock=unit_artifact_lock();a.validate_artifact_lock(lock)
        unbuilt=copy.deepcopy(lock);unbuilt.update(status='UNBUILT',outputs=None)
        a.validate_artifact_lock(unbuilt,require_built=False);self.reject(lambda:a.validate_artifact_lock(unbuilt))
        for bad in (dict(unbuilt,outputs=lock['outputs']),dict(lock,outputs=None),dict(lock,selfSha256='0'*64)):
            self.reject(lambda:a.validate_artifact_lock(bad,require_built=False))
        for key in lock:
            bad=copy.deepcopy(lock);del bad[key];self.reject(lambda:a.validate_artifact_lock(bad))
        for name in ('BuildRecipe','ReceiptContractFile'):
            for key in SESSION_SPEC['contractSchemas']['$defs'][name]['required']:
                value=schema_fixture(name);del value[key];self.reject(lambda:a.schema_validate(value,name))

        # Recipe R1: libpq is part of the staged inventory itself. The audit's
        # existing pure parser rejects incomplete candidates instead of adding it.
        recipe=json.loads((a.ARTIFACT_LOCK_PATH.parent/'build-recipe-v1.json').read_bytes())
        a.schema_validate(recipe,'BuildRecipe')
        stage=next(step for step in recipe['steps'] if step['stepId']=='STAGE_ELF_DEPENDENCY_CANDIDATE')
        audit=next(step for step in recipe['steps'] if step['stepId']=='VERIFY_CANDIDATE_RUNTIME_LOADER_ABI_AND_BYTES')
        stage_tree=ast.parse(stage['argv'][3]);audit_tree=ast.parse(audit['argv'][3])
        deps=next(node.value for node in stage_tree.body if isinstance(node,ast.Assign) and
            any(isinstance(target,ast.Name) and target.id=='deps' for target in node.targets))
        self.assertIsInstance(deps,ast.Dict)
        self.assertIn('libpq.so.5',[key.value for key in deps.keys if isinstance(key,ast.Constant)])
        for node in ast.walk(audit_tree):
            if isinstance(node,ast.Assign):
                for target in node.targets:
                    if isinstance(target,ast.Subscript) and isinstance(target.value,ast.Name) and target.value.id=='expected':
                        self.assertNotEqual(ast.literal_eval(target.slice),'libpq.so.5','audit must not silently supplement libpq')
        functions=[node for node in audit_tree.body if isinstance(node,ast.FunctionDef) and node.name=='candidate_dependencies']
        self.assertEqual(len(functions),1);function=functions[0]
        # Extract only this actual repository pure function, never the stage,
        # audit Docker subprocesses or other build-recipe top-level statements.
        permitted={'SystemExit','type','len','set','sorted','names.append','re.fullmatch','n.encode'}
        for node in ast.walk(function):
            self.assertNotIsInstance(node,(ast.Import,ast.ImportFrom,ast.Global,ast.Nonlocal))
            if isinstance(node,ast.Call):self.assertIn(ast.unparse(node.func),permitted)
        namespace={'re':re};exec(compile(ast.Module(body=[function],type_ignores=[]),'candidate_dependencies-pure-test','exec'),namespace)
        parser=namespace['candidate_dependencies'];pq=lock['outputs']['libpq']
        candidate=[dict(item,path=a.EXPORTER_PREFIX+'/lib/'+item['name']) for item in lock['outputs']['runtimeDependencies']]
        self.assertEqual(parser(candidate,a.EXPORTER_PREFIX,pq['bytes'],pq['sha256']),{item['name']:item for item in candidate})
        malformed=[[],candidate[:-1],candidate+[copy.deepcopy(candidate[-1])],list(reversed(candidate)),candidate*33]
        for key,value in [('path','/usr/lib/libpq.so.5'),('bytes',True),('bytes',pq['bytes']+1),
                          ('sha256','0'*64),('extra',True),('name','..')]:
            bad=copy.deepcopy(candidate);bad[-1][key]=value;malformed.append(bad)
        for bad in malformed:
            with self.assertRaises(SystemExit):parser(bad,a.EXPORTER_PREFIX,pq['bytes'],pq['sha256'])
        # R2: use the same frozen name boundaries in the actual recipe parser.
        for name in ('_libunit.so','.libunit.so','-libunit.so','+libunit.so','a','a'*127):
            dep=dict(name=name,path=a.EXPORTER_PREFIX+'/lib/'+name,bytes=19,sha256=sha(b'UNIT_NAME_BYTES_NOT_RUNTIME'))
            named=sorted(candidate+[dep],key=lambda item:item['name'])
            self.assertEqual(parser(named,a.EXPORTER_PREFIX,pq['bytes'],pq['sha256']),{item['name']:item for item in named})
        for name in ('.','..','a'*128,'','bad/name','bad name','bad:name','bad\\name','bäd','bad\nname'):
            dep=dict(name=name,path=a.EXPORTER_PREFIX+'/lib/'+name,bytes=19,sha256=sha(b'UNIT_NAME_BYTES_NOT_RUNTIME'))
            named=sorted(candidate+[dep],key=lambda item:item['name'])
            with self.assertRaises(SystemExit):parser(named,a.EXPORTER_PREFIX,pq['bytes'],pq['sha256'])

    def test_SESSION_024_exporter_catalog_sql_allowlist_equivalence(self):
        registry=SESSION_SPEC['operationRegistry']['value'];self.assertEqual(sha(canonical(registry)),a.ROLES_REGISTRY_SHA)
        initializers=SESSION_SPEC['readonlyInitialization']['initializers'];self.assertEqual([x['utf8Bytes'] for x in initializers],[48,39,33])
        for x in initializers:
            self.assertEqual(sha(x['sql'].encode()),x['sqlRawSha256']);self.assertEqual(len(x['sql'].encode()),x['utf8Bytes'])
        gate=SESSION_SPEC['readonlyInitialization']['measurement'];self.assertEqual(len(gate['sql'].encode()),558)
        self.assertEqual(sha(gate['sql'].encode()),'69ca65eec13106041e9a35318a5395f5d32210cabba9374ee657a6a3cf466e8f')
        self.assertIn('current_database()::pg_catalog.text',gate['sql']);self.assertEqual(gate['typeOids'],[25]*11)
        receipt=producer_receipt_fixture();receipt['initializerResults'].reverse()
        self.reject(lambda:a.validate_producer_receipt(canonical(receipt)+b'\n',receipt['bindings']))

    def test_SESSION_025_controller_tool_budget_physical_boundary(self):
        f=self.session_unit();self.assertEqual(f.auth['budgets'],a.BUDGETS)
        self.assertEqual((a.BUDGETS['measurementSessionAttempts'],a.BUDGETS['rolesToolInvocationAttempts']),(2,1))
        for key in ('logicalPgconnObjects','reconnectCalls','fallbackCalls'):
            self.mutate_receipt(('toolOperationCounts',key),2)
        ep=schema_fixture('RolesExporterProof');self.assertIsNone(ep['physicalConnectionAttempts'])
        self.assertEqual(ep['physicalConnectionAttemptsStatus'],'NOT_OBSERVABLE');self.assertEqual(ep['logicalPgconnObjects'],1)
        for key in ('fullBackup','schemaBackup','restore','sourceMutation'):
            self.assertIs(f.auth['permissions'][key],False)
        ceilings=SESSION_SPEC['futureActualLocalValidationResources']['memoryCeilings']
        self.assertIsNone(OwnedSource.SOURCE_MEMORY_BYTES)
        self.assertIs(type(OwnedSessionSource.SOURCE_MEMORY_BYTES),int)
        self.assertEqual(OwnedSessionSource.SOURCE_MEMORY_BYTES,1073741824)
        self.assertEqual(ceilings['poolerBytes'],2147483648)
        self.assertEqual(OwnedSessionSource.SOURCE_MEMORY_BYTES+ceilings['poolerBytes']+
            ceilings['stockPrePostClientBytes']+ceilings['rolesRuntimeBytes'],ceilings['aggregateConfiguredMaximumBytes'])
        # Defined isolated unit responses inspect actual preflight argv. They
        # are synthetic protocol bytes, not observed package or resource proof.
        audit=f.run();self.addCleanup(audit.unlock);outputs=audit.artifact_lock['outputs'];inspection=[]
        for dependency in outputs['runtimeDependencies']:
            name=dependency['name'];path='/lib64/ld-linux-x86-64.so.2' if name=='ld-linux-x86-64.so.2' else a.EXPORTER_PREFIX+'/lib/'+name
            inspection.append(name+' => '+path+' (0x1)\n')
        for dependency in outputs['runtimeDependencies']:
            name=dependency['name'];path='/lib64/ld-linux-x86-64.so.2' if name=='ld-linux-x86-64.so.2' else a.EXPORTER_PREFIX+'/lib/'+name
            resolved=outputs['libpq']['path'] if name=='libpq.so.5' else path
            inspection.append('UPLY_RUNTIME_FILE='+name+'\n'+resolved+'\n'+str(dependency['bytes'])+'\n'+dependency['sha256']+'  '+path+'\n')
        policy_ctx=SimpleNamespace(fixture=False,transport_kind='SESSION')
        for context in (f.ctx,self.f.ctx,policy_ctx):
            runs=[]
            def audit_response(args):
                if args[:2]==['image','inspect']:
                    return 0,(args[2]+(' linux amd64' if args[2]!=a.IMAGE else '')+'\n').encode(),b''
                self.assertEqual(args[:2],['run','--rm']);runs.append(args)
                return (0,b'psql (PostgreSQL) 17.6\npg_dumpall (PostgreSQL) 17.6\npg_dump (PostgreSQL) 17.6\n',b'') if args[args.index('--name')+1].endswith('-version') else (0,''.join(inspection).encode('ascii'),b'')
            with patch.object(audit,'ctx',context):
                with patch.object(audit,'docker',side_effect=audit_response):audit.image_preflight()
                self.assertEqual(len(runs),2 if context.transport_kind=='SESSION' else 1)
                for args in runs:
                    if context.fixture is True and context.transport_kind=='SESSION':
                        expected=ceilings['stockPrePostClientBytes'] if args[args.index('--name')+1].endswith('-version') else ceilings['rolesRuntimeBytes']
                        self.assertEqual(args.count('--memory'),1);self.assertEqual(args[args.index('--memory')+1],str(expected))
                        self.assertLess(args.index('--memory'),args.index('--network'));self.assertLess(args.index('--memory'),args.index('--entrypoint'))
                    else:self.assertNotIn('--memory',args)

        # R1 F2: rebind report and terminal hashes so these negatives reach the
        # artifact-reader counter domain gate, rather than only hash rejection.
        path=synthetic_success(f);report_path=path/'acquisition.json'
        original=report_path.read_bytes();report=json.loads(original)
        terminal_path=f.root/'terminal'/(f.aid+'.json');original_terminal=terminal_path.read_bytes()
        a.validate_observed_counters(report['observedCounters'])
        for field in ('toolInternalSQLStatements','physicalServerConnections'):
            for value in (0,1,True,False,None,'NOT_OBSERVABLE_BY_FIXED_GATE','unavailable'):
                with self.subTest(unobservableCounter=field,value=value):
                    bad=copy.deepcopy(report);bad['observedCounters'][field]=value
                    self.reject(lambda:a.validate_observed_counters(bad['observedCounters']))
                    raw=canonical(bad);report_path.write_bytes(raw)
                    terminal=json.loads(original_terminal);terminal['reportRef'].update(sha256=sha(raw),bytes=len(raw))
                    terminal_path.write_bytes(canonical(terminal))
                    self.reject(lambda:a.validate_artifacts(path,f.raw,fixture=True))
        for field in (k for k in a.COUNTERS if k not in ('toolInternalSQLStatements','physicalServerConnections')):
            for value in (-1,True,None,'0'):
                bad=copy.deepcopy(report['observedCounters']);bad[field]=value
                self.reject(lambda:a.validate_observed_counters(bad))
        report_path.write_bytes(original);terminal_path.write_bytes(original_terminal)
        a.validate_artifacts(path,f.raw,fixture=True)

    def test_SESSION_026_privacy_public_failure_and_raw_private(self):
        policy=SESSION_SPEC['stderrCapturePolicy'];self.assertIn('rawDurableAvailable',json.dumps(policy))
        sentinel='UNIT_RAW_DIAGNOSTIC_'+uuid.uuid4().hex
        result=a._failure_code(Failure('ACQUISITION_FAILED',sentinel));self.assertNotIn(sentinel,result)
        r=producer_receipt_fixture();r['rawDiagnostic']=sentinel;self.reject(lambda:a.validate_producer_receipt(canonical(r)+b'\n',r['bindings']))
        ep=schema_fixture('RolesExporterProof');ep['stderrBytes']=1048577;self.reject(lambda:a.schema_validate(ep,'RolesExporterProof'))
        ep=schema_fixture('RolesExporterProof');ep['stderrRaw']=sentinel;self.reject(lambda:a.schema_validate(ep,'RolesExporterProof'))

    def test_SESSION_027_owned_cleanup_timeout_collision(self):
        run=self.consumed();self.assertLessEqual(run.deadline-run.mono,600)
        run.deadline=time.monotonic()-1;self.reject(run.time_guard,'ACQUISITION_AUTH_EXPIRED')
        f=self.session_unit();aid='a'*32;iid='b'*32;p=f.root/'proof-staging'/aid/iid
        p.mkdir(parents=True,mode=0o700);p.parent.chmod(0o700);p.parent.parent.chmod(0o700)
        (p/'readonly.json').mkdir(mode=0o700);self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,'readonly.json'))
        p.chmod(0o755);self.reject_file(lambda:a.read_auxiliary_staging(f.root,aid,iid,'readonly.json'))
        self.assertEqual(f.ctx.network,f.ctx.fixture_label)

        guarded=f.run();self.addCleanup(guarded.unlock);guarded.consume();guarded.credentials()
        network={'Internal':True,'Name':f.network,'Labels':{'uply.provenance-test':f.network}}
        endpoint={'Image':LOCAL_POOL_IMAGE,'Id':'a'*64,'Name':'/'+f.host,
            'Config':{'User':'65534:65534','Labels':{'uply.provenance-test':f.network}},
            'HostConfig':{'NetworkMode':f.network,'Binds':None,'PortBindings':{},'ReadonlyRootfs':True,'Memory':2147483648,
                'Tmpfs':{'/tmp':'rw,mode=1777,size=268435456','/lab':'rw,mode=0700,uid=65534,gid=65534,size=1048576'}},
            'Mounts':[{'Destination':'/tmp','Type':'tmpfs'},{'Destination':'/lab','Type':'tmpfs'}],
            'NetworkSettings':{'Networks':{f.network:{}}}}
        raw=b'ISOLATED_UNIT_POOL_INPUT'
        def guard_response(args):
            if args[:2]==['network','inspect']:return 0,canonical([network]),b''
            if args[:2]==['container','inspect']:return 0,canonical([endpoint]),b''
            self.assertEqual(args,['exec','--user','65534:65534','a'*64,'/bin/cat','/lab/input.json'])
            return 0,raw,b''
        with patch.object(guarded,'docker',side_effect=guard_response):
            guarded.fixture_guard()
            old=endpoint['HostConfig'].pop('Memory');self.reject(guarded.fixture_guard,'ACQUISITION_TARGET_MISMATCH')
            endpoint['HostConfig']['Memory']=old
            for memory in (None,0,True,False,2147483648.0,2147483647,2147483649,'2147483648'):
                endpoint['HostConfig']['Memory']=memory;self.reject(guarded.fixture_guard,'ACQUISITION_TARGET_MISMATCH')
            endpoint['HostConfig']['Memory']=old
            guarded.fixture_guard()  # Restored positive reaches the route hash gate.
            for path,bad in [(('Image',),a.IMAGE),(('Name',),'/caller'),(('Config','User'),'0:0'),
                (('HostConfig','Binds'),['/caller:/lab:ro']),(('HostConfig','ReadonlyRootfs'),False),
                (('HostConfig','NetworkMode'),'host'),(('HostConfig','Tmpfs','/lab'),'mode=0777'),
                (('NetworkSettings','Networks'),{'host':{}}),(('Config','Labels'),{})]:
                node=endpoint
                for key in path[:-1]:node=node[key]
                old=node[path[-1]];node[path[-1]]=bad;self.reject(guarded.fixture_guard,'ACQUISITION_TARGET_MISMATCH');node[path[-1]]=old
            raw=b'CHANGED_UNIT_POOL_INPUT';self.reject(guarded.fixture_guard,'ACQUISITION_TARGET_MISMATCH')
            raw=b'ISOLATED_UNIT_POOL_INPUT';network['Internal']=False;self.reject(guarded.fixture_guard,'ACQUISITION_TARGET_MISMATCH')

    def test_SESSION_028_no_production_adoption_or_restore_authority(self):
        f=self.session_unit();intent=f.auth['bindings']['acquisitionIntent']
        for key in ('productionAdoptionReady','AgentRunAuthorized','restoreAuthorized','backupAuthorized'):
            bad=copy.deepcopy(intent);bad[key]=True;self.reject(lambda:a.validate_session_intent(bad,fixture=True))
        leaf,imp,v,p,s,c=synthetic_admission_bundle();self.assertIs(leaf['productionExecutionAuthorized'],False)
        leaf['productionExecutionAuthorized']=True;self.reject(lambda:check_synthetic_admission_bundle(leaf,imp,v,p,s,c))
        for key in ('restore','rolesReplay','fullBackup','schemaBackup','mint','AgentRun','approvalRotation'):
            self.assertIs(f.auth['permissions'][key],False)

    def test_SESSION_029_fail_consumed_no_retry_fallback(self):
        f=self.session_unit();dispatch=[]
        # Failure seam deliberately prevents all actual network I/O.
        with patch.object(a._Run,'image_preflight',return_value=None), \
             patch.object(a._Run,'fixture_guard',side_effect=Failure('ACQUISITION_FAILED','ACQUISITION_TARGET_MISMATCH')), \
             patch.object(a._Run,'dispatch',side_effect=lambda *args:dispatch.append(args)):
            result=a.acquire(f.ctx,f.approval,f.digest)
        self.assertEqual(result['status'],a.FAILED);self.assertEqual(dispatch,[])
        report=json.loads((f.root/'acquisitions'/f.aid/'acquisition.json').read_bytes())
        self.assertEqual(report['observedCounters']['automaticRetries'],0)
        self.assertTrue((f.root/'consumed'/(f.aid+'.json')).exists())
        self.reject(lambda:f.run(),'ACQUISITION_REPLAY')
        self.assertFalse((f.root/'acquisitions'/f.aid/'roles.sql').exists())

    def test_SESSION_030_pre_roles_post_sequence_snapshot_binding(self):
        path=synthetic_success(self.f);report=a.validate_artifacts(path,self.f.raw,fixture=True)
        dispatches=[json.loads(p.read_bytes()) for p in sorted((self.f.root/'dispatches'/self.f.aid).glob('*.json'))]
        self.assertEqual([(x['sequence'],x['kind']) for x in dispatches],[(1,'PRE'),(2,'ROLES'),(3,'POST')])
        self.assertEqual(report['observedCounters']['controllerSelectStatements'],27)
        p=path/'post.json';post=json.loads(p.read_bytes());post['responses'][0]['canonicalResponse']['defaultTransactionReadOnly']='off'
        post['responses'][0]['canonicalResponseSha256']=sha(canonical(post['responses'][0]['canonicalResponse']))
        post['canonicalSnapshotSha256']=sha(canonical(a._raw_snapshot(post['responses'])))
        p.write_bytes(canonical(post))
        report_path=path/'acquisition.json';report=json.loads(report_path.read_bytes())
        report['files']['post.json']=dict(sha256=sha(p.read_bytes()),bytes=len(p.read_bytes()))
        report_path.write_bytes(canonical(report))
        terminal_path=self.f.root/'terminal'/(self.f.aid+'.json');terminal=json.loads(terminal_path.read_bytes())
        terminal['reportRef'].update(sha256=sha(report_path.read_bytes()),bytes=len(report_path.read_bytes()))
        terminal_path.write_bytes(canonical(terminal))
        self.reject(lambda:a.validate_artifacts(path,self.f.raw,fixture=True))


if __name__=='__main__':
    unittest.main(verbosity=2)

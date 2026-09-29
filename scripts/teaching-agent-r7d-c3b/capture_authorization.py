"""Local-only capture authority lifecycle. No transport, SQL or credential API."""
import argparse
import contextlib
import ctypes
import errno
import fcntl
import math
import os
from pathlib import Path
import re
import stat
import time
import uuid
import json
import plan_contract as pc
from receipts import Failure, safe_file, strict_json, canonical, sha, sanitized, exclusive

APPROVAL_FIELDS = {'contract','approvalId','scope','planId','targetProfile','sourceApprovalPath',
    'sourceApprovalRawSha256','sourcePackageHashes','draftRawSha256','migrationRawSha256',
    'migrationBodySha256','targetIdentity','credentialIdentitySha256','credentialIdentityEvidencePath',
    'credentialIdentityEvidenceRawSha256','transportRiskArtifactRawSha256','lossAcceptanceRecordRawSha256',
    'f2EvidenceRawSha256','expectedCanonicalState','explicitUserApproval','approvalReference',
    'approvalReferenceSha256','operatorUid','observedAt','expiresAt','maximumCaptureAttempts'}
BASE = 'docs/evidence/teaching-agent-stage-1f-r7d-c/'
LOSS_PATH = BASE+'r7d-c3b-runner-historical-evidence-loss-acceptance-record.json'
LOSS_SHA = 'b74ee5ba2a55d5a496763ad84b64fd25b5f5d3a9b65f9a7e06d1ccdfd380bfe3'
F2_PATH = BASE+'r7d-c3b-runner-p1e-f2-receipt-directory-fix.json'
F2_SHA = '413db75399233402e29dd3d60ff742b4bc8decca32d6088fe673361165da7f07'
V4_PATH = BASE+'approval-r7d-c3b-runner-controlled-preflight-v4.json'
V4_SHA = '3da6c591143c8b3d0cfcd66a01237faab7a0c0bb50ad1f33a734e28e8e9ba068'
LEGACY_SHA = '1056fa492a3fb08e8bb819cb98a257ec994c91adca1fa65e961f6ac28595cd31'
PHASES = ('PREPARED','ARCHIVED','STAGED','PUBLISHED')
CLAIMS = ('approval-claims','approval-reference-claims','nonce-claims','consumed')


def deny(code):
    raise Failure('APPROVAL_MISSING', code)


def hexid(value, length=64):
    if type(value) is not str or not re.fullmatch('[a-f0-9]{%d}' % length, value):
        deny('AUTH_IDENTITY_FORMAT')
    return value


def fresh(data):
    for k in ('observedAt','expiresAt'):
        if type(data[k]) not in (int,float) or not math.isfinite(data[k]): deny('AUTH_APPROVAL_TIME')
    now = time.time()
    if not (data['observedAt'] <= now < data['expiresAt'] and
            0 < data['expiresAt']-data['observedAt'] <= 900): deny('AUTH_APPROVAL_EXPIRED')


def directory(path, create=False):
    path = Path(path).absolute()
    for parent in [path,*path.parents]:
        if parent.is_symlink(): deny('AUTH_PATH_UNSAFE')
    if not os.path.lexists(path) and create:
        # Parent must already exist. Never let parents=True create weak intermediates.
        try: os.mkdir(path, 0o700)
        except FileExistsError: pass
        syncdir(path.parent)
    s = path.lstat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o700:
        deny('AUTH_PATH_UNSAFE')
    return path


def syncdir(path):
    fd = os.open(path, os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try: os.fsync(fd)
    finally: os.close(fd)


def record(path, data):
    if sanitized(data) != data: deny('AUTH_RECEIPT_UNSAFE')
    directory(path.parent)
    try: return exclusive(path, data, redact=False)
    except FileExistsError: deny('AUTH_IDENTITY_ALREADY_RESERVED')


def read_record(path):
    return strict_json(safe_file(path, private=True))


def move_exact(source, dest, expected):
    """One-link exact bytes moved without replacing any destination; no fallback."""
    directory(source.parent); directory(dest.parent)
    raw = safe_file(source, private=True); before = source.stat()
    if sha(raw) != expected: deny('AUTH_OLD_HASH_MISMATCH')
    if os.path.lexists(dest): deny('AUTH_ARCHIVE_COLLISION')
    sf = os.open(source.parent, os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
    df = os.open(dest.parent, os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:
        if os.fstat(sf).st_dev != os.fstat(df).st_dev: deny('AUTH_ATOMIC_RENAME_UNSUPPORTED')
        libc = ctypes.CDLL(None, use_errno=True)
        try: rename = libc.renameat2
        except AttributeError: deny('AUTH_ATOMIC_RENAME_UNSUPPORTED')
        rename.argtypes = [ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
        rename.restype = ctypes.c_int
        if os.stat(source.name,dir_fd=sf,follow_symlinks=False) != before: deny('AUTH_PATH_UNSAFE')
        if rename(sf,os.fsencode(source.name),df,os.fsencode(dest.name),1):
            code = ctypes.get_errno()
            if code in (errno.ENOSYS,errno.EINVAL,errno.EXDEV,errno.EOPNOTSUPP): deny('AUTH_ATOMIC_RENAME_UNSUPPORTED')
            if code == errno.EEXIST: deny('AUTH_ARCHIVE_COLLISION')
            deny('AUTH_ARCHIVE_IO')
        os.fsync(sf); os.fsync(df)
        after = dest.stat()
        if (after.st_ino,after.st_dev,after.st_uid,after.st_gid,after.st_mode) != (
                before.st_ino,before.st_dev,before.st_uid,before.st_gid,before.st_mode): deny('AUTH_PATH_UNSAFE')
        if safe_file(dest,True) != raw: deny('AUTH_ARCHIVE_HASH_MISMATCH')
    finally:
        os.close(sf); os.close(df)


class Lifecycle:
    def __init__(self, plan):
        self.plan = plan
        if plan.data['planId'] != 'acl-000-v1' or plan.data['status'] != 'DRAFT_NOT_EXECUTABLE': deny('AUTH_PLAN')
        profiles = strict_json(pc.safe_file(pc.PROFILE_PATH))['profiles']
        self.profile = profiles[plan.data['targetProfile']]
        self.home = Path(self.profile['authorizationDirectory'])
        self.receipts = pc.ROOT / self.profile['receiptRoot']
        self.canonical = self.home / 'acl-000-v1.capture.json'
        self.archive = self.home / 'capture-archive' / 'acl-000-v1'
        self.pending = self.home / 'capture-pending' / 'acl-000-v1'
        self.approvals = self.home / 'capture-approvals'
        self.root = self.receipts / 'authorization-rotations'
        self.lockdir = self.home / 'capture-lifecycle'
        self.lockpath = self.lockdir / 'acl-000-v1.lock'

    def identity(self):
        p=self.profile; fixture=self.plan.fixture
        return {'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,
            'targetProfile':self.plan.data['targetProfile'],'imageId':p['imageId'],'fixture':fixture,
            'sslmode':None if fixture else 'verify-full',
            'projectIdentitySha256':None if fixture else p['projectIdentitySha256'],
            'hostIdentitySha256':None if fixture else p['hostIdentitySha256']}

    def authority(self):
        # Read source/evidence only, before creating runtime directories/locks.
        raw=pc.safe_file(pc.ROOT/pc.CAPTURE_APPROVAL); v=strict_json(raw)
        if (v.get('approvalVersion') != 5 or v.get('approved') is not False or
            v.get('executionAuthorized') is not False or
            v.get('status') != 'READY_AWAITING_EXPLICIT_APPROVAL' or
            v.get('approvalType') != 'CONTROLLED_PRODUCTION_READ_ONLY_BASELINE_CAPTURE_AND_REVIEW_ONLY' or
            v.get('runtimePackageHashes') != pc.package_hashes() or
            v.get('runtimePackageSha256') != sha(canonical(pc.package_hashes())) or
            v.get('draftRawSha256') != self.plan.digest): deny('AUTH_SOURCE_AUTHORITY')
        for path,digest in ((LOSS_PATH,LOSS_SHA),(F2_PATH,F2_SHA),(V4_PATH,V4_SHA)):
            if sha(pc.safe_file(pc.ROOT/path)) != digest: deny('AUTH_EVIDENCE_BINDING')
        loss=strict_json(pc.safe_file(pc.ROOT/LOSS_PATH))
        if (loss['acceptedLoss'] is not True or loss['restored'] is not False or
            loss['originalBytesAvailable'] is not False or loss['scope']!='R7D-C3B_ONLY' or
            v.get('acceptanceRecordPath') != LOSS_PATH or v.get('acceptanceRecordRawSha256') != LOSS_SHA):
            deny('AUTH_LOSS_BINDING')
        if os.path.lexists(self.receipts/'R7D-C3B.release-completed.json'): deny('RISK_ACCEPTANCE_SCOPE_EXPIRED')
        if not self.plan.fixture: pc.risk_guard(self.plan,{'transportRiskAcceptance':pc.RISK_BINDING.copy()})
        self.plan.source()
        return sha(raw)

    @contextlib.contextmanager
    def locked(self):
        self.authority()
        directory(self.home); directory(self.receipts)
        directory(self.lockdir,True)
        flags=os.O_RDWR|os.O_NOFOLLOW|os.O_CLOEXEC
        try:
            fd=os.open(self.lockpath,flags|os.O_CREAT|os.O_EXCL,0o600)
            os.fsync(fd);syncdir(self.lockdir)
        except FileExistsError: fd=os.open(self.lockpath,flags)
        try:
            s=os.fstat(fd)
            if (not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=os.getuid() or
                stat.S_IMODE(s.st_mode)!=0o600 or self.lockpath.lstat()!=s): deny('AUTH_PATH_UNSAFE')
            try: fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError: deny('AUTH_LIFECYCLE_LOCK_BUSY')
            if self.lockpath.lstat()!=os.fstat(fd): deny('AUTH_PATH_UNSAFE')
            self.authority()
            for p in (self.home/'capture-archive',self.archive,self.home/'capture-pending',self.pending,
                      self.approvals,self.root,self.root/'operations',self.root/'ready',self.root/'outcomes',
                      *(self.root/x for x in CLAIMS),self.root/'approval-reference-claims'):
                directory(p,True)
            yield
        finally: os.close(fd)

    def approval(self, aid, digest):
        hexid(aid,32);hexid(digest)
        path=self.approvals/(aid+'.json'); raw=safe_file(path,True)
        if sha(raw)!=digest: deny('AUTH_EXPLICIT_APPROVAL_HASH')
        a=strict_json(raw)
        if set(a)!=APPROVAL_FIELDS or sanitized(a)!=a: deny('AUTH_EXPLICIT_APPROVAL_SCHEMA')
        expected={'contract':'capture-execution-approval/1','approvalId':aid,
            'scope':'ONE_CONTROLLED_PRODUCTION_READ_ONLY_CAPTURE','planId':self.plan.data['planId'],
            'targetProfile':self.plan.data['targetProfile'],'sourceApprovalPath':pc.CAPTURE_APPROVAL,
            'sourceApprovalRawSha256':self.authority(),'sourcePackageHashes':pc.package_hashes(),
            'draftRawSha256':self.plan.digest,'migrationRawSha256':self.plan.migration['rawSha256'],
            'migrationBodySha256':self.plan.migration['bodySha256'],'targetIdentity':self.identity(),
            'transportRiskArtifactRawSha256':pc.RISK_SHA,'lossAcceptanceRecordRawSha256':LOSS_SHA,
            'f2EvidenceRawSha256':F2_SHA,'explicitUserApproval':True,'operatorUid':os.getuid(),
            'maximumCaptureAttempts':1}
        for k,value in expected.items():
            if canonical(a[k])!=canonical(value): deny('AUTH_EXPLICIT_APPROVAL_BINDING')
        fresh(a);hexid(a['approvalReferenceSha256']);hexid(a['credentialIdentityEvidenceRawSha256'])
        if not self.plan.fixture:hexid(a['credentialIdentitySha256'])
        elif a['credentialIdentitySha256'] is not None:deny('AUTH_CREDENTIAL_PROVENANCE')
        # The user attestation reference lives only in a fixed private namespace.
        ref=self.approvals/('user-'+a['approvalReferenceSha256']+'.json')
        if a['approvalReference'] != str(ref): deny('AUTH_EXPLICIT_APPROVAL_REFERENCE')
        refraw=safe_file(ref,True)
        if sha(refraw)!=a['approvalReferenceSha256']:deny('AUTH_EXPLICIT_APPROVAL_REFERENCE')
        refdata=strict_json(refraw)
        if (set(refdata)!={'contract','explicitUserApproval','approvalId','sourceApprovalRawSha256','maximumCaptureAttempts','observedAt','expiresAt'} or
            refdata['contract']!='capture-user-attestation/1' or refdata['explicitUserApproval'] is not True or
            refdata['approvalId']!=aid or refdata['sourceApprovalRawSha256']!=a['sourceApprovalRawSha256'] or
            type(refdata['maximumCaptureAttempts']) is not int or refdata['maximumCaptureAttempts']!=1):deny('AUTH_EXPLICIT_APPROVAL_REFERENCE')
        fresh(refdata)
        if a['expiresAt']>refdata['expiresAt']:deny('AUTH_APPROVAL_EXPIRED')
        expected_old=a['expectedCanonicalState']
        if type(expected_old) is not dict or set(expected_old)!={'state','sha256'}:deny('AUTH_OLD_STATE')
        if expected_old['state']=='ABSENT':
            if expected_old['sha256'] is not None:deny('AUTH_OLD_STATE')
        elif expected_old['state'] in ('EXPIRED_CONSUMED_HISTORICAL','CONSUMED'):hexid(expected_old['sha256'])
        else:deny('AUTH_OLD_STATE')
        # Provenance is a raw-SHA-pinned historical auth, or a finite v5-listed safe identity artifact.
        provenance=Path(a['credentialIdentityEvidencePath'])
        allowed={str(self.canonical),str(self.archive/(a['credentialIdentityEvidenceRawSha256']+'.json'))}
        if str(provenance) in allowed:
            if a['credentialIdentityEvidenceRawSha256']!=LEGACY_SHA and not os.path.lexists(self.root/'outcomes'/(a['credentialIdentityEvidenceRawSha256']+'.json')):
                deny('AUTH_CREDENTIAL_PROVENANCE')
            if provenance==self.canonical and sha(safe_file(provenance,True))!=a['credentialIdentityEvidenceRawSha256']:
                provenance=self.archive/(a['credentialIdentityEvidenceRawSha256']+'.json')
            provenance_raw=safe_file(provenance,True);data=strict_json(provenance_raw)
        else:
            v=strict_json(pc.safe_file(pc.ROOT/pc.CAPTURE_APPROVAL))
            approved=v.get('credentialIdentityEvidence',[])
            if not any(e=={'path':str(provenance),'sha256':a['credentialIdentityEvidenceRawSha256']} for e in approved):deny('AUTH_CREDENTIAL_PROVENANCE')
            if provenance.is_absolute() or '..' in provenance.parts or not str(provenance).startswith(BASE):deny('AUTH_CREDENTIAL_PROVENANCE')
            provenance=pc.ROOT/provenance;provenance_raw=pc.safe_file(provenance);data=strict_json(provenance_raw)
        if sha(provenance_raw)!=a['credentialIdentityEvidenceRawSha256'] or data.get('credentialIdentitySha256')!=a['credentialIdentitySha256']:
            deny('AUTH_CREDENTIAL_PROVENANCE')
        return a

    def claim(self, family, key, data):
        hexid(key,32 if family=='approval-claims' else 64)
        return record(self.root/family/(key+'.json'),data)

    def unfinished(self, active=None):
        ready={}
        for path in (self.root/'ready').iterdir():
            hexid(path.stem)
            r=read_record(path)
            if path.name!=r.get('newAuthorizationRawSha256','')+'.json':deny('AUTH_LIFECYCLE_INCOMPLETE')
            op=r.get('rotationId');hexid(op,32)
            if op in ready:deny('AUTH_LIFECYCLE_INCOMPLETE')
            ready[op]=r
        ops=set()
        for op in (self.root/'operations').iterdir():
            hexid(op.name,32);directory(op);ops.add(op.name)
            if op.name not in ready:deny('AUTH_LIFECYCLE_INCOMPLETE')
            r=ready[op.name];h=r['newAuthorizationRawSha256']
            self.verify_ready(h)
            if h!=active:
                outcome=self.root/'outcomes'/(h+'.json')
                if not os.path.lexists(outcome):deny('AUTH_LIFECYCLE_INCOMPLETE')
                out=read_record(outcome)
                if out.get('authorizationRawSha256')!=h or sha(safe_file(self.archive/(h+'.json'),True))!=h:
                    deny('AUTH_LIFECYCLE_INCOMPLETE')
        if ops!=set(ready):deny('AUTH_LIFECYCLE_INCOMPLETE')
        for family in ('approval-claims','approval-reference-claims','nonce-claims'):
            for path in (self.root/family).iterdir():
                c=read_record(path)
                if c.get('rotationId') not in ops:deny('AUTH_LIFECYCLE_INCOMPLETE')

    def verify_ready(self,h):
        hexid(h);r=read_record(self.root/'ready'/(h+'.json'))
        if r.get('contract')!='capture-authorization-rotation/1' or r.get('state')!='MINTED_READY' or r.get('newAuthorizationRawSha256')!=h:
            deny('AUTH_ROTATION_NOT_READY')
        op=hexid(r['rotationId'],32);folder=self.root/'operations'/op;directory(folder)
        if {p.name for p in folder.iterdir()}!={x+'.json' for x in PHASES}:deny('AUTH_ROTATION_NOT_READY')
        for phase in PHASES:
            raw=safe_file(folder/(phase+'.json'),True);data=strict_json(raw)
            if sha(raw)!=r['phaseFileHashes'][phase] or data.get('rotationId')!=op or data.get('phase')!=phase:
                deny('AUTH_ROTATION_NOT_READY')
        staged=read_record(folder/'STAGED.json');published=read_record(folder/'PUBLISHED.json')
        if staged.get('newAuthorizationRawSha256')!=h or published.get('newAuthorizationRawSha256')!=h:deny('AUTH_ROTATION_NOT_READY')
        for family,key in [('approval-claims',r['explicitApprovalId']),('approval-reference-claims',r['approvalReferenceSha256']),('nonce-claims',r['nonceSha256'])]:
            c=read_record(self.root/family/(key+'.json'))
            if c != r['claims'][family]:deny('AUTH_ROTATION_NOT_READY')
            if c.get('rotationId')!=op or c.get('explicitApprovalRawSha256')!=r['explicitApprovalRawSha256']:deny('AUTH_ROTATION_NOT_READY')
        if r['oldAuthorizationRawSha256'] is not None:
            if sha(safe_file(self.archive/(r['oldAuthorizationRawSha256']+'.json'),True))!=r['archiveRawSha256']:deny('AUTH_ROTATION_NOT_READY')
            if r['historicalNonceSha256'] is not None:
                c=read_record(self.root/'nonce-claims'/(r['historicalNonceSha256']+'.json'))
                if c!=r['claims']['historical-nonce']:deny('AUTH_ROTATION_NOT_READY')
        return r

    def mint(self, aid, approval_hash):
        with self.locked():
            self.unfinished()
            a=self.approval(aid,approval_hash);expected=a['expectedCanonicalState']
            oldraw=None;old=None
            if os.path.lexists(self.canonical):
                oldraw=safe_file(self.canonical,True);old=strict_json(oldraw)
                if expected['state']=='ABSENT' or sha(oldraw)!=expected['sha256']:deny('AUTH_OLD_HASH_MISMATCH')
                if old['expiresAt']>time.time():deny('AUTH_UNEXPIRED_ACTIVE')
                if expected['state']=='EXPIRED_CONSUMED_HISTORICAL' and sha(oldraw)!=LEGACY_SHA:deny('AUTH_OLD_HASH_MISMATCH')
                if os.path.lexists(self.archive/(sha(oldraw)+'.json')):deny('AUTH_ARCHIVE_COLLISION')
            elif expected['state']!='ABSENT':deny('AUTH_OLD_HASH_MISMATCH')
            rotation=uuid.uuid4().hex;nonce=uuid.uuid4().hex;nh=sha(nonce.encode())
            # Precheck collisions without touching canonical; O_EXCL remains authoritative.
            for family,key in [('approval-claims',aid),('approval-reference-claims',a['approvalReferenceSha256']),('nonce-claims',nh)]:
                if os.path.lexists(self.root/family/(key+'.json')):deny('AUTH_IDENTITY_ALREADY_RESERVED')
            folder=self.root/'operations'/rotation;os.mkdir(folder,0o700);syncdir(folder.parent)
            hashes={};start=time.time()
            def phase(name,**kw):
                hashes[name]=record(folder/(name+'.json'),dict(rotationId=rotation,phase=name,**kw))
            phase('PREPARED',planId=self.plan.data['planId'],oldAuthorizationRawSha256=sha(oldraw) if oldraw else None,
                  explicitApprovalId=aid,explicitApprovalRawSha256=approval_hash,nonceSha256=nh,startedAt=start)
            c={'rotationId':rotation,'explicitApprovalId':aid,'explicitApprovalRawSha256':approval_hash,'nonceSha256':nh}
            claims={}
            for family,key in [('approval-claims',aid),('approval-reference-claims',a['approvalReferenceSha256']),('nonce-claims',nh)]:
                claims[family]=dict(c,family=family,identity=key);self.claim(family,key,claims[family])
            historical=None
            if oldraw:
                historical=sha(hexid(old['nonce'],32).encode()) if expected['state']=='EXPIRED_CONSUMED_HISTORICAL' else None
                if historical:
                    hc=dict(c,family='historical-nonce',identity=historical,oldAuthorizationRawSha256=sha(oldraw),status='HISTORICAL_USED')
                    self.claim('nonce-claims',historical,hc);claims['historical-nonce']=hc
                move_exact(self.canonical,self.archive/(sha(oldraw)+'.json'),sha(oldraw))
            phase('ARCHIVED',oldAuthorizationRawSha256=sha(oldraw) if oldraw else None)
            now=time.time()
            auth={'contract':'readonly-baseline-capture-authorization/'+('1' if self.plan.fixture else '2'),
                'scope':pc.CAPTURE_MODE,'planId':self.plan.data['planId'],'planSha256':self.plan.digest,
                'migrationSha256':self.plan.migration['rawSha256'],'bodySha256':self.plan.migration['bodySha256'],
                'packageHashes':pc.package_hashes(),'targetProfile':self.plan.data['targetProfile'],'targetIdentity':self.identity(),
                'observedAt':now,'expiresAt':min(now+900,a['expiresAt']),'operatorUid':os.getuid(),
                'userApprovalRef':'OWNED_ISOLATED_FIXTURE' if self.plan.fixture else pc.CAPTURE_APPROVAL,
                'userApprovalSha256':sha(b'OWNED_ISOLATED_FIXTURE') if self.plan.fixture else a['sourceApprovalRawSha256'],
                'explicitCaptureAuthorization':True,'nonce':nonce,'expectedLedgerPrefixSha256':None,
                'credentialIdentitySha256':a['credentialIdentitySha256']}
            if not self.plan.fixture:auth['transportRiskAcceptance']=pc.RISK_BINDING.copy()
            pc.authorize_capture(self.plan,auth)
            pending=self.pending/(rotation+'.json');h=record(pending,auth)
            if read_record(pending)!=auth:deny('AUTH_STAGED_IDENTITY')
            phase('STAGED',newAuthorizationRawSha256=h,newAuthorizationCanonicalSha256=sha(canonical(auth)))
            self.authority();fresh(a);pc.authorize_capture(self.plan,auth)
            move_exact(pending,self.canonical,h)
            phase('PUBLISHED',newAuthorizationRawSha256=h)
            r={'contract':'capture-authorization-rotation/1','state':'MINTED_READY','rotationId':rotation,
                'planId':self.plan.data['planId'],'originalPath':str(self.canonical),
                'archivePath':str(self.archive/(sha(oldraw)+'.json')) if oldraw else None,
                'oldAuthorizationRawSha256':sha(oldraw) if oldraw else None,'archiveRawSha256':sha(oldraw) if oldraw else None,
                'oldObservedAt':old['observedAt'] if old else None,'oldExpiresAt':old['expiresAt'] if old else None,
                'oldStatus':expected['state'],'rotationReason':'FRESH_EXPLICIT_SINGLE_CAPTURE_APPROVAL',
                'newAuthorizationRawSha256':h,'newAuthorizationCanonicalSha256':sha(canonical(auth)),
                'sourceApprovalPath':pc.CAPTURE_APPROVAL,'sourceApprovalRawSha256':a['sourceApprovalRawSha256'],
                'historicalV4RawSha256':V4_SHA,'f2EvidenceRawSha256':F2_SHA,'lossAcceptanceRecordRawSha256':LOSS_SHA,
                'transportRiskArtifactRawSha256':pc.RISK_SHA,'packageHashes':pc.package_hashes(),'operatorUid':os.getuid(),
                'rotationStartedAt':start,'rotationCompletedAt':time.time(),'observedAt':auth['observedAt'],'expiresAt':auth['expiresAt'],
                'nonceSha256':nh,'explicitApprovalId':aid,'explicitApprovalRawSha256':approval_hash,
                'approvalReferenceSha256':a['approvalReferenceSha256'],'phaseFileHashes':hashes,'claims':claims,
                'historicalNonceSha256':historical,'credentialMaterialPresent':False}
            record(self.root/'ready'/(h+'.json'),r)
            self.verify_ready(h)
            return {'state':'MINTED_READY','authorizationRawSha256':h,'nextMigrationAllowed':False}

    @contextlib.contextmanager
    def attempt(self):
        with self.locked():
            raw=safe_file(self.canonical,True);auth=strict_json(raw);h=sha(raw)
            pc.authorize_capture(self.plan,auth)
            if os.path.lexists(self.root/'consumed'/(h+'.json')):deny('CAPTURE_AUTHORIZATION_CONSUMED')
            self.unfinished(active=h);r=self.verify_ready(h)
            a=self.approval(r['explicitApprovalId'],r['explicitApprovalRawSha256'])
            if (r['newAuthorizationCanonicalSha256']!=sha(canonical(auth)) or r['nonceSha256']!=sha(auth['nonce'].encode()) or
                r['sourceApprovalRawSha256']!=a['sourceApprovalRawSha256'] or r['packageHashes']!=pc.package_hashes() or
                r['approvalReferenceSha256']!=a['approvalReferenceSha256'] or auth['expiresAt']>a['expiresAt']):deny('AUTH_ROTATION_NOT_READY')
            syncdir(self.root/'ready')
            claim={'contract':'capture-authorization-consumption/1','planId':self.plan.data['planId'],
                'authorizationRawSha256':h,'authorizationCanonicalSha256':sha(canonical(auth)),
                'rotationReadyReceiptSha256':sha(safe_file(self.root/'ready'/(h+'.json'),True)),
                'explicitApprovalId':r['explicitApprovalId'],'explicitApprovalRawSha256':r['explicitApprovalRawSha256'],
                'nonceSha256':r['nonceSha256'],'packageSha256':sha(canonical(pc.package_hashes())),
                'operatorUid':os.getuid(),'claimedAt':time.time(),'phase':'BEFORE_CREDENTIAL_ACCESS','maximumAttempts':1}
            self.claim('consumed',h,claim)
            lease={'auth':auth,'receiptSha256':None,'receiptPath':None}
            failure=None
            try: yield lease
            except BaseException as e:
                failure=e;raise
            finally:
                try:
                    receipt_hash=lease['receiptSha256'];path=lease['receiptPath']
                    if failure is None:
                        if not receipt_hash or not path or Path(path).parent!=self.receipts:deny('AUTH_CAPTURE_RECEIPT_MISSING')
                        body=safe_file(path,True);receipt=strict_json(body)
                        if (sha(body)!=receipt_hash or receipt.get('contract')!='readonly-baseline-capture/2' or
                            receipt.get('authorizationSha256')!=sha(canonical(auth)) or receipt.get('captureEnd')!='ROLLBACK'):
                            deny('AUTH_CAPTURE_RECEIPT_MISSING')
                    if safe_file(self.canonical,True)!=raw:deny('AUTHORIZATION_CHANGED')
                    move_exact(self.canonical,self.archive/(h+'.json'),h)
                    record(self.root/'outcomes'/(h+'.json'),{'contract':'capture-authorization-outcome/1',
                        'authorizationRawSha256':h,'archiveRawSha256':h,'consumptionClaimSha256':sha(safe_file(self.root/'consumed'/(h+'.json'),True)),
                        'captureReceiptSha256':receipt_hash,'state':'SUCCESS' if failure is None else 'CAPTURE_FAILED_CONSUMED',
                        'failureCode':failure.code if isinstance(failure,Failure) else ('LOCAL_FAILURE' if failure else None),
                        'completedAt':time.time(),'nextMigrationAllowed':False})
                except Exception:raise Failure('VERIFY_FAILED','BLOCKED_LIFECYCLE_FINALIZATION') from None


def capture_attempt(plan):
    return Lifecycle(plan).attempt()


# Backup lifecycle is deliberately separate from the capture state machine above.
BACKUP_SCOPE = 'BACKUP_READ_EXPORT'
BACKUP_DESIGN = BASE+'approval-r7d-c3b-backup-authorization-lifecycle-design.json'
BACKUP_DESIGN_SHA = '217abeddc1bcc1a7fb166e384fe3cfe0854f21bd1a0dd34952e63af8ecf44083'
BACKUP_IMPLEMENTATION = BASE+'r7d-c3b-backup-authorization-lifecycle-v4-implementation-completion.json'
BACKUP_RESOLUTION_DESIGN = BASE+'r7d-c3b-attempt2-e3-recovery-d13-forward-authority-successor-package-sealing-scope-review.json'
BACKUP_RESOLUTION_DESIGN_SHA = '588f55b25e9738086f403601e7eadb46dc41820b1089e218b1207742bb819f27'
BACKUP_RESOLUTION_VALIDATION = BASE+'r7d-c3b-backup-authorization-lifecycle-v4-authority-resolution-validation-completion.json'
BACKUP_PACKAGE_LOCK = BASE+'r7d-c3b-backup-authorization-lifecycle-v4-package-lock.json'
BACKUP_LEGACY_SHA = 'aa6917ea7a265b85d224c94bfad5f915dc6a7e31bd6cef403bfc2be9021d752e'
BACKUP_BASELINE = BASE+'r7d-c3b-runner-000-post-hardening-backup-recovery-a1-authorization-record.json'
BACKUP_BASELINE_SHA = '43e26b17c20ec85fa24458b759627eaf2209341d0891eb922ccc360cca11bd56'
BACKUP_IDENTITY = BASE+'runner-000-backup-preinstall-reauth1/94830e10c7c322db4df403434516cbb6/backup-authorization-identity.json'
BACKUP_IDENTITY_SHA = '058e14200b2e424c0c793e1a5fe1f56a1549e4bbfdefa07b803cc17be16b4814'
BACKUP_LINEAGE = {
    'historicalBackupResultSha256': (BASE+'r7d-c3b-runner-000-backup-result-reauth1.json', '4c36c76498d88639e3d6ef3070206be5b4e312887c2338d09cdcee8b6446bcf7'),
    'historicalCombinedResultSha256': (BASE+'r7d-c3b-runner-000-backup-preinstall-result-reauth1.json', 'a014fb7dfac39aa3845eee364e1a9a2db79431f3ef1882eca33d869b1b718b57'),
    'blockedA1ResultSha256': (BASE+'r7d-c3b-runner-000-post-hardening-backup-recovery-a1-result.json', '42451f0b9a7bbfb50b346296d241c00bd7de08513f1a0e11548c28c2ad446e29')}
BACKUP_APPROVAL_FIELDS = set('contract approvalId scope planId explicitUserApproval humanApprovalSha256 operatorUid observedAt expiresAt maximumBackupAttempts maximumOwnedRecoveryAttempts freshPreinstallAuthorized migrationInstallAuthorized deploymentAuthorized automaticRetry implementationEvidenceSha256 forwardPackageLockSha256 designProposalSha256 packageHashes packageDigest sealedPlanSha256 registrySha256 migrationRawSha256 migrationBodySha256 targetProfile targetIdentity runtimeBoundary sourcePrefixSha256 ledgerDescriptorSha256 catalogBeforeSha256 baselineAuthoritySha256 credentialIdentitySha256 credentialIdentityProvenance transportRiskAcceptance expectedCanonicalState'.split())
BACKUP_COMMON = set('contract planId scope rotationId operatorUid recordedAt packageDigest approvalId approvalRawSha256 humanApprovalSha256'.split())
BACKUP_IDS = set('authorizationRawSha256 authorizationCanonicalSha256 nonceSha256'.split())
BACKUP_FIELDS = {
    'phase': set('phase previousRecordSha256 oldAuthorizationRawSha256 newAuthorizationRawSha256 newAuthorizationCanonicalSha256 nonceSha256'.split()),
    'claim': set('family identity authorizationRawSha256'.split()),
    'bootstrap': set('historicalRawSha256 historicalNonceSha256 historicalBackupResultSha256 historicalCombinedResultSha256 blockedA1ResultSha256 status formalHistoricalConsume'.split()),
    'ready': BACKUP_IDS | set('state oldAuthorizationRawSha256 phaseFileHashes claimHashes bootstrapReceiptSha256 credentialProvenanceSha256 observedAt expiresAt maximumBackupAttempts'.split()),
    'entry': BACKUP_IDS | {'state','maximumBackupAttempts'},
    'consumption': BACKUP_IDS | {'state','entryReceiptSha256','readyReceiptSha256','maximumBackupAttempts'},
    'dispatch': BACKUP_IDS | {'state','consumptionReceiptSha256','maximumBackupAttempts'},
    'result': BACKUP_IDS | set('state consumptionReceiptSha256 dispatchReceiptSha256 backupDirectory backupManifestSha256 runnerReceiptName runnerReceiptSha256 primaryFailure'.split()),
    'terminal-archive': BACKUP_IDS | {'state','resultReceiptSha256','archiveRawSha256','canonicalAbsent'},
    'outcome': BACKUP_IDS | {'state','resultReceiptSha256','terminalArchiveReceiptSha256','canonicalAbsent','nextMigrationAllowed'},
    'secondary': BACKUP_IDS | {'primaryFailure','secondaryFailure','terminalStage','state'}}
BACKUP_FAMILIES = ('approval-id','approval-raw','human-approval','nonce','auth-raw')
BACKUP_DIRS = ('operations','ready','claims','runner-entry','consumed','dispatch','results','terminal-archive','secondary','outcomes','bootstrap')
BACKUP_STATES = ('BACKUP_SUCCESS','BACKUP_FAILED','BACKUP_NOT_DISPATCHED')


def _backup_contract(kind):
    return 'backup-historical-used-reservation/1' if kind == 'bootstrap' else 'backup-authorization-'+kind+'/1'


def _backup_nonce(nonce):
    return sha(canonical({'scope':BACKUP_SCOPE,'nonce':hexid(nonce,32)}))


def _backup_failure(error, category):
    if error is None: return None
    state = error.state if isinstance(error,Failure) else 'UNKNOWN_FAILURE'
    if state not in {'APPROVAL_MISSING','PRECHECK_FAILED','TARGET_IDENTITY_MISMATCH','BACKUP_FAILED','VERIFY_FAILED'}:
        state = 'UNKNOWN_FAILURE'
    detail = [error.state,error.code] if isinstance(error,Failure) else [type(error).__name__]
    return {'stateClass':state,'codeClass':category,'detailSha256':sha(canonical(detail))}


def _backup_authority_exact(actual, expected):
    # Python equality alone accepts bool as int and float as integer counters.
    if type(actual) is not type(expected): deny('BACKUP_AUTH_SOURCE_AUTHORITY')
    if type(expected) is dict:
        if set(actual)!=set(expected): deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        for key in expected: _backup_authority_exact(actual[key],expected[key])
    elif type(expected) is list:
        if len(actual)!=len(expected): deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        for a,b in zip(actual,expected): _backup_authority_exact(a,b)
    elif actual!=expected: deny('BACKUP_AUTH_SOURCE_AUTHORITY')


def _backup_authority_schema(data, fields, expected, now):
    """Closed authority schemas come only from the raw-SHA-pinned design."""
    if type(data) is not dict or set(data)!=set(fields): deny('BACKUP_AUTH_SOURCE_AUTHORITY')
    for key,spec in fields.items():
        value=data[key]
        if type(spec) is dict and set(spec)=={'const'}:
            _backup_authority_exact(value,spec['const'])
        elif type(spec) is dict and set(spec)=={'closedFields'}:
            if type(value) is not dict or set(value)!=set(spec['closedFields']): deny('BACKUP_AUTH_SOURCE_AUTHORITY')
            for digest in value.values(): hexid(digest)
        elif key=='recordedAt':
            if type(value) not in (int,float) or not math.isfinite(value) or not 0<value<=now:
                deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        elif key in expected:
            _backup_authority_exact(value,expected[key])
        elif key=='validationCompletionSha256': hexid(value)
        else: deny('BACKUP_AUTH_SOURCE_AUTHORITY')
    for key,value in expected.items():
        if key not in data: deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        _backup_authority_exact(data[key],value)


class BackupLifecycle:
    """Fixed backup-only protocol. Never imports transport or accesses credentials."""
    def __init__(self, plan):
        plan.ensure_ready()
        if plan.data['planId'] != 'acl-000-v1': deny('BACKUP_AUTH_PLAN')
        self.plan=plan
        self.profile=strict_json(pc.safe_file(pc.PROFILE_PATH))['profiles'][plan.data['targetProfile']]
        self.home=Path(self.profile['authorizationDirectory'])
        self.receipts=pc.ROOT/self.profile['receiptRoot']
        self.canonical=self.home/'acl-000-v1.backup.json'
        self.archive=self.home/'backup-archive'/'acl-000-v1'
        self.pending=self.home/'backup-pending'/'acl-000-v1'
        self.approvals=self.home/'backup-approvals'
        self.lockdir=self.home/'backup-lifecycle';self.lockpath=self.lockdir/'acl-000-v1.lock'
        self.root=self.receipts/'backup-authorization-lifecycle'/'acl-000-v1'

    def identity(self):
        p=self.profile;f=self.plan.fixture
        return {'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,
            'targetProfile':self.plan.data['targetProfile'],'imageId':p['imageId'],'fixture':f,
            'sslmode':None if f else 'verify-full','projectIdentitySha256':None if f else p['projectIdentitySha256'],
            'hostIdentitySha256':None if f else p['hostIdentitySha256']}

    def runtime(self):
        return {'buildId':self.profile['buildId'],'feature':'OFF','allowlists':'EMPTY'}

    def _artifact(self, path, digest=None):
        raw=pc.safe_file(pc.ROOT/path)
        if digest is not None and sha(raw)!=digest: deny('BACKUP_AUTH_EVIDENCE_HASH')
        return strict_json(raw),sha(raw)

    def authority(self):
        self.plan.ensure_ready();self.plan.source()
        if strict_json(pc.safe_file(pc.PROFILE_PATH))['profiles'][self.plan.data['targetProfile']]!=self.profile:
            deny('BACKUP_AUTH_PROFILE_CHANGED')
        package=pc.package_hashes();digest=sha(canonical(package))
        if len(package)!=10: deny('BACKUP_AUTH_PACKAGE_MEMBERSHIP')
        self._artifact(BACKUP_DESIGN,BACKUP_DESIGN_SHA)
        resolution,_=self._artifact(BACKUP_RESOLUTION_DESIGN,BACKUP_RESOLUTION_DESIGN_SHA)
        frozen=resolution['bindings']['currentPackageHashes']
        if type(package) is not dict or set(package)!=set(frozen): deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        for name,value in package.items():
            hexid(value)
            if name!='capture_authorization.py' and value!=frozen[name]: deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        # Sole fixed success inputs. Historical blocked bytes are never read here.
        raw=pc.safe_file(pc.ROOT/BACKUP_IMPLEMENTATION,True);impl,ih=strict_json(raw),sha(raw)
        raw=pc.safe_file(pc.ROOT/BACKUP_RESOLUTION_VALIDATION,True);validation,vh=strict_json(raw),sha(raw)
        raw=pc.safe_file(pc.ROOT/BACKUP_PACKAGE_LOCK,True);lock,lh=strict_json(raw),sha(raw)
        now=time.time()
        common={'designProposalSha256':BACKUP_DESIGN_SHA,'packageHashes':package,'packageDigest':digest,
                'sealedPlanSha256':self.plan.digest,'registrySha256':sha(pc.safe_file(pc.REGISTRY_PATH))}
        resolved=dict(common,resolutionDesignProposalSha256=BACKUP_RESOLUTION_DESIGN_SHA)
        _backup_authority_schema(impl,resolution['newCompletionAuthoritySchema']['fields'],
                                 dict(resolved,validationCompletionSha256=vh),now)
        _backup_authority_schema(validation,resolution['freshValidationAuthoritySchema']['fields'],resolved,now)
        _backup_authority_schema(lock,resolution['packageLockImpact']['fields'],dict(common,implementationEvidenceSha256=ih),now)
        for key in set(impl)&set(validation)-{'contract','status','recordedAt'}:
            _backup_authority_exact(impl[key],validation[key])
        if not validation['recordedAt']<=impl['recordedAt']<=lock['recordedAt']: deny('BACKUP_AUTH_SOURCE_AUTHORITY')
        baseline,_=self._artifact(BACKUP_BASELINE,BACKUP_BASELINE_SHA)
        for path,h in BACKUP_LINEAGE.values():self._artifact(path,h)
        pc.risk_guard(self.plan,{} if self.plan.fixture else {'transportRiskAcceptance':pc.RISK_BINDING.copy()})
        return {'package':package,'digest':digest,'implementationSha':ih,'lockSha':lh,
                'completedAt':max(impl['recordedAt'],lock['recordedAt']),'baseline':baseline['acceptedBaseline']}

    @contextlib.contextmanager
    def locked(self):
        self.authority();directory(self.home);directory(self.receipts);directory(self.lockdir,True)
        flags=os.O_RDWR|os.O_NOFOLLOW|os.O_CLOEXEC
        try:
            fd=os.open(self.lockpath,flags|os.O_CREAT|os.O_EXCL,0o600);os.fsync(fd);syncdir(self.lockdir)
        except FileExistsError:fd=os.open(self.lockpath,flags)
        try:
            s=os.fstat(fd)
            if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o600 or self.lockpath.lstat()!=s:deny('BACKUP_AUTH_LOCK_IDENTITY')
            try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:deny('BACKUP_AUTH_LOCK_BUSY')
            if self.lockpath.lstat()!=os.fstat(fd):deny('BACKUP_AUTH_LOCK_IDENTITY')
            self.authority()
            for p in [self.home/'backup-archive',self.archive,self.home/'backup-pending',self.pending,self.approvals,
                      self.receipts/'backup-authorization-lifecycle',self.root,*[self.root/x for x in BACKUP_DIRS],
                      *[self.root/'claims'/x for x in BACKUP_FAMILIES]]:directory(p,True)
            yield
        finally:os.close(fd)

    def _schema(self, data, kind):
        if type(data) is not dict or set(data)!=BACKUP_COMMON|BACKUP_FIELDS[kind] or data['contract']!=_backup_contract(kind) or sanitized(data)!=data:
            deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        if data['planId']!='acl-000-v1' or data['scope']!=BACKUP_SCOPE or type(data['operatorUid']) is not int or data['operatorUid']!=os.getuid():deny('BACKUP_AUTH_RECEIPT_BINDING')
        for k in ['rotationId','approvalId']:hexid(data[k],32)
        for k in ['packageDigest','approvalRawSha256','humanApprovalSha256']:hexid(data[k])
        for k,v in data.items():
            if k.endswith('Sha256') and v is not None:hexid(v)
            if k in ['recordedAt','observedAt','expiresAt'] and (type(v) not in (int,float) or not math.isfinite(v)):deny('BACKUP_AUTH_RECEIPT_TIME')
        if 'maximumBackupAttempts' in data and (type(data['maximumBackupAttempts']) is not int or data['maximumBackupAttempts']!=1):deny('BACKUP_AUTH_RECEIPT_BINDING')
        if kind=='phase' and data['phase'] not in PHASES:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        if kind=='claim':
            if data['family'] not in BACKUP_FAMILIES:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
            hexid(data['identity'],32 if data['family']=='approval-id' else 64)
        states={'ready':('MINT_READY',),'entry':('CHECKING_READY',),'consumption':('CONSUMED_PRE_CREDENTIAL',),
                'dispatch':('BACKUP_DISPATCH_INTENT',),'terminal-archive':('TERMINALLY_ARCHIVED',),
                'result':BACKUP_STATES,'outcome':BACKUP_STATES,'secondary':('LIFECYCLE_FINALIZATION_FAILED',)}
        if kind in states and data['state'] not in states[kind]:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        if kind=='bootstrap' and (data['status']!='HISTORICAL_USED_NO_FORMAL_CONSUME' or data['formalHistoricalConsume'] is not False):deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        if 'canonicalAbsent' in data and data['canonicalAbsent'] is not True:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        if 'nextMigrationAllowed' in data and data['nextMigrationAllowed'] is not False:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        for k in ['primaryFailure','secondaryFailure']:
            if k not in data or data[k] is None:continue
            f=data[k]
            if type(f) is not dict or set(f)!={'stateClass','codeClass','detailSha256'} or f['stateClass'] not in {'APPROVAL_MISSING','PRECHECK_FAILED','TARGET_IDENTITY_MISMATCH','BACKUP_FAILED','VERIFY_FAILED','UNKNOWN_FAILURE'} or f['codeClass'] not in {'AUTHORIZATION_GATE','CREDENTIAL_OR_RUNTIME_GATE','BACKUP_BODY_FAILURE','DIAGNOSTIC_PERSISTENCE','LIFECYCLE_PERSISTENCE','LIFECYCLE_ARCHIVE','UNKNOWN_FAILURE'}:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
            hexid(f['detailSha256'])
        if kind=='secondary' and data['terminalStage'] not in {'RESULT_WRITE','CANONICAL_VERIFY','ARCHIVE_MOVE','ARCHIVE_RECEIPT','OUTCOME_RECEIPT'}:deny('BACKUP_AUTH_RECEIPT_SCHEMA')
        if kind=='result':
            if data['backupDirectory'] is not None:
                p=Path(data['backupDirectory'])
                if p.parent!=Path(self.profile['backupRoot']) or not re.fullmatch('exact-single-[a-f0-9]{32}',p.name):deny('BACKUP_AUTH_RESULT_PATH')
            if data['runnerReceiptName'] is not None and not re.fullmatch(r'[a-f0-9]{32}\.backup\.json',data['runnerReceiptName']):deny('BACKUP_AUTH_RESULT_PATH')
        return data

    def _write(self, path, kind, data):
        data=dict(data,contract=_backup_contract(kind),recordedAt=time.time())
        self._schema(data,kind);h=record(path,data)
        if safe_file(path,True)!=canonical(data)+b'\n':deny('BACKUP_AUTH_RECEIPT_READBACK')
        return h

    def _read(self,path,kind):return self._schema(read_record(path),kind)

    def _same(self, a,b,keys):
        if any(canonical(a.get(k))!=canonical(b.get(k)) for k in keys):deny('BACKUP_AUTH_CHAIN')

    def _base(self,rotation,a,h):
        return dict(planId='acl-000-v1',scope=BACKUP_SCOPE,rotationId=rotation,operatorUid=os.getuid(),
                    packageDigest=a['packageDigest'],approvalId=a['approvalId'],approvalRawSha256=h,humanApprovalSha256=a['humanApprovalSha256'])

    def _ids(self,raw):
        a=strict_json(raw)
        return dict(authorizationRawSha256=sha(raw),authorizationCanonicalSha256=sha(canonical(a)),nonceSha256=_backup_nonce(a['nonce']))

    def approval(self,aid,h,provenance=True):
        hexid(aid,32);hexid(h);raw=safe_file(self.approvals/(aid+'.json'),True)
        if sha(raw)!=h:deny('BACKUP_AUTH_APPROVAL_HASH')
        a=strict_json(raw);v=self.authority()
        if type(a) is not dict or set(a)!=BACKUP_APPROVAL_FIELDS or sanitized(a)!=a:deny('BACKUP_AUTH_APPROVAL_SCHEMA')
        expected={'contract':'backup-execution-approval/1','approvalId':aid,'scope':BACKUP_SCOPE,'planId':'acl-000-v1',
            'explicitUserApproval':True,'operatorUid':os.getuid(),'maximumBackupAttempts':1,'maximumOwnedRecoveryAttempts':1,
            'freshPreinstallAuthorized':False,'migrationInstallAuthorized':False,'deploymentAuthorized':False,'automaticRetry':False,
            'implementationEvidenceSha256':v['implementationSha'],'forwardPackageLockSha256':v['lockSha'],'designProposalSha256':BACKUP_DESIGN_SHA,
            'packageHashes':v['package'],'packageDigest':v['digest'],'sealedPlanSha256':self.plan.digest,
            'registrySha256':sha(pc.safe_file(pc.REGISTRY_PATH)),'migrationRawSha256':self.plan.migration['rawSha256'],
            'migrationBodySha256':self.plan.migration['bodySha256'],'targetProfile':self.plan.data['targetProfile'],
            'targetIdentity':self.identity(),'runtimeBoundary':self.runtime(),'sourcePrefixSha256':self.plan.data['ledger']['sourcePrefixSha256'],
            'ledgerDescriptorSha256':v['baseline']['ledgerDescriptorSha256'],'catalogBeforeSha256':v['baseline']['protectedCatalogSha256'],
            'baselineAuthoritySha256':BACKUP_BASELINE_SHA,'transportRiskAcceptance':None if self.plan.fixture else pc.RISK_BINDING.copy()}
        self._same(a,expected,expected)
        fresh(a);hexid(a['humanApprovalSha256'])
        if a['observedAt']<v['completedAt']:deny('BACKUP_AUTH_APPROVAL_PREDATES_IMPLEMENTATION')
        if a['humanApprovalSha256'] in {BACKUP_BASELINE_SHA,BACKUP_DESIGN_SHA,*[x[1] for x in BACKUP_LINEAGE.values()]}:deny('BACKUP_AUTH_OLD_HUMAN_APPROVAL')
        e=a['expectedCanonicalState'];p=a['credentialIdentityProvenance']
        if type(e) is not dict or set(e)!={'state','rawSha256'} or e['state'] not in {'HISTORICAL_USED_EXPIRED','ABSENT_TERMINAL'}:deny('BACKUP_AUTH_APPROVAL_SCHEMA')
        if e!={'state':'HISTORICAL_USED_EXPIRED','rawSha256':BACKUP_LEGACY_SHA} and e!={'state':'ABSENT_TERMINAL','rawSha256':None}:deny('BACKUP_AUTH_OLD_HASH')
        if type(p) is not dict or set(p)!={'kind','authorizationRawSha256','outcomeSha256'} or p['kind'] not in {'HISTORICAL_BOOTSTRAP','COMPLETED_BACKUP'}:deny('BACKUP_AUTH_CREDENTIAL_PROVENANCE')
        hexid(p['authorizationRawSha256'])
        if self.plan.fixture:
            if a['credentialIdentitySha256'] is not None:deny('BACKUP_AUTH_CREDENTIAL_PROVENANCE')
        else:hexid(a['credentialIdentitySha256'])
        if provenance:self.provenance(a)
        return a

    def provenance(self,a):
        p=a['credentialIdentityProvenance'];h=p['authorizationRawSha256']
        if p['kind']=='HISTORICAL_BOOTSTRAP':
            if h!=BACKUP_LEGACY_SHA or p['outcomeSha256'] is not None:deny('BACKUP_AUTH_CREDENTIAL_PROVENANCE')
            path=self.archive/(h+'.json')
            if os.path.lexists(self.canonical) and sha(safe_file(self.canonical,True))==h:path=self.canonical
            raw=safe_file(path,True);proof,_=self._artifact(BACKUP_IDENTITY,BACKUP_IDENTITY_SHA)
            if proof.get('rawSha256')!=h or proof.get('credentialIdentitySha256')!=a['credentialIdentitySha256']:deny('BACKUP_AUTH_CREDENTIAL_PROVENANCE')
        else:
            hexid(p['outcomeSha256']);self.verify_terminal(h)
            if sha(safe_file(self.root/'outcomes'/(h+'.json'),True))!=p['outcomeSha256']:deny('BACKUP_AUTH_CREDENTIAL_PROVENANCE')
            raw=safe_file(self.archive/(h+'.json'),True)
        old=strict_json(raw)
        if sha(raw)!=h or old.get('scope')!=BACKUP_SCOPE or old.get('targetIdentity')!=self.identity() or old.get('credentialIdentitySha256')!=a['credentialIdentitySha256']:
            deny('BACKUP_AUTH_CREDENTIAL_PROVENANCE')

    def _entries(self,path,dirs=False,length=64):
        out={}
        for p in path.iterdir():
            name=p.name if dirs else p.stem
            hexid(name,length)
            if dirs:directory(p)
            elif p.name!=name+'.json':deny('BACKUP_AUTH_PATH_UNSAFE')
            else:safe_file(p,True)
            out[name]=p
        return out

    def verify_ready(self,h):
        hexid(h);r=self._read(self.root/'ready'/(h+'.json'),'ready')
        if r['authorizationRawSha256']!=h or set(r['phaseFileHashes'])!=set(PHASES) or set(r['claimHashes'])!=set(BACKUP_FAMILIES):deny('BACKUP_AUTH_CHAIN')
        folder=self.root/'operations'/r['rotationId'];directory(folder)
        if set(p.name for p in folder.iterdir())!={n+'.json' for n in PHASES}:deny('BACKUP_AUTH_INCOMPLETE')
        prev=None;oldh=r['oldAuthorizationRawSha256']
        keys=BACKUP_COMMON-{'contract','recordedAt'}
        for phase in PHASES:
            path=folder/(phase+'.json');p=self._read(path,'phase');self._same(p,r,keys)
            if sha(safe_file(path,True))!=r['phaseFileHashes'][phase] or p['phase']!=phase or p['previousRecordSha256']!=prev or p['oldAuthorizationRawSha256']!=oldh or p['nonceSha256']!=r['nonceSha256']:deny('BACKUP_AUTH_CHAIN')
            if p['newAuthorizationRawSha256']!=(h if phase in ('STAGED','PUBLISHED') else None) or p['newAuthorizationCanonicalSha256']!=(r['authorizationCanonicalSha256'] if phase in ('STAGED','PUBLISHED') else None):deny('BACKUP_AUTH_CHAIN')
            prev=r['phaseFileHashes'][phase]
        identities={'approval-id':r['approvalId'],'approval-raw':r['approvalRawSha256'],'human-approval':r['humanApprovalSha256'],'nonce':r['nonceSha256'],'auth-raw':h}
        for family,key in identities.items():
            path=self.root/'claims'/family/(key+'.json');c=self._read(path,'claim');self._same(c,r,keys)
            if c['family']!=family or c['identity']!=key or c['authorizationRawSha256']!=(h if family=='auth-raw' else None) or sha(safe_file(path,True))!=r['claimHashes'][family]:deny('BACKUP_AUTH_CHAIN')
        if oldh is not None:
            if oldh!=BACKUP_LEGACY_SHA or sha(safe_file(self.archive/(oldh+'.json'),True))!=oldh:deny('BACKUP_AUTH_CHAIN')
            path=self.root/'bootstrap'/(oldh+'.json');b=self._read(path,'bootstrap');self._same(b,r,keys)
            if sha(safe_file(path,True))!=r['bootstrapReceiptSha256'] or b['historicalRawSha256']!=oldh or any(b[k]!=v[1] for k,v in BACKUP_LINEAGE.items()):deny('BACKUP_AUTH_CHAIN')
            nh=_backup_nonce(strict_json(safe_file(self.archive/(oldh+'.json'),True))['nonce'])
            c=self._read(self.root/'claims'/'nonce'/(nh+'.json'),'claim');self._same(c,r,keys)
            if b['historicalNonceSha256']!=nh or c['identity']!=nh or c['family']!='nonce' or c['authorizationRawSha256']!=oldh:deny('BACKUP_AUTH_CHAIN')
        elif r['bootstrapReceiptSha256'] is not None:deny('BACKUP_AUTH_CHAIN')
        raw=safe_file(self.approvals/(r['approvalId']+'.json'),True)
        if sha(raw)!=r['approvalRawSha256']:deny('BACKUP_AUTH_CHAIN')
        a=strict_json(raw)
        if set(a)!=BACKUP_APPROVAL_FIELDS or a['contract']!='backup-execution-approval/1' or a['scope']!=BACKUP_SCOPE or a['humanApprovalSha256']!=r['humanApprovalSha256'] or sha(canonical(a['packageHashes']))!=r['packageDigest'] or a['credentialIdentityProvenance']['authorizationRawSha256']!=r['credentialProvenanceSha256'] or r['expiresAt']>a['expiresAt'] or r['observedAt']<a['observedAt']:deny('BACKUP_AUTH_CHAIN')
        return r

    def verify_terminal(self,h):
        r=self.verify_ready(h);keys=(BACKUP_COMMON-{'contract','recordedAt'})|BACKUP_IDS
        records={};hashes={}
        for folder,kind in [('runner-entry','entry'),('consumed','consumption'),('results','result'),('terminal-archive','terminal-archive'),('outcomes','outcome')]:
            p=self.root/folder/(h+'.json');x=self._read(p,kind);self._same(x,r,keys);records[folder]=x;hashes[folder]=sha(safe_file(p,True))
        c=records['consumed'];b=records['results'];t=records['terminal-archive'];o=records['outcomes']
        if c['entryReceiptSha256']!=hashes['runner-entry'] or c['readyReceiptSha256']!=sha(safe_file(self.root/'ready'/(h+'.json'),True)) or b['consumptionReceiptSha256']!=hashes['consumed'] or t['resultReceiptSha256']!=hashes['results'] or t['archiveRawSha256']!=h or o['resultReceiptSha256']!=hashes['results'] or o['terminalArchiveReceiptSha256']!=hashes['terminal-archive'] or o['state']!=b['state']:deny('BACKUP_AUTH_CHAIN')
        if b['dispatchReceiptSha256'] is not None:
            p=self.root/'dispatch'/(h+'.json');x=self._read(p,'dispatch');self._same(x,r,keys)
            if sha(safe_file(p,True))!=b['dispatchReceiptSha256'] or x['consumptionReceiptSha256']!=hashes['consumed'] or b['state']=='BACKUP_NOT_DISPATCHED':deny('BACKUP_AUTH_CHAIN')
        elif b['state']!='BACKUP_NOT_DISPATCHED' or os.path.lexists(self.root/'dispatch'/(h+'.json')):deny('BACKUP_AUTH_CHAIN')
        raw=safe_file(self.archive/(h+'.json'),True);self._same(self._ids(raw),r,BACKUP_IDS)
        if b['state']=='BACKUP_SUCCESS':self._success(b,historical=True)
        return o

    def inventory(self,active=None):
        if set(p.name for p in self.root.iterdir())!=set(BACKUP_DIRS) or set(p.name for p in (self.root/'claims').iterdir())!=set(BACKUP_FAMILIES):deny('BACKUP_AUTH_INCOMPLETE')
        if list(self.pending.iterdir()) or list((self.root/'secondary').iterdir()):deny('BACKUP_AUTH_INCOMPLETE')
        ready=self._entries(self.root/'ready');operations=self._entries(self.root/'operations',True,32)
        expected={k:set() for k in BACKUP_FAMILIES};rotations=set();terminal=set();dispatch=set();bootstrap=set()
        for h in ready:
            r=self.verify_ready(h);rotations.add(r['rotationId'])
            for k,v in [('approval-id',r['approvalId']),('approval-raw',r['approvalRawSha256']),('human-approval',r['humanApprovalSha256']),('nonce',r['nonceSha256']),('auth-raw',h)]:
                if v in expected[k]:deny('BACKUP_AUTH_REPLAY')
                expected[k].add(v)
            if r['oldAuthorizationRawSha256']:
                bootstrap.add(BACKUP_LEGACY_SHA);b=self._read(self.root/'bootstrap'/(BACKUP_LEGACY_SHA+'.json'),'bootstrap');expected['nonce'].add(b['historicalNonceSha256'])
            if h==active:
                if any(os.path.lexists(self.root/f/(h+'.json')) for f in ['runner-entry','consumed','dispatch','results','terminal-archive','outcomes']):deny('BACKUP_AUTH_CONSUMED')
            else:
                self.verify_terminal(h);terminal.add(h)
                if os.path.lexists(self.root/'dispatch'/(h+'.json')):dispatch.add(h)
        if active is not None and active not in ready:deny('BACKUP_AUTH_READY_REQUIRED')
        if rotations!=set(operations):deny('BACKUP_AUTH_INCOMPLETE')
        for family,ids in expected.items():
            if set(self._entries(self.root/'claims'/family,length=32 if family=='approval-id' else 64))!=ids:deny('BACKUP_AUTH_INCOMPLETE')
        if set(self._entries(self.root/'bootstrap'))!=bootstrap:deny('BACKUP_AUTH_INCOMPLETE')
        for f in ['runner-entry','consumed','results','terminal-archive','outcomes']:
            if set(self._entries(self.root/f))!=terminal:deny('BACKUP_AUTH_INCOMPLETE')
        if set(self._entries(self.root/'dispatch'))!=dispatch:deny('BACKUP_AUTH_INCOMPLETE')
        if set(self._entries(self.archive))!=bootstrap|terminal:deny('BACKUP_AUTH_INCOMPLETE')
        return terminal

    def mint(self,aid,h):
        # No directory mutation until all external authority/provenance gates pass.
        a=self.approval(aid,h)
        with self.locked():
            terminal=self.inventory();a=self.approval(aid,h);e=a['expectedCanonicalState'];oldraw=None
            if e['state']=='HISTORICAL_USED_EXPIRED':
                if terminal:deny('BACKUP_AUTH_BOOTSTRAP_REPLAY')
                oldraw=safe_file(self.canonical,True);old=strict_json(oldraw)
                if sha(oldraw)!=BACKUP_LEGACY_SHA or old.get('scope')!=BACKUP_SCOPE or old.get('contract')!='exact-single-operator-authorization/'+('1' if self.plan.fixture else '2') or set(old)!=(pc.AUTH_FIELDS if self.plan.fixture else pc.AUTH_FIELDS|{'transportRiskAcceptance'}):deny('BACKUP_AUTH_OLD_HASH')
                if type(old.get('expiresAt')) not in (int,float) or not math.isfinite(old['expiresAt']) or old['expiresAt']>time.time():deny('BACKUP_AUTH_OLD_ACTIVE')
                if os.path.lexists(self.archive/(BACKUP_LEGACY_SHA+'.json')):deny('AUTH_ARCHIVE_COLLISION')
            elif os.path.lexists(self.canonical) or not terminal:deny('BACKUP_AUTH_EXPECTED_TERMINAL')
            rotation=uuid.uuid4().hex;nonce=uuid.uuid4().hex;nh=_backup_nonce(nonce);base=self._base(rotation,a,h)
            identities={'approval-id':aid,'approval-raw':h,'human-approval':a['humanApprovalSha256'],'nonce':nh}
            for family,key in identities.items():
                if os.path.lexists(self.root/'claims'/family/(key+'.json')):deny('BACKUP_AUTH_REPLAY')
            if oldraw and nh==_backup_nonce(old['nonce']):deny('BACKUP_AUTH_REPLAY')
            folder=self.root/'operations'/rotation;os.mkdir(folder,0o700);syncdir(folder.parent)
            phases={};claims={};oldh=sha(oldraw) if oldraw else None;newh=None;newch=None
            def phase(name):
                phases[name]=self._write(folder/(name+'.json'),'phase',dict(base,phase=name,previousRecordSha256=next(reversed(phases.values())) if phases else None,oldAuthorizationRawSha256=oldh,newAuthorizationRawSha256=newh,newAuthorizationCanonicalSha256=newch,nonceSha256=nh))
            phase('PREPARED')
            for family,key in identities.items():claims[family]=self._write(self.root/'claims'/family/(key+'.json'),'claim',dict(base,family=family,identity=key,authorizationRawSha256=None))
            bh=None
            if oldraw:
                onh=_backup_nonce(old['nonce'])
                bh=self._write(self.root/'bootstrap'/(oldh+'.json'),'bootstrap',dict(base,historicalRawSha256=oldh,historicalNonceSha256=onh,**{k:v[1] for k,v in BACKUP_LINEAGE.items()},status='HISTORICAL_USED_NO_FORMAL_CONSUME',formalHistoricalConsume=False))
                self._write(self.root/'claims'/'nonce'/(onh+'.json'),'claim',dict(base,family='nonce',identity=onh,authorizationRawSha256=oldh))
                move_exact(self.canonical,self.archive/(oldh+'.json'),oldh)
            phase('ARCHIVED');now=time.time()
            auth={'contract':'exact-single-operator-authorization/'+('1' if self.plan.fixture else '2'),'scope':BACKUP_SCOPE,
                'planId':'acl-000-v1','planSha256':self.plan.digest,'migrationVersion':self.plan.data['migration']['version'],
                'migrationSha256':self.plan.migration['rawSha256'],'packageHashes':pc.package_hashes(),'targetProfile':self.plan.data['targetProfile'],
                'targetIdentity':self.identity(),'observedAt':now,'expiresAt':min(now+900,a['expiresAt']),'operatorUid':os.getuid(),
                'userApprovalRef':str(self.approvals/(aid+'.json')),'userApprovalSha256':h,'nonce':nonce,
                'ledgerDescriptorSha256':a['ledgerDescriptorSha256'],'catalogBeforeSha256':a['catalogBeforeSha256'],
                'backupManifestSha256':None,'backupDirectory':None,'runtimeBoundary':self.runtime(),'credentialIdentitySha256':a['credentialIdentitySha256']}
            if not self.plan.fixture:auth['transportRiskAcceptance']=pc.RISK_BINDING.copy()
            pc.authorize(self.plan,auth,BACKUP_SCOPE)
            pending=self.pending/(rotation+'.json');newh=record(pending,auth)
            raw=safe_file(pending,True)
            if raw!=canonical(auth)+b'\n':deny('BACKUP_AUTH_PENDING_READBACK')
            newch=sha(canonical(auth));claims['auth-raw']=self._write(self.root/'claims'/'auth-raw'/(newh+'.json'),'claim',dict(base,family='auth-raw',identity=newh,authorizationRawSha256=newh))
            phase('STAGED');self.authority();self.approval(aid,h);pc.authorize(self.plan,auth,BACKUP_SCOPE)
            for family,key in identities.items():
                if sha(safe_file(self.root/'claims'/family/(key+'.json'),True))!=claims[family]:deny('BACKUP_AUTH_CHAIN')
            move_exact(pending,self.canonical,newh);phase('PUBLISHED')
            self._write(self.root/'ready'/(newh+'.json'),'ready',dict(base,**self._ids(raw),state='MINT_READY',oldAuthorizationRawSha256=oldh,phaseFileHashes=phases,claimHashes=claims,bootstrapReceiptSha256=bh,credentialProvenanceSha256=a['credentialIdentityProvenance']['authorizationRawSha256'],observedAt=now,expiresAt=auth['expiresAt'],maximumBackupAttempts=1))
            self.verify_ready(newh)
            return {'state':'MINT_READY','authorizationRawSha256':newh,'nextMigrationAllowed':False}

    def _success(self,b,*,historical=False):
        if not all(b[k] for k in ['backupDirectory','backupManifestSha256','runnerReceiptName','runnerReceiptSha256']):deny('BACKUP_AUTH_RESULT_MISSING')
        self._schema(b,'result')
        manifest=Path(b['backupDirectory'])/'metadata/manifest.json';raw=safe_file(manifest,True)
        if sha(raw)!=b['backupManifestSha256']:deny('BACKUP_AUTH_RESULT_HASH')
        m=strict_json(raw)
        # Fresh and terminal-history validation are distinct. No authority pin,
        # envelope, consumption, dispatch or archive policy is changed here.
        ready=self.verify_ready(b['authorizationRawSha256'])
        self._same(b,ready,(BACKUP_COMMON-{'contract','recordedAt'})|BACKUP_IDS)
        approval_raw=safe_file(self.approvals/(ready['approvalId']+'.json'),True)
        if sha(approval_raw)!=ready['approvalRawSha256']:deny('BACKUP_AUTH_RESULT_BINDING')
        approval=strict_json(approval_raw)
        auth_path=self.archive/(b['authorizationRawSha256']+'.json') if historical else self.canonical
        auth_raw=safe_file(auth_path,True)
        if sha(auth_raw)!=b['authorizationRawSha256']:deny('BACKUP_AUTH_RESULT_BINDING')
        auth=strict_json(auth_raw)
        if (m.get('packageHashes')!=approval['packageHashes'] or auth['packageHashes']!=approval['packageHashes'] or
            sha(canonical(approval['packageHashes']))!=b['packageDigest']):deny('BACKUP_AUTH_RESULT_BINDING')
        from backup_adapter import validate_recovery_artifacts
        try:
            validate_recovery_artifacts(Path(b['backupDirectory']),b['backupManifestSha256'],
                expected_package_digest=b['packageDigest'],expected_plan_sha=self.plan.digest,
                expected_target_sha=sha(canonical(auth['targetIdentity'])),
                expected_target_identity=auth['targetIdentity'],
                expected_credential_sha=auth['credentialIdentitySha256'],
                expected_authorization_sha=sha(canonical(auth)),historical=historical)
        except Failure:deny('BACKUP_AUTH_RESULT_BINDING')
        raw=safe_file(self.receipts/b['runnerReceiptName'],True)
        expected={'state':'SUCCESS','backupManifestSha256':b['backupManifestSha256'],'planId':'acl-000-v1','planSha256':self.plan.digest,'nextMigrationAllowed':False}
        if sha(raw)!=b['runnerReceiptSha256'] or canonical(strict_json(raw))!=canonical(expected):deny('BACKUP_AUTH_RESULT_BINDING')

    @contextlib.contextmanager
    def attempt(self):
        with self.locked():
            raw=safe_file(self.canonical,True);auth=strict_json(raw);h=sha(raw)
            if any(os.path.lexists(self.root/f/(h+'.json')) for f in ['runner-entry','consumed','dispatch']):deny('BACKUP_AUTH_CONSUMED')
            pc.authorize(self.plan,auth,BACKUP_SCOPE)
            self.inventory(active=h);r=self.verify_ready(h);a=self.approval(r['approvalId'],r['approvalRawSha256'])
            base={k:r[k] for k in BACKUP_COMMON-{'contract','recordedAt'}};ids=self._ids(raw)
            entry=self._write(self.root/'runner-entry'/(h+'.json'),'entry',dict(base,**ids,state='CHECKING_READY',maximumBackupAttempts=1))
            r=self.verify_ready(h);self._same(ids,r,BACKUP_IDS);a=self.approval(r['approvalId'],r['approvalRawSha256'])
            if safe_file(self.canonical,True)!=raw or auth['userApprovalRef']!=str(self.approvals/(a['approvalId']+'.json')) or auth['userApprovalSha256']!=r['approvalRawSha256'] or auth['expiresAt']>a['expiresAt'] or auth['observedAt']!=r['observedAt'] or auth['expiresAt']!=r['expiresAt'] or auth['packageHashes']!=a['packageHashes'] or auth['targetIdentity']!=self.identity() or auth['runtimeBoundary']!=self.runtime() or auth['credentialIdentitySha256']!=a['credentialIdentitySha256'] or auth['backupDirectory'] is not None or auth['backupManifestSha256'] is not None:deny('BACKUP_AUTH_CHAIN')
            pc.authorize(self.plan,auth,BACKUP_SCOPE)
            consumed=self._write(self.root/'consumed'/(h+'.json'),'consumption',dict(base,**ids,state='CONSUMED_PRE_CREDENTIAL',entryReceiptSha256=entry,readyReceiptSha256=sha(safe_file(self.root/'ready'/(h+'.json'),True)),maximumBackupAttempts=1))
            lease={'auth':auth,'backupDirectory':None,'backupManifestSha256':None,'runnerReceiptName':None,'runnerReceiptSha256':None}
            dispatched=[None]
            def dispatch():
                dispatched[0]=self._write(self.root/'dispatch'/(h+'.json'),'dispatch',dict(base,**ids,state='BACKUP_DISPATCH_INTENT',consumptionReceiptSha256=consumed,maximumBackupAttempts=1))
            lease['dispatch']=dispatch
            primary=None
            try:yield lease
            except BaseException as error:primary=error;raise
            finally:
                stage='RESULT_WRITE'
                try:
                    state=('BACKUP_FAILED' if dispatched[0] else 'BACKUP_NOT_DISPATCHED') if primary is not None else 'BACKUP_SUCCESS'
                    body=dict(base,**ids,contract=_backup_contract('result'),recordedAt=time.time(),state=state,consumptionReceiptSha256=consumed,dispatchReceiptSha256=dispatched[0],primaryFailure=_backup_failure(primary,'BACKUP_BODY_FAILURE' if dispatched[0] else 'CREDENTIAL_OR_RUNTIME_GATE'),**{k:lease[k] for k in ['backupDirectory','backupManifestSha256','runnerReceiptName','runnerReceiptSha256']})
                    if primary is None:
                        if dispatched[0] is None:deny('BACKUP_AUTH_DISPATCH_MISSING')
                        self._success(body)
                    rh=self._write(self.root/'results'/(h+'.json'),'result',body)
                    stage='CANONICAL_VERIFY'
                    if safe_file(self.canonical,True)!=raw:deny('BACKUP_AUTH_CANONICAL_CHANGED')
                    stage='ARCHIVE_MOVE';move_exact(self.canonical,self.archive/(h+'.json'),h)
                    stage='ARCHIVE_RECEIPT'
                    if os.path.lexists(self.canonical):deny('BACKUP_AUTH_CANONICAL_REMAINS')
                    th=self._write(self.root/'terminal-archive'/(h+'.json'),'terminal-archive',dict(base,**ids,state='TERMINALLY_ARCHIVED',resultReceiptSha256=rh,archiveRawSha256=h,canonicalAbsent=True))
                    stage='OUTCOME_RECEIPT'
                    self._write(self.root/'outcomes'/(h+'.json'),'outcome',dict(base,**ids,state=state,resultReceiptSha256=rh,terminalArchiveReceiptSha256=th,canonicalAbsent=True,nextMigrationAllowed=False))
                except BaseException as secondary:
                    try:self._write(self.root/'secondary'/(h+'.json'),'secondary',dict(base,**ids,state='LIFECYCLE_FINALIZATION_FAILED',primaryFailure=_backup_failure(primary,'BACKUP_BODY_FAILURE' if dispatched[0] else 'CREDENTIAL_OR_RUNTIME_GATE'),secondaryFailure=_backup_failure(secondary,'LIFECYCLE_ARCHIVE' if stage in {'ARCHIVE_MOVE','CANONICAL_VERIFY'} else 'LIFECYCLE_PERSISTENCE'),terminalStage=stage))
                    except BaseException:pass  # No fallback/retry; incomplete durable chain remains closed.
                    if primary is None:raise Failure('VERIFY_FAILED','BACKUP_AUTH_FINALIZATION_FAILED') from None


def backup_attempt(plan):
    return BackupLifecycle(plan).attempt()


def main(argv=None):
    parser=argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument('command',choices=['mint','mint-backup'])
    parser.add_argument('--plan',required=True,choices=['acl-000-v1'])
    parser.add_argument('--approval-id',required=True)
    parser.add_argument('--approval-sha256',required=True)
    args=parser.parse_args(argv)
    try:
        hexid(args.approval_id,32);hexid(args.approval_sha256)
        kind = BackupLifecycle if args.command == 'mint-backup' else Lifecycle
        result=kind(pc.load_plan(args.plan)).mint(args.approval_id,args.approval_sha256)
        print(json.dumps(result));return 0
    except Failure as e:
        print(json.dumps({'state':e.state,'code':e.code,'nextMigrationAllowed':False}));return 1
    except Exception:
        print(json.dumps({'state':'PRECHECK_FAILED','code':'AUTH_LOCAL_IO_OR_PROTOCOL_FAILURE','nextMigrationAllowed':False}));return 1


if __name__=='__main__':raise SystemExit(main())

"""Versioned maintenance transport. No public SQL execution surface or CLI DSN."""
import configparser
import contextlib
import contextvars
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import threading
import time
import uuid
from receipts import Failure, safe_file, strict_json, sha, canonical, exclusive, private_directory, sanitized
from plan_contract import (PROFILE_PATH, ROOT, authorize, authorize_capture, CAPTURE_MODE,
                           TRANSPORT_CONTRACT, RISK_BINDING, risk_guard)

IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.159'
IMAGE_ID = 'sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f'
ENV = {'PATH':'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C.UTF-8'}


# Only the local C/D/E1-E9 backup segment activates this private context.
_LOCAL_DIAGNOSTIC = contextvars.ContextVar('backup_local_diagnostic', default=None)
_LOCAL_OPERATION = contextvars.ContextVar('backup_local_operation', default=None)
_DIAGNOSTIC_PHASES = {
    'C': {'ARCHIVE_FULL_TOC_LIST'}, 'D': {'ARCHIVE_SCHEMA_TOC_LIST'},
    'E1': {'OWNED_CLUSTER_RUN'},
    'E2': {'OWNED_PG_ISREADY', 'OWNED_INSPECT', 'OWNED_BOOTSTRAP_IDENTITY',
           'OWNED_RESTORE_ADMIN_CREATE', 'OWNED_RESTORE_ADMIN_IDENTITY'},
    'E3': {'OWNED_ROLES_SQL', 'OWNED_INSPECT', 'OWNED_ROLE_STATE',
           'OWNED_STAGED_PLPGSQL_SQL', 'OWNED_STAGED_PLPGSQL_STATE', 'OWNED_FOOTPRINT'},
    'E4': {'OWNED_PG_RESTORE'},
    'E5': {'OWNED_INSPECT', 'OWNED_FIRST_OBSERVE_PSQL'},
    'E6': {'OWNED_SUPPLEMENT_SQL', 'OWNED_INSPECT'},
    'E6_DB_ACL': {'OWNED_INSPECT', 'OWNED_DATABASE_ACL_STATE', 'OWNED_DATABASE_ACL_SQL'},
    'E7': {'OWNED_INSPECT', 'OWNED_FINAL_OBSERVE_COUNTS_PSQL',
           'OWNED_STAGED_PLPGSQL_STATE', 'OWNED_ROLE_STATE', 'OWNED_FOOTPRINT'}, 'E8': set(),
    'E9': {'OWNED_INSPECT', 'OWNED_STOP', 'OWNED_REMOVAL_CHECK'},
}
_DIAGNOSTIC_CODES = frozenset({
    'VERIFY_FAILED', 'BACKUP_FAILED', 'PRECHECK_FAILED', 'UNKNOWN_COMMIT',
    'TARGET_IDENTITY_MISMATCH', 'DOCKER_OPERATION_FAILED', 'OWNED_DB_START',
    'OWNED_CONTAINER_IDENTITY', 'CLEANUP_FAILED', 'ROLE_PASSWORD',
    'RESTORE_CATALOG_OR_COUNTS_MISMATCH', 'SESSION_LOST', 'SQL_STATEMENT_FAILED',
    'TRANSPORT_ACK_MISSING', 'INVALID_PROTOCOL_JSON', 'ROLE_EXPIRED',
    'DIAGNOSTIC_STREAM_INCOMPLETE', 'DIAGNOSTIC_PERSISTENCE_FAILED',
    'DIAGNOSTIC_OPERATION_INVALID', 'CAPTURE_FAILED',
    'SOURCE_DATABASE_ACL_PROFILE_UNSUPPORTED', 'DATABASE_ACL_QUERY_RESPONSE_INVALID',
    'DESTINATION_DATABASE_ACL_BASELINE_MISMATCH', 'DATABASE_ACL_EXECUTION_IDENTITY_MISMATCH',
    'DATABASE_ACL_STDIN_SHA_MISMATCH', 'DATABASE_ACL_REPLAY_FAILED',
    'DATABASE_ACL_FIDELITY_MISMATCH', 'DATABASE_ACL_RECEIPT_BINDING_MISMATCH',
})


class _DiagnosticPersistenceError(Exception):
    # Not a Failure: never swallowed by the frozen readiness polling loop.
    def __init__(self, primary=None):
        self.primary = primary
        super().__init__('DIAGNOSTIC_PERSISTENCE_FAILED')


def _error_class(prefix, returncode, timeout=False, spawn=False):
    if timeout: return 'TIMEOUT'
    if spawn: return 'OS_SPAWN_FAILURE'
    prefix = prefix[:4096].lower()
    for kind, patterns in (
        ('PERMISSION_DENIED', (b'permission denied', b'operation not permitted')),
        ('OCI_RUNTIME_FAILURE', (b'oci runtime', b'failed to create task')),
        ('BROKEN_PIPE', (b'broken pipe', b'closed fifo')),
        ('CONTAINER_NOT_FOUND', (b'no such container',)),
        ('IMAGE_NOT_FOUND', (b'no such image', b'unable to find image')),
        ('RESOURCE_FAILURE', (b'out of memory', b'no space left', b'cannot allocate memory')),
    ):
        if any(x in prefix for x in patterns): return kind
    if returncode: return 'PROCESS_EXIT_NONZERO'
    return 'UNKNOWN_DOCKER_ERROR' if prefix else 'NONE'


class _LocalBackupDiagnostics:
    def __init__(self, root, attempt, plan, auth):
        if not re.fullmatch('[a-f0-9]{32}', attempt):
            raise Failure('BACKUP_FAILED', 'DIAGNOSTIC_OPERATION_INVALID')
        self.attempt, self.sequence, self.phase = attempt, 0, None
        self.records, self.descriptors = [], {}
        self.primary, self.secondaries, self.persistence = None, [], []
        self.primary_error = None
        self.failed_storage = False
        self.cleanup_status = 'NOT_REACHED'
        self.steps = {p:'NOT_STARTED' for p in _DIAGNOSTIC_PHASES}
        try:
            root = Path(root)
            # private_directory checks every ancestor for symlinks before creation.
            private_directory(root)
            for directory in (root.parent, root): self._sync(directory)
            self.root = root / attempt
            self.root.mkdir(mode=0o700, exist_ok=False)
            private_directory(self.root); self._sync(root); self._sync(self.root)
            self._write('attempt.json', {
                'contract':'backup-local-diagnostics/1', 'backupAttempt':attempt,
                'planId':plan.data['planId'], 'planSha256':plan.digest,
                'packageHashes':auth['packageHashes'], 'packageDigest':sha(canonical(auth['packageHashes'])),
                'authorizationSha256':sha(canonical(auth)),
                'targetIdentitySha256':sha(canonical(auth['targetIdentity'])), 'imageId':IMAGE_ID,
            })
        except Exception:
            self.failed_storage = True
            raise _DiagnosticPersistenceError() from None

    @staticmethod
    def _sync(path):
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try: os.fsync(fd)
        finally: os.close(fd)

    def _write(self, name, value):
        if self.failed_storage: raise _DiagnosticPersistenceError()
        try:
            digest = exclusive(self.root / name, value)
            if sha(safe_file(self.root / name, True)) != digest:
                raise ValueError()
            self.records.append({'file':name, 'sha256':digest})
            return digest
        except Exception:
            self.failed_storage = True
            self.persistence.append({'code':'DIAGNOSTIC_PERSISTENCE_FAILED'})
            raise _DiagnosticPersistenceError() from None

    def event(self, kind, value, primary=None):
        self.sequence += 1
        try: return self._write(f'{self.sequence:06d}.{kind}.json', value)
        except _DiagnosticPersistenceError:
            if primary is None and self.phase != 'E9': raise
            return None

    @contextlib.contextmanager
    def active(self):
        token = _LOCAL_DIAGNOSTIC.set(self)
        try: yield self
        finally: _LOCAL_DIAGNOSTIC.reset(token)

    def describe(self, error):
        if isinstance(error, _DiagnosticPersistenceError) and error.primary is not None:
            return self.describe(error.primary)
        known = self.descriptors.get(id(error))
        if known is not None: return dict(known[1])
        state = error.state if isinstance(error, Failure) and error.state in _DIAGNOSTIC_CODES else 'UNKNOWN_EXCEPTION'
        code = error.code if isinstance(error, Failure) and error.code in _DIAGNOSTIC_CODES else 'UNKNOWN_EXCEPTION'
        if isinstance(error, _DiagnosticPersistenceError):
            state, code = 'BACKUP_FAILED', 'DIAGNOSTIC_PERSISTENCE_FAILED'
        return {'phase':self.phase, 'operationKind':None, 'state':state, 'code':code,
                'invocationReceiptSha256':None}

    def remember(self, error):
        if self.primary is None:
            self.primary_error = error
            self.primary = self.describe(error)

    def secondary(self, primary, error):
        self.remember(primary)
        self.secondaries.append(self.describe(error))
        self.cleanup_status = 'FAIL'

    def begin(self, kind, container):
        if kind not in _DIAGNOSTIC_PHASES.get(self.phase, set()):
            raise Failure('BACKUP_FAILED', 'DIAGNOSTIC_OPERATION_INVALID')
        if container is not None and not re.fullmatch('uply-runner-i1-[a-f0-9]{32}', container):
            raise Failure('BACKUP_FAILED', 'DIAGNOSTIC_OPERATION_INVALID')
        record = dict(contract='backup-docker-invocation/1', recordType='START',
            backupAttempt=self.attempt, sequenceNumber=self.sequence+1, phase=self.phase,
            operationKind=kind, startedAt=time.time(), completedAt=None, returnCode=None,
            stdoutSha256=None, stderrSha256=None, stdoutComplete=False, stderrComplete=False,
            timeout=False, containerIdentitySafeHash=sha(container.encode()) if container else None,
            imageId=IMAGE_ID, networkClassification='OWNED_NETWORK_NONE', failureCode=None,
            sanitizedErrorClass='NONE')
        self.event('docker-start', record)
        return record

    def end(self, start, out_hash, err_hash, complete, returncode, prefix=b'',
            timeout=False, spawn=False, error=None):
        record = dict(start, recordType='END', sequenceNumber=self.sequence+1, completedAt=time.time(), returnCode=returncode,
            stdoutSha256=out_hash, stderrSha256=err_hash, stdoutComplete=complete[0],
            stderrComplete=complete[1], timeout=timeout,
            sanitizedErrorClass=_error_class(prefix, returncode, timeout, spawn),
            failureCode=self.describe(error)['code'] if error is not None else None)
        digest = self.event('docker-end', record, error)
        if error is not None:
            desc = self.describe(error)
            desc.update(phase=start['phase'], operationKind=start['operationKind'], invocationReceiptSha256=digest)
            self.descriptors[id(error)] = (error, desc)
        return digest

    def finish(self, error=None):
        if error is not None: self.remember(error)
        if self.primary_error is not None: self.primary = self.describe(self.primary_error)
        value = {'contract':'backup-local-diagnostics/1', 'backupAttempt':self.attempt,
            'status':'FAILURE' if error is not None or self.failed_storage else 'LOCAL_PHASES_COMPLETED',
            'primaryFailure':self.primary, 'cleanupSecondaryFailures':self.secondaries,
            'cleanupStatus':self.cleanup_status, 'persistenceSecondaryFailures':self.persistence,
            'diagnosticPersistenceStatus':'NOT_PERSISTED' if self.failed_storage else 'DURABLE',
            'phases':self.steps, 'records':list(self.records)}
        try: self._write('terminal.json', value)
        except _DiagnosticPersistenceError:
            if error is None: raise


@contextlib.contextmanager
def _diagnostic_phase(phase, required=True):
    d = _LOCAL_DIAGNOSTIC.get()
    if d is None:
        yield
        return
    if phase not in _DIAGNOSTIC_PHASES:
        raise Failure('BACKUP_FAILED', 'DIAGNOSTIC_OPERATION_INVALID')
    previous, d.phase = d.phase, phase
    d.steps[phase] = 'STARTED' if required else 'NOT_REQUIRED'
    try:
        d.event('phase-start', {'contract':'backup-local-phase/1', 'backupAttempt':d.attempt,
                'phase':phase, 'status':d.steps[phase], 'timestamp':time.time()})
        try: yield
        except BaseException as error:
            d.steps[phase] = 'FAIL'
            # Nested phase unwind must not replace the first meaningful phase.
            if id(error) not in d.descriptors: d.descriptors[id(error)] = (error, d.describe(error))
            if phase == 'E9': d.cleanup_status = 'FAIL'
            elif not isinstance(error, _DiagnosticPersistenceError): d.remember(error)
            d.event('phase-end', {'contract':'backup-local-phase/1', 'backupAttempt':d.attempt,
                    'phase':phase, 'status':'FAIL', 'timestamp':time.time()}, error)
            raise
        else:
            d.steps[phase] = 'PASS' if required else 'NOT_REQUIRED'
            if phase == 'E9' and d.cleanup_status != 'FAIL': d.cleanup_status = 'PASS'
            d.event('phase-end', {'contract':'backup-local-phase/1', 'backupAttempt':d.attempt,
                    'phase':phase, 'status':d.steps[phase], 'timestamp':time.time()})
    finally: d.phase = previous


@contextlib.contextmanager
def _diagnostic_operation(kind, container=None):
    d = _LOCAL_DIAGNOSTIC.get()
    if d is not None and kind not in _DIAGNOSTIC_PHASES.get(d.phase, set()):
        raise Failure('BACKUP_FAILED', 'DIAGNOSTIC_OPERATION_INVALID')
    token = _LOCAL_OPERATION.set((kind, container))
    try: yield
    finally: _LOCAL_OPERATION.reset(token)


def _close_preserving(close, primary):
    d = _LOCAL_DIAGNOSTIC.get()
    if d is None or primary is None:
        close()
        return
    d.remember(primary)
    try: close()
    except BaseException as secondary: d.secondary(primary, secondary)


def _diagnostic_start():
    d = _LOCAL_DIAGNOSTIC.get()
    if d is None: return None, None
    kind, container = _LOCAL_OPERATION.get() or (None, None)
    return d, d.begin(kind, container)


def _docker(args, data=None, timeout=120):
    d, start = _diagnostic_start()
    try:
        p = subprocess.run(['docker', *args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           env=ENV, timeout=timeout, check=False)
    except (subprocess.TimeoutExpired, OSError) as error:
        if d is not None:
            timed = isinstance(error, subprocess.TimeoutExpired)
            out, err = (error.stdout, error.stderr) if timed else (None, None)
            d.end(start, sha(out) if out is not None else None, sha(err) if err is not None else None,
                  (False,False), None, (err or b'')[:4096], timed, not timed, error)
        raise
    error = Failure('VERIFY_FAILED', 'DOCKER_OPERATION_FAILED') if p.returncode else None
    if d is not None:
        d.end(start, sha(p.stdout), sha(p.stderr), (True,True), p.returncode, p.stderr[:4096], error=error)
    if error is not None:
        if d is not None and d.failed_storage and start['operationKind']=='OWNED_PG_ISREADY':
            raise _DiagnosticPersistenceError(error) from None
        raise error
    return p.stdout


class _Session:
    """Private persistent psql protocol; stdout nonce/SQLSTATE checked, errors never logged."""
    def __init__(self, argv, readonly):
        self.readonly = readonly
        self.invocation_id = uuid.uuid4().hex
        self._diagnostic, self._diagnostic_start_record = _diagnostic_start()
        self._diagnostic_ended = False
        self._diagnostic_primary = None
        if self._diagnostic is not None:
            self._stream_hashes = [hashlib.sha256(), hashlib.sha256()]
            self._stream_complete = [False, False]
            self._stderr_prefix = bytearray()
        try:
            self._proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=ENV)
        except OSError as error:
            if self._diagnostic is not None:
                self._diagnostic.end(self._diagnostic_start_record, None, None, (False,False), None,
                                     spawn=True, error=error)
            raise
        self._lines = queue.Queue()
        self._errors = 0
        def reader():
            if self._diagnostic is None:
                for line in iter(self._proc.stdout.readline, b''): self._lines.put(line)
                self._lines.put(None)
                return
            try:
                for line in iter(self._proc.stdout.readline, b''):
                    if self._diagnostic is not None: self._stream_hashes[0].update(line)
                    self._lines.put(line)
                if self._diagnostic is not None: self._stream_complete[0] = True
            except Exception:
                if self._diagnostic is None: raise
            finally: self._lines.put(None)
        def errors():
            if self._diagnostic is None:
                for _ in iter(self._proc.stderr.readline, b''): self._errors += 1
                return
            try:
                for line in iter(self._proc.stderr.readline, b''):
                    if self._diagnostic is not None:
                        self._stream_hashes[1].update(line)
                        self._stderr_prefix.extend(line[:max(0,4096-len(self._stderr_prefix))])
                    self._errors += 1
                if self._diagnostic is not None: self._stream_complete[1] = True
            except Exception:
                if self._diagnostic is None: raise
        self._threads = [threading.Thread(target=reader,daemon=True),threading.Thread(target=errors,daemon=True)]
        for t in self._threads: t.start()
        try:
            self._exchange("SET standard_conforming_strings=on; SET search_path=public,pg_catalog; SET statement_timeout='60s'; SET lock_timeout='5s'; SET idle_in_transaction_session_timeout='120s';")
            self._exchange('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;' if readonly else 'BEGIN ISOLATION LEVEL READ COMMITTED;')
        except Exception as error:
            self._diagnostic_primary = error
            _close_preserving(self.close, error);raise

    def _exchange(self, sql, timeout=65):
        if self._proc.poll() is not None: raise Failure('UNKNOWN_COMMIT','SESSION_LOST')
        marker = 'ACK_' + uuid.uuid4().hex
        try:
            self._proc.stdin.write(sql.encode() + b'\n\\echo ' + marker.encode() + b' :ERROR :SQLSTATE\n')
            self._proc.stdin.flush()
            result = []
            end = time.monotonic() + timeout
            while True:
                line = self._lines.get(timeout=max(0.001,end-time.monotonic()))
                if line is None: raise Failure('UNKNOWN_COMMIT','SESSION_LOST')
                line = line.decode('utf8').rstrip('\r\n')
                if line.startswith(marker + ' '):
                    if line != marker + ' false 00000': raise Failure('PRECHECK_FAILED','SQL_STATEMENT_FAILED')
                    return '\n'.join(result)
                result.append(line)
        except (OSError,queue.Empty,UnicodeError):
            raise Failure('UNKNOWN_COMMIT','TRANSPORT_ACK_MISSING') from None

    def _json(self, sql):
        try: return json.loads(self._exchange(sql))
        except (ValueError,UnicodeError): raise Failure('VERIFY_FAILED','INVALID_PROTOCOL_JSON') from None

    def _rollback(self):
        self._exchange('ROLLBACK;')

    def close(self):
        if self._diagnostic is None:
            return self._close_process()
        error = None
        try: self._close_process()
        except BaseException as caught:
            error = caught
            raise
        finally:
            if not self._diagnostic_ended:
                self._diagnostic_ended = True
                complete = [done and not thread.is_alive() for done,thread in zip(self._stream_complete,self._threads)]
                code = self._proc.poll()
                failure = self._diagnostic_primary or error
                if failure is None and (code or not all(complete)):
                    failure = Failure('VERIFY_FAILED', 'DOCKER_OPERATION_FAILED' if code else 'DIAGNOSTIC_STREAM_INCOMPLETE')
                self._diagnostic.end(self._diagnostic_start_record,
                    self._stream_hashes[0].hexdigest(), self._stream_hashes[1].hexdigest(), complete,
                    code, bytes(self._stderr_prefix), error=failure)
                if failure is not None and self._diagnostic_primary is None and error is None: raise failure

    def _close_process(self):
        if self._proc.poll() is None:
            try: self._proc.stdin.write(b'\\q\n'); self._proc.stdin.flush()
            except OSError: pass
            try: self._proc.wait(timeout=3)
            except subprocess.TimeoutExpired: self._proc.kill(); self._proc.wait()
        for f in [self._proc.stdin,self._proc.stdout,self._proc.stderr]: f.close()
        for t in self._threads: t.join(timeout=2)


def validate_identity(actual, expected):
    keys = {'database','role','currentRole','serverMajor','targetProfile','imageId','projectIdentitySha256',
            'hostIdentitySha256','sslmode','fixture'}
    if any(actual.get(k) != expected.get(k) for k in keys): raise Failure('TARGET_IDENTITY_MISMATCH')
    expiry = actual.get('roleExpiry')
    if expiry and expiry not in ('infinity',):
        from datetime import datetime
        if datetime.fromisoformat(expiry).timestamp() <= time.time(): raise Failure('TARGET_IDENTITY_MISMATCH','ROLE_EXPIRED')


def _conninfo(raw, host, user):
    """Parse only pinned psql 17 C-locale metadata, never expose rejected text."""
    lines = raw.splitlines()
    if len(lines) not in (1, 2):
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_PROOF_MISSING')
    endpoint = re.fullmatch(r'You are connected to database "postgres" as user "([a-zA-Z0-9_.]+)" on host "([a-zA-Z0-9.-]+)"(?: \(address "[a-fA-F0-9.:]+"\))? at port "5432"\.', lines[0])
    if not endpoint or endpoint.groups() != (user, host):
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_IDENTITY_MISMATCH')
    if len(lines) == 1:
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_REQUIRED')
    tls = re.fullmatch(r'SSL connection \(protocol: (TLSv1\.[23]), cipher: ([A-Z0-9_-]+), compression: off(?:, ALPN: (?:postgresql|none))?\)', lines[1])
    if not tls: raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_REQUIRED')
    return {'enabled': True, 'version': tls[1], 'cipher': tls[2]}


def _dump_profile(tool, args, data):
    """Only the three implementation-owned backup invocations, no connection inputs."""
    if data is not None or type(args) is not list:
        raise Failure('BACKUP_FAILED', 'TRANSPORT_PROFILE_MISMATCH')
    if tool == 'pg_dumpall' and args == ['--roles-only', '--no-role-passwords']:
        return 'roles', None
    for kind, prefix in [('full', ['-d','postgres','-Fc']),
                         ('schema', ['-d','postgres','-Fc','--schema-only'])]:
        if tool == 'pg_dump' and args[:-1] == prefix and type(args[-1]) is str:
            match = re.fullmatch(r'--snapshot=([0-9A-F]+-[0-9A-F]+-[0-9]+)', args[-1])
            if match: return kind, match[1]
    raise Failure('BACKUP_FAILED', 'TRANSPORT_PROFILE_MISMATCH')


def _valid_dump(kind, raw):
    if type(raw) is not bytes: return False
    if kind in ('full','schema'): return len(raw) > 32 and raw.startswith(b'PGDMP')
    return (raw.startswith(b'--\n-- PostgreSQL database cluster dump\n') and
            b'PostgreSQL database cluster dump complete' in raw and
            not re.search(rb'\bPASSWORD\s+\S+', raw, re.I))


def _record_proof(root, proof):
    if type(proof) is not dict or type(proof.get('invocationId')) is not str or not re.fullmatch('[a-f0-9]{32}',proof['invocationId']):
        raise Failure('PRECHECK_FAILED','CLIENT_TLS_PROOF_MISSING')
    if sanitized(proof) != proof: raise Failure('PRECHECK_FAILED', 'UNSAFE_TLS_PROOF')
    path = private_directory(root) / (proof['invocationId'] + '.json')
    try: digest = exclusive(path, proof)
    except (OSError, Failure):
        raise Failure('PRECHECK_FAILED', 'CLIENT_TLS_PROOF_MISSING') from None
    return {'proof': proof, 'sha256': digest, 'path': str(path)}


def _read_proof(record):
    try:
        if record['path'] is None and record['proof'].get('fixture') is True:
            if sha(canonical(record['proof'])+b'\n') != record['sha256']: raise ValueError()
            return record['proof']
        raw = safe_file(Path(record['path']), True)
        if sha(raw) != record['sha256'] or strict_json(raw) != record['proof']:
            raise ValueError()
        return record['proof']
    except (OSError, KeyError, TypeError, ValueError, Failure):
        raise Failure('PRECHECK_FAILED', 'CLIENT_TLS_PROOF_MISSING') from None


def session_security(session, plan, auth):
    """Same-process proof only. Backend observation is deliberately not a TLS gate."""
    risk_guard(plan, auth)
    if plan.fixture: return None
    record = getattr(session, '_transport_proof', None)
    if type(record) is not dict or getattr(session, '_proof_process', None) is not session._proc:
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_PROOF_MISSING')
    p = _read_proof(record)
    if (session._proc.poll() is not None or p['invocationId'] != session.invocation_id or
        p['tool'] != 'psql' or p['proofKind'] != 'PSQL_SAME_SESSION_METADATA' or
        p['authorizationSha256'] != sha(canonical(auth)) or p['fixture'] is not False or
        p['targetIdentitySha256'] != sha(canonical(auth['targetIdentity'])) or
        p['targetProfile'] != auth['targetProfile'] or p['toolImageId'] != IMAGE_ID or
        p['packageHashes'] != auth['packageHashes'] or
        p['credentialIdentitySha256'] != auth['credentialIdentitySha256'] or
        p['endpoint']['port'] != 5432 or p['gssencmode'] != 'disable' or
        sha(canonical(p['endpoint']['host'])) != auth['targetIdentity']['hostIdentitySha256'] or
        p['transportContract'] != TRANSPORT_CONTRACT or p['riskAcceptance'] != RISK_BINDING):
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_PROOF_MISSING')
    if p['clientTls']['enabled'] is not True or p['sslmode'] != 'verify-full':
        raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_REQUIRED')
    return {'transportContract': p['transportContract'], 'riskAcceptanceId': RISK_BINDING['riskAcceptanceId'],
            'clientProof': {'invocationId': p['invocationId'], 'sha256': record['sha256'],
                            'proofKind': p['proofKind'], 'clientTls': p['clientTls']},
            'backendObservedSsl': p['backendObservedSsl']}


class MaintenanceTransport:
    def __init__(self, plan, authorization, mode):
        (authorize_capture(plan, authorization) if mode == CAPTURE_MODE else
         authorize(plan,authorization,mode))  # Before credential presence/read.
        if plan.fixture or plan.data['targetProfile'] != 'uply-canonical-maintenance/1':
            raise Failure('TARGET_IDENTITY_MISMATCH','FIXTURE_FORBIDDEN')
        profiles = strict_json(safe_file(PROFILE_PATH))['profiles']
        self.profile = profiles[plan.data['targetProfile']]
        self.identity = authorization['targetIdentity']
        expected={'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,
                  'targetProfile':plan.data['targetProfile'],'imageId':IMAGE_ID,'fixture':False,
                  'sslmode':'verify-full','projectIdentitySha256':self.profile['projectIdentitySha256'],
                  'hostIdentitySha256':self.profile['hostIdentitySha256']}
        if self.identity != expected:raise Failure('TARGET_IDENTITY_MISMATCH','SEALED_TARGET_IDENTITY')
        self._plan, self._auth, self._mode = plan,authorization,mode
        commands={'SINGLE_MIGRATION_APPLY':'apply','READ_ONLY_PREFLIGHT':'preflight','READ_ONLY_VERIFY':'verify','BACKUP_READ_EXPORT':'backup',CAPTURE_MODE:'capture'}
        if mode not in commands:raise Failure('APPROVAL_MISSING')
        self._authorization_path=Path(self.profile['authorizationDirectory'])/(plan.data['planId']+'.'+commands[mode]+'.json')
        self._authorization_bytes=safe_file(self._authorization_path,True)
        if canonical(strict_json(self._authorization_bytes))!=canonical(authorization):raise Failure('APPROVAL_MISSING')
        self._runtime_guard()
        self._credential_digest = self._validate_credentials()
        if self._credential_digest != authorization['credentialIdentitySha256']:
            raise Failure('TARGET_IDENTITY_MISMATCH','CREDENTIAL_FILE_IDENTITY')
        if _docker(['image','inspect',IMAGE,'--format','{{.Id}}']).decode().strip() != IMAGE_ID:
            raise Failure('TARGET_IDENTITY_MISMATCH','CLIENT_IMAGE')
        self.fixture = False
        self._pending_tool_proofs = {}

    def _runtime_guard(self):
        if safe_file(self._authorization_path,True)!=self._authorization_bytes:raise Failure('APPROVAL_MISSING','AUTHORIZATION_CHANGED')
        if self._mode == CAPTURE_MODE: authorize_capture(self._plan, self._auth)
        else: authorize(self._plan,self._auth,self._mode)
        p=self.profile
        raw=safe_file(Path(p['runtimePath']),True)
        if sha(raw)!=p['runtimeSha256'] or sha(safe_file(Path(p['launcherPath']),True))!=p['launcherSha256']:
            raise Failure('PRECHECK_FAILED','RUNTIME_IDENTITY')
        if safe_file(Path(p['buildPath'])).decode().strip()!=p['buildId']:
            raise Failure('PRECHECK_FAILED','APPLICATION_BUILD')
        runtime=strict_json(raw)
        if runtime.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED') not in (None,False,'0','false',''):
            raise Failure('PRECHECK_FAILED','FEATURE_MUST_BE_OFF')
        if any(runtime.get(k) not in (None,'',[]) for k in ('TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS')):
            raise Failure('PRECHECK_FAILED','ALLOWLIST_MUST_BE_EMPTY')
        try:
            project=runtime['NEXT_PUBLIC_SUPABASE_URL'].split('//')[1].split('.')[0]
            if sha(json.dumps(project,sort_keys=True,separators=(',',':')).encode())!=p['projectIdentitySha256']:raise ValueError()
        except (ValueError,KeyError,IndexError):raise Failure('TARGET_IDENTITY_MISMATCH') from None

    def _validate_credentials(self):
        root = Path(self.profile['connectionDirectory'])
        # Values are held only in memory; never exception/receipt/argv material.
        raw = {x:safe_file(root/x,private=True) for x in ('pg_service.conf','pgpass','root.crt')}
        try:
            c = configparser.ConfigParser(interpolation=None); c.read_string(raw['pg_service.conf'].decode())
            s = c['uply']; host,user = s['host'],s['user']
            project = user.split('.',1)[1]
            # Historical identity serialization is compact JSON, including string quotes.
            digest = lambda x: sha(json.dumps(x,sort_keys=True,separators=(',',':')).encode())
            if (digest(host) != self.profile['hostIdentitySha256'] or digest(project) != self.profile['projectIdentitySha256'] or
                s.get('sslmode') != 'verify-full' or s.get('dbname') != 'postgres' or not user.startswith('postgres.')):
                raise ValueError()
            if set(c.sections()) != {'uply'} or c.defaults(): raise ValueError()
            if set(s) - {'host','port','dbname','user','sslmode','sslrootcert','passfile','connect_timeout','application_name'}: raise ValueError()
            if s.get('sslrootcert') != '/connection/root.crt' or s.get('passfile') != '/connection/pgpass': raise ValueError()
            if s.get('port') != '5432': raise ValueError()
            if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]*',host) or not re.fullmatch(r'postgres\.[a-zA-Z0-9]+',user): raise ValueError()
            self._endpoint = {'host': host, 'user': user, 'port': 5432}
        except (ValueError,KeyError,IndexError,UnicodeError,configparser.Error):
            raise Failure('TARGET_IDENTITY_MISMATCH','SERVICE_PROFILE') from None
        self._ca_sha = sha(raw['root.crt'])
        return sha(canonical({k:sha(v) for k,v in raw.items()}))

    def _base(self, readonly=True):
        self._runtime_guard()
        if self._validate_credentials() != self._credential_digest: raise Failure('TARGET_IDENTITY_MISMATCH')
        return ['docker','run','--rm','-i','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user',str(os.getuid())+':'+str(os.getgid()),'--network','host',
                '-v',self.profile['connectionDirectory']+':/connection:ro',
                '-e','LC_ALL=C','-e','PGSERVICEFILE=/dev/null',
                '-e','PGPASSFILE=/connection/pgpass','-e','PGSSLMODE=verify-full','-e','PGSSLROOTCERT=/connection/root.crt',
                '-e','PGGSSENCMODE=disable',
                '-e','PGOPTIONS=-c default_transaction_read_only='+('on' if readonly else 'off'),
                '--entrypoint','/usr/bin/env',IMAGE_ID,'-u','PGSERVICE','-u','PGHOSTADDR']

    def _connparams(self):
        # No password or arbitrary caller conninfo. Explicit parameters win over
        # service/environment defaults, including port/GSS; only pinned TCP host.
        e = self._endpoint
        return ("host='"+e['host']+"' port='5432' dbname='postgres' user='"+e['user']+
                "' sslmode='verify-full' sslrootcert='/connection/root.crt' "
                "passfile='/connection/pgpass' gssencmode='disable' connect_timeout='15'")

    def _proof_root(self):
        return ROOT / self.profile['receiptRoot'] / 'transport-invocations'

    def _proof(self, invocation, tool, kind, started, tls, backend, **details):
        return dict(contract='maintenance-client-proof/1', invocationId=invocation,
                    tool=tool, toolImageId=IMAGE_ID, proofKind=kind, startedAt=started,
                    completedAt=time.time(), fixture=False, transportContract=TRANSPORT_CONTRACT,
                    riskAcceptance=RISK_BINDING.copy(), clientTlsRequired=True,
                    targetProfile=self.identity['targetProfile'], targetIdentitySha256=sha(canonical(self.identity)),
                    endpoint=dict(self._endpoint), sslmode='verify-full', gssencmode='disable',
                    caIdentitySha256=self._ca_sha, credentialIdentitySha256=self._credential_digest,
                    authorizationSha256=sha(canonical(self._auth)), packageHashes=self._auth['packageHashes'],
                    backupAttempt=getattr(self,'_backup_attempt',None), clientTls=tls,
                    backendObservedSsl=backend, **details)

    @contextlib.contextmanager
    def _session(self, readonly=True):
        if not readonly:
            if self._mode != 'SINGLE_MIGRATION_APPLY':raise Failure('APPROVAL_MISSING','READ_ONLY_TRANSPORT')
            authorize(self._plan,self._auth,'SINGLE_MIGRATION_APPLY')
        base = self._base(readonly)
        try:
            s = _Session(base+['psql','-XqAt','-w','-d',self._connparams(),'-v','ON_ERROR_STOP=off'],readonly)
        except (Failure, OSError):
            # No user operation/COMMIT was dispatched at construction. Do not
            # mislabel handshake/CA/hostname failure as UNKNOWN_COMMIT.
            raise Failure('TARGET_IDENTITY_MISMATCH','CLIENT_TLS_PROOF_MISSING') from None
        try:
            try: self._check(s)
            except Exception:
                try: s._rollback()
                except Failure: pass
                raise
            yield s
        finally: s.close()

    def _check(self, session):
        self._runtime_guard()
        from checks import IDENTITY_SQL
        a = session._json(IDENTITY_SQL)
        a.update({k:self.profile[k] for k in ['projectIdentitySha256','hostIdentitySha256','sslmode']})
        a.update(targetProfile=self._plan.data['targetProfile'],imageId=IMAGE_ID,fixture=False)
        validate_identity(a,self.identity)
        if not hasattr(session, '_transport_proof'):
            started = time.time()
            tls = _conninfo(session._exchange('\\conninfo'), self._endpoint['host'], self._endpoint['user'])
            from checks import CAPTURE_TLS_SQL
            backend = session._json(CAPTURE_TLS_SQL)
            if backend is None: backend = 'unavailable'
            if type(backend) is not bool and backend != 'unavailable':
                raise Failure('TARGET_IDENTITY_MISMATCH', 'CLIENT_TLS_PROOF_MISSING')
            self._runtime_guard()
            proof = self._proof(session.invocation_id, 'psql', 'PSQL_SAME_SESSION_METADATA',
                                started, tls, backend)
            session._transport_proof = _record_proof(self._proof_root(), proof)
            session._proof_process = session._proc
        session_security(session, self._plan, self._auth)

    def _tool(self, tool, args, data=None):
        if self._mode != 'BACKUP_READ_EXPORT': raise Failure('APPROVAL_MISSING')
        kind, snapshot = _dump_profile(tool,args,data)
        invocation, started = uuid.uuid4().hex, time.time()
        base = self._base()
        params = self._connparams()
        actual = (['-d',params,'-Fc',*(['--schema-only'] if kind == 'schema' else []),'--snapshot='+snapshot]
                  if tool == 'pg_dump' else ['-d',params,'-l','postgres','--roles-only','--no-role-passwords'])
        try:
            p = subprocess.run(base+[tool,'--no-password',*actual],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV,timeout=300)
        except (OSError, subprocess.TimeoutExpired):
            raise Failure('BACKUP_FAILED','BACKUP_CLIENT_TLS_PROOF_MISSING') from None
        if p.returncode or not _valid_dump(kind,p.stdout):
            raise Failure('BACKUP_FAILED','BACKUP_CLIENT_TLS_PROOF_MISSING')
        self._runtime_guard()
        proof = self._proof(invocation, tool, 'REAL_INVOCATION_LIBPQ_ENFORCEMENT', started,
                            {'enabled':True,'version':None,'cipher':None}, 'unavailable',
                            dumpKind=kind, snapshot=snapshot, outputSha256=sha(p.stdout),
                            inputSha256=sha(canonical([tool,args])), exitCode=0)
        self._pending_tool_proofs[(tool,sha(p.stdout))] = _record_proof(self._proof_root(),proof)
        return p.stdout

    def _take_tool_proof(self, tool, raw):
        record = self._pending_tool_proofs.pop((tool,sha(raw)),None)
        if record is None: raise Failure('BACKUP_FAILED','BACKUP_CLIENT_TLS_PROOF_MISSING')
        _read_proof(record)
        return record


class OwnedTransport:
    """Only labeled network-none disposable containers; never a production profile."""
    def __init__(self, container):
        if not re.fullmatch('uply-runner-i1-[a-f0-9]{32}',container): raise Failure('TARGET_IDENTITY_MISMATCH')
        self.container = container; self.fixture = True
        self._pending_tool_proofs = {}
        self._inspect()
        self.identity = {'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,
                         'targetProfile':'OWNED_ISOLATED_FIXTURE','imageId':IMAGE_ID,
                         'projectIdentitySha256':None,'hostIdentitySha256':None,'sslmode':None,'fixture':True}

    def _inspect(self):
        with _diagnostic_operation('OWNED_INSPECT', self.container):
            i = json.loads(_docker(['inspect',self.container]))[0]
        if (i['Image'] != IMAGE_ID or i['HostConfig']['NetworkMode']!='none' or i['HostConfig'].get('Binds') or
            i['HostConfig'].get('PortBindings') or i['Mounts'] or i['Config']['Labels'].get('uply.task')!='runner-i1'):
            raise Failure('TARGET_IDENTITY_MISMATCH','OWNED_CONTAINER_IDENTITY')

    @contextlib.contextmanager
    def _session(self, readonly=True):
        self._inspect()
        argv = ['docker','exec','-i','-e','PGOPTIONS=-c default_transaction_read_only='+('on' if readonly else 'off'),self.container,
                'psql','-h','/tmp','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=off']
        d = _LOCAL_DIAGNOSTIC.get()
        kind = 'OWNED_FIRST_OBSERVE_PSQL' if d is not None and d.phase == 'E5' else 'OWNED_FINAL_OBSERVE_COUNTS_PSQL'
        with _diagnostic_operation(kind, self.container):
            s = _Session(argv,readonly)
        primary = None
        try: self._check(s); yield s
        except BaseException as error:
            primary = error
            s._diagnostic_primary = error
            raise
        finally: _close_preserving(s.close, primary)

    def _check(self, session):
        from checks import IDENTITY_SQL
        a = session._json(IDENTITY_SQL)
        a.update({k:self.identity[k] for k in ['targetProfile','imageId','projectIdentitySha256','hostIdentitySha256','sslmode','fixture']})
        validate_identity(a,self.identity)
        if not hasattr(session, '_transport_proof'):
            session._transport_proof = self._owned_proof('psql', session.invocation_id)

    def _owned_proof(self, tool, invocation, **details):
        # Test-only plaintext socket provenance. Never presented as production TLS.
        p = dict(contract='maintenance-client-proof/1', fixture=True,
                 proofKind='OWNED_ISOLATED_INVOCATION', invocationId=invocation, tool=tool,
                 toolImageId=IMAGE_ID, startedAt=time.time(), completedAt=time.time(),
                 targetProfile='OWNED_ISOLATED_FIXTURE', targetIdentitySha256=sha(canonical(self.identity)),
                 backupAttempt=getattr(self,'_backup_attempt',None),
                 transportContract='OWNED_ISOLATED_FIXTURE', riskAcceptance=None, **details)
        return {'proof':p,'sha256':sha(canonical(p)+b'\n'),'path':None}

    def _tool(self, tool, args, data=None):
        self._inspect()
        kind, snapshot = _dump_profile(tool,args,data)
        raw = _docker(['exec','-i','-e','PGOPTIONS=-c default_transaction_read_only=on',self.container,tool,
                       '-h','/tmp','-U','postgres',*args],data,300)
        if not _valid_dump(kind,raw): raise Failure('BACKUP_FAILED','BACKUP_CLIENT_TLS_PROOF_MISSING')
        self._pending_tool_proofs[(tool,sha(raw))] = self._owned_proof(tool,uuid.uuid4().hex,
            dumpKind=kind,snapshot=snapshot,outputSha256=sha(raw),inputSha256=sha(canonical([tool,args])),exitCode=0)
        return raw

    _take_tool_proof = MaintenanceTransport._take_tool_proof


OWNED_RESTORE_ADMIN = 'uply_owned_restore_admin'
OWNED_RESTORE_ADMIN_TUPLE = [OWNED_RESTORE_ADMIN, True, True, True, True,
                            True, True, True, -1, None, None]


# Finite Candidate V1 gate codes; raw SQL/errors never become public diagnostics.
_DIAGNOSTIC_CODES = _DIAGNOSTIC_CODES | frozenset(['ARCHIVE_FORMAT', 'BACKUP_ALREADY_ACTIVE', 'BACKUP_BASELINE', 'BACKUP_CLIENT_TLS_PROOF_MISSING', 'BACKUP_ROOT', 'BOOTSTRAP_CREATE_INTERNAL_COMMENT_AMBIGUITY', 'BOOTSTRAP_CREATE_MULTIPLE_MATCH', 'BOOTSTRAP_CREATE_ZERO_MATCH', 'CAPTURE_FAILED', 'CLEANUP_FAILED', 'DERIVATION_BYTE_PRESERVATION', 'DESTINATION_BOOTSTRAP_IDENTITY_MISMATCH', 'DIAGNOSTIC_PERSISTENCE_FAILED', 'EXPORTER_DRIFT', 'OWNED_DB_START', 'OWNED_RESTORE_ADMIN_FOOTPRINT', 'OWNED_RESTORE_ADMIN_IDENTITY', 'OWNED_RESTORE_ADMIN_MEMBERSHIP_FOOTPRINT', 'OWNED_RESTORE_ADMIN_SOURCE_COLLISION', 'OWNED_ROLE_REPLAY_INCOMPLETE', 'RESTORE_CATALOG_OR_COUNTS_MISMATCH', 'RESTORE_EVIDENCE_BINDING_MISMATCH', 'ROLE_FIDELITY_PROFILE_UNSUPPORTED', 'ROLE_PASSWORD', 'ROLE_SCRIPT_BACKSLASH_STRING_UNSUPPORTED', 'ROLE_SCRIPT_CREATE_FORM_UNSUPPORTED', 'ROLE_SCRIPT_EMPTY_OR_AMBIGUOUS_STATEMENT', 'ROLE_SCRIPT_ENCODING_UNSUPPORTED', 'ROLE_SCRIPT_LEXICAL_AMBIGUITY', 'ROLE_SCRIPT_META_BOUNDARY_AMBIGUOUS', 'ROLE_SCRIPT_META_UNSUPPORTED', 'ROLE_SCRIPT_QUOTED_IDENTIFIER_INVALID', 'ROLE_SCRIPT_RESTRICT_ORDER', 'ROLE_SCRIPT_RESTRICT_PAIR', 'ROLE_SCRIPT_RESTRICT_UNCLOSED', 'ROLE_SCRIPT_STATEMENT_CLASS_UNSUPPORTED', 'ROLE_SCRIPT_STRING_PREFIX_UNSUPPORTED', 'ROLE_SCRIPT_TRUNCATED_COMMENT', 'ROLE_SCRIPT_TRUNCATED_STATEMENT', 'ROLE_SCRIPT_TRUNCATED_STRING', 'ROLE_STDIN_SHA_MISMATCH', 'SNAPSHOT_ID', 'SOURCE_BOOTSTRAP_CAPTURE_BINDING_MISMATCH', 'SOURCE_BOOTSTRAP_DRIFT', 'SOURCE_BOOTSTRAP_PROVENANCE_INVALID', 'SOURCE_OR_ROLE_DRIFT', 'SOURCE_RECOVERY_PROFILE_UNSUPPORTED', 'STAGED_PLPGSQL_DEPENDENCY', 'STAGED_PLPGSQL_FINALIZATION_FAILED'])


def _restore_identifier(value):
    # Names are SQL identifiers/argv data, never shell programs or container names.
    if (type(value) is not str or not value or not value.isascii() or
            len(value.encode('ascii')) > 63 or '\x00' in value):
        raise Failure('BACKUP_FAILED', 'SOURCE_BOOTSTRAP_PROVENANCE_INVALID')
    return '"' + value.replace('"', '""') + '"'


class OwnedRestoreDestinationTransport:
    """Destination-only capability. Source OwnedTransport remains unchanged."""
    def __init__(self, container):
        if not re.fullmatch('uply-runner-i1-[a-f0-9]{32}', container):
            raise Failure('TARGET_IDENTITY_MISMATCH')
        self.container = container
        self.fixture = True
        self.identity = {'database': 'postgres', 'role': OWNED_RESTORE_ADMIN,
                         'currentRole': OWNED_RESTORE_ADMIN, 'serverMajor': 17,
                         'targetProfile': 'OWNED_ISOLATED_RESTORE_DESTINATION',
                         'imageId': IMAGE_ID, 'projectIdentitySha256': None,
                         'hostIdentitySha256': None, 'sslmode': None, 'fixture': True}
        self._inspect()

    _inspect = OwnedTransport._inspect

    def _sql(self, raw, kind, *, bootstrap_user=None):
        user = OWNED_RESTORE_ADMIN if bootstrap_user is None else bootstrap_user
        _restore_identifier(user)
        if type(raw) is not bytes:
            raise Failure('BACKUP_FAILED', 'ROLE_STDIN_SHA_MISMATCH')
        self._inspect()
        with _diagnostic_operation(kind, self.container):
            return _docker(['exec', '-i', self.container, 'psql', '-XqAt', '-h', '/tmp',
                            '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], raw)

    def _json(self, sql, kind, *, bootstrap_user=None):
        return strict_json(self._sql(sql.encode('utf8'), kind, bootstrap_user=bootstrap_user))

    @contextlib.contextmanager
    def _session(self, readonly=True):
        if readonly is not True:
            raise Failure('BACKUP_FAILED', 'OWNED_RESTORE_ADMIN_IDENTITY')
        self._inspect()
        d = _LOCAL_DIAGNOSTIC.get()
        kind = ('OWNED_FIRST_OBSERVE_PSQL' if d is not None and d.phase == 'E5'
                else 'OWNED_FINAL_OBSERVE_COUNTS_PSQL')
        argv = ['docker', 'exec', '-i', '-e', 'PGOPTIONS=-c default_transaction_read_only=on',
                self.container, 'psql', '-h', '/tmp', '-U', OWNED_RESTORE_ADMIN,
                '-d', 'postgres', '-XqAt', '-v', 'ON_ERROR_STOP=off']
        with _diagnostic_operation(kind, self.container):
            s = _Session(argv, True)
        primary = None
        try:
            from checks import IDENTITY_SQL
            actual = s._json(IDENTITY_SQL)
            actual.update({k: self.identity[k] for k in
                           ['targetProfile', 'imageId', 'projectIdentitySha256',
                            'hostIdentitySha256', 'sslmode', 'fixture']})
            validate_identity(actual, self.identity)
            yield s
        except BaseException as error:
            primary = error
            s._diagnostic_primary = error
            raise
        finally:
            _close_preserving(s.close, primary)


class CaptureTransport:
    """Finite capture capability: no session, SQL, dump, restore or mutation API."""
    def __init__(self, plan, authorization):
        authorize_capture(plan, authorization)
        if plan.fixture: raise Failure('TARGET_IDENTITY_MISMATCH', 'FIXTURE_FORBIDDEN')
        self.__transport = MaintenanceTransport(plan, authorization, CAPTURE_MODE)
        self.__plan, self.__auth = plan, authorization

    @classmethod
    def owned(cls, plan, authorization, transport):
        authorize_capture(plan, authorization)
        if not plan.fixture or type(transport) is not OwnedTransport:
            raise Failure('TARGET_IDENTITY_MISMATCH', 'OWNED_ONLY')
        transport._inspect()
        validate_identity(transport.identity, authorization['targetIdentity'])
        obj = cls.__new__(cls)
        obj.__transport, obj.__plan, obj.__auth = transport, plan, authorization
        return obj

    def capture(self):
        from checks import capture_baseline
        authorize_capture(self.__plan, self.__auth)
        with self.__transport._session(True) as session:
            try:
                return capture_baseline(session, self.__plan, self.__auth)
            finally:
                # Even mismatches close the same snapshot explicitly. Never COMMIT.
                session._rollback()

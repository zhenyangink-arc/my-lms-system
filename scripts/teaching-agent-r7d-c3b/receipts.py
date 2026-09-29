"""Immutable, private operational receipts. Never serialize exception text."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import time
import uuid

class Failure(Exception):
    def __init__(self, state, code=None):
        self.state, self.code = state, code or state
        super().__init__(self.code)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()

def strict_json(raw):
    def pairs(items):
        obj = {}
        for k, v in items:
            if k in obj:
                raise Failure('PRECHECK_FAILED', 'DUPLICATE_JSON_KEY')
            obj[k] = v
        return obj
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError):
        raise Failure('PRECHECK_FAILED', 'INVALID_JSON') from None

def safe_file(path, private=False):
    path = Path(path).absolute()
    for part in [path, *path.parents]:
        if part.is_symlink():
            raise Failure('PRECHECK_FAILED', 'SYMLINK')
    s = path.stat()
    if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or s.st_uid != os.getuid():
        raise Failure('PRECHECK_FAILED', 'FILE_IDENTITY')
    if private and stat.S_IMODE(s.st_mode) != 0o600:
        raise Failure('PRECHECK_FAILED', 'PRIVATE_FILE_MODE')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        if os.fstat(fd) != s:
            raise Failure('PRECHECK_FAILED', 'FILE_RACE')
        with os.fdopen(fd, 'rb', closefd=False) as f:
            return f.read()
    finally:
        os.close(fd)

def private_directory(path):
    path = Path(path).absolute()
    for p in [path, *path.parents]:
        if p.is_symlink():
            raise Failure('PRECHECK_FAILED', 'SYMLINK_DIRECTORY')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    s = path.stat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o700:
        raise Failure('PRECHECK_FAILED', 'DIRECTORY_MODE')
    return path

SECRET_KEY = re.compile(r'^(password|pgpassword|dsn|cookie|authorization|access_token|refresh_token|service_role_key|env)$', re.I)
SECRET_VALUE = re.compile(r'postgres(?:ql)?://|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.|Bearer\s+|(?:PGPASSWORD|password|Cookie|Authorization)\s*[:=]', re.I)

def sanitized(data):
    if isinstance(data, dict):
        return {k: '[REDACTED]' if SECRET_KEY.search(k) else sanitized(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitized(x) for x in data]
    if isinstance(data, str) and SECRET_VALUE.search(data):
        return '[REDACTED]'
    if data is None or type(data) in (str, int, float, bool):
        return data
    raise Failure('PRECHECK_FAILED', 'UNSAFE_RECEIPT_TYPE')

def exclusive(path, data, redact=True):
    path = Path(path)
    private_directory(path.parent)
    raw = canonical(sanitized(data) if redact else data) + b'\n'
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as f:
            f.write(raw); f.flush(); os.fsync(fd)
    finally:
        os.close(fd)
    d = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(d)
    finally:
        os.close(d)
    return sha(raw)

class Journal:
    def __init__(self, root, plan, nonce):
        if not re.fullmatch('[a-f0-9]{32}', nonce):
            raise Failure('APPROVAL_MISSING')
        self.root = private_directory(root)
        self.attempt = nonce
        self.base = {'attemptId': nonce, 'planId': plan.data['planId'], 'planSha256': plan.digest,
                     'migrationVersion': plan.data['migration']['version'], 'rawSha256': plan.migration['rawSha256'],
                     'bodySha256': plan.migration['bodySha256'], 'nextMigrationAllowed': False}
        # This exclusive durable claim consumes authorization, including failed/unknown attempts.
        exclusive(self.root / (nonce + '.attempt.json'), dict(self.base, timestamp=time.time(), phase='BEFORE_DISPATCH'))

    def record(self, phase, **details):
        if not re.fullmatch('[A-Z_]+', phase):
            raise Failure('PRECHECK_FAILED')
        return exclusive(self.root / (self.attempt + '.' + phase + '.json'),
                         dict(self.base, timestamp=time.time(), phase=phase, **details))

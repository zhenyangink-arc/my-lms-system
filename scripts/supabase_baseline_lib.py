"""Offline schema-only archive handling. No credentials or remote database inputs."""
import collections
import hashlib
import json
import pathlib
import re
import subprocess

IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.159'
APP_SCHEMAS = ('public', 'private', 'recording_private', 'runtime_publish_private')
BASELINE_GUARD = """DO $baseline_guard$
BEGIN
  IF current_setting('uply.bootstrap_mode', true) IS DISTINCT FROM 'new-environment' THEN
    RAISE EXCEPTION 'BASELINE_NEW_ENVIRONMENT_ONLY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','private','recording_private','runtime_publish_private')
      AND c.relkind IN ('r','p','v','m','S')) THEN
    RAISE EXCEPTION 'BASELINE_REFUSES_EXISTING_APPLICATION';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations) THEN
      RAISE EXCEPTION 'BASELINE_REFUSES_EXISTING_LEDGER';
    END IF;
  END IF;
END
$baseline_guard$"""
HEADER = re.compile(r'--\n-- Name: (.*); Type: (.*); Schema: (.*); Owner: (.*)\n--\n')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def restore_text(snapshot):
    data = pathlib.Path(snapshot).read_bytes()
    base = ['docker', 'run', '--rm', '--pull=never', '--network', 'none', '-i',
            '--read-only', '--entrypoint', 'pg_restore', IMAGE]
    toc = subprocess.run(base + ['--list'], input=data, capture_output=True, check=True).stdout.decode()
    if re.search(r'\b(TABLE DATA|SEQUENCE SET|BLOBS|BLOB DATA)\b', toc):
        raise ValueError('SCHEMA_ONLY_SNAPSHOT_REQUIRED')
    plain = subprocess.run(base + ['--schema-only', '--file=-'], input=data,
                           capture_output=True, check=True).stdout.decode()
    return plain


def blocks(plain):
    matches = list(HEADER.finditer(plain))
    if not matches:
        raise ValueError('UNRECOGNIZED_ARCHIVE_FORMAT')
    for i, match in enumerate(matches):
        text = plain[match.start():matches[i + 1].start() if i + 1 < len(matches) else len(plain)]
        text = re.sub(r'^\\(?:un)?restrict .*\n', '', text, flags=re.M)
        text = text.replace('--\n-- PostgreSQL database dump complete\n--', '')
        yield match.groups(), text.strip() + '\n'


def is_app(meta):
    name, kind, schema, _ = meta
    if schema in APP_SCHEMAS:
        return True
    if schema == '-' and (kind == 'SCHEMA' and name in APP_SCHEMAS
                          or kind in ('ACL', 'COMMENT') and name in ['SCHEMA ' + s for s in APP_SCHEMAS]):
        return True
    # App-owned attachments on platform tables, not platform table definitions.
    if schema == 'auth' and kind == 'TRIGGER':
        return name in ('users on_auth_user_created', 'users z_sync_auth_registration_metadata')
    if schema in ('storage', 'realtime') and kind == 'POLICY':
        return True
    return schema == '-' and kind == 'EVENT TRIGGER' and name == 'ensure_rls'


def sql_statements(text):
    """Split only at top-level semicolons, retaining function bodies as one DDL.

    PostgreSQL dollar/single/double quoting and nested comments are recognized.
    Fail closed on unterminated input. Does not execute SQL.
    """
    statements, current, i = [], [], 0
    while i < len(text):
        if text.startswith('--', i):
            end = text.find('\n', i)
            i = len(text) if end < 0 else end + 1
            current.append(' ')
        elif text.startswith('/*', i):
            depth, j = 1, i + 2
            while depth and j < len(text):
                if text.startswith('/*', j): depth, j = depth + 1, j + 2
                elif text.startswith('*/', j): depth, j = depth - 1, j + 2
                else: j += 1
            if depth: raise ValueError('UNTERMINATED_COMMENT')
            i = j
            current.append(' ')
        elif text[i] in "'\"":
            quote, j = text[i], i + 1
            while j < len(text):
                if text[j] == quote:
                    if j + 1 < len(text) and text[j + 1] == quote: j += 2; continue
                    j += 1; break
                if text[j] == '\\': j += 2
                else: j += 1
            else: raise ValueError('UNTERMINATED_QUOTE')
            current.append(text[i:j]); i = j
        elif text[i] == '$' and (match := re.match(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$', text[i:])):
            tag = match.group(); end = text.find(tag, i + len(tag))
            if end < 0: raise ValueError('UNTERMINATED_FUNCTION_BODY')
            end += len(tag); current.append(text[i:end]); i = end
        elif text[i] == ';':
            statement = ''.join(current).strip()
            if statement: statements.append(statement)
            current = []; i += 1
        else:
            current.append(text[i]); i += 1
    if ''.join(current).strip(): raise ValueError('UNTERMINATED_STATEMENT')
    return statements


def data_boundary(sql):
    statements = sql_statements(sql)
    for statement in statements:
        if statement in ('BEGIN', 'COMMIT', BASELINE_GUARD):
            continue
        if re.match(r'^(CREATE|ALTER|COMMENT|GRANT|REVOKE|SET)\b', statement, re.I):
            continue
        if re.fullmatch(r"SELECT pg_catalog.set_config\('search_path', '', false\)", statement):
            continue
        raise ValueError('NON_SCHEMA_STATEMENT')
    return len(statements)


def secret_boundary(text):
    patterns = [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                r'\bsk-[A-Za-z0-9_-]{32,}', r'\bsb_secret_[A-Za-z0-9_-]{20,}',
                r'postgres(?:ql)?://[^\s\'\"]+', r'\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
                r'\bPASSWORD\s+\'(?!\')', r'https://[a-z0-9]+\.supabase\.co']
    if any(re.search(pattern, text, re.I) for pattern in patterns):
        raise ValueError('SECRET_OR_ENDPOINT_PATTERN_FOUND')


def migrations(root, ledger, decisions):
    ledger_by_version = {entry['version']: entry['name'] for entry in ledger}
    if len(ledger_by_version) != len(ledger) or not ledger:
        raise ValueError('INVALID_BASELINE_LEDGER')
    cutover = max(ledger_by_version)
    result, seen = [], set()
    for file in sorted((root / 'supabase/migrations').glob('*.sql')):
        match = re.fullmatch(r'(\d+)_([a-z0-9_]+)\.sql', file.name)
        if not match or match[1] in seen: raise ValueError('MIGRATION_IDENTITY_INVALID')
        version, name = match.groups(); seen.add(version)
        if version <= cutover and ledger_by_version.get(version) != name:
            raise ValueError('PRE_CUTOVER_ORPHAN')
        if version > cutover:
            result.append({'version': version, 'name': name, 'filename': file.name,
                           'sha256': digest(file.read_bytes())})
    if not set(ledger_by_version) <= seen: raise ValueError('MISSING_LEDGER_HISTORY')
    for entry in decisions:
        if entry['status'] != 'REISSUED_POST_BASELINE': raise ValueError('UNRESOLVED_ORPHAN')
        if (root / 'supabase/migrations' / entry['originalFilename']).exists():
            raise ValueError('ORPHAN_STILL_ACTIVE')
        if digest((root / entry['archive']).read_bytes()) != entry['originalSha256']:
            raise ValueError('ARCHIVE_CHANGED')
        if not any(m['filename'] == entry['newFilename'] and m['sha256'] == entry['newSha256'] for m in result):
            raise ValueError('REISSUE_NOT_IN_SEQUENCE')
    return result

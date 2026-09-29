#!/usr/bin/env python3
"""R4C fixed read-only catalog/operations inventory. Never dump or restore data.

Only metadata is written under this stage's evidence directory. A private,
temporary libpq credential mount is removed on exit; no raw stderr is published.
"""
import configparser
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/evidence/teaching-agent-stage-1f-r4c'
IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.159'
RUNTIME = Path('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json')
SERVICE = Path('/tmp/uply-stage1f-readonly/pg_service.conf')


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=60, **kwargs)
    if result.returncode:
        stderr=result.stderr.decode(errors='replace')
        known=['Permission denied','permission denied','password authentication failed','no password supplied','could not translate host name','Network is unreachable','Connection refused','certificate verify failed','syntax error','could not open','executable file not found']
        raise RuntimeError('READ_ONLY_COMMAND_FAILED: ' + args[0] + '; categories=' + ','.join(s for s in known if s in stderr))
    return result.stdout.decode()


def save(name, value):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def workspace():
    names = run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).split('\0')
    return {n: sha(ROOT / n) for n in sorted(set(names)) if n and (ROOT / n).is_file()}


SQL = """
\\conninfo
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SELECT json_build_object(
 'observedAt', clock_timestamp(),
 'readOnly', current_setting('transaction_read_only'),
 'serverVersion', current_setting('server_version'),
 'databaseName', current_database(),
 'databaseBytes', pg_database_size(current_database()),
 'tls', (SELECT json_build_object('ssl',ssl,'version',version,'bits',bits) FROM pg_stat_ssl WHERE pid=pg_backend_pid()),
 'schemaCountNonSystem', (SELECT count(*) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'),
 'tableCountNonSystem', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'),
 'schemaTables', (SELECT json_agg(x ORDER BY schema) FROM (SELECT n.nspname AS schema, count(*) FILTER (WHERE c.relkind IN ('r','p')) AS tables FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace=n.oid WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' GROUP BY n.nspname) x),
 'extensions', (SELECT json_agg(x ORDER BY name) FROM (SELECT extname AS name,extversion AS version FROM pg_extension) x),
 'roleCount', (SELECT count(*) FROM pg_roles),
 'migrationLedger', (SELECT json_agg(x ORDER BY version) FROM (SELECT version,name FROM supabase_migrations.schema_migrations) x),
 'agentTables', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('agent_definition_versions','agent_conversations','agent_messages','agent_runs','agent_run_events')),
 'agentPrefixedTables', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'agent\\_%' ESCAPE '\\')
);
ROLLBACK;
"""


def database():
    config = configparser.ConfigParser(interpolation=None)
    config.read(SERVICE)
    entry = config['audit']
    assert entry['sslmode'] == 'verify-full'
    runtime = json.loads(RUNTIME.read_text())
    project = runtime['NEXT_PUBLIC_SUPABASE_URL'].split('//')[1].split('.')[0]
    assert project in entry['host'] or project in entry['user'], 'TARGET_IDENTITY_MISMATCH'
    password = None
    for line in (ROOT / '.env.local').read_text().splitlines():
        if line.startswith('SUPABASE_DB_PASSWORD='):
            password = line.partition('=')[2].strip()
            if password[:1] in ('"', "'") and password[-1:] == password[:1]:
                password = password[1:-1]
    assert password and '\n' not in password and '\r' not in password
    with tempfile.TemporaryDirectory(prefix='uply-r4c-connection-') as directory:
        private = Path(directory)
        esc = lambda value: value.replace('\\', '\\\\').replace(':', '\\:')
        (private / 'pgpass').write_text(':'.join(esc(v) for v in [entry['host'],entry.get('port','5432'),entry['dbname'],entry['user'],password]) + '\n')
        (private / 'pgpass').chmod(0o600)
        (private / 'root.crt').write_bytes(SERVICE.with_name('root.crt').read_bytes())
        entry['sslrootcert'] = '/connection/root.crt'
        entry['passfile'] = '/connection/pgpass'
        entry['application_name'] = 'uply_r4c_readonly_catalog'
        with (private / 'pg_service.conf').open('w') as handle:
            config.write(handle, space_around_delimiters=False)
        (private / 'pg_service.conf').chmod(0o600)
        output = run(['docker','run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
                      '--user',str(os.getuid())+':'+str(os.getgid()), '--network=host','-i',
                      '-v',directory+':/connection:ro','-e','PGSERVICEFILE=/connection/pg_service.conf',
                      '-e','PGOPTIONS=-c default_transaction_read_only=on', '--entrypoint','psql',IMAGE,
                      '-X','-At','-w','-v','ON_ERROR_STOP=1','service=audit'], input=SQL.encode())
    data, _ = json.JSONDecoder().raw_decode(output[output.index('{'):])
    tls = re.search(r'SSL connection [(]protocol: ([A-Za-z0-9.]+), cipher: ([A-Za-z0-9_-]+)', output)
    data['clientTls'] = {'diagnosticObserved':bool(tls), 'protocol':tls[1] if tls else None, 'cipher':tls[2] if tls else None,
                         'verifyFullConnectionSucceeded':True}
    data['serverBackendTls'] = data.pop('tls')
    ledger = data.pop('migrationLedger')
    data.update(migrationLedgerCount=len(ledger),latestMigration=ledger[-1],ledgerSha256=digest(ledger),
                projectIdentitySha256=digest(project),hostIdentitySha256=digest(entry['host']),
                projectMatchesRuntime=True,sslmode='verify-full',clientImage=IMAGE)
    data['expectedStateMatches'] = len(ledger)==449 and ledger[-1]['version']=='202609130003' and data['agentTables']==0 and data['agentPrefixedTables']==0
    return data


def operations():
    raw = json.loads(run(['pm2','jlist']))
    matches = [p for p in raw if p.get('name')=='uply-first-enable']
    assert len(matches)==1
    app = matches[0]; env=app['pm2_env']
    pm = {k:env.get(k) for k in ['status','exec_mode','instances','pm_cwd','pm_exec_path','kill_timeout','restart_time','pm_uptime']}
    pm.update(name=app['name'],pid=app['pid'])
    config = json.loads(RUNTIME.read_text())
    keys = ['TEACHING_AGENT_ALLOWED_TENANTS','TEACHING_AGENT_ALLOWED_COURSES','TEACHING_AGENT_ALLOWED_USERS']
    flag=config.get('TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED')
    runtime={'path':str(RUNTIME),'sha256':sha(RUNTIME),'mode':oct(RUNTIME.stat().st_mode & 0o777),
             'featureFlag':'OFF' if flag in (None,False,'false','0','') else 'NOT_OFF',
             'allowlists':{k:'EMPTY' if config.get(k) in (None,'',[]) else 'NONEMPTY' for k in keys},
             'necessaryVariables':{k:'SET' if config.get(k) else 'UNSET' for k in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','DEEPSEEK_API_KEY']}}
    serve=json.loads(run(['tailscale','serve','status','--json']))
    summary=[]
    for authority, settings in serve.get('Web',{}).items():
        for path, handler in settings.get('Handlers',{}).items():
            summary.append({'port':authority.rsplit(':',1)[-1],'path':path,'proxy':handler.get('Proxy')})
    return {'observedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'pm2':pm,'runtime':runtime,
            'launcherSha256':sha(env['pm_exec_path']),
            'tailscale':{'canonicalSha256':digest(serve),'tcpPorts':sorted(serve.get('TCP',{})),
                         'bindings':summary,'funnelEnabled':any(serve.get('AllowFunnel',{}).values())}}


if __name__ == '__main__':
    assert len(sys.argv)==2 and sys.argv[1] in ('start','end')
    phase=sys.argv[1]
    if phase=='start': save('workspace-before.json',workspace())
    db=database(); save('database-'+phase+'.json',db)
    ops=operations(); save('operations-'+phase+'.json',ops)
    print(json.dumps({'database':db,'operations':ops},ensure_ascii=False,indent=2))
    if not db['expectedStateMatches']:
        print('STOP — PRODUCTION STATE CHANGED')
        sys.exit(3)

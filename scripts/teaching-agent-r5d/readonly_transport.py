"""Fixed acceptance SQL only; TLS verify-full and default_transaction_read_only=on.
Temporary credential mount is private and removed on exit. No mutation API.
"""
import configparser,json,os,tempfile
from pathlib import Path
from inventory import ROOT,RUNTIME,SERVICE,IMAGE,run
def query(sql):
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
    with tempfile.TemporaryDirectory(prefix='uply-r5d-readonly-') as directory:
        private = Path(directory)
        esc = lambda value: value.replace('\\', '\\\\').replace(':', '\\:')
        (private / 'pgpass').write_text(':'.join(esc(v) for v in [entry['host'],entry.get('port','5432'),entry['dbname'],entry['user'],password]) + '\n')
        (private / 'pgpass').chmod(0o600)
        (private / 'root.crt').write_bytes(SERVICE.with_name('root.crt').read_bytes())
        entry['sslrootcert'] = '/connection/root.crt'
        entry['passfile'] = '/connection/pgpass'
        entry['application_name'] = 'uply_r5d_readonly_acceptance'
        with (private / 'pg_service.conf').open('w') as handle:
            config.write(handle, space_around_delimiters=False)
        (private / 'pg_service.conf').chmod(0o600)
        output = run(['docker','run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
                      '--user',str(os.getuid())+':'+str(os.getgid()), '--network=host','-i',
                      '-v',directory+':/connection:ro','-e','PGSERVICEFILE=/connection/pg_service.conf',
                      '-e','PGOPTIONS=-c default_transaction_read_only=on', '--entrypoint','psql',IMAGE,
                      '-X','-At','-w','-v','ON_ERROR_STOP=1','service=audit'], input=sql.encode())
    return output

#!/usr/bin/env python3
"""Owned local R2 Supabase lifecycle. No remote target arguments or production secrets."""
import argparse,base64,hashlib,hmac,json,os,pathlib,re,secrets,socket,subprocess,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
MARKER='uply-teaching-agent-r2-disposable-v1'
def public_production_identity():
    # Only public URL/ref metadata is extracted; credentials are never parsed or copied.
    url=None
    with (ROOT/'.env.local').open() as f:
        for line in f:
            if line.startswith('NEXT_PUBLIC_SUPABASE_URL='):url=line.split('=',1)[1].strip().strip('\"\'');break
    ref=(ROOT/'supabase/.temp/project-ref').read_text().strip()
    from urllib.parse import urlparse
    host=urlparse(url or '').hostname
    if not host or not ref:raise ValueError('PRODUCTION_PUBLIC_IDENTITY_REQUIRED')
    return {'host':host,'ref':ref,'url':url}
def guard(state):
    from urllib.parse import urlparse
    prod=public_production_identity();u=urlparse(state['url'])
    if state['marker']!=MARKER or not re.fullmatch(r'uply-agent-r2-[a-f0-9]{12}',state['project']):raise ValueError('INVALID_STAGE_MARKER')
    if u.hostname!='127.0.0.1' or u.port!=state['ports']['api'] or state['dbHost']!='127.0.0.1':raise ValueError('LOCAL_TARGET_REQUIRED')
    if state['url']==prod['url'] or state['project']==prod['ref'] or u.hostname==prod['host'] or state['dbHost']==prod['host']:raise ValueError('PRODUCTION_TARGET_FORBIDDEN')
    return True
def token(secret,role):
    b=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).rstrip(b'=')
    data=b({'alg':'HS256','typ':'JWT'})+b'.'+b({'iss':'supabase-demo','role':role,'iat':int(time.time()),'exp':int(time.time())+86400})
    return (data+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),data,hashlib.sha256).digest()).rstrip(b'=')).decode()
def prepare():
    os.umask(0o077);directory=pathlib.Path(tempfile.mkdtemp(prefix='uply-r2-private-'));project='uply-agent-r2-'+secrets.token_hex(6)
    held=[]
    try:
        for _ in range(7):
            s=socket.socket();s.bind(('127.0.0.1',0));held.append(s)
        ports=dict(zip(['api','db','shadow','studio','smtp','analytics','next'],[s.getsockname()[1] for s in held]))
    finally:
        for s in held:s.close()
    state={'marker':MARKER,'project':project,'directory':str(directory),'ports':ports,'url':f'http://127.0.0.1:{ports["api"]}','dbHost':'127.0.0.1','owner':'Stage 1F-R2 harness','createdAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    guard(state)
    for kind in ['container','network','volume']:
        names=subprocess.check_output(['docker',kind,'ls','--format','{{.Name}}' if kind!='container' else '{{.Names}}']).decode()
        if project in names:raise ValueError('STAGING_IDENTITY_COLLISION')
    jwt=secrets.token_urlsafe(48);private={'SUPABASE_AUTH_JWT_SECRET':jwt,'SUPABASE_AUTH_ANON_KEY':token(jwt,'anon'),'SUPABASE_AUTH_SERVICE_ROLE_KEY':token(jwt,'service_role')}
    (directory/'private.json').write_text(json.dumps(private));(directory/'state.json').write_text(json.dumps(state));(directory/'supabase').mkdir();(directory/'supabase/migrations').mkdir()
    (directory/'supabase/config.toml').write_text(f'''project_id = "{project}"
[api]
enabled = true
port = {ports['api']}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = {ports['db']}
shadow_port = {ports['shadow']}
major_version = 17
[db.migrations]
enabled = false
[db.seed]
enabled = false
[studio]
enabled = false
port = {ports['studio']}
[local_smtp]
enabled = false
port = {ports['smtp']}
[analytics]
enabled = false
port = {ports['analytics']}
[edge_runtime]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:{ports['next']}"
additional_redirect_urls = []
jwt_expiry = 3600
jwt_secret = "env(SUPABASE_AUTH_JWT_SECRET)"
anon_key = "env(SUPABASE_AUTH_ANON_KEY)"
service_role_key = "env(SUPABASE_AUTH_SERVICE_ROLE_KEY)"
[auth.email]
enable_signup = true
enable_confirmations = false
[auth.rate_limit]
sign_in_sign_ups = 200
[storage]
enabled = true
[realtime]
enabled = true
''')
    print(json.dumps(state));return state
def load(directory):
    state=json.loads((directory/'state.json').read_text());guard(state)
    if pathlib.Path(state['directory']).resolve()!=directory.resolve():raise ValueError('STAGE_DIRECTORY_MISMATCH')
    return state
def cli(directory,args):
    state=load(directory);private=json.loads((directory/'private.json').read_text())
    env={k:v for k,v in os.environ.items() if not any(x in k for x in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC'])}
    env.update(private);env.update(SUPABASE_HOME=str(directory/'cli-home'),SUPABASE_TELEMETRY_DISABLED='1',DO_NOT_TRACK='1')
    result=subprocess.run([str(ROOT/'node_modules/.bin/supabase'),*args,'--workdir',str(directory)],env=env,capture_output=True)
    (directory/('cli-'+args[0]+'.private.log')).write_bytes(result.stdout+result.stderr)
    print(json.dumps({'operation':args[0],'exit':result.returncode,'project':state['project']}));return result
def sql(directory,statement,check=True):
    state=load(directory);name='supabase_db_'+state['project']
    inspected=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
    if inspected['Config']['Labels'].get('com.supabase.cli.project')!=state['project']:raise ValueError('DATABASE_OWNER_MISMATCH')
    ports=inspected['HostConfig']['PortBindings'].get('5432/tcp',[])
    if not any(int(p['HostPort'])==state['ports']['db'] for p in ports):raise ValueError('DATABASE_PORT_MISMATCH')
    result=subprocess.run(['docker','exec','-i',name,'psql','-U','supabase_admin','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],input=statement.encode(),capture_output=True)
    if check and result.returncode:
        (directory/'sql-error.private.log').write_bytes(result.stderr)
        raise RuntimeError('STAGING_SQL_FAILED; private diagnostic retained')
    return result
def bootstrap(directory):
    state=load(directory);manifest=json.loads((ROOT/'supabase/bootstrap/baseline-manifest.json').read_text());baseline=(ROOT/'supabase/bootstrap/app-schema-baseline.sql').read_bytes()
    if hashlib.sha256(baseline).hexdigest()!=manifest['baselineSqlDigest']:raise ValueError('BASELINE_DIGEST_MISMATCH')
    if sql(directory,"select count(*) from pg_tables where schemaname in ('public','private','recording_private','runtime_publish_private')").stdout.strip()!=b'0':raise ValueError('STAGING_NOT_EMPTY')
    platform=json.loads(sql(directory,"select json_build_object('extensions',(select json_agg(json_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion)) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),'roles',(select json_agg(json_build_object('name',rolname,'super',rolsuper)) from pg_roles where rolname in ('postgres','supabase_admin')));").stdout)
    # Public btree_gist support is the only absent app-required extension in the CLI stack.
    sql(directory,'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;')
    # CLI postgres is NOSUPERUSER. PostgreSQL requires a superuser-owned function
    # when creating this archived event trigger. Bootstrap only, never student flow:
    # retain exact app owner/DDL, then restore the original role attribute immediately.
    was_super=next(r['super'] for r in platform['roles'] if r['name']=='postgres')
    try:
        if not was_super:sql(directory,'ALTER ROLE postgres SUPERUSER;')
        sql(directory,"SET ROLE postgres; SET uply.bootstrap_mode='new-environment';\n"+baseline.decode())
    finally:
        if not was_super:sql(directory,'ALTER ROLE postgres NOSUPERUSER;')
    ledger=json.loads((ROOT/'supabase/bootstrap/migration-ledger-baseline.json').read_text())
    def insert(rows):
        for row in rows:
            if not re.fullmatch(r'\d+',row['version']) or not re.fullmatch(r'[a-z0-9_]+',row['name']):raise ValueError('LEDGER_INVALID')
        return 'INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES '+','.join("('%s','%s')"%(x['version'],x['name']) for x in rows)+';'
    sql(directory,'CREATE SCHEMA IF NOT EXISTS supabase_migrations;CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text primary key,statements text[],name text);')
    sql(directory,insert(ledger));steps=[]
    for entry in manifest['postBaselineMigrations']:
        data=(ROOT/'supabase/migrations'/entry['filename']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=entry['sha256']:raise ValueError('MIGRATION_DIGEST_MISMATCH')
        sql(directory,'SET ROLE postgres;\n'+data.decode());sql(directory,insert([entry]));steps.append({'filename':entry['filename'],'exit':0})
    sql(directory,"NOTIFY pgrst,'reload schema';")
    observed=json.loads(sql(directory,"select json_agg(json_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations;").stdout)
    expected=ledger+[{'version':m['version'],'name':m['name']} for m in manifest['postBaselineMigrations']]
    if observed!=expected:raise ValueError('LEDGER_MISMATCH')
    denied=sql(directory,"SET uply.bootstrap_mode='new-environment';\n"+baseline.decode(),False)
    if denied.returncode==0 or b'BASELINE_REFUSES_EXISTING_APPLICATION' not in denied.stderr:raise ValueError('BASELINE_REPEAT_GUARD_FAILED')
    result={'baseline':'PASS','ledgerCount':len(observed),'ledgerExact':True,'steps':steps,'repeatGuard':'PASS','platformBefore':platform,'bootstrapRole':'postgres SUPERUSER only while installing exact event-trigger DDL; restored NOSUPERUSER before incrementals/Auth/Student tests; no student impersonation'}
    (directory/'bootstrap-result.json').write_text(json.dumps(result,indent=2));print(json.dumps({'baseline':'PASS','ledgerCount':len(observed),'steps':len(steps)}))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['prepare','start','status','bootstrap']);p.add_argument('--directory',type=pathlib.Path);a=p.parse_args()
    if a.action=='prepare':prepare()
    elif a.action=='start':raise SystemExit(cli(a.directory,['start','-x','studio,meta,inbucket,analytics,vector,edge-runtime,imgproxy']).returncode)
    elif a.action=='bootstrap':bootstrap(a.directory)
    else:
        result=cli(a.directory,['status','-o','json'])
        if result.returncode==0:
            status=json.loads(result.stdout)
            if status.get('API_URL')!=load(a.directory)['url']:raise ValueError('STATUS_ENDPOINT_MISMATCH')
            (a.directory/'status.json').write_text(json.dumps(status))
        raise SystemExit(result.returncode)

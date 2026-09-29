#!/usr/bin/env python3
"""R1 migration proof only: each invocation owns and removes a network-none tmpfs DB.
Fresh includes platform schema prerequisites and one synthetic owner; it never skips app SQL.
A failed historical data migration is reported as a failure, never converted to PASS.
"""
import pathlib,subprocess,json,time,uuid,re,hashlib
import argparse,sys
parser=argparse.ArgumentParser(description='Offline disposable PostgreSQL migration verification. Never accepts a database endpoint.')
parser.add_argument('--mode',choices=['fresh','full-history','clone'],required=True)
parser.add_argument('--snapshot-dir',type=pathlib.Path,required=True,help='Private directory containing schema.dump and roles.sql, schema/roles only')
parser.add_argument('--output',type=pathlib.Path,required=True,help='New private evidence directory')
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];evidence=args.snapshot_dir.resolve();mode='fresh' if args.mode=='full-history' else args.mode
assert (evidence/'schema.dump').is_file() and (evidence/'roles.sql').is_file()
name='uply-stage1fr1-'+mode+'-'+uuid.uuid4().hex[:8];out=args.output.resolve();out.mkdir(mode=0o700,parents=True,exist_ok=False);image='public.ecr.aws/supabase/postgres:17.6.1.159';result={'mode':mode,'network':'none','container':name,'steps':[]}
def docker(args,input=None):return subprocess.run(['docker']+args,input=input,capture_output=True)
def sql(s):return docker(['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],s.encode())
# Read only cached platform SQL. No service, account, port, volume, .env or network.
bootstrap_names=['00000000000000-initial-schema.sql','00000000000001-auth-schema.sql','00000000000002-storage-schema.sql']
bootstrap_sql=''.join(docker(['run','--rm','--pull=never','--network','none','--entrypoint','cat',image,'/docker-entrypoint-initdb.d/init-scripts/'+f]).stdout.decode() for f in bootstrap_names)
toc_result=docker(['run','--rm','--pull=never','--network','none','-i','--entrypoint','pg_restore',image,'--list'],(evidence/'schema.dump').read_bytes())
assert toc_result.returncode==0
schema_toc=toc_result.stdout.decode()
result['snapshotSha256']=hashlib.sha256((evidence/'schema.dump').read_bytes()).hexdigest()
created=False
try:
 r=docker(['run','-d','--pull=never','--name',name,'--label','uply.stage=1fr1-disposable','--network','none','--read-only','--tmpfs','/tmp:rw,size=1024m,mode=1777','--user','100:101','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/testpg -A trust --no-locale >/tmp/init.log && exec postgres -D /tmp/testpg -k /tmp -c listen_addresses='' -c max_connections=20"]);assert r.returncode==0;created=True
 for _ in range(60):
  if sql('select 1').returncode==0:break
  time.sleep(.1)
 if mode=='fresh':
  boot='create role supabase_admin superuser;\n'+bootstrap_sql;r=sql(boot);result['bootstrapExit']=r.returncode;(out/'bootstrap-private.log').write_bytes(r.stderr)
  if r.returncode:raise RuntimeError('platform bootstrap failed')
  # Storage service schema is a platform prerequisite, not application history.
  # Storage namespace already created by the platform initializer.
  toc=schema_toc; toc='\n'.join(l for l in toc.splitlines() if ' POLICY storage ' not in l)
  docker(['exec','-i',name,'/bin/sh','-c','cat > /tmp/storage.list'],toc.encode())
  r=docker(['exec','-i',name,'pg_restore','-h','/tmp','-U','postgres','-d','postgres','--schema=storage','--no-owner','--no-acl','--use-list=/tmp/storage.list'],(evidence/'schema.dump').read_bytes());result['storageSchemaExit']=r.returncode;(out/'storage-private.log').write_bytes(r.stderr)
  if r.returncode:raise RuntimeError('platform storage schema failed')
  assert sql('create schema realtime; create publication supabase_realtime_messages_publication;').returncode==0
  toc=schema_toc;toc='\n'.join(l for l in toc.splitlines() if ' POLICY realtime ' not in l)
  docker(['exec','-i',name,'/bin/sh','-c','cat > /tmp/realtime.list'],toc.encode())
  r=docker(['exec','-i',name,'pg_restore','-h','/tmp','-U','postgres','-d','postgres','--schema=realtime','--no-owner','--no-acl','--use-list=/tmp/realtime.list'],(evidence/'schema.dump').read_bytes());result['realtimeSchemaExit']=r.returncode;(out/'realtime-private.log').write_bytes(r.stderr)
  if r.returncode:raise RuntimeError('platform realtime schema failed')
  toc='\n'.join(l for l in toc.splitlines() if ' FUNCTION auth jwt() ' in l)
  docker(['exec','-i',name,'/bin/sh','-c','cat > /tmp/jwt.list'],toc.encode())
  r=docker(['exec','-i',name,'pg_restore','-h','/tmp','-U','postgres','-d','postgres','--no-owner','--no-acl','--use-list=/tmp/jwt.list'],(evidence/'schema.dump').read_bytes());result['jwtFunctionExit']=r.returncode
  if r.returncode:raise RuntimeError('platform JWT function failed')


 else:
  roles=(evidence/'roles.sql').read_text();roles='\n'.join(l for l in roles.splitlines() if not l.startswith('CREATE ROLE postgres;') and not l.startswith('ALTER ROLE postgres '));roles=re.sub(r' GRANTED BY [a-z_]+','',roles)
  r=sql(roles);result['rolesExit']=r.returncode;(out/'roles-private.log').write_bytes(r.stderr)
  if r.returncode:raise RuntimeError('clone roles failed')
  r=docker(['exec','-i',name,'pg_restore','-h','/tmp','-U','postgres','-d','postgres'],(evidence/'schema.dump').read_bytes());result['restoreExit']=r.returncode;(out/'restore-private.log').write_bytes(r.stderr)
  if r.returncode:raise RuntimeError('clone restore failed')
  result['roleAdaptation']='bootstrap postgres remains superuser; membership grants preserved but issued by bootstrap postgres instead of hosted supabase_admin'
 if mode=='fresh':
  # Preserve the R1 historical replay contract, including subsequently archived orphans.
  inventory=json.loads((root/'docs/evidence/teaching-agent-stage-1f-r1/migration-identity/migration-inventory.json').read_text())
  files=[]
  for entry in inventory:
   f=root/'supabase/migrations'/entry['filename']
   if not f.exists():f=root/'docs/evidence/teaching-agent-stage-1f-r1b/migration-archive'/entry['filename']
   if hashlib.sha256(f.read_bytes()).hexdigest()!=entry['sha256']:raise ValueError('LEGACY_HISTORY_BYTES_CHANGED')
   files.append(f)
 else:
  manifest=json.loads((root/'supabase/bootstrap/baseline-manifest.json').read_text())
  files=[root/'supabase/migrations'/m['filename'] for m in manifest['postBaselineMigrations']]
 for f in files:
  if mode=='fresh' and f.name=='202608190007_seed_korean_chapter_one_pilot_papers.sql':
   bootstrap="set request.jwt.claim.role='service_role'; insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000999','migration-fixture@example.invalid','{\"name\":\"Synthetic migration owner\"}'); update public.profiles set role='platform_super_admin',global_role='platform_owner',status='active' where id='00000000-0000-4000-8000-000000000999'; reset request.jwt.claim.role;"
   r=sql(bootstrap);result['syntheticOwnerBootstrapExit']=r.returncode;(out/'synthetic-owner-private.log').write_bytes(r.stderr)
   if r.returncode:raise RuntimeError('synthetic migration owner prerequisite failed')
  r=sql(f.read_text());result['steps'].append({'file':f.name,'exit':r.returncode});(out/(f.name+'.private.log')).write_bytes(r.stderr)
  if r.returncode:result['failedMigration']=f.name;result['errorLines']=[l for l in r.stderr.decode().splitlines() if 'ERROR:' in l];break
 result['agentTables']=sql("select count(*) from pg_tables where schemaname='public' and tablename in ('agent_runs','agent_conversations','agent_messages','agent_definition_versions','agent_run_events')").stdout.decode().strip()
 result['success']=len(result['steps'])==len(files) and all(s['exit']==0 for s in result['steps'])
 if mode=='fresh' and not result['success']:
  expected=result.get('failedMigration')=='202608190007_seed_korean_chapter_one_pilot_papers.sql' and len(result['steps'])==287 and all(s['exit']==0 for s in result['steps'][:-1]) and result.get('errorLines')==['ERROR:  韩国语一级第一章正式题库不存在或尚未发布']
  result['legacyClassification']='LEGACY_HISTORY_NOT_SELF_CONTAINED' if expected else 'UNEXPECTED_HISTORY_FAILURE'
 if result['success']:
  q="select json_build_object('policies',(select json_agg(to_jsonb(p)) from pg_policies p where schemaname='public'),'rpc',(select json_agg(json_build_object('name',p.proname,'definer',p.prosecdef,'path',p.proconfig,'browserExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%agent_run%' or p.proname='record_agent_usage_v1')));";r=sql(q);(out/'verify.json').write_bytes(r.stdout)
  if r.returncode:raise RuntimeError('post-migration catalog verification failed')
except Exception as e:result['error']=str(e);result['success']=False
finally:
 if created:docker(['rm','-f',name])
 (out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='steps'}));print('Executed migration steps',len(result['steps']))

sys.exit(0 if result.get("success") else 1)

"""Read-only synthetic staging catalog/fingerprints; only explicitly owned cleanup mutates."""
import json,pathlib,subprocess,sys,signal,os,shutil,time
from staging import load,sql,guard
d=pathlib.Path(sys.argv[2]);s=load(d);action=sys.argv[1]
def inventory(kind):
 args=['docker',kind,'ls']+(['-a'] if kind=='container' else [])+['--filter','label=com.supabase.cli.project='+s['project'],'--format','{{.Names}}' if kind=='container' else '{{.Name}}']
 return subprocess.check_output(args).decode().split()
if action=='capture':
 stack=[]
 for name in inventory('container'):
  x=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
  stack.append({'name':name,'image':x['Config']['Image'],'state':x['State']['Status'],'health':x['State'].get('Health',{}).get('Status'),'ports':x['HostConfig']['PortBindings'],'labels':x['Config']['Labels']})
 (d/'stack-result.json').write_text(json.dumps(stack,indent=2))
 guards=[]
 for field,value in [('url','https://production.invalid'),('project','not-owned'),('dbHost','production.invalid'),('marker','')]:
  try:guard({**s,field:value});guards.append(False)
  except ValueError:guards.append(True)
 (d/'guard-result.json').write_text(json.dumps({'positive':guard(s),'negative':guards}))
 q="""select json_build_object('tables',(select json_agg(json_build_object('name',c.relname,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('agent_definition_versions','agent_conversations','agent_messages','agent_runs','agent_run_events')),'postgresSuper',(select rolsuper from pg_roles where rolname='postgres'),'functions',(select json_agg(json_build_object('name',p.proname,'securityDefiner',p.prosecdef,'config',p.proconfig)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','agent_core_private') and (p.proname like '%agent_run%' or p.proname in ('definition_guard','transition_agent_run_v1'))));"""
 (d/'agent-catalog.json').write_bytes(sql(d,q).stdout)
 print(json.dumps({'capture':'PASS','containers':len(stack),'guards':all(guards)}))
elif action in ['before','after']:
 tables=json.loads(sql(d,"select json_agg(tablename) from pg_tables where schemaname='public' and (tablename like 'learning_agent_%' or tablename like 'digital_textbook_%' or tablename like '%progress%' or tablename like '%completion%' or tablename like '%assignment%' or tablename like '%quiz%' or tablename like '%assessment%' or tablename like '%chapter_test%' or tablename in ('courses','lessons','course_categories','profiles','tenants','tenant_memberships','student_app_enrollments','tenant_student_apps'));").stdout)
 result={}
 for table in sorted(tables):
  if not table.replace('_','').isalnum():raise ValueError('INVALID_TABLE')
  result[table]=json.loads(sql(d,"select json_build_object('rows',count(*),'digest',md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),''))) from public."+table+' t;').stdout)
 (d/('domain-'+action+'.json')).write_text(json.dumps(result,indent=2))
 if action=='after':
  before=json.loads((d/'domain-before.json').read_text());changes=[t for t in result if before.get(t)!=result[t]]
  (d/'side-effects-result.json').write_text(json.dumps({'tables':len(result),'changedTables':changes,'teachingWrites':0 if not changes else 'NOT_ZERO'}));print(json.dumps({'changedTables':changes,'tables':len(result)}))
 else:print(json.dumps({'fingerprintedTables':len(result)}))
elif action=='cleanup':
 # Never accept arbitrary names, paths, project refs, or Docker prune.
 # Exec sandboxes can assign different PID namespaces. Resolve owners by unique cwd,
 # never trust a PID recorded in another namespace or kill by port alone.
 owners=[]
 for proc in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   if proc.joinpath('cwd').resolve()!=d/'next':continue
   command=proc.joinpath('cmdline').read_bytes()
   if b'next' not in command:continue
   owners.append(int(proc.name))
  except (FileNotFoundError,PermissionError,ProcessLookupError):continue
 for pid in owners:
  try:os.kill(pid,signal.SIGTERM)
  except ProcessLookupError:pass
 time.sleep(1)
 for pid in owners:
  proc=pathlib.Path('/proc')/str(pid)
  if proc.exists() and proc.joinpath('cwd').resolve()==d/'next':os.kill(pid,signal.SIGKILL)
 import socket
 probe=socket.socket()
 try:
  if probe.connect_ex(('127.0.0.1',s['ports']['next']))==0:raise ValueError('NEXT_STILL_LISTENING_OR_NOT_VISIBLE_IN_SANDBOX')
 finally:probe.close()
 removed={}
 for kind in ['container','network','volume']:
  names=inventory(kind)
  for name in names:
   if not name.endswith('_'+s['project']):raise ValueError('RESOURCE_OWNER_MISMATCH')
  if names:subprocess.run(['docker',kind,'rm']+(['-f'] if kind=='container' else [])+names,check=True,capture_output=True)
  removed[kind]=names
  if inventory(kind):raise ValueError('CLEANUP_INCOMPLETE')
 result={'removed':removed,'remainingOwnedResources':0,'privateDirectoryRemoved':False}
 if not str(d).startswith('/tmp/uply-r2-private-') or d.is_symlink():raise ValueError('PRIVATE_PATH_MISMATCH')
 shutil.rmtree(d);result['privateDirectoryRemoved']=not d.exists()
 pathlib.Path('/tmp/'+s['project']+'-cleanup-result.json').write_text(json.dumps(result,indent=2));print(json.dumps({'cleanup':'PASS','remainingOwnedResources':0,'privateDirectoryRemoved':True}))

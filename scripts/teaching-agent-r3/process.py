"""Owned local next start. Startup flags are immutable until process replacement."""
import json,os,pathlib,signal,socket,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import ROOT,load
action=sys.argv[1];d=pathlib.Path(sys.argv[2]);s=load(d);dest=d/'next'
def owners():
    found=[]
    for p in pathlib.Path('/proc').glob('[0-9]*'):
        try:
            if p.joinpath('cwd').resolve()==dest and b'next' in p.joinpath('cmdline').read_bytes():found.append(int(p.name))
        except (FileNotFoundError,PermissionError,ProcessLookupError):pass
    return found
if action in ['signal','stop','simulate-pm2-stop']:
    found=owners()
    for pid in found:os.kill(pid,signal.SIGTERM)
    forced=False
    if action in ['stop','simulate-pm2-stop']:
        for _ in range(150 if action=='simulate-pm2-stop' else 550):
            if not owners():break
            time.sleep(.1)
        if owners():
            if action!='simulate-pm2-stop':raise ValueError('OWNED_NEXT_DRAIN_TIMEOUT')
            for pid in owners():os.kill(pid,signal.SIGKILL)
            forced=True
    print(json.dumps({'signalled':len(found),'forcedKill':forced}));raise SystemExit
if action not in ['start-off','start-on','start-watched','start-wrong-course','start-wrong-user']:raise ValueError('INVALID_ACTION')
probe=socket.socket();occupied=probe.connect_ex(('127.0.0.1',s['ports']['next']))==0;probe.close()
if occupied:raise ValueError('PORT_ALREADY_SERVING')
keys=json.loads((d/'status.json').read_text());ids=json.loads((d/'fixture.json').read_text());users=json.loads((d/'users.private.json').read_text())
env={k:v for k,v in os.environ.items() if not any(x in k for x in ['SUPABASE','DEEPSEEK','OPENAI','ANTHROPIC','TEACHING_AGENT','NEXT_PUBLIC_'])}
enabled=action in ['start-on','start-wrong-course','start-wrong-user']
env.update(NODE_ENV='production',NEXT_PUBLIC_SUPABASE_URL=s['url'],NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=keys['ANON_KEY'],SUPABASE_SERVICE_ROLE_KEY=keys['SERVICE_ROLE_KEY'],NEXT_TELEMETRY_DISABLED='1',UPLY_R2_DIRECTORY=str(d),UPLY_R3_STARTUP_ONLY='0' if action=='start-watched' else '1',TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED='1' if enabled else '0',TEACHING_AGENT_ALLOWED_TENANTS=ids['A'] if enabled else '',TEACHING_AGENT_ALLOWED_COURSES=ids['acourse'] if enabled else '',TEACHING_AGENT_ALLOWED_USERS=users['A1']['id'] if enabled else '')
if action=='start-wrong-course':env['TEACHING_AGENT_ALLOWED_COURSES']=ids['bcourse']
if action=='start-wrong-user':env['TEACHING_AGENT_ALLOWED_USERS']=users['A2']['id']
with (d/('process-'+action+'.private.log')).open('a') as f:
    p=subprocess.Popen(['node',str(ROOT/'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',str(s['ports']['next'])],cwd=dest,env=env,stdin=subprocess.DEVNULL,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
for _ in range(100):
    if p.poll() is not None:raise ValueError('NEXT_START_FAILED')
    probe=socket.socket();ready=probe.connect_ex(('127.0.0.1',s['ports']['next']))==0;probe.close()
    if ready:break
    time.sleep(.1)
else:raise ValueError('NEXT_START_TIMEOUT')
print(json.dumps({'started':True,'mode':action,'startupOnly':action!='start-watched','port':s['ports']['next']}))

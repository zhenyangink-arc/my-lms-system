"""Run real maintenance command through owned Docker psql; inspect safe receipts."""
import json,os,pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load,sql,ROOT
D=pathlib.Path(sys.argv[1]);load(D);I=json.loads((D/'fixture.json').read_text());A=I['A']
binpath=D/'operator-bin';binpath.mkdir(exist_ok=True)
wrapper=binpath/'psql'
wrapper.write_text('''#!/usr/bin/env python3
import pathlib,sys,os
sys.path.insert(0,'''+repr(str(ROOT/'scripts/teaching-agent-r2'))+''')
from staging import sql,load
p=pathlib.Path('''+repr(str(D))+''');load(p)
args=dict(x[2:].split('=',1) for x in sys.argv[1:] if x.startswith('--') and not x.startswith('--set='))
variables=dict(x[len('--set='):].split('=',1) for x in sys.argv[1:] if x.startswith('--set='))
s=pathlib.Path(args['file']).read_text()
for k,v in variables.items():s=s.replace(":"+"'"+k+"'", "'"+v.replace("'","''")+"'")
r=sql(p,'SET ROLE '+('authenticated' if os.environ.get('R3A_DENY') else 'service_role')+';'+s,False)
sys.stdout.buffer.write(r.stdout);sys.stderr.buffer.write(r.stderr);sys.exit(r.returncode)
''');wrapper.chmod(0o700)
env={**os.environ,'PATH':str(binpath)+':'+os.environ['PATH']}
cmd=['python3',str(ROOT/'scripts/teaching-agent-r3a/reconcile-command.py'),'--service','owned-staging','--tenant',A,'--operator','synthetic-operator','--limit','50','--execute']
receipts=[]
for denied in [False,True]:
 r=subprocess.run(cmd,env={**env,**({'R3A_DENY':'1'} if denied else {})},capture_output=True);receipt=json.loads(r.stdout)
 assert r.returncode==(1 if denied else 0) and receipt['reconcileError']==int(denied)
 assert receipt['commitState']==('UNKNOWN' if denied else 'CONFIRMED')
 assert receipt['success'] is (not denied) and receipt['retryAllowed'] is False
 assert receipt['followUpReadRequired'] is denied
 assert not r.stderr;receipts.append(receipt)
monitor=(ROOT/'scripts/teaching-agent-r3a/operator-monitor.sql').read_text().replace(":'tenant_id'","'"+A+"'").replace(":'since'","'2026-01-01'")
m=json.loads(sql(D,'SET ROLE service_role;'+monitor).stdout)
assert m['active']==0 and m['expiredActive']==0 and m['reconciledCancelled']>=1 and m['reconciledDeadlineFailed']>=1
# Existing R3 operator queries remain usable without edits.
for filename in ['operator-active-runs.sql','operator-run-lookup.sql']:
 s=(ROOT/'scripts/teaching-agent-r3'/filename).read_text().replace(":'tenant_id'","'"+A+"'")
 run=sql(D,"select id from agent_runs where tenant_id='"+A+"' and status='failed' limit 1").stdout.decode().strip()
 s=s.replace(":'run_id'","'"+run+"'");assert sql(D,'SET ROLE service_role;'+s,False).returncode==0
out={'status':'PASS','receipts':receipts,'reconcileErrorCount':sum(x['reconcileError'] for x in receipts),'monitor':m,'r3Queries':'PASS','publicEndpoint':'NONE','productionWrites':0}
(D/'operator-reconcile-result.json').write_text(json.dumps(out,indent=2));print(json.dumps({'status':'PASS','realSqlReceipts':2,'errorCount':out['reconcileErrorCount']}))

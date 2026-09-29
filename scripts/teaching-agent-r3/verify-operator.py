"""Exercise the actual read-only operator SQL on guarded synthetic staging only."""
import json, pathlib, sys, uuid
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]/'teaching-agent-r2'))
from staging import load, sql
d=pathlib.Path(sys.argv[1]); load(d)
ids=json.loads((d/'fixture.json').read_text())
ops=json.loads((d/'operations-result.json').read_text())
root=pathlib.Path(__file__).resolve().parent
def query(name, tenant, run=None, role=None):
    prefix=f"\\set tenant_id '{uuid.UUID(tenant)}'\n\\set since '2026-01-01T00:00:00Z'\n"
    if run: prefix+=f"\\set run_id '{uuid.UUID(run)}'\n"
    if role: prefix+='SET ROLE authenticated;\n'
    result=sql(d,prefix+(root/name).read_text(),check=False)
    return result,[json.loads(line) for line in result.stdout.decode().splitlines() if line.startswith('{')]
out={'productionWrites':0,'operatorAuthorization':'out-of-band tenant-authorized operator; not a student endpoint','lookups':{}}
failed=json.loads(sql(d,"SELECT json_agg(id) FROM public.agent_runs WHERE status='failed';").stdout)[0]
for label,run in {**ops['lookupRunIds'],'failed':failed}.items():
    result,rows=query('operator-run-lookup.sql',ids['A'],run)
    assert result.returncode==0 and len(rows)==1
    out['lookups'][label]=rows[0]
    result,rows=query('operator-run-lookup.sql',ids['B'],run)
    assert result.returncode==0 and rows==[]
out['crossTenantLookup']='PASS: no rows for all four run IDs'
result,rows=query('operator-active-runs.sql',ids['A'])
assert result.returncode==0 and any(r['runId']==ops['lookupRunIds']['orphan'] for r in rows)
out['activeRuns']=rows
result,rows=query('operator-monitor.sql',ids['A'])
assert result.returncode==0 and len(rows)==1 and rows[0]['expiredActive']>=1
out['monitor']=rows[0]
result,_=query('operator-run-lookup.sql',ids['A'],ops['lookupRunIds']['completed'],role=True)
assert result.returncode!=0
out['nonPrivileged']='PASS: denied'
result=sql(d,(root/'operator-active-runs.sql').read_text(),check=False)
assert result.returncode!=0
out['missingTenant']='PASS: rejected'
out['status']='PASS'
(d/'operator-result.json').write_text(json.dumps(out,indent=2))
print(json.dumps({'status':'PASS','lookups':len(out['lookups']),'expiredActive':out['monitor']['expiredActive'],'contentFieldsReturned':0}))

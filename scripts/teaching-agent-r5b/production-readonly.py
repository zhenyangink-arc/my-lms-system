"""End-state production catalog/operations read only, using reviewed fixed R4C queries."""
import datetime,importlib.util,json,sys
from pathlib import Path
from urllib.parse import urlsplit
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2];EV=ROOT/'docs/evidence/teaching-agent-stage-1f-r5b'
spec=importlib.util.spec_from_file_location('readonly_inventory',ROOT/'scripts/teaching-agent-r4c/inventory.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
start=json.loads((EV/'production-preflight.json').read_text());db=module.database();ops=module.operations()
for b in ops['tailscale']['bindings']:
 target=urlsplit(b.pop('proxy'));b.update(targetAddress=target.hostname,targetPort=target.port)
checks={key:db[key]==start['database'][key] for key in ('serverVersion','projectIdentitySha256','hostIdentitySha256','migrationLedgerCount','latestMigration','ledgerSha256','agentTables','agentPrefixedTables','schemaTables','extensions','roleCount')}
checks.update({key:ops[key]==start['operations'][key] for key in ('pm2','runtime','launcherSha256','tailscale')})
result={'status':'MATCH' if all(checks.values()) else 'PRODUCTION STATE CHANGED','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'database':db,'operations':ops,'checksAgainstStart':checks,'productionDbWrites':0,'productionMigration':'NOT APPLIED','productionDeploy':0,'liveProviderRequestsByThisTask':0}
(EV/'production-end-state.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':result['status'],'checks':checks}))
if not all(checks.values()):raise SystemExit('STOP — PRODUCTION STATE CHANGED')

"""Fixed read-only R5A end inventory; writes only sanitized R5A evidence.

Reuses the reviewed catalog READ ONLY/ROLLBACK inventory, never its CLI/save.
No migration, application, backup, reconciler, or Provider execution capability.
"""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/evidence/teaching-agent-stage-1f-r5a'
spec = importlib.util.spec_from_file_location('r4c_readonly', ROOT / 'scripts/teaching-agent-r4c/inventory.py')
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


def safe_operations(value):
    value = json.loads(json.dumps(value))
    for binding in value['tailscale']['bindings']:
        if 'proxy' in binding:
            target = urlsplit(binding.pop('proxy'))
            binding.update(targetAddress=target.hostname, targetPort=target.port)
    return value


start_path = OUT / 'production-preflight.json'
start = json.loads(start_path.read_text())
start['operations'] = safe_operations(start['operations'])
start_path.write_text(json.dumps(start, ensure_ascii=False, indent=2) + '\n')
db = inventory.database()
ops = safe_operations(inventory.operations())
db_keys = ('serverVersion', 'projectIdentitySha256', 'hostIdentitySha256',
           'migrationLedgerCount', 'latestMigration', 'ledgerSha256', 'agentTables',
           'agentPrefixedTables', 'schemaTables', 'extensions', 'roleCount')
checks = {key: db[key] == start['database'][key] for key in db_keys}
checks.update({key: ops[key] == start['operations'][key]
               for key in ('pm2', 'runtime', 'launcherSha256', 'tailscale')})
result = {'observedAtUtc': dt.datetime.now(dt.timezone.utc).isoformat(),
          'database': db, 'operations': ops, 'checksAgainstStart': checks,
          'status': 'MATCH' if all(checks.values()) else 'PRODUCTION STATE CHANGED',
          'productionDbWritesByThisTask': 0, 'productionDeploysByThisTask': 0,
          'providerRequestsByThisTask': 0, 'productionContentWritesByThisTask': 0,
          'productionMigrations': 'NOT APPLIED',
          'scopeNote': 'Catalog/ledger and operations checks; not a global audit of unrelated site activity.'}
(OUT / 'production-end-state.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'checks': checks}, ensure_ascii=False))
if not all(checks.values()):
    raise SystemExit('STOP — PRODUCTION STATE CHANGED')

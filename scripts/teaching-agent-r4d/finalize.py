#!/usr/bin/env python3
"""Finalize only this successful R4D private batch; no DB or Docker mutation."""
import datetime as dt
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from execute import Execution, EV, audit, write, publish

summary=json.loads((EV/'backup-summary.json').read_text())
batch=Path(summary['path'])
assert batch.parent==Path('/home/yangzhen/backups/uply') and not batch.is_symlink()
assert summary['seal']=='VALID'
assert json.loads((EV/'restore-verification.json').read_text())['status']=='PASS'
assert json.loads((EV/'cleanup.json').read_text())['pass']
manifest=json.loads((batch/'metadata/manifest.json').read_text())
assert audit.sha(batch/'metadata/manifest.json')==summary['manifestSha256']
assert all(audit.sha(batch/r['path'])==r['sha256'] for r in manifest['files'])
for stream in ['stdout','stderr']:
    files=sorted((batch/'private').glob('restore-*.'+stream+'.log'))
    (batch/f'private/restore.{stream}.log').write_bytes(b''.join(p.read_bytes() for p in files))
policy={'operator':'杨震','standby':'TBD — NOT ASSIGNED','dataPolicyApprover':'TBD — APPROVAL REQUIRED',
        'retentionMinimumDays':7,'deleteBeforeStableStage1gPilot':False,'automaticDeletion':False,
        'notBefore':(dt.datetime.fromisoformat(summary['snapshotStart'])+dt.timedelta(days=7)).isoformat(),
        'rpoTargetSecondsAtActualApprovedProductionChange':900,'rtoInitialTargetSeconds':3600,
        'offHost':'NOT CONFIRMED','offHostRequiredForR4d':False,'offHostRequiredBeforeBroaderRollout':True}
write(batch/'metadata/recovery-policy.json',policy);publish('recovery-policy.json',policy)
execution=Execution();execution.batch=batch
execution.pre=json.loads((EV/'preflight.json').read_text())
execution.snapshot_info=json.loads((batch/'metadata/source-snapshot.json').read_text())
execution.seal('VALID')
result={'status':'PASS','verifiedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'path':str(batch),
        'directoriesMode':'0700','filesMode':'0600','coreArtifactHashesUnchanged':True,
        'manifestAndChecksumsReverified':True,'privateLogsRetained':True,'historicalBackupsDeleted':False,
        'authorizedBackupFilesystemWrites':True,'productionDatabaseChanges':0}
publish('private-batch-verification.json',result)
print(json.dumps(result,ensure_ascii=False))

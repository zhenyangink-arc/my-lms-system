#!/usr/bin/env python3
"""One registered plan per invocation. Production plan capture/sealing is separate."""
import argparse
import json
from pathlib import Path
import sys
import uuid
from receipts import Failure, safe_file, strict_json, exclusive, sha
from plan_contract import load_plan, PROFILE_PATH, ROOT, authorize, authorize_capture
from maintenance_transport import MaintenanceTransport, CaptureTransport
from transaction import Engine
from backup_adapter import capture_backup, verification_baseline


def main(argv=None):
    parser=argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument('command',choices=['preflight','backup','apply','verify','capture'])
    parser.add_argument('--plan',required=True,choices=['acl-000-v1'])
    args=parser.parse_args(argv)
    try:
        plan=load_plan(args.plan)
        if args.command == 'capture':
            from capture_authorization import capture_attempt
            with capture_attempt(plan) as lease:
                auth=lease['auth']
                receipt=CaptureTransport(plan,auth).capture()
                receipt['captureEnd']='ROLLBACK'
                profile=strict_json(safe_file(PROFILE_PATH))['profiles'][plan.data['targetProfile']]
                root=ROOT/profile['receiptRoot']
                path=root/(uuid.uuid4().hex+'.capture.json')
                receipt_hash=exclusive(path,receipt)
                lease.update(receiptSha256=receipt_hash,receiptPath=path)
            print(json.dumps({'state':'SUCCESS','command':'capture','planId':args.plan,
                              'receiptSha256':receipt_hash,'nextMigrationAllowed':False}))
            return 0
        # All four historical install modes retain the READY-only guard.
        plan.ensure_ready()
        profile=strict_json(safe_file(PROFILE_PATH))['profiles'][plan.data['targetProfile']]
        if args.command == 'backup':
            from capture_authorization import backup_attempt
            with backup_attempt(plan) as lease:
                auth=lease['auth']
                transport=MaintenanceTransport(plan,auth,'BACKUP_READ_EXPORT')
                if safe_file(Path(profile['buildPath'])).decode().strip()!=profile['buildId']:
                    raise Failure('PRECHECK_FAILED','APPLICATION_BUILD')
                root=ROOT/profile['receiptRoot']
                lease['dispatch']()
                path=capture_backup(plan,auth,transport,Path(profile['backupRoot']))
                manifest_hash=sha(safe_file(path/'metadata/manifest.json',True))
                receipt={'state':'SUCCESS','backupManifestSha256':manifest_hash,
                         'planId':plan.data['planId'],'planSha256':plan.digest,'nextMigrationAllowed':False}
                receipt_path=root/(uuid.uuid4().hex+'.backup.json')
                receipt_hash=exclusive(receipt_path,receipt)
                lease.update(backupDirectory=str(path),backupManifestSha256=manifest_hash,
                             runnerReceiptName=receipt_path.name,runnerReceiptSha256=receipt_hash)
            print(json.dumps(receipt));return 0
        mode={'backup':'BACKUP_READ_EXPORT','apply':'SINGLE_MIGRATION_APPLY','preflight':'READ_ONLY_PREFLIGHT','verify':'READ_ONLY_VERIFY'}[args.command]
        auth_path=Path(profile['authorizationDirectory'])/(args.plan+'.'+args.command+'.json')
        auth=strict_json(safe_file(auth_path,True));authorize(plan,auth,mode)
        transport=MaintenanceTransport(plan,auth,mode)
        if safe_file(Path(profile['buildPath'])).decode().strip()!=profile['buildId']:
            raise Failure('PRECHECK_FAILED','APPLICATION_BUILD')
        root=ROOT/profile['receiptRoot']
        engine=Engine(plan,transport,auth,root)
        if args.command=='apply':result={'state':engine.apply()}
        elif args.command=='preflight':
            observation=engine.preflight()
            result={'state':'SUCCESS','observedAt':observation['observedAt'],'ledgerCount':len(observation['state']['ledger'])}
        else:
            # Verify requires original attempt claim and matching backup baseline;
            # it does not consume/rewrite the attempt or replay the migration.
            attempt=strict_json(safe_file(root/(auth['nonce']+'.attempt.json'),True))
            if attempt['planSha256']!=plan.digest:raise Failure('VERIFY_FAILED')
            before=verification_baseline(plan,auth,transport)
            result=dict(engine.reconcile(before),originalAttempt=auth['nonce'])
        receipt=dict(result,planId=plan.data['planId'],planSha256=plan.digest,nextMigrationAllowed=False)
        exclusive(root/(uuid.uuid4().hex+'.'+args.command+'.json'),receipt)
        print(json.dumps(receipt));return 0
    except Failure as e:
        print(json.dumps({'state':e.state,'code':e.code,'nextMigrationAllowed':False}));return 1
    except Exception:
        # No raw exception/traceback/argv/environment may escape to logs.
        print(json.dumps({'state':'VERIFY_FAILED','code':'LOCAL_IO_OR_PROTOCOL_FAILURE','nextMigrationAllowed':False}));return 1


if __name__=='__main__':sys.exit(main())

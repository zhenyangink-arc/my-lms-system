#!/usr/bin/env python3
"""One explicit tenant transaction; stdout is exactly one private JSON receipt.

No automatic retry. UNKNOWN requires STOP, a new read-only connection, and
operator review. SIGKILL/power loss or unavailable output cannot guarantee a
receipt; missing receipt after dispatch must also be treated as UNKNOWN.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
import uuid

CONTRACT = 'deadline-terminal-v1'
ACK = 'UPLY_RECONCILE_COMMIT_ACK_V1'
ROOT = Path(__file__).resolve().parents[2]
SQL = Path(__file__).with_name('operator-reconcile.sql')
MIGRATION = ROOT / 'supabase/migrations/202609140006_agent_run_reconciliation.sql'


class LocalArgumentError(Exception):
    pass


class Parser(argparse.ArgumentParser):
    def error(self, message):
        # argparse's message may contain arbitrary submitted values. Never echo it.
        raise LocalArgumentError()

    def _print_message(self, message, file=None):
        if message:
            sys.stderr.write(message)


def label(value):
    if (not value or value != value.strip() or len(value) > 100
            or not any(c.isalnum() for c in value)
            or not all(c.isalnum() or c in ' ._-' for c in value)
            or re.match(r'eyJ[A-Za-z0-9_-]+\.', value)):
        raise argparse.ArgumentTypeError('Use an operator name or a safe release reference')
    return value


def parser():
    p = Parser(description=__doc__)
    p.add_argument('--service', required=True)
    p.add_argument('--tenant', type=uuid.UUID, required=True)
    p.add_argument('--operator', type=label, required=True)
    p.add_argument('--limit', type=int, default=50)
    p.add_argument('--execute', action='store_true', required=True)
    p.add_argument('--release-ref', type=label)
    p.add_argument('--build-ref', type=label)
    p.add_argument('--receipt-file', type=Path)
    return p


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def initial_receipt():
    return {
        'receiptVersion': 'reconciler-receipt-v1', 'operation': 'reconcile_agent_run_batch_v1',
        'invocationId': str(uuid.uuid4()), 'operator': None,
        'executedAtUtc': dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z'),
        'tenantScope': None, 'batchLimit': None,
        'examined': None, 'eligible': None, 'processed': None, 'terminalized': None,
        'cancelled': None, 'failed': None, 'skipped': None, 'fenceConflicts': None,
        'eligibleScope': 'selected bounded candidates at scan time; NOT total tenant eligible',
        'commitState': 'NOT_COMMITTED', 'result': 'HOLD', 'success': False,
        'errorCode': None, 'durationMs': 0,
        'releaseRef': None, 'buildRef': None, 'reconcilerVersion': CONTRACT,
        'reconcilerHash': None, 'operatorSqlHash': None, 'operatorCommandHash': None,
        'followUpReadRequired': False, 'retryAllowed': False,
        'followUpInstruction': None, 'receiptFileWritten': False,
        # Preserve old reader fields, but commitState is now the authoritative contract.
        'contractVersion': CONTRACT, 'status': 'failed', 'reconcileError': 1,
        'code': None, 'reconciledCancelled': None, 'reconciledDeadlineFailed': None,
    }


def validate_output(stdout, limit):
    # -qAt emits one compact JSON line; the final meta-command follows COMMIT.
    # No result is accepted while the child is running or when an ACK is missing.
    lines = stdout.decode('utf-8', errors='strict').splitlines()
    if len(lines) != 2 or lines[1] != ACK:
        raise ValueError('INVALID_OUTPUT')
    def object_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('DUPLICATE_FIELD')
            result[key] = value
        return result
    data = json.loads(lines[0], object_pairs_hook=object_pairs)
    if not isinstance(data, dict) or set(data) != {
        'contractVersion', 'results', 'reconciledCancelled', 'reconciledDeadlineFailed', 'reconcileError'
    } or data['contractVersion'] != CONTRACT:
        raise ValueError('INVALID_RESULT')
    rows = data['results']
    if not isinstance(rows, list) or len(rows) > limit:
        raise ValueError('INVALID_ROWS')
    for key in ['reconciledCancelled', 'reconciledDeadlineFailed', 'reconcileError']:
        if type(data[key]) is not int or not 0 <= data[key] <= limit:
            raise ValueError('INVALID_COUNT')
    if data['reconcileError'] != 0:
        raise ValueError('INVALID_ERROR_COUNT')
    counts = {'cancelled': 0, 'failed': 0, 'skipped': 0, 'fenceConflicts': 0}
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('runId'), str):
            raise ValueError('INVALID_ROW')
        run_id = str(uuid.UUID(row['runId']))
        if run_id in ids:
            raise ValueError('DUPLICATE_RUN')
        ids.add(run_id)
        outcome = row.get('result')
        if outcome == 'reconciled':
            if set(row) != {'runId', 'result', 'status', 'reason'}:
                raise ValueError('INVALID_TERMINAL')
            expected = {'cancelled': 'RUN_CANCELLED', 'failed': 'DEADLINE_EXCEEDED'}
            if row.get('status') not in expected or row.get('reason') != expected[row['status']]:
                raise ValueError('INVALID_REASON')
            counts[row['status']] += 1
        elif outcome in ('already_terminal', 'not_eligible'):
            statuses = ('completed', 'failed', 'cancelled') if outcome == 'already_terminal' else ('created', 'running', 'waiting_tool')
            if set(row) != {'runId', 'result', 'status'} or row.get('status') not in statuses:
                raise ValueError('INVALID_NOOP')
            counts['skipped'] += 1
        elif outcome in ('not_found', 'fence_conflict'):
            if set(row) != {'runId', 'result'}:
                raise ValueError('INVALID_NOOP')
            counts['fenceConflicts' if outcome == 'fence_conflict' else 'skipped'] += 1
        else:
            raise ValueError('INVALID_OUTCOME')
    if data['reconciledCancelled'] != counts['cancelled'] or data['reconciledDeadlineFailed'] != counts['failed']:
        raise ValueError('INCONSISTENT_COUNTS')
    return {**counts, 'examined': len(rows), 'eligible': len(rows), 'processed': len(rows),
            'terminalized': counts['cancelled'] + counts['failed'],
            'reconciledCancelled': counts['cancelled'], 'reconciledDeadlineFailed': counts['failed']}


def atomic_receipt(path, receipt):
    """Existing trusted parent only; no directory creation and no credential logging."""
    fd, temporary = tempfile.mkstemp(prefix='.reconcile-receipt-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write(json.dumps(receipt, ensure_ascii=False) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main(argv=None):
    start = time.monotonic()
    receipt = initial_receipt()
    dispatched = False
    receipt_path = None
    exit_code = 1
    try:
        a = parser().parse_args(argv)
        receipt.update(operator=a.operator, tenantScope=str(a.tenant), batchLimit=a.limit,
                       releaseRef=a.release_ref, buildRef=a.build_ref)
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', a.service) or not 1 <= a.limit <= 100:
            raise LocalArgumentError()
        if a.receipt_file:
            # Do not create a parent or intentionally overwrite a historical receipt.
            if not a.receipt_file.parent.is_dir() or a.receipt_file.exists() or a.receipt_file.is_symlink():
                raise LocalArgumentError()
            receipt_path = a.receipt_file
        receipt.update(reconcilerHash=sha(MIGRATION), operatorSqlHash=sha(SQL),
                       operatorCommandHash=sha(Path(__file__)))
        env = {**os.environ, 'PGSERVICE': a.service, 'PGCONNECT_TIMEOUT': '5'}
        dispatched = True  # From here, uncertainty is never inferred to be rollback.
        completed = subprocess.run([
            'psql', '-X', '-qAt', '--set=tenant_id=' + str(a.tenant),
            '--set=batch_limit=' + str(a.limit), '--file=' + str(SQL),
        ], env=env, capture_output=True, timeout=20)
        if completed.returncode != 0:
            receipt['errorCode'] = 'PSQL_TERMINATION_UNKNOWN'
        else:
            receipt.update(validate_output(completed.stdout, a.limit))
            receipt.update(commitState='CONFIRMED', result='SUCCESS', success=True,
                           status='committed', reconcileError=0)
            exit_code = 0
    except LocalArgumentError:
        receipt['errorCode'] = 'INVALID_ARGUMENTS'
        exit_code = 2
    except SystemExit as error:
        receipt['errorCode'] = 'CONTROLLED_EXIT' if dispatched else ('HELP_REQUESTED' if error.code == 0 else 'LOCAL_EXIT')
        exit_code = 1 if dispatched else (0 if error.code == 0 else 2)
    except KeyboardInterrupt:
        receipt['errorCode'] = 'CONTROLLED_INTERRUPTION'
        exit_code = 130
    except subprocess.TimeoutExpired:
        receipt['errorCode'] = 'SUBPROCESS_TIMEOUT'
    except OSError:
        receipt['errorCode'] = 'SUBPROCESS_OR_LOCAL_IO_ERROR'
    except (ValueError, TypeError, KeyError, AttributeError):
        receipt['errorCode'] = 'INVALID_RESULT'
    except Exception:
        receipt['errorCode'] = 'UNEXPECTED_EXCEPTION'
    if not receipt['success']:
        receipt['commitState'] = 'UNKNOWN' if dispatched else 'NOT_COMMITTED'
        receipt['followUpReadRequired'] = dispatched
        if dispatched:
            receipt['followUpInstruction'] = 'STOP; NO RETRY; NEW READ-ONLY CONNECTION; VERIFY DB; OPERATOR REVIEW. Original invocation remains UNKNOWN even if current runs are terminal.'
    receipt['durationMs'] = round((time.monotonic() - start) * 1000, 3)
    receipt['code'] = receipt['errorCode']
    if receipt_path:
        try:
            # File and stdout use the same envelope when persistence succeeds.
            stored = {**receipt, 'receiptFileWritten': True}
            atomic_receipt(receipt_path, stored)
            receipt = stored
        except (Exception, KeyboardInterrupt):
            # Losing the receipt file does not invalidate an already known DB COMMIT.
            receipt.update(success=False, result='HOLD', errorCode='RECEIPT_WRITE_FAILED',
                           code='RECEIPT_WRITE_FAILED', status='failed', reconcileError=1,
                           followUpReadRequired=True,
                           followUpInstruction='STOP; NO RETRY; preserve stdout receipt; operator review and new read-only verification. Do not rewrite prior invocation commitState.')
            exit_code = 1
    try:
        print(json.dumps(receipt, ensure_ascii=False), flush=True)
    except (OSError, KeyboardInterrupt):
        # A broken output sink cannot be repaired by repeating the transaction.
        try:
            sys.stderr.write('RECEIPT_OUTPUT_UNAVAILABLE; STOP; NO RETRY; READ_ONLY_VERIFY\n')
        except (OSError, KeyboardInterrupt):
            pass
        return 1
    return exit_code


def interrupt(signum, frame):
    raise KeyboardInterrupt()


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, interrupt)
    sys.exit(main())

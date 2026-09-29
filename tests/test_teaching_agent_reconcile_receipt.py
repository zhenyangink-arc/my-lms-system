"""Offline CLI contract tests: mock ONLY the psql subprocess, never a DB connection."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('receipt_command', ROOT/'scripts/teaching-agent-r3a/reconcile-command.py')
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)
TENANT = '00000000-0000-4000-a000-000000000001'
BASE = ['--service','synthetic-only','--tenant',TENANT,'--operator','synthetic-operator','--execute']
SECRET = 'PRIVATE_ERROR_SENTINEL_NEVER_OUTPUT'
FIELDS = set('receiptVersion operation operator executedAtUtc tenantScope batchLimit examined eligible processed terminalized cancelled failed skipped fenceConflicts commitState result success errorCode durationMs releaseRef buildRef reconcilerVersion reconcilerHash followUpReadRequired retryAllowed'.split())


def data(rows=None):
    rows = rows or []
    return {'contractVersion':cli.CONTRACT,'results':rows,
            'reconciledCancelled':sum(r.get('result')=='reconciled' and r.get('status')=='cancelled' for r in rows),
            'reconciledDeadlineFailed':sum(r.get('result')=='reconciled' and r.get('status')=='failed' for r in rows),'reconcileError':0}


def output(value=None, ack=True):
    return (json.dumps(data() if value is None else value)+'\n'+(cli.ACK+'\n' if ack else '')).encode()


def completed(stdout=None, code=0):
    return subprocess.CompletedProcess(['synthetic-psql'],code,output() if stdout is None else stdout,SECRET.encode())


class ReceiptTests(unittest.TestCase):
    def invoke(self, result=None, extra=None, args=None, exception=None):
        out, err = io.StringIO(), io.StringIO()
        with patch.object(cli.subprocess,'run',return_value=result or completed(),side_effect=exception) as runner, contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = cli.main((BASE if args is None else args)+(extra or []))
        self.assertEqual(len(out.getvalue().splitlines()),1)
        receipt = json.loads(out.getvalue())
        self.assertTrue(FIELDS <= receipt.keys())
        self.assertNotIn(SECRET,out.getvalue()+err.getvalue())
        self.assertFalse(receipt['retryAllowed'])
        self.assertGreaterEqual(receipt['durationMs'],0)
        return receipt, code, runner

    def unknown(self, **kwargs):
        r, code, runner = self.invoke(**kwargs)
        self.assertEqual(code,1)
        self.assertEqual(r['commitState'],'UNKNOWN')
        self.assertEqual(r['result'],'HOLD')
        self.assertFalse(r['success'])
        self.assertTrue(r['followUpReadRequired'])
        self.assertIn('NEW READ-ONLY CONNECTION',r['followUpInstruction'])
        self.assertIn('remains UNKNOWN',r['followUpInstruction'])
        self.assertIsNone(r['terminalized'])
        self.assertEqual(runner.call_count,1)

    def test_normal_and_counts(self):
        outcomes=[{'result':'reconciled','status':'cancelled','reason':'RUN_CANCELLED'},
                  {'result':'reconciled','status':'failed','reason':'DEADLINE_EXCEEDED'},
                  {'result':'already_terminal','status':'completed'},
                  {'result':'not_eligible','status':'running'},
                  {'result':'not_found'},{'result':'fence_conflict'}]
        rows=[dict(runId=f'00000000-0000-4000-a000-{n:012d}',**r) for n,r in enumerate(outcomes,1)]
        r, code, runner = self.invoke(completed(output(data(rows))),extra=['--release-ref','synthetic-release','--build-ref','synthetic-build'])
        self.assertEqual((code,r['commitState'],r['result']),(0,'CONFIRMED','SUCCESS'))
        self.assertTrue(r['success']);self.assertFalse(r['followUpReadRequired'])
        self.assertEqual([r[k] for k in ['examined','eligible','processed','terminalized','cancelled','failed','skipped','fenceConflicts']],[6,6,6,2,1,1,3,1])
        self.assertEqual(r['operator'],'synthetic-operator');self.assertEqual(r['releaseRef'],'synthetic-release')
        self.assertEqual(len(r['reconcilerHash']),64);self.assertEqual(runner.call_count,1)

    def test_empty_default50(self):
        r, code, runner=self.invoke()
        self.assertEqual((code,r['commitState'],r['batchLimit'],r['processed']),(0,'CONFIRMED',50,0))
        self.assertIn('--set=batch_limit=50',runner.call_args.args[0]);self.assertTrue(r['success'])

    def test_max100(self):
        rows=[{'runId':f'00000000-0000-4000-a000-{n:012d}','result':'not_found'} for n in range(100)]
        r,code,_=self.invoke(completed(output(data(rows))),extra=['--limit','100'])
        self.assertEqual((code,r['batchLimit'],r['skipped']),(0,100,100))

    def test_local_validation_never_starts_child(self):
        for args in [BASE+['--limit','0'],BASE+['--limit','101'],BASE+['--limit','no'],[],
                     ['--service','synthetic-only','--tenant',TENANT,'--execute'],
                     BASE+['--tenant',SECRET],BASE+['--operator','person@email.invalid'],
                     BASE+['--operator','   '],BASE+['--operator','...'],
                     BASE+['--operator','eyJsynthetic.payload.signature'],
                     BASE+['--service','postgres://'+SECRET],BASE+['--unknown',SECRET]]:
            with self.subTest(argsKind=len(args)):
                r,code,runner=self.invoke(args=args)
                self.assertEqual((code,r['commitState']),(2,'NOT_COMMITTED'))
                self.assertFalse(r['success']);self.assertFalse(r['followUpReadRequired']);runner.assert_not_called()

    def test_timeout_after_process_start(self):
        self.unknown(exception=subprocess.TimeoutExpired(SECRET,20,output=output()))

    def test_connection_loss(self):
        self.unknown(result=completed(output(),code=2))

    def test_sql_rejection_is_conservatively_unknown(self):
        self.unknown(result=completed(b'',code=3))

    def test_killed_child(self):
        self.unknown(result=completed(output(),code=-signal.SIGKILL))

    def test_oserror(self):
        self.unknown(exception=OSError(SECRET))

    def test_broken_pipe(self):
        self.unknown(exception=BrokenPipeError(SECRET))

    def test_unexpected_exception(self):
        self.unknown(exception=RuntimeError(SECRET))

    def test_malformed_and_incomplete_outputs(self):
        for stdout in [b'',b'{',b'[]',output([],True),output('x'),output(42),output(False),output({},True),
                       b'null\n'+cli.ACK.encode()+b'\n',output(ack=False),
                       output()+b'extra\n',b'{}\n'+cli.ACK[:10].encode(),b'\xff\n'+cli.ACK.encode(),
                       cli.ACK.encode()+b'\n'+output(ack=False)]:
            with self.subTest(stdoutShape=len(stdout)):
                self.unknown(result=completed(stdout))

    def test_bad_nested_shapes_and_counts(self):
        mutations=[{'results':[None]},{'results':[[]]},{'results':[{}]},{'results':'invalid'},
                   {'reconciledCancelled':True},{'reconciledDeadlineFailed':-1},{'reconcileError':1},
                   {'unexpected':SECRET},{'contractVersion':'other'}, {'reconciledCancelled':1}]
        for change in mutations:
            with self.subTest(field=list(change)):
                self.unknown(result=completed(output({**data(),**change})))

    def test_duplicate_json_fields(self):
        text=output().replace(b'"results": []',b'"results": [], "results": []')
        self.unknown(result=completed(text))

    def test_duplicate_runs_and_bad_reason(self):
        row={'runId':TENANT,'result':'reconciled','status':'failed','reason':'DEADLINE_EXCEEDED'}
        for rows in [[row,row],[{**row,'reason':'BAD'}],[{**row,'runId':'invalid'}],[{**row,'status':'completed'}]]:
            self.unknown(result=completed(output(data(rows))))

    def test_rows_cannot_exceed_limit(self):
        rows=[{'runId':f'00000000-0000-4000-a000-{n:012d}','result':'not_found'} for n in range(51)]
        self.unknown(result=completed(output(data(rows))))

    def test_catchable_interruption(self):
        r,code,runner=self.invoke(exception=KeyboardInterrupt())
        self.assertEqual((code,r['commitState']),(130,'UNKNOWN'))
        self.assertFalse(r['success']);self.assertTrue(r['followUpReadRequired']);self.assertEqual(runner.call_count,1)

    def test_controlled_exit_after_dispatch_is_unknown_and_nonzero(self):
        self.unknown(exception=SystemExit(0))

    def test_help_keeps_stdout_machine_readable(self):
        r,code,runner=self.invoke(args=['--help'])
        self.assertEqual((code,r['commitState']),(0,'NOT_COMMITTED'));runner.assert_not_called()

    def test_atomic_file_private_and_stdout_equal(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'receipt.json'
            r,code,_=self.invoke(extra=['--receipt-file',str(p)])
            self.assertEqual(code,0);self.assertEqual(json.loads(p.read_text()),r)
            self.assertEqual(p.stat().st_mode&0o777,0o600);self.assertEqual(list(Path(d).iterdir()),[p])

    def test_unknown_file_preserves_unknown(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'receipt.json'
            r,code,_=self.invoke(extra=['--receipt-file',str(p)],exception=OSError(SECRET))
            self.assertEqual(code,1);self.assertEqual(json.loads(p.read_text()),r);self.assertEqual(r['commitState'],'UNKNOWN')

    def test_parent_must_exist_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'existing.json';p.write_text('original')
            for target in [p,Path(d)/'not-created'/'receipt.json']:
                r,code,runner=self.invoke(extra=['--receipt-file',str(target)])
                self.assertEqual((code,r['commitState']),(2,'NOT_COMMITTED'));runner.assert_not_called()
            self.assertEqual(p.read_text(),'original');self.assertFalse((Path(d)/'not-created').exists())

    def test_atomic_rename_failure_preserves_commit_and_outputs_hold(self):
        with tempfile.TemporaryDirectory() as d,patch.object(cli.os,'replace',side_effect=OSError(SECRET)):
            r,code,_=self.invoke(extra=['--receipt-file',str(Path(d)/'receipt.json')])
            self.assertEqual((code,r['commitState'],r['result']),(1,'CONFIRMED','HOLD'))
            self.assertFalse(r['success']);self.assertFalse(r['receiptFileWritten']);self.assertEqual(os.listdir(d),[])

    def test_missing_executable_is_not_silently_retried(self):
        self.unknown(exception=FileNotFoundError(SECRET))


if __name__=='__main__':
    unittest.main()

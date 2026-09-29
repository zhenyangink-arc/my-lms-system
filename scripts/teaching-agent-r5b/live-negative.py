"""Expected failures on a SECOND disposable restored clone, never the successful rehearsal DB."""
import json,sys
from pathlib import Path
sys.dont_write_bytecode=True;sys.path.insert(0,str(Path(__file__).parent));import runner as r
state=json.loads(Path(sys.argv[1]).read_text());t=r.IsolatedPsql(state);plan=r.load_package();before=t.snapshot();r.verify_snapshot(before,plan,0)
# Explicit negative fixture, outside the migration transaction, only in disposable DB.
fixture="""BEGIN;CREATE FUNCTION public.r5b_reject_ledger_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'R5B_EXPECTED_LEDGER_FAILURE';END $$;
CREATE TRIGGER r5b_expected_ledger_failure BEFORE INSERT ON supabase_migrations.schema_migrations FOR EACH ROW EXECUTE FUNCTION public.r5b_reject_ledger_write();COMMIT;"""
assert t.execute(fixture)['code']==0
receipts=[];dispatched=[]
class Counted:
 def snapshot(self):return t.snapshot()
 def execute(self,sql):dispatched.append(sql);return t.execute(sql)
try:r.run_all(Counted(),plan,receipts.append);raise RuntimeError('EXPECTED_FAILURE_DID_NOT_STOP')
except r.Halt:pass
assert len(dispatched)==1 and len(receipts)==1 and receipts[0]['commitState']=='UNKNOWN' and not receipts[0]['nextMigrationAllowed']
after=t.snapshot();r.verify_snapshot(after,plan,0,before['baseFullDigest'])
check=t.execute("BEGIN READ ONLY;SELECT (to_regnamespace('agent_core_private') IS NULL AND to_regclass('public.agent_runs') IS NULL AND NOT EXISTS(select 1 from pg_attribute where attrelid='public.ai_token_usage'::regclass and attname='run_id' and not attisdropped));ROLLBACK;")
assert check['code']==0 and 't' in check['stdout'].splitlines(),'DDL_DID_NOT_ROLL_BACK'
# Real timeout/disconnection/invalid ACK over the same transport, harmless READ ONLY SQL.
timeout=t.execute('BEGIN READ ONLY;SELECT pg_sleep(2);ROLLBACK;',timeout=.05)
connection=t.execute('BEGIN READ ONLY;SELECT pg_terminate_backend(pg_backend_pid());ROLLBACK;')
bad=t.execute("BEGIN READ ONLY;SELECT 1;COMMIT;SELECT '{\"r5bCommitAck\":\"bad\",\"version\":\"202609140000\"}';")
assert all(r.classify(x,'expected','202609140000')=='UNKNOWN' for x in (timeout,connection,bad))
end=t.snapshot();r.verify_snapshot(end,plan,0,before['baseFullDigest'])
result={'status':'PASS','atomicDdlAndLedgerRollback':'PASS','negativeCloneStart':449,'negativeCloneEnd':449,'failureInjected':'Ledger INSERT trigger rejects after unmodified 000 DDL body','migrationWriteDispatches':1,'nextMigrationDispatches':0,'automaticRetries':0,'originalCommitReceipt':receipts[0],'newReadOnlyVerification':'All 000 DDL absent; ledger449 full prefix unchanged; original UNKNOWN not upgraded','realTransportFaults':{'timeout':'UNKNOWN / STOP','connectionLost':'UNKNOWN / STOP','badAcknowledgement':'UNKNOWN / STOP'},'productionWrites':0}
(r.ROOT/'docs/evidence/teaching-agent-stage-1f-r5b/live-negative-tests.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

-- One invocation, one explicit tenant, at most 100 rows. Run only with an
-- independently approved infrastructure connection; never in a browser.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
SELECT public.reconcile_agent_run_batch_v1(:'tenant_id'::uuid,:'batch_limit'::integer);
COMMIT;
-- Reached only after COMMIT with ON_ERROR_STOP. The CLI also requires the
-- entire child to exit 0 and validates the preceding result; this marker alone
-- is not sufficient and is never emitted by a pre-COMMIT SELECT.
\echo UPLY_RECONCILE_COMMIT_ACK_V1

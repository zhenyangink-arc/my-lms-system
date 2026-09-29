\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
WITH scoped AS (
  SELECT id,status,deadline_at FROM public.agent_runs WHERE tenant_id=:'tenant_id'::uuid
  AND current_user IN ('postgres','supabase_admin','service_role')
), events AS (
  SELECT metadata FROM public.agent_run_events WHERE tenant_id=:'tenant_id'::uuid
  AND kind='run.reconciled' AND created_at>=:'since'::timestamptz
  AND current_user IN ('postgres','supabase_admin','service_role')
)
SELECT json_build_object(
 'active',(SELECT count(*) FROM scoped WHERE status IN ('created','running','waiting_tool')),
 'expiredActive',(SELECT count(*) FROM scoped WHERE status IN ('created','running','waiting_tool') AND deadline_at<=now()),
 'eligible',(SELECT count(*) FROM scoped WHERE status IN ('created','running','waiting_tool') AND deadline_at<=now()-interval '6 seconds'),
 'reconciledCancelled',(SELECT count(*) FROM events WHERE metadata->>'reason'='RUN_CANCELLED'),
 'reconciledDeadlineFailed',(SELECT count(*) FROM events WHERE metadata->>'reason'='DEADLINE_EXCEEDED'),
 'reconcileError','Count failed one-shot invocation receipts; an aborted SQL transaction cannot persist its own error');
COMMIT;

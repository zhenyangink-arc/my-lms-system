-- Authorized operator only. Tenant scope is mandatory; no prompt/message fields.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT json_build_object('runId',id,'status',status,'createdAt',created_at,'deadlineAt',deadline_at)
FROM public.agent_runs
WHERE tenant_id=:'tenant_id'::uuid AND status IN ('created','running','waiting_tool')
AND current_user IN ('postgres','supabase_admin','service_role')
ORDER BY created_at,id;
COMMIT;

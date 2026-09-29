-- Restricted operator, tenant-scoped aggregate. No student content or identities.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
WITH scoped AS (
 SELECT * FROM public.agent_runs WHERE tenant_id=:'tenant_id'::uuid
 AND created_at>=:'since'::timestamptz
 AND current_user IN ('postgres','supabase_admin','service_role')
)
SELECT json_build_object('newRuns',count(*),
 'completed',count(*) FILTER(WHERE status='completed'),
 'failed',count(*) FILTER(WHERE status='failed'),
 'cancelled',count(*) FILTER(WHERE status='cancelled'),
 'active',count(*) FILTER(WHERE status IN ('created','running','waiting_tool')),
 'expiredActive',count(*) FILTER(WHERE status IN ('created','running','waiting_tool') AND deadline_at<now()),
 'deadline',count(*) FILTER(WHERE terminal_reason='DEADLINE_EXCEEDED'),
 'evidenceMissing',count(*) FILTER(WHERE terminal_reason='REQUIRED_EVIDENCE_MISSING'),
 'outputInvalid',count(*) FILTER(WHERE terminal_reason='SKILL_OUTPUT_INVALID'),
 'providerUnavailable',count(*) FILTER(WHERE terminal_reason IN ('PROVIDER_UNAVAILABLE','MODEL_CAPABILITY_UNAVAILABLE')),
 'unknownUsageCalls',(SELECT count(*) FROM public.agent_run_events e JOIN scoped r ON r.id=e.run_id
   WHERE e.kind='model.usage' AND e.metadata#>>'{usage,status}'='unknown'),
 'completedWithoutSource',(SELECT count(*) FROM scoped r WHERE r.status='completed' AND NOT EXISTS
   (SELECT 1 FROM public.agent_messages m WHERE m.run_id=r.id AND m.role='assistant' AND jsonb_array_length(m.source_refs)>0)),
 'durationSamples',count(ended_at),
 'durationMinMs',min(extract(epoch FROM (ended_at-created_at))*1000),
 'durationMaxMs',max(extract(epoch FROM (ended_at-created_at))*1000),
 'selectionLatency','NOT_PERSISTED; use a separately scoped approved measurement')
FROM scoped;
COMMIT;

-- Operator-only psql, read-only connection. Required variables: tenant_id, run_id.
-- The operator must be authorized for this tenant. Never expose this as an API or Tool.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT json_build_object(
 'runId',r.id,'status',r.status,'createdAt',r.created_at,'deadlineAt',r.deadline_at,
 'endedAt',r.ended_at,'definitionVersion',r.profile_version,'skill',r.skill_ref,
 'errorCode',CASE WHEN r.terminal_reason ~ '^[A-Z_]{1,100}$' THEN r.terminal_reason ELSE NULL END,
 'events',(SELECT coalesce(json_agg(json_build_object('seq',e.seq,'kind',e.kind,
   'at',e.created_at,'modelCallId',e.model_call_id,'toolCallId',e.tool_call_id,
   'errorCode',e.metadata->>'errorCode','usageStatus',e.metadata#>>'{usage,status}',
   'provider',e.metadata->>'provider','model',e.metadata->>'model',
   'status',e.metadata#>>'{details,status}','stage',e.metadata#>>'{details,stage}',
   'toolRef',e.metadata#>'{details,toolRef}','modelConfigVersion',e.metadata#>>'{details,modelConfigVersion}') ORDER BY e.seq),'[]')
   FROM public.agent_run_events e WHERE e.run_id=r.id AND e.tenant_id=r.tenant_id),
 'reportedUsage',(SELECT coalesce(json_agg(json_build_object('modelCallId',u.model_call_id,
   'status',u.usage_status,'durationMs',u.duration_ms,'inputTokens',u.input_tokens,
   'outputTokens',u.output_tokens,'totalTokens',u.total_tokens)),'[]')
   FROM public.ai_token_usage u WHERE u.run_id=r.id),
 'sourceCount',(SELECT coalesce(sum(jsonb_array_length(m.source_refs)),0)
   FROM public.agent_messages m WHERE m.run_id=r.id AND m.tenant_id=r.tenant_id AND m.role='assistant'),
 'durationMs',extract(epoch FROM (r.ended_at-r.created_at))*1000
)
FROM public.agent_runs r
WHERE r.tenant_id=:'tenant_id'::uuid AND r.id=:'run_id'::uuid
AND current_user IN ('postgres','supabase_admin','service_role');
COMMIT;

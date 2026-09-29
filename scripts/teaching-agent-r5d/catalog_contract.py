"""Fixed READ ONLY catalog checks copied from the R5B expected-state contract. No RPC invocation."""
import json,re
from types import SimpleNamespace
def verify(t,plan):
 r=SimpleNamespace(quote=lambda value: "'"+str(value).replace("'", "''")+"'")
 functions={}
 for m in plan:
  if m['version'].endswith('001'):functions['agent_core_private.transition_agent_run_base_v1']=functions['public.transition_agent_run_v1']
  if m['version'].endswith('002'):functions['agent_core_private.transition_agent_run_evidence_v1']=functions['public.transition_agent_run_v1']
  for f in re.finditer(r'create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*(.*?)\bas\s+\$\$(.*?)\$\$\s*;',m['sql'],re.I|re.S):functions[f[1]]={'body':f[3].strip(),'securityDefiner':bool(re.search(r'security\s+definer',f[2],re.I)), 'config':[key.lower()+'='+ (value if value else '""') for key,value in re.findall(r"set\s+(\w+)\s*(?:=|to\b)\s*'([^']*)'",f[2],re.I)]}
 assert len(functions)==35
 names=','.join(r.quote(n) for n in functions)
 tables=['agent_definition_versions','agent_conversations','agent_runs','agent_messages','agent_run_events','curriculum_plan_assessments'];tn=','.join(r.quote(n) for n in tables)
 query=f"""BEGIN READ ONLY;SET LOCAL statement_timeout='15s';
 SELECT json_build_object(
 'functions',(select json_agg(json_build_object('name',n.nspname||'.'||p.proname,'body',btrim(p.prosrc),'definer',p.prosecdef,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'args',pg_get_function_identity_arguments(p.oid),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in ({names})),
 'columns',(select json_agg(json_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname in ({tn},'ai_token_usage','student_learning_agent_script_nodes') and a.attnum>0 and not a.attisdropped),
 'constraints',(select json_agg(json_build_object('table',c.relname,'name',k.conname,'type',k.contype,'validated',k.convalidated,'deferred',k.condeferred,'definition',pg_get_constraintdef(k.oid))) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ({tn},'curriculum_plan_template_items')),
 'indexes',(select json_agg(json_build_object('name',i.relname,'valid',x.indisvalid,'unique',x.indisunique,'definition',pg_get_indexdef(i.oid))) from pg_index x join pg_class i on i.oid=x.indexrelid where i.relname in ('agent_runs_one_active','agent_run_usage_once','agent_runs_actor_created','agent_messages_conversation_created','agent_usage_call_once','agent_runs_reconcile_deadline')),
 'rls',(select json_agg(json_build_object('table',relname,'enabled',relrowsecurity,'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),'browserSelect',has_table_privilege('authenticated',c.oid,'SELECT'),'browserWrite',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'),'serviceSelect',has_table_privilege('service_role',c.oid,'SELECT'),'serviceInsert',has_table_privilege('service_role',c.oid,'INSERT'))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ({tn})),
 'policies',(select json_agg(json_build_object('table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)) from pg_policies where schemaname='public' and (tablename in ({tn},'ai_token_usage','digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','learning_agent_lessons','learning_agent_script_versions','learning_agent_script_nodes','curriculum_plan_templates','curriculum_plan_template_items'))),
 'view',(select json_build_object('options',reloptions,'owner',pg_get_userbyid(relowner),'browserSelect',has_table_privilege('authenticated',c.oid,'SELECT'),'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),'definition',pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='student_learning_agent_script_nodes'),
 'triggers',(select json_agg(json_build_object('name',g.tgname,'enabled',g.tgenabled,'definition',pg_get_triggerdef(g.oid))) from pg_trigger g where g.tgname in ('agent_definition_immutable','agent_event_immutable','agent_definition_guard','curriculum_learning_source_guard','curriculum_learning_publication_guard','curriculum_exam_roster_guard','curriculum_exam_cancellation_guard')),
 'agentRows',json_build_object({','.join(r.quote(n)+', (select count(*) from public.'+n+')' for n in tables[:5])})
 );ROLLBACK;"""
 raw=t.execute(query);assert raw['code']==0,'CATALOG_READ_FAILED'
 v=next(json.loads(line) for line in raw['stdout'].splitlines() if line.startswith('{'))
 checks={};checks['all35FunctionBodiesAndSecurity']=len(v['functions'])==35 and all(f['body'].strip()==functions[f['name']]['body'] and f['definer']==functions[f['name']]['securityDefiner'] and f['owner']=='postgres' and f['config']==functions[f['name']]['config'] for f in v['functions'])
 checks['privateAgentAcl']=all(not any(f[k] for k in ('anon','authenticated','service')) for f in v['functions'] if f['name'].startswith('agent_core_private.'))
 agent_rpc=[f for f in v['functions'] if f['name'].startswith('public.') and ('agent_run' in f['name'] or f['name'].endswith('agent_usage_v1') or f['name'].endswith('student_agent_event_sequence_v1'))]
 checks['agentRpcServiceOnly']=len(agent_rpc)==12 and all(f['service'] and not f['anon'] and not f['authenticated'] for f in agent_rpc)
 f=next(f for f in v['functions'] if f['name']=='public.create_teaching_content_skeleton');checks['skeletonAcl']=f['authenticated'] and not f['anon'] and not f['service']
 checks['agentTablesRlsNoBrowser']=len(v['rls'])==6 and all(x['enabled'] and not x['anonSelect'] and not x['browserSelect'] and not x['browserWrite'] for x in v['rls'])
 checks['agentServiceTableAcl']=all(x['serviceSelect'] and x['serviceInsert']==(x['table']=='agent_definition_versions') for x in v['rls'] if x['table'].startswith('agent_'))
 checks['sixIndexesValid']=len(v['indexes'])==6 and all(x['valid'] for x in v['indexes']) and sum(x['unique'] for x in v['indexes'])==3
 checks['sevenTriggersEnabled']=len(v['triggers'])==7 and all(x['enabled']=='O' for x in v['triggers'])
 constraints={n:[x for x in v['constraints'] if x['table']==n] for n in tables}
 checks['constraintCountsAndValidation']=all(len(constraints[n])==num and all(x['validated'] for x in constraints[n]) for n,num in zip(tables,[7,5,10,8,3,6]))
 checks['twoDeferredInputMessageFks']=sum(x['deferred'] for n in tables for x in constraints[n])==2
 checks['usageBoundariesRestrictive']=sum(x['name'].startswith('agent_usage_browser_') and x['permissive']=='RESTRICTIVE' for x in v['policies'])==3
 checks['rawNodeBroadPolicyRemoved']=not any(x['name']=='authenticated read published learning agent script nodes' for x in v['policies'])
 checks['staffPolicies']=sum(x['name'] in ('staff read adopted curriculum templates','staff read adopted curriculum items') for x in v['policies'])==2
 checks['safeView']=v['view']['options']==['security_barrier=true'] and v['view']['owner']=='postgres' and v['view']['browserSelect'] and not v['view']['anonSelect'] and not any(x['name'] in ('configuration','answer_key') for x in v['columns'] if x['table']=='student_learning_agent_script_nodes')
 expectedCols={
 'agent_definition_versions':'id tenant_id actor_id agent_code version status manifest created_at',
 'agent_conversations':'id tenant_id actor_id agent_code app_id scope_kind scope_ref status created_at',
 'agent_runs':'id tenant_id actor_id conversation_id input_message_id definition_id agent_code profile_version skill_ref scope_ref status idempotency_key request_digest budget deadline_at lease_expires_at state_version fencing_token execution_attempt retry_of_run_id context_metadata terminal_reason created_at ended_at cancel_requested_at public_event_seq',
 'agent_messages':'id tenant_id actor_id conversation_id run_id role content state origin source_refs created_at',
 'agent_run_events':'id tenant_id actor_id run_id seq kind model_call_id tool_call_id skill_run_id metadata created_at',
 'curriculum_plan_assessments':'plan_id item_id assignment_id created_by created_at'}
 checks['exactNewColumns']=all([x['name'] for x in v['columns'] if x['table']==n]==cols.split() for n,cols in expectedCols.items())
 checks['usageNewColumns']=all(any(x['table']=='ai_token_usage' and x['name']==n for x in v['columns']) for n in ('run_id','model_call_id','attempt_index','usage_status','duration_ms'))
 checks['cancelSequenceShape']=any(x['table']=='agent_runs' and x['name']=='public_event_seq' and x['type']=='bigint' and x['notNull'] and x['default']=='0' for x in v['columns'])
 checks['agentRowsZero']=all(n==0 for n in v['agentRows'].values())
 return v,checks

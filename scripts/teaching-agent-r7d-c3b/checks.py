"""Finite catalog-only check registry. All SQL below is implementation-owned."""
import copy
import json
from receipts import Failure, sha, canonical, safe_file, strict_json
from plan_contract import ROOT, registry

SIGNATURE = 'public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)'
FUNCTION_SHA = '3d72415147051a92a0312f56bf6b60d81aa5e0e103aced878a20be21b5d96941'
SCHEMAS = "n.nspname not like 'pg_%' and n.nspname <> 'information_schema'"
# No business function is invoked. pg_get_functiondef is hashed by PG17 core SHA256.
CATALOG_SQL = """
select jsonb_build_object(
'functions',(select coalesce(jsonb_agg(jsonb_build_object(
 'signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')',
 'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
 'language',l.lanname,'volatility',p.provolatile,'parallel',p.proparallel,'leakproof',p.proleakproof,
 'config',p.proconfig) order by n.nspname,p.proname,oidvectortypes(p.proargtypes)),'[]')
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where p.prokind in ('f','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema'
 and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'relations',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
'columns',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnum,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),a.attacl) order by n.nspname,c.relname,a.attnum),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped and n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
'constraints',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid)) order by n.nspname,c.relname,x.conname),'[]') from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
'indexes',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,pg_get_indexdef(c.oid)) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='i' and n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
'policies',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,p.polname,p.polcmd,p.polpermissive,(select array_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end order by r) from unnest(p.polroles) r),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by n.nspname,c.relname,p.polname),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal),
 'namespaces',(select jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner),nspacl) order by nspname) from pg_namespace where nspname not like 'pg_%' and nspname<>'information_schema'),
 'defaults',(select coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,d.defaclacl::text) order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype),'[]') from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),
 'roles',(select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil,rolconfig) order by rolname) from pg_roles),
 'memberships',(select coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor),admin_option,inherit_option,set_option) order by pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)),'[]') from pg_auth_members),
 'views',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,pg_get_viewdef(c.oid,true)) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
 'rules',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,r.rulename,pg_get_ruledef(r.oid)) order by n.nspname,c.relname,r.rulename),'[]') from pg_rewrite r join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
 'extensions',(select jsonb_agg(jsonb_build_array(e.extname,e.extversion,n.nspname,pg_get_userbyid(e.extowner)) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'types',(select coalesce(jsonb_agg(jsonb_build_array(n.nspname,t.typname,t.typtype,pg_get_userbyid(t.typowner),t.typacl,t.typnotnull,t.typdefault,(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) order by n.nspname,t.typname),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and t.typtype in ('e','d')),
 'ledgerText',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version collate "C")::text,'[]') from supabase_migrations.schema_migrations),
 'ledgerDescriptor',jsonb_build_object(
  'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid='supabase_migrations.schema_migrations'::regclass and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid='supabase_migrations.schema_migrations'::regclass),
  'triggers',(select coalesce(jsonb_agg(pg_get_triggerdef(oid) order by tgname),'[]') from pg_trigger where tgrelid='supabase_migrations.schema_migrations'::regclass and not tgisinternal),
  'rules',(select coalesce(jsonb_agg(pg_get_ruledef(oid) order by rulename),'[]') from pg_rewrite where ev_class='supabase_migrations.schema_migrations'::regclass),
  'acl',(select relacl::text from pg_class where oid='supabase_migrations.schema_migrations'::regclass),
  'owner',(select pg_get_userbyid(relowner) from pg_class where oid='supabase_migrations.schema_migrations'::regclass)),
 'targetAcl',(select coalesce(jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee::regrole::text),'[]') from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)')),
 'effective',(select jsonb_object_agg(rolname,has_function_privilege(oid,to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)'),'EXECUTE')) from pg_roles where rolname in ('postgres','authenticated','service_role','anon'))
);
"""
IDENTITY_SQL = "select jsonb_build_object('database',current_database(),'role',session_user,'currentRole',current_user,'serverMajor',current_setting('server_version_num')::int/10000,'readOnly',current_setting('transaction_read_only'),'roleExpiry',(select rolvaliduntil from pg_roles where rolname=session_user));"


def observe(session):
    state = session._json(CATALOG_SQL)
    state['ledger'] = json.loads(state['ledgerText'])
    state['prefix'] = sha(state['ledgerText'].encode())
    return state


def descriptor(state):
    return sha(canonical(state['ledgerDescriptor']))


def fingerprint(state):
    return sha(canonical(state))


def ledger_check(plan, state, auth):
    l = plan.data['ledger']; rows = state['ledger']; vs = [x['version'] for x in rows]
    desc = state['ledgerDescriptor']
    if (desc['columns'] != [['version','text',True],['statements','text[]',False],['name','text',False]] or
        desc['constraints'] != ['PRIMARY KEY (version)'] or desc['triggers'] or desc['rules'] or
        desc['owner'] != 'postgres' or descriptor(state) != auth['ledgerDescriptorSha256']):
        raise Failure('PRECHECK_FAILED', 'LEDGER_DESCRIPTOR')
    if len(vs) != l['expectedCount'] or vs != l['expectedPriorVersions'] or len(vs) != len(set(vs)) or state['prefix'] != l['sourcePrefixSha256']:
        raise Failure('PRECHECK_FAILED', 'LEDGER_PREFIX')
    if sha(canonical(vs)) != l['versionsSha256'] or vs[-1] != l['expectedLatest']:
        raise Failure('PRECHECK_FAILED', 'LEDGER_VERSIONS')


def target(state):
    signature = 'public.review_chapter_practice_binding(uuid, uuid, integer, jsonb, boolean)'
    rows = [x for x in state['functions'] if x['signature'] == signature]
    if len(rows) != 1: raise Failure('PRECHECK_FAILED', 'FUNCTION_MISSING')
    return rows[0]


def function_check(state, p):
    t = target(state)
    wanted = {'sha256':p['definitionSha256'],'owner':p['owner'],'securityDefiner':p['securityDefiner'],
              'language':p['language'],'volatility':p['volatility'],'parallel':p['parallel'],
              'leakproof':p['leakproof'],'config':p['searchPathConfig']}
    if any(t[k] != v for k, v in wanted.items()): raise Failure('PRECHECK_FAILED', 'FUNCTION_CONTRACT')


def acl_check(state, p):
    actual = sorted(state['targetAcl'], key=lambda x:x['grantee'])
    if actual != sorted(p['entries'], key=lambda x:x['grantee']): raise Failure('PRECHECK_FAILED', 'ACL_CONTRACT')
    eff = dict(state['effective'], PUBLIC=any(x['grantee']=='PUBLIC' for x in actual))
    if eff != p['effective']: raise Failure('PRECHECK_FAILED', 'EFFECTIVE_PRIVILEGE')


def manifest():
    ref = registry()['catalogManifest']; raw = safe_file(ROOT / ref['path'])
    if sha(raw) != ref['sha256']: raise Failure('PRECHECK_FAILED', 'CATALOG_AUTHORITY_HASH')
    return strict_json(raw)


def normalized(sig):
    return sig.replace('public.', '').replace(', ', ',').replace('timestamp with time zone','timestamp with time zone')


def inventory_check(state, name):
    expected = manifest()[name]
    actual = {normalized(x['signature']):x for x in state['functions']}
    for e in expected['functions']:
        a = actual.get(normalized(e['signature']))
        if not a or a['sha256'] != e['sha256'] or a['acl'] != e['acl']:
            raise Failure('PRECHECK_FAILED', 'CATALOG_FUNCTION_INVENTORY')
    # 34b's minimal domain bootstrap is NOT authority for historical unrelated
    # domain table shapes. Pin its completion/publication objects only; the full
    # actual historical catalog is separately sealed and protected by scope_delta.
    for e in expected.get('constraints', []):
        if not e['table'].startswith(('agent_', 'ai_token_usage', 'runtime_publish_private.', 'agent_core_private.')):continue
        wanted=dict(e,table=e['table'] if '.' in e['table'] else 'public.'+e['table'])
        if wanted not in state['constraints']: raise Failure('PRECHECK_FAILED', 'CATALOG_CONSTRAINT_INVENTORY')


def scope_delta(plan, before, after, raw):
    v = plan.data['migration']['version']
    expected = {'version':v,'name':plan.data['migration']['name'],'statements':[raw.decode('utf8')]}
    if after['ledger'] != before['ledger'] + [expected] or after['ledgerDescriptor'] != before['ledgerDescriptor']:
        raise Failure('PRECHECK_FAILED', 'LEDGER_EXACT_DELTA')
    b, a = copy.deepcopy(before), copy.deepcopy(after)
    for s in (a,b):
        for k in ['ledger','ledgerText','prefix']: s.pop(k)
    if v == '202609180000':
        bt, at = target(b), target(a)
        if {k:v for k,v in bt.items() if k != 'acl'} != {k:v for k,v in at.items() if k != 'acl'}:
            raise Failure('PRECHECK_FAILED', 'TARGET_BODY_CHANGED')
        at['acl'] = bt['acl']; a['targetAcl'] = b['targetAcl']; a['effective'] = b['effective']
    else:
        delta = manifest()['completionDelta' if v.endswith('001') else 'publicationDelta']
        allowed = {normalized(x['signature']) for x in delta['addedFunctions']+delta['changedFunctions']}
        for s in (a,b):
            s['functions'] = [x for x in s['functions'] if normalized(x['signature']) not in allowed]
        if v.endswith('002'):
            for s in (a,b):
                s['constraints'] = [x for x in s['constraints'] if not (x['table']=='runtime_publish_private.snapshots' and x['name'] in ('snapshot_version_kind','snapshots_check'))]
    if a != b: raise Failure('PRECHECK_FAILED', 'UNEXPECTED_SCHEMA_DELTA')


def run_checks(plan, state, auth, phase, before=None, raw=None):
    for item in plan.data[phase]:
        c,p = item['checkId'], item['parameters']
        if c == 'ledger-baseline/1': ledger_check(plan,state,auth)
        elif c == 'migration-absent/1':
            if set(p['versions']) & {x['version'] for x in state['ledger']}: raise Failure('PRECHECK_FAILED', 'MIGRATION_PRESENT')
        elif c == 'function-contract/1': function_check(state,p)
        elif c == 'acl-contract/1': acl_check(state,p)
        elif c in ('agent-completion-contract/1','publication-contract/1'): inventory_check(state,p['state'])
        elif c == 'application-boundary/1':
            if auth['runtimeBoundary'] != p: raise Failure('PRECHECK_FAILED', 'APPLICATION_BOUNDARY')
        elif c == 'scope-delta/1': scope_delta(plan,before,state,raw)
        elif c == 'catalog-fingerprint/1':
            if fingerprint(state) != auth['catalogBeforeSha256']: raise Failure('PRECHECK_FAILED', 'CATALOG_FINGERPRINT')
        else: raise Failure('PRECHECK_FAILED', 'UNKNOWN_CHECK')
    if phase == 'preflightChecks' and fingerprint(state) != auth['catalogBeforeSha256']:
        raise Failure('PRECHECK_FAILED', 'FRESH_CATALOG_DRIFT')


# Reuse the exact fixed ledger serializer and descriptor from the reviewed catalog
# family; these literal boundaries select implementation-owned text only.
LEDGER_CAPTURE_SQL = "select jsonb_build_object(" + CATALOG_SQL[
    CATALOG_SQL.index("'ledgerText',"):CATALOG_SQL.index(",\n 'targetAcl',")
] + ");"
CAPTURE_SESSION_SQL = "select jsonb_build_object('readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'));"
CAPTURE_TLS_SQL = "select to_jsonb((select ssl from pg_stat_ssl where pid=pg_backend_pid()));"
TARGET_DEFINITION_SQL = "select to_jsonb(pg_get_functiondef(to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)')));"


# Exact-target-only catalog projection. The shape and serialization deliberately
# match the shared validators and the full catalog; there are no query inputs.
TARGET_PREGATE_SQL = """
select jsonb_build_object(
 'functions',(select coalesce(jsonb_agg(jsonb_build_object(
  'signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')',
  'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
  'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
  'language',l.lanname,'volatility',p.provolatile,'parallel',p.proparallel,
  'leakproof',p.proleakproof,'config',p.proconfig)),'[]')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)')),
 'targetAcl',(select coalesce(jsonb_agg(jsonb_build_object(
  'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
  'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
  order by a.grantee::regrole::text),'[]')
  from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid=to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)')),
 'effective',(select jsonb_object_agg(rolname,has_function_privilege(
  oid,to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)'),'EXECUTE'))
  from pg_roles where rolname in ('postgres','authenticated','service_role','anon'))
);
"""


def capture_ledger_check(plan, state, auth):
    """Initial capture pins known versions/shape, observes the unknown source digest.

    Optional prior digest is only a recapture constraint, never a first-capture
    prerequisite. Same-count statement drift is detectable from the fresh digest.
    """
    d, l = state['ledgerDescriptor'], plan.data['ledger']
    vs = [r['version'] for r in state['ledger']]
    if (d['columns'] != [['version','text',True],['statements','text[]',False],['name','text',False]] or
        d['constraints'] != ['PRIMARY KEY (version)'] or d['triggers'] or d['rules'] or d['owner'] != 'postgres'):
        raise Failure('PRECHECK_FAILED', 'CAPTURE_LEDGER_DESCRIPTOR')
    absent = [plan.data['migration']['version'], *l['followingAbsent']]
    if (len(vs) != 458 or len(vs) != l['expectedCount'] or len(vs) != len(set(vs)) or
        vs != l['expectedPriorVersions'] or sha(canonical(vs)) != l['versionsSha256'] or
        not vs or vs[-1] != l['expectedLatest'] or set(vs).intersection(absent)):
        raise Failure('PRECHECK_FAILED', 'CAPTURE_LEDGER_MISMATCH')
    if auth['expectedLedgerPrefixSha256'] is not None and state['prefix'] != auth['expectedLedgerPrefixSha256']:
        raise Failure('PRECHECK_FAILED', 'CAPTURE_LEDGER_PREFIX_MISMATCH')


def capture_baseline(session, plan, auth):
    """Fixed catalog reads, one readonly snapshot. No caller SQL/identifier inputs.

    Return only safe metadata and fingerprints; raw statements/definition never
    leave this method or enter receipts. Fingerprints use the install algorithm.
    """
    import time
    from plan_contract import authorize_capture
    authorize_capture(plan, auth)
    start = time.time()
    mode = session._json(CAPTURE_SESSION_SQL)
    if not session.readonly or mode != {'readOnly': 'on', 'isolation': 'repeatable read'}:
        raise Failure('PRECHECK_FAILED', 'CAPTURE_READONLY_REQUIRED')
    from maintenance_transport import session_security
    security = session_security(session, plan, auth)
    ledger = session._json(LEDGER_CAPTURE_SQL)
    ledger['ledger'] = json.loads(ledger['ledgerText'])
    ledger['prefix'] = sha(ledger['ledgerText'].encode())
    capture_ledger_check(plan, ledger, auth)  # Before ANY protected catalog query.
    pregate = session._json(TARGET_PREGATE_SQL)
    for check in plan.data['preflightChecks']:
        if check['checkId'] == 'function-contract/1': function_check(pregate, check['parameters'])
        elif check['checkId'] == 'acl-contract/1': acl_check(pregate, check['parameters'])
    definition = session._json(TARGET_DEFINITION_SQL)
    if (type(definition) is not str or sha(definition.encode()) != FUNCTION_SHA or
        sha(definition.encode()) != target(pregate)['sha256']):
        raise Failure('PRECHECK_FAILED', 'CAPTURE_FUNCTION_DEFINITION')
    del definition
    # Only a fully successful function gate may reach the broad catalog query.
    state = observe(session)
    if any(state[k] != ledger[k] for k in ledger):
        raise Failure('PRECHECK_FAILED', 'CAPTURE_SNAPSHOT_MISMATCH')
    try:
        full_target = target(state)
    except Failure:
        raise Failure('PRECHECK_FAILED', 'CAPTURE_TARGET_SNAPSHOT_MISMATCH') from None
    if canonical([target(pregate), pregate['targetAcl'], pregate['effective']]) != canonical(
            [full_target, state['targetAcl'], state['effective']]):
        raise Failure('PRECHECK_FAILED', 'CAPTURE_TARGET_SNAPSHOT_MISMATCH')
    t = full_target
    other = [r for r in state['functions'] if r['signature'] != t['signature']]
    overloads = [r for r in other if r['signature'].startswith('public.review_chapter_practice_binding(')]
    versions = [r['version'] for r in ledger['ledger']]
    role_names = {'postgres', 'authenticated', 'service_role', 'anon'}
    # Role config could contain environment data. Hash that field, never expose it.
    roles = [r[:-1] + [sha(canonical(r[-1]))] for r in state['roles'] if r[0] in role_names]
    authorize_capture(plan, auth)  # Recheck static locks/window before releasing evidence.
    return {
        'contract': 'readonly-baseline-capture/2', 'state': 'SUCCESS',
        'transportSecurity': security,
        'planId': plan.data['planId'], 'planSha256': plan.digest,
        'authorizationSha256': sha(canonical(auth)), 'packageSha256': sha(canonical(auth['packageHashes'])),
        'migrationRawSha256': plan.migration['rawSha256'], 'migrationBodySha256': plan.migration['bodySha256'],
        'targetIdentity': auth['targetIdentity'], 'fixture': plan.fixture,
        'readStartedAt': start, 'readEndedAt': time.time(), 'transaction': mode,
        'ledger': {'count': len(versions), 'duplicates': len(versions)-len(set(versions)),
                   'orderedVersions': versions, 'latestVersion': versions[-1],
                   'presence': {v: v in versions for v in registry()['migrations']},
                   'statementsInclusivePrefixSha256': state['prefix'],
                   'descriptor': state['ledgerDescriptor'], 'descriptorSha256': descriptor(state)},
        'targetFunction': t, 'targetAcl': state['targetAcl'],
        'effective': dict(state['effective'], PUBLIC=False), 'roles': roles,
        'memberships': state['memberships'], 'defaults': state['defaults'],
        'defaultAclSha256': sha(canonical(state['defaults'])),
        'rolesSha256': sha(canonical(state['roles'])),
        'membershipsSha256': sha(canonical(state['memberships'])),
        'otherFunctionAclSha256': sha(canonical([[r['signature'],r['acl']] for r in other])),
        'overloadsSha256': sha(canonical(overloads)),
        'protectedCatalogSha256': fingerprint(state),
        'catalogFamilySha256': {k: sha(canonical(v)) for k,v in state.items()
                                if k not in ('ledgerText','ledger','prefix')},
        'queryFamilySha256': {k:sha(v.encode()) for k,v in
                             [('session',CAPTURE_SESSION_SQL), ('ledger',LEDGER_CAPTURE_SQL),
                              ('targetPreGate',TARGET_PREGATE_SQL),
                              ('protectedCatalog',CATALOG_SQL), ('targetDefinition',TARGET_DEFINITION_SQL)] +
                             ([] if plan.fixture else [('tls',CAPTURE_TLS_SQL)])},
        'credentialOutput': False, 'businessWrites': 0, 'authWrites': 0,
        'nextMigrationAllowed': False, 'planStatus': 'DRAFT_NOT_EXECUTABLE'}

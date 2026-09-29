#!/usr/bin/env python3
"""R3D offline owned-clone rehearsal (case-insensitive final COMMIT injection). No remote database connection is accepted."""
import argparse, importlib.util, json, pathlib, sys, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from supabase_baseline_lib import digest, encoded, migrations, restore_text, blocks, is_app
spec = importlib.util.spec_from_file_location('baseline_verifier', ROOT / 'scripts/verify-supabase-baseline.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def ledger(db):
    return json.loads(db.query("select json_agg(json_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations").stdout)

def diff(before, after):
    return {key: {'removed': [x for x in before[key] or [] if x not in (after[key] or [])],
                  'added': [x for x in after[key] or [] if x not in (before[key] or [])]}
            for key in before if before[key] != after[key]}

def verify_objects(db, source, version):
    # Independently require each declared final object, not just a nonempty diff.
    relations = sorted(set(re.findall(r'create\s+(?:or\s+replace\s+)?(?:table|view)\s+([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*)', source, re.I)))
    functions = sorted(set(re.findall(r'create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*)', source, re.I)))
    checks = [f"to_regclass('{name}') IS NOT NULL" for name in relations]
    checks += [f"EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='{name.split('.')[0]}' AND p.proname='{name.split('.')[1]}')" for name in functions]
    if version == '202609140005':
        checks += ["NOT has_table_privilege('anon','public.student_learning_agent_script_nodes','SELECT')",
                   "has_table_privilege('authenticated','public.student_learning_agent_script_nodes','SELECT')",
                   "NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_learning_agent_script_nodes' AND column_name='configuration')"]
    assert checks and db.query('SELECT '+ ' AND '.join('('+c+')' for c in checks)).stdout.strip()==b't', 'DECLARED_OBJECT_VERIFICATION_FAILED'
    return {'relations': relations, 'functions': functions, 'assertions': len(checks), 'status': 'PASS'}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--snapshot', type=pathlib.Path, required=True)
    p.add_argument('--output', type=pathlib.Path, required=True)
    a = p.parse_args()
    a.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    manifest = json.loads((ROOT/'supabase/bootstrap/baseline-manifest.json').read_text())
    history = json.loads((ROOT/'supabase/bootstrap/migration-ledger-baseline.json').read_text())
    observed = json.loads((a.snapshot/'catalog.json').read_text())
    if observed['migrations'] != history or observed['agentTables'] != 0:
        raise ValueError('LATEST_TARGET_CUTOVER_CHANGED')
    post = migrations(ROOT, history, manifest['orphanMigrationDecisions'])
    if post != manifest['postBaselineMigrations']:
        raise ValueError('RELEASE_MANIFEST_CHANGED')
    baseline = (ROOT/'supabase/bootstrap/app-schema-baseline.sql').read_bytes().decode()
    if digest(baseline.encode()) != manifest['baselineSqlDigest']:
        raise ValueError('BASELINE_CHANGED')
    result = {'snapshotDigest': digest((a.snapshot/'schema.dump').read_bytes()), 'migrations': post,
              'productionWrites': 0, 'productionMigration': 'NOT APPLIED', 'featureFlag': 'OFF', 'paths': []}
    catalogs = {}
    # Both paths use the latest schema-only platform prerequisites, without altering the frozen baseline.
    for mode in ['target-upgrade', 'baseline-fresh']:
        path = {'mode': mode, 'steps': [], 'baselineApplied': mode == 'baseline-fresh'}
        with v.Disposable(a.output) as db:
            db.restore_roles(a.snapshot)
            if mode == 'target-upgrade':
                db.restore_clone(a.snapshot)
            else:
                platform = [(m,t) for m,t in blocks(restore_text(a.snapshot/'schema.dump')) if not is_app(m)
                            and m[2] != 'supabase_migrations' and m[0] not in ('supabase_migrations','SCHEMA supabase_migrations')]
                db.query("SET check_function_bodies=false; SET standard_conforming_strings=on; SELECT pg_catalog.set_config('search_path','',false);\n"+'\n'.join(t for _,t in platform), 'platform')
                db.query("SET uply.bootstrap_mode='new-environment';\n"+baseline, 'baseline')
            v.initialize_ledger(db, history)
            before = db.catalog(); catalogs[mode+'-before'] = before
            for i, entry in enumerate(post):
                expected = history + [{'version': x['version'], 'name': x['name']} for x in post[:i]]
                if ledger(db) != expected: raise ValueError('PER_STEP_LEDGER_PREFLIGHT_FAILED')
                data = (ROOT/'supabase/migrations'/entry['filename']).read_bytes()
                if digest(data) != entry['sha256']: raise ValueError('PER_STEP_FILE_CHANGED')
                db.query(data.decode(), entry['version'])
                after = db.catalog()
                changes = diff(before, after)
                if not changes: raise ValueError('EXPECTED_OBJECT_CHANGE_MISSING')
                objects=verify_objects(db,data.decode(),entry['version'])
                # Verify schema before recording metadata. Any failure halts; never marks failed SQL applied.
                db.query(v.ledger_sql([entry]), 'ledger-'+entry['version'])
                installed = ledger(db)
                if installed != expected + [{'version': entry['version'], 'name': entry['name']}]:
                    raise ValueError('PER_STEP_LEDGER_VERIFY_FAILED')
                detail = entry['version']+'-'+mode+'-diff.json'
                (a.output/detail).write_bytes(encoded(changes))
                path['steps'].append({'version': entry['version'], 'preflight':'PASS', 'apply':'PASS', 'verify':'PASS',
                                     'ledgerBefore':len(expected), 'ledgerAfter':len(installed),
                                     'schemaBefore':digest(encoded(before)), 'schemaAfter':digest(encoded(after)),
                                     'changedCategories':list(changes), 'catalogDiff':detail})
                path['steps'][-1]['objectVerification']=objects
                before=after
            catalogs[mode+'-after']=before
            path['emptyApplicationTables']=v.verify_empty_application(db)
        result['paths'].append(path)
    for point in ['before','after']:
        differences=diff(catalogs['target-upgrade-'+point], catalogs['baseline-fresh-'+point])
        result['equivalence-'+point]={'status':'PASS' if not differences else 'FAIL','categories':len(catalogs['target-upgrade-'+point]),'differences':differences}
        if differences: raise ValueError('LATEST_SCHEMA_EQUIVALENCE_FAILED')
    with v.Disposable(a.output) as db:
        db.restore_roles(a.snapshot); db.restore_clone(a.snapshot); v.initialize_ledger(db, history)
        initial=db.catalog(); applied=[]; stopped=False
        for i,entry in enumerate(post):
            # Inject a failure into the new reconciliation transaction, before COMMIT; no ledger mark.
            if i==len(post)-1: initial=db.catalog()
            source=(ROOT/'supabase/migrations'/entry['filename']).read_text()
            if i==len(post)-1: source=re.sub(r'(?i)commit;\s*$', 'SELECT 1/0; commit;', source)
            attempt=db.query(source,check=False)
            if attempt.returncode: stopped=True; break
            db.query(v.ledger_sql([entry])); applied.append(entry['version'])
        assert stopped and len(applied)==len(post)-1 and ledger(db)==history+[{'version':x['version'],'name':x['name']} for x in post[:-1]] and db.catalog()==initial
        result['failureInjection']={'status':'PASS','injectedAt':post[-1]['version'],'applied':applied,'laterStepsAttempted':0,'ledgerCount':len(ledger(db)),'transactionRolledBack':True,'flag':'OFF'}
    result['success']=True
    (a.output/'result.json').write_bytes(encoded(result))
    print(json.dumps({'success':True,'stepsPerPath':len(post),'equivalence':'PASS','failureStops':'PASS'}))

if __name__=='__main__': main()

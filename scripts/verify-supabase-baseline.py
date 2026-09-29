#!/usr/bin/env python3
"""Verify baseline-fresh and upgrade in owned offline disposable databases only.

No URL, target name, port, external connection, credentials or .env arguments exist.
Platform schema is a schema-only stand-in, not a full Supabase Auth/PostgREST stack.
"""
import argparse
import json
import pathlib
import re
import subprocess
import time
import uuid
from supabase_baseline_lib import (APP_SCHEMAS, IMAGE, blocks, data_boundary, digest,
                                   encoded, is_app, migrations, restore_text, secret_boundary)

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Disposable:
    def __init__(self, output):
        self.output = output
        self.name = 'uply-r1b-' + uuid.uuid4().hex[:12]
        self.created = False

    def docker(self, arguments, data=None):
        return subprocess.run(['docker'] + arguments, input=data, capture_output=True, timeout=180)

    def __enter__(self):
        result = self.docker(['run', '-d', '--pull=never', '--name', self.name,
                              '--label', 'uply.stage=1fr1b-disposable', '--network', 'none', '--read-only',
                              '--tmpfs', '/tmp:rw,size=1024m,mode=1777', '--user', '100:101',
                              '--entrypoint', '/bin/sh', IMAGE, '-c',
                              "initdb -D /tmp/testpg -A trust --no-locale >/tmp/init.log && exec postgres -D /tmp/testpg -k /tmp -c listen_addresses='' -c max_connections=20"])
        if result.returncode: raise RuntimeError('DISPOSABLE_CREATE_FAILED')
        self.created = True
        for _ in range(100):
            if self.query('select 1', check=False).returncode == 0: return self
            time.sleep(.1)
        self.__exit__(None, None, None)
        raise RuntimeError('DISPOSABLE_START_FAILED')

    def __exit__(self, *_):
        if self.created:
            if self.docker(['rm', '-f', self.name]).returncode:
                raise RuntimeError('DISPOSABLE_CLEANUP_FAILED')

    def query(self, sql, label='query', check=True):
        result = self.docker(['exec', '-i', self.name, 'psql', '-h', '/tmp', '-U', 'postgres',
                              '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], sql.encode())
        if check and result.returncode:
            (self.output / (label + '.private.log')).write_bytes(result.stderr)
            raise RuntimeError(label + '_FAILED')
        return result

    def restore_roles(self, snapshot_dir):
        roles = (snapshot_dir / 'roles.sql').read_text()
        if re.search(r'\bPASSWORD\b', roles, re.I): raise ValueError('ROLE_PASSWORD_NOT_ALLOWED')
        roles = '\n'.join(line for line in roles.splitlines()
                          if not line.startswith(('CREATE ROLE postgres;', 'ALTER ROLE postgres ')))
        roles = re.sub(r' GRANTED BY [a-z_]+', '', roles)
        self.query(roles, 'roles')

    def restore_clone(self, snapshot_dir):
        result = self.docker(['exec', '-i', self.name, 'pg_restore', '--exit-on-error',
                             '-h', '/tmp', '-U', 'postgres', '-d', 'postgres'], (snapshot_dir / 'schema.dump').read_bytes())
        if result.returncode:
            (self.output / 'restore.private.log').write_bytes(result.stderr)
            raise RuntimeError('TARGET_CLONE_RESTORE_FAILED')

    def catalog(self):
        return json.loads(self.query((ROOT / 'scripts/supabase-baseline-catalog.sql').read_text(), 'catalog').stdout)


def ledger_sql(entries):
    # Generated metadata from exact version/name only; no archived statements or secrets.
    if not entries: raise ValueError('EMPTY_LEDGER')
    for row in entries:
        if not re.fullmatch(r'\d+', row['version']) or not re.fullmatch(r'[a-z0-9_]+', row['name']):
            raise ValueError('INVALID_LEDGER_METADATA')
    values = ','.join("('%s','%s')" % (row['version'], row['name']) for row in entries)
    return 'INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ' + values + ';'


def initialize_ledger(db, ledger):
    db.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations; '
             'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations '
             '(version text PRIMARY KEY, statements text[], name text);', 'ledger-schema')
    if db.query('select count(*) from supabase_migrations.schema_migrations').stdout.strip() != b'0':
        raise ValueError('LEDGER_NOT_EMPTY')
    db.query(ledger_sql(ledger), 'baseline-ledger')


def verify_empty_application(db):
    tables = json.loads(db.query("select coalesce(json_agg(format('%I.%I',n.nspname,c.relname)), '[]') "
                                "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                                "where n.nspname in ('public','private','recording_private','runtime_publish_private') "
                                "and c.relkind in ('r','p')").stdout)
    for table in tables:
        if db.query('select count(*) from ' + table).stdout.strip() != b'0':
            raise ValueError('BASELINE_HAS_BUSINESS_ROWS')
    return len(tables)


def proof(snapshot_dir, artifact, output, mode):
    manifest = json.loads((artifact / 'baseline-manifest.json').read_text())
    ledger = json.loads((artifact / 'migration-ledger-baseline.json').read_text())
    baseline = (artifact / 'app-schema-baseline.sql').read_bytes().decode()
    if digest(baseline.encode()) != manifest['baselineSqlDigest']: raise ValueError('BASELINE_DIGEST_MISMATCH')
    if digest(encoded(ledger)) != manifest['preCutoverLedgerDigest']: raise ValueError('LEDGER_DIGEST_MISMATCH')
    if digest((snapshot_dir / 'schema.dump').read_bytes()) != manifest['sourceSchemaDigest']:
        raise ValueError('SNAPSHOT_DIGEST_MISMATCH')
    data_boundary(baseline); secret_boundary(baseline)
    post = migrations(ROOT, ledger, manifest['orphanMigrationDecisions'])
    if post != manifest['postBaselineMigrations']: raise ValueError('RELEASE_SEQUENCE_CHANGED')
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    result = {'mode': mode, 'success': False, 'productionWrites': 0, 'liveProviderRequests': 0,
              'roleAdaptation': 'Bootstrap postgres remains superuser; role memberships issued by bootstrap postgres.',
              'platform': 'Offline schema-only PostgreSQL prerequisite stand-in; NOT full Supabase staging', 'steps': []}
    try:
        with Disposable(output) as db:
            db.restore_roles(snapshot_dir)
            if mode == 'baseline-fresh':
                plain = restore_text(snapshot_dir / 'schema.dump')
                platform = [(meta, text) for meta, text in blocks(plain) if not is_app(meta)
                            and meta[2] != 'supabase_migrations' and meta[0] not in ('supabase_migrations', 'SCHEMA supabase_migrations')]
                preamble = "SET check_function_bodies=false; SET standard_conforming_strings=on; SELECT pg_catalog.set_config('search_path','',false);\n"
                db.query(preamble + '\n'.join(text for _, text in platform), 'platform')
                # Verify both guards independently before any baseline admission.
                denied = db.query(baseline, check=False)
                if denied.returncode == 0 or b'BASELINE_NEW_ENVIRONMENT_ONLY' not in denied.stderr:
                    raise ValueError('BASELINE_OPT_IN_GUARD_FAILED')
                db.query("SET uply.bootstrap_mode='new-environment';\n" + baseline, 'baseline')
                result['baselineApplied'] = True
                result['emptyApplicationTablesBeforeFixtures'] = verify_empty_application(db)
            else:
                db.restore_clone(snapshot_dir)
                result['baselineApplied'] = False
            before = db.catalog()
            (output / 'before-catalog.json').write_bytes(encoded(before))
            # Exact target ledger metadata on the disposable clone is just a catalog fixture;
            # existing production receives neither baseline SQL nor ledger writes.
            initialize_ledger(db, ledger)
            installed = json.loads(db.query("select json_agg(json_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations").stdout)
            if installed != ledger: raise ValueError('LEDGER_BOOTSTRAP_MISMATCH')
            result['preCutoverLedgerExact'] = True
            # Refuse a repeat baseline on a database with existing app objects, with no changes.
            guarded = db.query("SET uply.bootstrap_mode='new-environment';\n" + baseline, check=False)
            if guarded.returncode == 0 or b'BASELINE_REFUSES_EXISTING_APPLICATION' not in guarded.stderr:
                raise ValueError('BASELINE_EXISTING_DATABASE_GUARD_FAILED')
            result['existingDatabaseGuard'] = 'PASS'
            for entry in post:
                file = ROOT / 'supabase/migrations' / entry['filename']
                db.query(file.read_text(), entry['version'])
                db.query(ledger_sql([entry]), 'incremental-ledger')
                result['steps'].append({'filename': file.name, 'exit': 0})
            after = db.catalog()
            (output / 'after-catalog.json').write_bytes(encoded(after))
            agent_tables = [t for t in after['relations'] if t['schema'] == 'public' and t['kind'] in ('r','p') and t['name'] in
                            ('agent_runs','agent_conversations','agent_messages','agent_definition_versions','agent_run_events')]
            if len(agent_tables) != 5: raise ValueError('AGENT_TABLES_MISSING')
            agent_rpc = [f for f in after['functions'] if f['name'] in ('admit_agent_run_v1','append_agent_run_event_v1','commit_agent_answer_v1','get_student_agent_run_status_v1','record_agent_usage_v1','request_agent_run_cancel_v1','transition_agent_run_v1')]
            if not agent_rpc or any(not f['securityDefiner'] or f['searchPathAndConfig'] != ['search_path=""'] for f in agent_rpc):
                raise ValueError('AGENT_RPC_BOUNDARY_MISMATCH')
            # Auth-table fixture is synthetic, local and rolled back. No production students.
            db.query("BEGIN; SET LOCAL request.jwt.claim.role='service_role'; "
                     "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES "
                     "('00000000-0000-4000-8000-000000000998','baseline-fixture@example.invalid','{\"name\":\"Synthetic bootstrap fixture\"}'); "
                     "DO $$ BEGIN IF NOT EXISTS(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000998') "
                     "THEN RAISE EXCEPTION 'SYNTHETIC_PROFILE_TRIGGER_FAILED'; END IF; END $$; ROLLBACK;", 'synthetic-fixture')
            result['syntheticFixture'] = 'PASS; Auth insert -> app profile triggers; rolled back'
            result['emptyApplicationTablesAfterFixtureRollback'] = verify_empty_application(db)
            result['agentTables'] = len(agent_tables)
            result['catalogCounts'] = {key: len(value or []) for key, value in after.items()}
            result['beforeCatalogDigest'] = digest(encoded(before))
            result['afterCatalogDigest'] = digest(encoded(after))
            result['success'] = True
    except Exception as error:
        result['error'] = str(error)
    (output / 'result.json').write_bytes(encoded(result))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['baseline-fresh', 'target-upgrade', 'compare'], required=True)
    parser.add_argument('--snapshot-dir', type=pathlib.Path, required=True)
    parser.add_argument('--artifact-dir', type=pathlib.Path, default=ROOT / 'supabase/bootstrap')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    if args.output.exists(): raise ValueError('OUTPUT_MUST_BE_NEW')
    if args.mode == 'compare':
        args.output.mkdir(mode=0o700)
        clone = proof(args.snapshot_dir, args.artifact_dir, args.output / 'target-upgrade', 'target-upgrade')
        fresh = proof(args.snapshot_dir, args.artifact_dir, args.output / 'baseline-fresh', 'baseline-fresh')
        differences = []
        for phase in ('before', 'after'):
            a, b = [args.output / mode / (phase + '-catalog.json') for mode in ('target-upgrade','baseline-fresh')]
            if not a.exists() or not b.exists(): differences.append(phase + ': missing catalog'); continue
            ca, cb = json.loads(a.read_text()), json.loads(b.read_text())
            differences.extend(phase + ':' + key for key in ca if ca[key] != cb.get(key))
        result = {'success': clone['success'] and fresh['success'] and not differences,
                  'targetUpgrade': clone['success'], 'baselineFresh': fresh['success'],
                  'normalizedApplicationDifferences': differences,
                  'beforeAndAfterCompared': True, 'baselineNeverInstalledOnUpgradePath': not clone.get('baselineApplied', True)}
        (args.output / 'result.json').write_bytes(encoded(result))
    else:
        result = proof(args.snapshot_dir, args.artifact_dir, args.output, args.mode)
    print(json.dumps(result))
    raise SystemExit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Generate an offline baseline; never connects to or writes a database."""
import argparse
import collections
import json
import pathlib
from supabase_baseline_lib import (APP_SCHEMAS, BASELINE_GUARD, blocks, data_boundary, digest,
                                   encoded, is_app, migrations, restore_text, secret_boundary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=pathlib.Path, required=True)
    parser.add_argument('--ledger-before', type=pathlib.Path, required=True)
    parser.add_argument('--ledger-after', type=pathlib.Path, required=True)
    parser.add_argument('--generated-at', required=True, help='Stable UTC snapshot acquisition timestamp')
    parser.add_argument('--output', type=pathlib.Path, required=True, help='New artifact directory')
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[1]
    before = json.loads(args.ledger_before.read_text())
    after = json.loads(args.ledger_after.read_text())
    if before != after: raise ValueError('BASELINE_SOURCE_CHANGED')
    ledger = before['migrations']
    if ledger != sorted(ledger, key=lambda row: row['version']): raise ValueError('UNSORTED_LEDGER')
    decisions = json.loads((root / 'supabase/bootstrap/orphan-migration-decisions.json').read_text())
    post = migrations(root, ledger, decisions)
    plain = restore_text(args.snapshot)
    chosen = [(meta, text) for meta, text in blocks(plain) if is_app(meta)]
    preamble = "-- GENERATED APPLICATION SCHEMA ONLY. NEVER APPLY TO EXISTING PRODUCTION.\n"
    preamble += "SET statement_timeout = 0;\nSET lock_timeout = 5000;\nSET client_encoding = 'UTF8';\n"
    preamble += "SET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\n"
    preamble += "SET check_function_bodies = false;\nSET row_security = off;\n"
    sql = preamble + 'BEGIN;\n' + BASELINE_GUARD + ';\n' + '\n'.join(text for _, text in chosen) + '\nCOMMIT;\n'
    count = data_boundary(sql)
    secret_boundary(sql)
    manifest = {'schemaVersion': 1, 'baselineCutoverVersion': ledger[-1]['version'],
                'baselineCutoverName': ledger[-1]['name'], 'generatedAt': args.generated_at,
                'sourceSchemaDigest': digest(args.snapshot.read_bytes()), 'baselineSqlDigest': digest(sql.encode()),
                'includedSchemas': list(APP_SCHEMAS),
                'excludedSchemas': sorted({meta[2] for meta, _ in blocks(plain)} - set(APP_SCHEMAS) - {'-'}),
                'platformAttachments': [list(meta[:3]) for meta, _ in chosen if meta[2] not in APP_SCHEMAS and meta[1] != 'SCHEMA' and meta[0] not in ['SCHEMA '+s for s in APP_SCHEMAS]],
                'objectCounts': dict(sorted(collections.Counter(meta[1] for meta, _ in chosen).items())),
                'topLevelSchemaStatements': count, 'businessDataStatements': 0,
                'preCutoverLedgerDigest': digest(encoded(ledger)), 'preCutoverLedgerCount': len(ledger),
                'postBaselineMigrationVersions': [m['version'] for m in post], 'postBaselineMigrations': post,
                'orphanMigrationDecisions': decisions,
                'platformPrerequisites': ['Supabase roles', 'auth', 'storage', 'realtime', 'extensions',
                                          'pgcrypto', 'uuid-ossp', 'btree_gist', 'Supabase CLI ledger schema'],
                'snapshotPlatformExtensions': [meta[0] for meta, _ in blocks(plain) if meta[1] == 'EXTENSION'],
                'snapshotPlatformPublications': [meta[0] for meta, _ in blocks(plain) if meta[1] == 'PUBLICATION'],
                'productionUse': 'NEVER APPLY BASELINE TO EXISTING PRODUCTION DATABASE'}
    secret_boundary(json.dumps(manifest))
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / 'app-schema-baseline.sql').write_text(sql)
    (args.output / 'migration-ledger-baseline.json').write_bytes(encoded(ledger))
    (args.output / 'baseline-manifest.json').write_bytes(encoded(manifest))
    print(json.dumps({'baselineSqlDigest': manifest['baselineSqlDigest'], 'ledgerCount': len(ledger),
                      'postBaselineVersions': manifest['postBaselineMigrationVersions'], 'dataBoundary': 'PASS'}))


if __name__ == '__main__':
    main()

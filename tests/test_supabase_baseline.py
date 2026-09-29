"""Baseline safety contracts; integration evidence must come from this invocation's owned DBs."""
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from supabase_baseline_lib import (blocks, data_boundary, digest, encoded, is_app,
                                   migrations, secret_boundary, sql_statements)


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.artifact = ROOT / 'supabase/bootstrap'
        self.manifest = json.loads((self.artifact / 'baseline-manifest.json').read_text())
        self.ledger = json.loads((self.artifact / 'migration-ledger-baseline.json').read_text())

    def test_ledger_and_active_runner_exact(self):
        self.assertEqual(digest(encoded(self.ledger)), self.manifest['preCutoverLedgerDigest'])
        self.assertEqual(self.ledger[-1]['version'], self.manifest['baselineCutoverVersion'])
        self.assertEqual(migrations(ROOT, self.ledger, self.manifest['orphanMigrationDecisions']),
                         self.manifest['postBaselineMigrations'])

    def test_reissue_preserves_reviewed_body_and_archive(self):
        for decision in self.manifest['orphanMigrationDecisions']:
            old = (ROOT / decision['archive']).read_bytes()
            new = (ROOT / 'supabase/migrations' / decision['newFilename']).read_bytes()
            self.assertEqual(new.split(b'\n', 3)[3], old)
            self.assertEqual(digest(old), decision['originalSha256'])
            self.assertGreater(decision['newFilename'].split('_')[0], self.manifest['baselineCutoverVersion'])

    def test_baseline_data_secret_and_digest(self):
        sql = (self.artifact / 'app-schema-baseline.sql').read_bytes()
        self.assertEqual(digest(sql), self.manifest['baselineSqlDigest'])
        self.assertEqual(data_boundary(sql.decode()), self.manifest['topLevelSchemaStatements'])
        secret_boundary(sql.decode())

    def test_platform_definitions_excluded_attachments_retained(self):
        selected = list(blocks((self.artifact / 'app-schema-baseline.sql').read_bytes().decode()))
        self.assertTrue(all(is_app(meta) for meta, _ in selected))
        self.assertFalse(any(meta[1] == 'TABLE' and meta[2] in ('auth','storage','realtime','supabase_migrations') for meta, _ in selected))
        self.assertEqual(sum(meta[1] == 'TRIGGER' and meta[2] == 'auth' for meta, _ in selected), 2)
        self.assertEqual(sum(meta[1] == 'POLICY' and meta[2] in ('storage','realtime') for meta, _ in selected), 10)

    def test_data_scanner_rejects_top_level_writes_and_obfuscation(self):
        for sql in ["INSERT INTO public.profiles VALUES ('x');", "COPY public.profiles FROM stdin;",
                    '/* nested /* comment */ */ DELETE FROM public.profiles;',
                    'WITH x AS (SELECT 1) INSERT INTO public.profiles SELECT * FROM x;',
                    "SELECT setval('public.some_sequence', 50);", "DO $$ BEGIN INSERT INTO public.profiles VALUES ('x'); END $$;"]:
            with self.assertRaises(ValueError): data_boundary(sql)
        self.assertEqual(data_boundary("CREATE FUNCTION public.example() RETURNS void LANGUAGE plpgsql AS $body$ BEGIN INSERT INTO public.example VALUES ('a; b'); END $body$;"), 1)
        with self.assertRaises(ValueError): sql_statements("SELECT 'unterminated")

    def test_secret_scanner_rejects_endpoint_and_credentials(self):
        for sample in ['postgres' + 'ql://user:pass@host/db', 'sk-' + 'A'*40,
                       '-----BEGIN ' + 'PRIVATE KEY-----', "ALTER ROLE x PASSWORD 'example';"]:
            with self.assertRaises(ValueError): secret_boundary(sample)

    def test_no_target_url_option(self):
        for script in ['build-supabase-app-baseline.py', 'verify-supabase-baseline.py']:
            result = subprocess.run([sys.executable, str(ROOT/'scripts'/script), '--url', 'invalid'], capture_output=True)
            self.assertNotEqual(result.returncode, 0)

    @unittest.skipUnless(os.environ.get('UPLY_BASELINE_SNAPSHOT_DIR'), 'Private schema-only snapshot required')
    def test_deterministic_regeneration_and_source_race_guard(self):
        with tempfile.TemporaryDirectory(prefix='uply-r1b-generator-test-') as directory:
            directory = pathlib.Path(directory)
            catalog = {'migrations': self.ledger, 'agentTables': 0}
            before, after = directory/'before.json', directory/'after.json'
            before.write_bytes(encoded(catalog)); after.write_bytes(encoded(catalog))
            command = [sys.executable, str(ROOT/'scripts/build-supabase-app-baseline.py'),
                       '--snapshot', str(pathlib.Path(os.environ['UPLY_BASELINE_SNAPSHOT_DIR'])/'schema.dump'),
                       '--ledger-before', str(before), '--ledger-after', str(after),
                       '--generated-at', self.manifest['generatedAt']]
            for name in ('a','b'):
                result = subprocess.run(command+['--output', str(directory/name)], capture_output=True)
                self.assertEqual(result.returncode, 0, 'generator failed')
                for filename in ['app-schema-baseline.sql','baseline-manifest.json','migration-ledger-baseline.json']:
                    self.assertEqual((directory/name/filename).read_bytes(), (self.artifact/filename).read_bytes())
            catalog['migrations'] = catalog['migrations'][:-1]; after.write_bytes(encoded(catalog))
            result = subprocess.run(command+['--output', str(directory/'race')], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'BASELINE_SOURCE_CHANGED', result.stderr)
            self.assertFalse((directory/'race').exists())

    @unittest.skipUnless(os.environ.get('UPLY_BASELINE_VERIFICATION_DIR'), 'Owned DB comparison evidence required')
    def test_actual_before_after_schema_equivalence(self):
        directory = pathlib.Path(os.environ['UPLY_BASELINE_VERIFICATION_DIR'])
        result = json.loads((directory/'result.json').read_text())
        self.assertTrue(result['success']); self.assertEqual(result['normalizedApplicationDifferences'], [])
        for phase in ('before','after'):
            self.assertEqual((directory/'target-upgrade'/f'{phase}-catalog.json').read_bytes(),
                             (directory/'baseline-fresh'/f'{phase}-catalog.json').read_bytes())
        for mode in ('baseline-fresh','target-upgrade'):
            result = json.loads((directory/mode/'result.json').read_text())
            self.assertTrue(result['success']); self.assertEqual(result['agentTables'], 5)
            self.assertEqual([x['filename'] for x in result['steps']], [x['filename'] for x in self.manifest['postBaselineMigrations']])
            self.assertEqual(result['existingDatabaseGuard'], 'PASS')
            self.assertEqual(result['baselineApplied'], mode=='baseline-fresh')

    @unittest.skipUnless(os.environ.get('UPLY_BASELINE_SNAPSHOT_DIR'), 'Private schema-only snapshot required')
    def test_legacy_exact_expected_failure(self):
        with tempfile.TemporaryDirectory(prefix='uply-r1b-legacy-test-') as directory:
            result = subprocess.run([sys.executable, str(ROOT/'scripts/verify-teaching-agent-release-migrations.py'),
                                     '--mode','full-history','--snapshot-dir',os.environ['UPLY_BASELINE_SNAPSHOT_DIR'],
                                     '--output',str(pathlib.Path(directory)/'proof')], capture_output=True)
            self.assertEqual(result.returncode, 1)
            evidence = json.loads((pathlib.Path(directory)/'proof/result.json').read_text())
            self.assertFalse(evidence['success'])
            self.assertEqual(evidence['legacyClassification'], 'LEGACY_HISTORY_NOT_SELF_CONTAINED')
            self.assertEqual(evidence['failedMigration'], '202608190007_seed_korean_chapter_one_pilot_papers.sql')
            self.assertEqual(evidence['errorLines'], ['ERROR:  韩国语一级第一章正式题库不存在或尚未发布'])
            self.assertEqual(len(evidence['steps']),287)
            self.assertTrue(all(x['exit']==0 for x in evidence['steps'][:-1]))


if __name__ == '__main__':
    unittest.main()

"""Pure guard tests; never starts Docker or opens a database."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('r2_staging', ROOT / 'scripts/teaching-agent-r2/staging.py')
staging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(staging)


class StagingGuardTests(unittest.TestCase):
    def setUp(self):
        self.state = {'marker': staging.MARKER, 'project': 'uply-agent-r2-012345abcdef',
                      'url': 'http://127.0.0.1:45678', 'ports': {'api': 45678}, 'dbHost': '127.0.0.1'}
        self.production = {'host': 'synthetic-production.invalid', 'ref': 'synthetic-production',
                           'url': 'https://synthetic-production.invalid'}

    def check(self, state, production=None):
        with patch.object(staging, 'public_production_identity', return_value=production or self.production):
            return staging.guard(state)

    def test_owned_loopback_is_allowed(self):
        self.assertTrue(self.check(self.state))

    def test_production_endpoint_and_db_host_abort(self):
        for patch_value in [{'url': self.production['url']}, {'dbHost': self.production['host']}]:
            with self.subTest(patch_value=patch_value), self.assertRaises(ValueError):
                self.check({**self.state, **patch_value})

    def test_exact_production_project_collision_aborts(self):
        with self.assertRaises(ValueError):
            self.check(self.state, {**self.production, 'ref': self.state['project']})

    def test_missing_owner_or_wrong_port_or_remote_url_aborts(self):
        for patch_value in [{'marker': ''}, {'project': 'supabase-existing'}, {'url': 'http://127.0.0.1:45679'},
                            {'url': 'https://remote.invalid:45678'}, {'url': 'http://127.0.0.1:45678.attacker.invalid'}]:
            with self.subTest(patch_value=patch_value), self.assertRaises(ValueError):
                self.check({**self.state, **patch_value})


if __name__ == '__main__':
    unittest.main()

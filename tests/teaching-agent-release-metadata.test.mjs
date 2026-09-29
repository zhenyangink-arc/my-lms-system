import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('supabase/bootstrap/baseline-manifest.json'));
const cutover = '202609130003';
const activeFiles = readdirSync(new URL('supabase/migrations/', root))
  .filter(file => file.endsWith('.sql')).sort();
const postFiles = activeFiles.filter(file => file.split('_')[0] > cutover);

// Independent filesystem inventory: never derive expected versions from the manifest.
function validate(candidate, files = postFiles) {
  assert.equal(candidate.baselineCutoverVersion, cutover);
  const versions = candidate.postBaselineMigrationVersions;
  const details = candidate.postBaselineMigrations;
  const fileVersions = files.map(file => file.split('_')[0]);
  assert.equal(new Set(fileVersions).size, fileVersions.length);
  assert.equal(new Set(versions).size, versions.length);
  assert.equal(new Set(details.map(entry => entry.version)).size, details.length);
  assert.deepEqual(versions, details.map(entry => entry.version));
  assert.deepEqual(versions, fileVersions);
  assert.deepEqual(details.map(entry => entry.filename), files);
  for (const entry of details) {
    assert.ok(entry.version > cutover);
    assert.equal(entry.filename, `${entry.version}_${entry.name}.sql`);
    assert.equal(entry.sha256, sha(read(`supabase/migrations/${entry.filename}`)));
  }
}

test('release manifest details, index and active SQL have exact ordered identities and hashes', () => {
  validate(manifest);
  assert.equal(new Set(activeFiles.map(file => file.split('_')[0])).size, activeFiles.length);
  assert.ok(manifest.postBaselineMigrationVersions.includes('202609140007'));
  const ledger = JSON.parse(read('supabase/bootstrap/migration-ledger-baseline.json'));
  assert.equal(ledger.length, 449);
  assert.equal(ledger.at(-1).version, cutover);
  assert.ok(ledger.every(entry => entry.version <= cutover));
  assert.equal(sha(read('supabase/bootstrap/migration-ledger-baseline.json')), manifest.preCutoverLedgerDigest);
});

const mutations = {
  'original missing 007 index': m => m.postBaselineMigrationVersions.pop(),
  'missing from both arrays': m => { m.postBaselineMigrationVersions.pop(); m.postBaselineMigrations.pop(); },
  'reordered index': m => m.postBaselineMigrationVersions.reverse(),
  'both arrays reordered': m => { m.postBaselineMigrationVersions.reverse(); m.postBaselineMigrations.reverse(); },
  'duplicate in both arrays': m => { m.postBaselineMigrationVersions.push(m.postBaselineMigrationVersions[0]); m.postBaselineMigrations.push(m.postBaselineMigrations[0]); },
  'extra nonexistent migration': m => {
    m.postBaselineMigrationVersions.push('209901010000');
    m.postBaselineMigrations.push({ version: '209901010000', name: 'absent', filename: '209901010000_absent.sql', sha256: '0'.repeat(64) });
  },
  'changed file hash': m => { m.postBaselineMigrations[0].sha256 = '0'.repeat(64); },
  'mismatched filename': m => { m.postBaselineMigrations[0].filename = m.postBaselineMigrations[1].filename; },
  'mismatched name': m => { m.postBaselineMigrations[0].name = 'incorrect'; },
  'cutover moved': m => { m.baselineCutoverVersion = '202609140007'; },
  'cutover included': m => {
    m.postBaselineMigrationVersions.unshift(cutover);
    m.postBaselineMigrations.unshift({ version: cutover, name: 'runtime_authoring_nonretryable_error', filename: `${cutover}_runtime_authoring_nonretryable_error.sql` });
  }
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`release metadata rejects ${name}`, () => {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    assert.throws(() => validate(candidate), assert.AssertionError);
  });
}
test('release metadata rejects missing and duplicate active files', () => {
  assert.throws(() => validate(manifest, postFiles.slice(0, -1)), assert.AssertionError);
  assert.throws(() => validate(manifest, [...postFiles, postFiles[0]]), assert.AssertionError);
});

test('author browser resolves module and teaching lesson through the observed chapter using fixture queries', async () => {
  const source = read('scripts/teaching-agent-r3d/author-browser.mjs').toString();
  const parsed = ts.createSourceFile('author-browser.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(parsed.parseDiagnostics.length, 0);
  const block = parsed.statements.find(ts.isTryStatement).tryBlock;
  const start = block.statements.findIndex(statement =>
    ts.isVariableStatement(statement) && statement.getText(parsed).includes("query('digital_textbook_modules'"));
  assert.ok(start >= 0);
  // Execute the real four statements, with no imports, credentials, browser or network.
  const code = block.statements.slice(start, start + 4).map(statement => statement.getText(parsed)).join('\n');
  const ids = {};
  const calls = [];
  await runInNewContext(`(async () => { ${code} })()`, {
    chapter: { id: 'fixture-chapter' }, ids,
    query: async (...args) => {
      calls.push(args);
      if (args[0] === 'digital_textbook_modules') return [{ id: 'fixture-module' }];
      if (args[0] === 'learning_agent_lessons') return [{ id: 'fixture-lesson' }];
      throw new Error('Unexpected query');
    }
  });
  assert.deepEqual(calls, [
    ['digital_textbook_modules', 'chapter_id', 'fixture-chapter'],
    ['learning_agent_lessons', 'module_id', 'fixture-module']
  ]);
  assert.deepEqual(ids, { amodule: 'fixture-module', ateachingLesson: 'fixture-lesson' });
});

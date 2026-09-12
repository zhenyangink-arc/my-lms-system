import test from 'node:test';
import assert from 'node:assert/strict';
import { courseContentSteps, practiceSourceLabel, practiceSourceNotice, selectTextbookVersion } from '../src/lib/course-content-workflow.ts';

const access = { app: { slug: 'korean' }, scope: 'platform', globalRole: 'platform_owner', capabilities: { manageContent: true } };

test('course content navigation keeps the four responsibilities in order', () => {
  assert.deepEqual(courseContentSteps(access).map(s => s.key), ['content', 'textbooks', 'teaching-scripts', 'toolbox']);
});
test('navigation does not expose owner-only script entry to other roles', () => {
  for (const override of [{ globalRole: 'platform_admin' }, { scope: 'tenant' }, { globalRole: null }]) {
    assert.equal(courseContentSteps({ ...access, ...override }).some(s => s.key === 'teaching-scripts'), false);
  }
});
test('unrelated apps and unavailable content permissions get no workflow', () => {
  assert.deepEqual(courseContentSteps({ ...access, app: { slug: 'study-abroad' } }), []);
  assert.deepEqual(courseContentSteps({ ...access, capabilities: { manageContent: false } }), []);
});
test('practice labels distinguish imported copies from live textbook references', () => {
  assert.equal(practiceSourceLabel('textbook'), '教材导入副本');
  assert.equal(practiceSourceLabel('custom'), '独立练习资源');
  assert.match(practiceSourceNotice, /不会随教材自动更新/);
  assert.match(practiceSourceNotice, /影响学生端练习/);
});

test('published textbook stays selected while a newer draft is surfaced for review', () => {
  const versions = [{ version_number: 3, status: 'draft' }, { version_number: 1, status: 'published' }, { version_number: 2, status: 'draft' }];
  const result = selectTextbookVersion(versions);
  assert.equal(result.selected.version_number, 1);
  assert.equal(result.newerDraft.version_number, 3);
  assert.equal(versions[0].version_number, 3);
});
test('version selection handles missing published versions and empty textbooks', () => {
  assert.equal(selectTextbookVersion([{ version_number: 1, status: 'draft' }, { version_number: 2, status: 'draft' }]).selected.version_number, 2);
  assert.deepEqual(selectTextbookVersion([]), { selected: undefined, newerDraft: undefined });
});
test('older drafts are not reported as newer changes', () => {
  const result = selectTextbookVersion([{ version_number: 1, status: 'draft' }, { version_number: 2, status: 'published' }]);
  assert.equal(result.newerDraft, undefined);
});

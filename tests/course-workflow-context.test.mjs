import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowChapters, workflowHref } from '../src/lib/course-workflow-context.ts';

const courses = [{ id: 'course-a', title: '韩语', lessons: [{ id: 'lesson-a', title: '入门', textbooks: [{ id: 'book-a', title: '教材', chapters: [
  { id: 'chapter-published', number: 1, versionId: 'v1', versionNumber: 1, versionStatus: 'published' },
  { id: 'chapter-draft', number: 1, versionId: 'v2', versionNumber: 2, versionStatus: 'draft' },
] }] }] }];

test('same chapter number in different versions retains distinct identities and lesson location', () => {
  const chapters = workflowChapters(courses);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].lessonId, 'lesson-a');
  assert.notEqual(chapters[0].id, chapters[1].id);
  assert.notEqual(chapters[0].versionId, chapters[1].versionId);
  assert.match(chapters[0].label, /版本 1（已发布）/);
  assert.match(chapters[1].label, /版本 2（草稿）/);
});

test('all four destinations preserve the exact selected chapter without carrying page-specific filters', () => {
  for (const section of ['content', 'textbooks', 'teaching-scripts', 'toolbox']) {
    const url = new URL(workflowHref('/platform/dashboard/admin/apps/korean', section, 'chapter-draft'), 'https://example.test');
    assert.equal(url.searchParams.get('chapter'), 'chapter-draft');
    assert.equal(url.searchParams.size, 1);
    assert.ok(url.pathname.endsWith(`/${section}`));
  }
});

test('untrusted chapter input cannot inject additional query parameters or fragments', () => {
  const value = 'chapter&node=lesson#other';
  const url = new URL(workflowHref('/platform/dashboard/admin/apps/korean', 'toolbox', value), 'https://example.test');
  assert.equal(url.searchParams.get('chapter'), value);
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, '');
});

test('clearing the chapter returns to unfiltered navigation', () => {
  assert.equal(workflowHref('/platform/dashboard/admin/apps/korean', 'textbooks', ''), '/platform/dashboard/admin/apps/korean/textbooks');
  assert.deepEqual(workflowChapters([]), []);
});

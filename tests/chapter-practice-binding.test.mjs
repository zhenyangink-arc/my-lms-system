import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterPracticeSnapshot, practiceSnapshotChanged, approvedVocabulary } from '../src/lib/chapter-practice-binding.ts';

function fixture() {
  return [{ lessons: [{ textbooks: [{ status: 'published', chapters: [{
    id: 'chapter', status: 'published', versionStatus: 'published',
    nodes: [{ id: 'b', vocabulary: [{ ko: '학교', zh: '学校', pos: '', collocation: '', transcription: '' }] }],
    grammarNodes: [{ id: 'a', items: [{ title: '입니다', meaning: '是', examples: [{ ko: '학생입니다.', zh: '是学生。', audio: 'a.mp3' }] }] }],
  }] }] }] }];
}
test('snapshots keep full vocabulary and grammar content in deterministic node order', () => {
  const source = fixture();
  const snapshot = chapterPracticeSnapshot(source, 'chapter');
  assert.deepEqual(snapshot.map(item => item.nodeId), ['a', 'b']);
  assert.equal(snapshot[0].value.examples[0].audio, 'a.mp3');
  snapshot[0].value.examples[0].audio = 'changed.mp3';
  assert.equal(chapterPracticeSnapshot(source, 'chapter')[0].value.examples[0].audio, 'a.mp3');
});
test('unpublished book, version, chapter and unmatched IDs cannot be approved', () => {
  for (const field of ['book', 'version', 'chapter']) {
    const data = fixture();
    const book = data[0].lessons[0].textbooks[0];
    if (field === 'book') book.status = 'draft';
    else book.chapters[0][field === 'version' ? 'versionStatus' : 'status'] = 'draft';
    assert.equal(chapterPracticeSnapshot(data, 'chapter'), null);
  }
  assert.equal(chapterPracticeSnapshot(fixture(), 'another-chapter'), null);
});
test('review detects nested audio and item ordering edits, but ignores JSON object key order', () => {
  const old = chapterPracticeSnapshot(fixture(), 'chapter');
  const reorderedKeys = structuredClone(old).map(item => ({ value: item.value, kind: item.kind, nodeId: item.nodeId }));
  assert.equal(practiceSnapshotChanged(old, reorderedKeys), false);
  const edited = structuredClone(old);
  edited[0].value.examples[0].audio = 'new.mp3';
  assert.equal(practiceSnapshotChanged(old, edited), true);
  assert.equal(practiceSnapshotChanged(old, [...old].reverse()), true);
  assert.equal(practiceSnapshotChanged(old, []), true);
});
test('student vocabulary excludes grammar and empty entries and deduplicates only equal teaching content', () => {
  const snapshot = chapterPracticeSnapshot(fixture(), 'chapter');
  const changed = { ...snapshot[1], value: { ...snapshot[1].value, collocation: '학교에 가요' } };
  const result = approvedVocabulary([snapshot, snapshot, [changed, { nodeId: 'empty', kind: 'vocabulary', value: {} }]]);
  assert.equal(result.length, 2);
  assert.equal(result[0].ko, '학교');
  assert.equal(result[1].collocation, '학교에 가요');
});

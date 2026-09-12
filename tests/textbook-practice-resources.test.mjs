import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textbookPracticeResources, vocabularyResourceKey, grammarResourceKey } from '../src/lib/textbook-practice-resources.ts';

const word = { ko: '안녕', zh: '你好', pos: '', collocation: '', transcription: '' };
const grammar = { title: '测试语法', meaning: '测试含义', caution: '', cases: [], rows: [], examples: [{ ko: '예문', zh: '例句', audio: 'test/audio.mp3' }] };
function fixture() {
  return [{ id: 'course', title: '虚构课程', lessons: [{ id: 'lesson', title: '虚构课时', textbooks: [{ id: 'book', title: '虚构教材', status: 'published', chapters: [1, 2].map(number => ({ id: `chapter-${number}`, number, status: 'published', versionId: 'version-1', versionNumber: 1, versionStatus: 'published', nodes: [{ id: `word-${number}`, vocabulary: [structuredClone(word)] }], grammarNodes: [{ id: `grammar-${number}`, items: [structuredClone(grammar)] }] })) }] }] }];
}
test('catalog preserves every chapter, kind and source version', () => {
  const items = textbookPracticeResources(fixture());
  assert.equal(items.length, 4);
  assert.equal(new Set(items.map(item => item.key)).size, 4);
  assert.equal(items[2].chapterId, 'chapter-2');
  assert.equal(items[0].versionId, 'version-1');
  assert.match(items[0].origin, /虚构课程.*虚构课时.*第 1 章.*版本 1/);
});
test('draft and archived books, versions and chapters cannot become copy sources', () => {
  for (const status of ['draft', 'archived']) {
    const data = fixture();
    data[0].lessons[0].textbooks[0].status = status;
    assert.deepEqual(textbookPracticeResources(data), []);
    for (const field of ['status', 'versionStatus']) {
      const chapters = fixture();
      chapters[0].lessons[0].textbooks[0].chapters.forEach(chapter => { chapter[field] = status; });
      assert.deepEqual(textbookPracticeResources(chapters), []);
    }
  }
});
test('editing copied nested values cannot mutate textbook input', () => {
  const data = fixture();
  const original = structuredClone(data);
  const items = textbookPracticeResources(data);
  items[0].value.zh = '独立改写';
  items[1].value.examples[0].zh = '独立例句';
  assert.deepEqual(data, original);
});
test('duplicate vocabulary compares all teaching fields, ignoring metadata and whitespace', () => {
  assert.equal(vocabularyResourceKey(word), vocabularyResourceKey({ ...word, zh: ' 你好 ', id: 'other', source: 'custom' }));
  for (const field of ['ko', 'zh', 'pos', 'collocation', 'transcription']) {
    assert.notEqual(vocabularyResourceKey(word), vocabularyResourceKey({ ...word, [field]: '不同' }));
  }
});
test('grammar deduplication preserves meaningful differences including audio', () => {
  assert.equal(grammarResourceKey(grammar), grammarResourceKey({ ...grammar, id: 'copy', source: 'textbook' }));
  const changed = structuredClone(grammar);
  changed.examples[0].audio = 'test/other.mp3';
  assert.notEqual(grammarResourceKey(grammar), grammarResourceKey(changed));
  assert.notEqual(grammarResourceKey(grammar), grammarResourceKey({ ...grammar, caution: '注意' }));
});
test('empty catalog and empty textbook items are safe', () => {
  assert.deepEqual(textbookPracticeResources([]), []);
  const data = fixture();
  data[0].lessons[0].textbooks[0].chapters.forEach(chapter => {
    chapter.nodes[0].vocabulary = [{ ...word, ko: '', zh: '' }];
    chapter.grammarNodes[0].items = [{ ...grammar, title: '' }];
  });
  assert.deepEqual(textbookPracticeResources(data), []);
});
test('copy UI only opens a draft; existing authenticated save actions remain the write boundary', () => {
  const catalog = readFileSync(new URL('../src/features/growth-toolbox/components/textbook-resource-catalog.tsx', import.meta.url), 'utf8');
  assert.match(catalog, /onClick=\{\(\) => setSelected\(resource\)\}/);
  assert.doesNotMatch(catalog, /createAdminClient|supabase|\.insert\(|\.update\(/);
  const listing = readFileSync(new URL('../src/features/growth-toolbox/components/growth-toolbox-listing.tsx', import.meta.url), 'utf8');
  assert.match(listing, /textbookResult.hasError \?/);
  assert.match(listing, /canManage=\{result.canManage && !result.hasError\}/);
});

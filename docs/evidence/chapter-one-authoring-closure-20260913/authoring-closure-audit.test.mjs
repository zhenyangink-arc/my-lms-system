import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {default:source}=await import('./fixtures/smart-textbook-legacy-adapter/chapter-one-source.server.ts');
const {default:ledger}=await import('./fixtures/smart-textbook-legacy-adapter/chapter-one-identities.server.ts');
const {adaptChapterOne}=await import('../src/lib/smart-textbook-legacy-adapter/adapter.server.ts');
const {profile}=await import('../src/lib/smart-textbook-legacy-adapter/profile.server.ts');
const baseline=adaptChapterOne(source,ledger);
test('unchanged chapter retains eight Steps, nineteen activities and three orientation questions',()=>{
  assert.equal(baseline.manifest.steps.length,8);
  assert.equal(baseline.manifest.activityRefs.length,19);
  assert.equal(baseline.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
});
test('vocabulary text edit without identity rebinding introduces a real compile blocker',()=>{
  const changed=structuredClone(source);
  const node=changed.nodes.find(n=>n.id===profile.vocabulary.nodeId);
  node.content.vocabulary[0].zh+='（隔离编辑测试）';
  const after=adaptChapterOne(changed,ledger);
  const errors=after.report.unsupported.filter(e=>e.source.nodeId===node.id&&e.source.path.includes('vocabulary'));
  assert(errors.length>0);
  assert(after.report.unsupported.length>baseline.report.unsupported.length);
});
test('a later published teaching version is rejected by the current adapter',()=>{
  const changed=structuredClone(source);
  changed.teachingVersions[0].version_number=24;
  const after=adaptChapterOne(changed,ledger);
  assert(after.report.unsupported.some(e=>e.source.path==='teachingVersions'));
  assert(after.report.unsupported.length>baseline.report.unsupported.length);
});

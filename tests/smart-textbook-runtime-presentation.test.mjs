import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {content,manifest} from './fixtures/runtime-4a.mjs';

const stepContent=key=>{
  const step=manifest.steps.find(item=>item.key===key);
  const block=manifest.blocks.find(item=>item.stepId===step.id&&item.type==='compat.learning.v1');
  return content[block.props.capsuleRef];
};

test('legacy slots project closed presentation semantics without title inference',()=>{
  const orientation=stepContent('orientation');
  assert.equal(orientation.cards.find(card=>card.title==='学习内容').section,'lead');
  assert.equal(orientation.cards.find(card=>card.title==='学习提示').section,'coach');
  assert.equal(orientation.cards.find(card=>card.title==='学习目标').section,'targets');
  assert.equal(orientation.cards.find(card=>card.title==='对话练习').section,'dialogueGroups');
  assert.equal(stepContent('vocabulary').cards.find(card=>card.title==='核心词汇').section,'vocabulary');
  assert.equal(stepContent('grammar').cards.find(card=>card.title==='语法理解').section,'grammarCards');
});

test('presentation remains a safe public projection',()=>{
  const payload=JSON.stringify(content);
  assert.doesNotMatch(payload,/answer_key|object_key|signedUrl|service_role|tenantId|studentId/);
});

test('runtime styling covers semantic learning sections and responsive navigation',()=>{
  const css=readFileSync('src/features/smart-textbook-runtime/components/runtime.css','utf8');
  for(const section of ['lead','coach','targets','dialogueGroups','dialogueScenes','vocabulary','grammarCards','patternCards'])assert.match(css,new RegExp(`data-section="${section}"`));
  assert.match(css,/runtime-steps[^}]*overflow-x:auto/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

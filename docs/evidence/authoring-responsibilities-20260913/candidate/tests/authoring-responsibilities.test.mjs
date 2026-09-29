import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courseContentSteps } from '../src/lib/course-content-workflow.ts';
const read = path => readFileSync(new URL('../src/'+path, import.meta.url),'utf8');
const access = {app:{slug:'korean'},scope:'platform',globalRole:'platform_owner',capabilities:{manageContent:true}};
test('each area explains its own responsibility and publication boundary',()=>{
  const steps=courseContentSteps(access);
  assert.equal(new Set(steps.map(s=>s.responsibility)).size,4);
  assert.match(steps[0].boundary,/普通课时/);
  assert.match(steps[1].boundary,/章节与关联测试.*不会更新教材快照/);
  assert.match(steps[2].boundary,/发布脚本不等于发布教材/);
  assert.match(steps[3].boundary,/确认引用不生成题目/);
});
test('live chapter context is read from URL, not stale server props',()=>{
  const links=read('app/dashboard/admin/apps/CourseWorkflowLinks.tsx');
  assert.match(links,/useSearchParams\(\)/);
  assert.match(links,/workflowHref\(appPath, step.key, chapterId\)/);
  assert.match(links,/CardTitleWithHint/);
});
test('duplicate global textbook shortcut removed, contextual lesson entry retained',()=>{
  const catalog=read('features/courses/components/course-catalog-listing.tsx');
  assert.doesNotMatch(catalog,/href=\{textbookRoute\}/);
  assert.match(catalog,/textbookHref=\{textbookRoute\}/);
  assert.match(read('features/courses/components/course-lesson-view.tsx'),/进入教材制作/);
});
test('textbook has one workbench CTA, legacy chapter publication is retained',()=>{
  const studio=read('features/digital-textbook/components/textbook-studio.tsx');
  assert.equal((studio.match(/<Link href=\{href\}/g)||[]).length,1);
  assert.match(studio,/前往工作台校验与发布/);
  assert.match(studio,/canPublishChapter=\{canPublish\}/);
});
test('script publication is explicitly distinguished from textbook publication',()=>{
  const studio=read('features/learning-agent-script-studio/TeachingScriptStudio.tsx');
  assert.match(studio,/发布当前步骤脚本/);
  assert.doesNotMatch(studio,/发布学习步骤/);
  assert.match(studio,/已发布教材快照的更新仍需在教材工作台完成/);
});

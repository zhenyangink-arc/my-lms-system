import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { renderAssessmentAuthoring, resolveAssessmentAuthoring } from "../src/features/subjects/admin-slot-contract.ts";
import { renderSubjectAssessmentAuthoring } from "../src/features/subjects/admin-slots.ts";
import { SUBJECT_SLUGS } from "../src/features/subjects/registry.ts";

const root = new URL("..", import.meta.url).pathname;
const props = { appId: "app", appSlug: "math", canRelease: false };
const read = (path) => readFileSync(join(root, path), "utf8");

test("没有注册插槽的学科、非学科应用都返回 null（韩语、英语沿用平台界面）", () => {
  for (const slug of [...SUBJECT_SLUGS, "university", "study-abroad", "", "constructor", "__proto__", "toString"]) {
    assert.equal(renderSubjectAssessmentAuthoring(slug, props), null, slug);
  }
});

test("解析函数：已注册返回组件；未注册、空插槽、原型属性名都返回 null", () => {
  const Component = () => null;
  const slots = { math: { AssessmentAuthoring: Component }, english: {} };
  assert.equal(resolveAssessmentAuthoring(slots, "math"), Component);
  assert.equal(resolveAssessmentAuthoring(slots, "english"), null);
  assert.equal(resolveAssessmentAuthoring(slots, "korean"), null);
  for (const slug of ["constructor", "__proto__", "hasOwnProperty", "toString"]) {
    assert.equal(resolveAssessmentAuthoring(slots, slug), null, slug);
  }
  assert.equal(resolveAssessmentAuthoring({}, "math"), null);
});

test("渲染函数：已注册时创建带参数的元素，未注册返回 null", () => {
  const Component = () => null;
  const element = renderAssessmentAuthoring({ math: { AssessmentAuthoring: Component } }, "math", { ...props, canRelease: true });
  assert.equal(element.type, Component);
  assert.deepEqual(element.props, { appId: "app", appSlug: "math", canRelease: true });
  assert.equal(renderAssessmentAuthoring({}, "math", props), null);
  assert.equal(renderAssessmentAuthoring({ math: {} }, "math", props), null);
});

test("作业与考试页面：有学科插槽时用插槽并跳过题库选题，否则保持原有的两个标准题库编辑器", () => {
  const page = read("src/app/dashboard/admin/apps/ManagementApplicationAssessmentPage.tsx");
  assert.match(page, /renderSubjectAssessmentAuthoring\(\s*access\.app\.slug,/);
  assert.match(page, /\{canPrepareStandardPapers && subjectAssessmentAuthoring\}/);
  assert.match(page, /canPrepareStandardPapers &&\s*!subjectAssessmentAuthoring &&\s*!testResult\.error/);
  assert.match(page, /canPrepareStandardPapers &&\s*!subjectAssessmentAuthoring &&\s*publishedTests\.length > 0/);
  // 原有的两个编辑器仍在，且参数不变
  assert.equal((page.match(/<AssessmentPaperComposer/g) ?? []).length, 2);
  assert.match(page, /paperType="homework"\s*canPublish=\{canReleaseStandardPapers\}\s*groups=\{composerGroups\}\s*questions=\{bankQuestions\}/);
  assert.match(page, /paperType="exam"\s*canPublish=\{canReleaseStandardPapers\}\s*groups=\{composerGroups\}\s*questions=\{bankQuestions\}/);
  // 插槽只在平台视图渲染，并传入发布权限而不是自行判断
  assert.match(page, /canRelease: canReleaseStandardPapers/);
});

test("插槽契约与注册表不引用任何学科内部文件（平台只通过公开入口）", () => {
  for (const path of ["src/features/subjects/admin-slot-contract.ts", "src/features/subjects/admin-slots.ts"]) {
    const text = read(path);
    assert.doesNotMatch(text, /from "\.\/(korean|english|math)\//, path);
  }
  const index = read("src/features/subjects/index.ts");
  assert.match(index, /renderSubjectAssessmentAuthoring/);
});

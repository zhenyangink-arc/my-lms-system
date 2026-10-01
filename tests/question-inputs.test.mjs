import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { renderQuestionInput, resolveQuestionInput } from "../src/features/subjects/question-input-contract.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const props = { name: "answer_q1", previousAnswer: "2x", kind: "math.expression" };

test("题型输入解析：已注册返回组件；未注册与原型属性名返回 null", () => {
  const Component = () => null;
  const registry = { "math.expression": Component };
  assert.equal(resolveQuestionInput(registry, "math.expression"), Component);
  for (const kind of ["single_choice", "short_text", "long_text", "file_link", "audio_recording", "", "constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.equal(resolveQuestionInput(registry, kind), null, kind);
    assert.equal(renderQuestionInput(registry, kind, props), null, kind);
  }
});

test("渲染：已注册时创建带参数的元素", () => {
  const Component = () => null;
  const element = renderQuestionInput({ "math.numeric": Component }, "math.numeric", props);
  assert.equal(element.type, Component);
  assert.deepEqual(element.props, props);
});

test("注册表只登记两种数学题型，且不从学科总入口导出（客户端安全的独立入口）", () => {
  const registry = read("src/features/subjects/question-inputs.ts");
  assert.match(registry, /"math\.expression": MathAnswerInput/);
  assert.match(registry, /"math\.numeric": MathAnswerInput/);
  assert.equal((registry.match(/MathAnswerInput,/g) ?? []).length, 2);
  assert.doesNotMatch(read("src/features/subjects/index.ts"), /question-inputs/);
});

test("作答输入组件：字段名原样使用，限长与判题器一致，KaTeX 禁用 trust，不引用 app 层与服务端模块", () => {
  const text = read("src/features/subjects/math/student/MathAnswerInput.tsx");
  assert.match(text, /^"use client";/);
  assert.match(text, /<input\s+name=\{name\}/);
  assert.match(text, /maxLength=\{MAX_EXPRESSION_LENGTH\}/);
  assert.match(text, /defaultValue=\{previousAnswer \?\? ""\}/);
  assert.match(text, /trust: false/);
  assert.equal((text.match(/dangerouslySetInnerHTML/g) ?? []).length, 1);
  assert.doesNotMatch(text, /from ["']@\/(app|lib)\//);
  assert.doesNotMatch(text, /server-only|\.server/);
  assert.doesNotMatch(text, /\beval\(|new Function\(/);
});

test("平台作答表单不再为数学题型写分支，只通过注册表取输入", () => {
  const form = read("src/app/dashboard/assignments/AssignmentSubmissionForm.tsx");
  assert.match(form, /from "@\/features\/subjects\/question-inputs"/);
  assert.doesNotMatch(form, /math\./);
});

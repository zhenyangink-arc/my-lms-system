import assert from "node:assert/strict";
import test from "node:test";

import { matchGuideAgentRule } from "../src/lib/guide-agent-rule-matcher.ts";

const courseRule = {
  id: "course-rule",
  name: "打开课程中心",
  trigger_phrases: ["打开课程中心", "我的课程在哪里"],
  action_type: "navigate",
  target_path: "/dashboard/courses",
  target_element_id: null,
  response_text: "正在打开课程中心。",
  priority: 100,
};

test("明确的导航意图仍会命中本地规则", () => {
  assert.equal(matchGuideAgentRule("请帮我打开课程中心。", [courseRule])?.id, courseRule.id);
  assert.equal(matchGuideAgentRule("我的课程在哪里？", [courseRule])?.id, courseRule.id);
});

test("否定、取消和暂缓表达不会触发页面跳转", () => {
  for (const message of [
    "我不想打开课程中心",
    "不要打开课程中心",
    "暂时不打开课程中心",
    "别打开课程中心",
    "打开课程中心算了",
    "取消打开课程中心",
  ]) {
    assert.equal(matchGuideAgentRule(message, [courseRule]), null, message);
  }
});

test("前一次否定后重新给出明确肯定指令时可以命中", () => {
  assert.equal(
    matchGuideAgentRule("不要打开课程中心，我改主意了，请打开课程中心", [courseRule])?.id,
    courseRule.id,
  );
});

test("多条规则同时命中时仍由优先级决定", () => {
  const higherPriority = {
    ...courseRule,
    id: "level-one-rule",
    name: "进入韩语1级",
    trigger_phrases: ["韩语1级"],
    target_path: "/dashboard/courses/korean/korean-basic/korean-beginner",
    priority: 300,
  };
  assert.equal(matchGuideAgentRule("打开韩语1级课程", [courseRule, higherPriority])?.id, higherPriority.id);
});

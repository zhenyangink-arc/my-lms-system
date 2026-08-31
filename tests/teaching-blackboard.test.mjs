import assert from "node:assert/strict";
import test from "node:test";

import {
  teachingBlackboardDisplayForSegment,
  teachingBlackboardSlidesFromDisplay,
} from "../src/lib/teaching-blackboard.ts";

const element = (id, content) => ({
  id,
  type: "text",
  content,
  x: 8,
  y: 8,
  width: 84,
  height: 18,
  fontSize: 28,
  fontWeight: 700,
  align: "left",
  tone: "default",
});

test("blackboard uses the latest slide linked at or before the current teacher line", () => {
  const display = {
    mode: "slides",
    slides: [
      { id: "first", name: "开场", segmentIndex: 0, background: "plain", elements: [element("a", "欢迎")] },
      { id: "third", name: "例句", segmentIndex: 2, background: "warm", elements: [element("b", "안녕하세요?")] },
    ],
  };

  assert.equal(teachingBlackboardDisplayForSegment(display, 0).activeSlide.id, "first");
  assert.equal(teachingBlackboardDisplayForSegment(display, 1).activeSlide.id, "first");
  assert.equal(teachingBlackboardDisplayForSegment(display, 2).activeSlide.id, "third");
});

test("legacy display fields become one editable slide without copying teacher script", () => {
  const slides = teachingBlackboardSlidesFromDisplay({
    title: { "zh-CN": "本节重点" },
    items: { "zh-CN": ["问候", "身份介绍"] },
    korean: "안녕하세요?",
    translation: { "zh-CN": "你好？" },
  });

  assert.equal(slides.length, 1);
  assert.deepEqual(slides[0].elements.map((item) => item.type), ["text", "bullets", "expression"]);
  assert.equal(slides[0].elements[1].content, "问候\n身份介绍");
  assert.equal(slides[0].elements[2].translation, "你好？");
});

test("legacy displays are returned unchanged by segment resolution", () => {
  const legacy = { title: { "zh-CN": "旧内容" } };
  assert.equal(teachingBlackboardDisplayForSegment(legacy, 3), legacy);
});

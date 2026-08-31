import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTeachingBlackboardSlides,
  teachingBlackboardDisplayForSegment,
  teachingBlackboardSlideFitsHeader,
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

test("blackboard stage placement is included with the active slide", () => {
  const display = {
    mode: "slides",
    placement: { x: 63, y: 18, scale: 0.9 },
    slides: [
      { id: "first", name: "开场", segmentIndex: 0, background: "plain", elements: [element("a", "欢迎")] },
    ],
  };

  assert.deepEqual(teachingBlackboardDisplayForSegment(display, 0).placement, { x: 63, y: 18, scale: 0.9 });
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

test("legacy displays use the same canvas representation as the admin stage", () => {
  const legacy = {
    title: { "zh-CN": "旧内容" },
    items: { "zh-CN": ["第一项", "第二项"] },
  };
  const resolved = teachingBlackboardDisplayForSegment(legacy, 3);
  const authoredSlide = teachingBlackboardSlidesFromDisplay(legacy)[0];

  assert.equal(resolved.mode, "slides");
  assert.deepEqual(resolved.activeSlide, authoredSlide);
});

test("an intentionally empty later slide clears the previous blackboard", () => {
  const display = {
    mode: "slides",
    slides: [
      { id: "content", name: "重点", segmentIndex: 0, background: "plain", elements: [element("a", "问候")] },
      { id: "clear", name: "清空", segmentIndex: 1, background: "plain", elements: [] },
    ],
  };

  assert.equal(teachingBlackboardDisplayForSegment(display, 0).activeSlide.id, "content");
  assert.equal(teachingBlackboardDisplayForSegment(display, 1).activeSlide.id, "clear");
  assert.equal(teachingBlackboardDisplayForSegment(display, 1).activeSlide.elements.length, 0);
});

test("normalization repairs duplicate ids and keeps elements inside the canvas", () => {
  const slides = normalizeTeachingBlackboardSlides({
    slides: [
      {
        id: "same",
        name: "一",
        segmentIndex: 0,
        background: "plain",
        elements: [
          { ...element("same-element", "甲"), x: 99, width: 40 },
          { ...element("same-element", "乙"), y: 99, height: 30 },
        ],
      },
      { id: "same", name: "二", segmentIndex: 1, background: "plain", elements: [] },
    ],
  });

  assert.equal(new Set(slides.map((slide) => slide.id)).size, 2);
  assert.equal(new Set(slides[0].elements.map((item) => item.id)).size, 2);
  assert.equal(slides[0].elements[0].x, 60);
  assert.equal(slides[0].elements[1].y, 70);
});

test("oversized active slides are rejected before entering response headers", () => {
  const small = { id: "small", name: "简洁", segmentIndex: 0, background: "plain", elements: [element("a", "你好")] };
  const large = {
    ...small,
    id: "large",
    elements: Array.from({ length: 12 }, (_, index) => element(`item-${index}`, "很多黑板文字".repeat(80))),
  };

  assert.equal(teachingBlackboardSlideFitsHeader(small), true);
  assert.equal(teachingBlackboardSlideFitsHeader(large), false);
});

test("legacy rich-text markers do not leak onto the blackboard", () => {
  const slides = teachingBlackboardSlidesFromDisplay({
    title: { "zh-CN": "[b]本节重点[/b]" },
    items: { "zh-CN": ["[color=primary]问候[/color]"] },
    korean: "[u]안녕하세요?[/u]",
    translation: { "zh-CN": "[b]你好？[/b]" },
  });

  assert.equal(slides[0].elements[0].content, "本节重点");
  assert.equal(slides[0].elements[1].content, "问候");
  assert.equal(slides[0].elements[2].content, "안녕하세요?");
  assert.equal(slides[0].elements[2].translation, "你好？");
});

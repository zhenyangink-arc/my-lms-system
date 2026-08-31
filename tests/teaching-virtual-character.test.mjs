import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultTeachingVirtualCharacterPlacement,
  normalizeTeachingVirtualCharacterPlacement,
  teachingVirtualCharacterPreviewGeometry,
  TEACHING_VIRTUAL_CHARACTER_STAGE,
} from "../src/lib/teaching-virtual-character.ts";

test("legacy left and right positions become usable stage coordinates", () => {
  assert.deepEqual(defaultTeachingVirtualCharacterPlacement("left"), { x: 25, y: 0, scale: 1 });
  assert.deepEqual(defaultTeachingVirtualCharacterPlacement("right"), { x: 75, y: 0, scale: 1 });
  assert.deepEqual(normalizeTeachingVirtualCharacterPlacement({}, "left"), { x: 25, y: 0, scale: 1 });
});

test("per-line virtual character placement is normalized to the editable stage", () => {
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: 62, characterY: 14, characterScale: 1.15 }),
    { x: 62, y: 14, scale: 1.15 },
  );
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: 999, characterY: -20, characterScale: 0.2 }),
    { x: 90, y: 0, scale: 0.75 },
  );
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: 50, characterY: 999, characterScale: 1 }),
    { x: 50, y: TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent, scale: 1 },
  );
});

test("invalid placement values fall back without propagating NaN", () => {
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: "bad", characterY: null, characterScale: undefined }, "right"),
    { x: 75, y: 0, scale: 1 },
  );
});

test("admin preview uses the same wide teaching-stage geometry as the learner view", () => {
  assert.equal(TEACHING_VIRTUAL_CHARACTER_STAGE.viewportTopPx, 0);
  assert.equal(TEACHING_VIRTUAL_CHARACTER_STAGE.viewportBottomPx, 0);
  const widescreen = teachingVirtualCharacterPreviewGeometry(1920, 1080);
  const laptop = teachingVirtualCharacterPreviewGeometry(1680, 1050);
  assert.equal(widescreen.aspectRatio, "1920 / 1080");
  assert.ok(widescreen.blackboardWidthPercent < 50);
  assert.ok(laptop.blackboardWidthPercent > 50);
  assert.equal(
    laptop.blackboardLeftPercent * 2 + laptop.blackboardWidthPercent,
    100,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  constrainTeachingBlackboardPlacementToViewport,
  defaultTeachingBlackboardPlacement,
  defaultTeachingVirtualCharacterPlacement,
  normalizeTeachingBlackboardPlacement,
  normalizeTeachingVirtualCharacterPlacement,
  teachingBlackboardPlacementBounds,
  teachingVirtualCharacterPreviewGeometry,
  TEACHING_VIRTUAL_CHARACTER_STAGE,
} from "../src/lib/teaching-virtual-character.ts";

test("blackboard placement uses the same bounded stage coordinates as the editor", () => {
  assert.deepEqual(defaultTeachingBlackboardPlacement(), { x: 50, y: 11, scale: 1 });
  assert.deepEqual(
    normalizeTeachingBlackboardPlacement({ x: 68, y: 24, scale: 1.15 }),
    { x: 68, y: 24, scale: 1.15 },
  );
  assert.deepEqual(
    normalizeTeachingBlackboardPlacement({ x: 50, y: 0, scale: 1.5 }),
    { x: 50, y: 0, scale: 1.5 },
  );
  assert.equal(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumScale, 1.5);
  assert.deepEqual(
    normalizeTeachingBlackboardPlacement({ x: 999, y: -10, scale: 0.2 }),
    { x: 90, y: 0, scale: 0.75 },
  );
});

test("blackboard stays fully visible after scaling on a laptop viewport", () => {
  const bounds = teachingBlackboardPlacementBounds(1366, 768, 1.25);
  const placement = constrainTeachingBlackboardPlacementToViewport(
    { x: 90, y: 70, scale: 1.25 },
    1366,
    768,
  );

  assert.ok(bounds.minimumXPercent > 39 && bounds.minimumXPercent < 40);
  assert.ok(bounds.maximumXPercent > 60 && bounds.maximumXPercent < 61);
  assert.ok(bounds.maximumTopPercent > 21 && bounds.maximumTopPercent < 22);
  assert.equal(placement.x, bounds.maximumXPercent);
  assert.equal(placement.y, bounds.maximumTopPercent);
  assert.equal(placement.scale, 1.25);
});

test("blackboard scale is reduced when a short viewport cannot contain it", () => {
  const bounds = teachingBlackboardPlacementBounds(768, 320, 1.25);
  const placement = constrainTeachingBlackboardPlacementToViewport(
    { x: 90, y: 70, scale: 1.25 },
    768,
    320,
  );

  assert.equal(bounds.maximumScale, 0.8);
  assert.equal(placement.scale, 0.8);
  assert.equal(placement.x, bounds.maximumXPercent);
  assert.equal(placement.y, bounds.maximumTopPercent);
});

test("blackboard can adapt below the authoring minimum on an extremely short viewport", () => {
  const bounds = teachingBlackboardPlacementBounds(1366, 320, 1);
  const placement = constrainTeachingBlackboardPlacementToViewport(
    { x: 50, y: 11, scale: 1 },
    1366,
    320,
  );

  assert.ok(bounds.maximumScale < TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumScale);
  assert.equal(placement.scale, bounds.maximumScale);
  assert.ok(placement.y + (
    1366 * teachingVirtualCharacterPreviewGeometry(1366, 320).blackboardWidthPercent / 100
    * 9 / 16 * placement.scale / 320 * 100
  ) <= 100);
});

test("legacy left and right positions become usable stage coordinates", () => {
  assert.deepEqual(defaultTeachingVirtualCharacterPlacement("left"), { x: 25, y: 0, scale: 1, dialogueX: 35, dialogueY: 30 });
  assert.deepEqual(defaultTeachingVirtualCharacterPlacement("right"), { x: 75, y: 0, scale: 1, dialogueX: 85, dialogueY: 30 });
  assert.deepEqual(normalizeTeachingVirtualCharacterPlacement({}, "left"), { x: 25, y: 0, scale: 1, dialogueX: 35, dialogueY: 30 });
});

test("per-line virtual character placement is normalized to the editable stage", () => {
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: 62, characterY: 14, characterScale: 1.15 }),
    { x: 62, y: 14, scale: 1.15, dialogueX: 72, dialogueY: 44 },
  );
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: 999, characterY: -20, characterScale: 0.2 }),
    { x: 90, y: 0, scale: 0.75, dialogueX: 92, dialogueY: 30 },
  );
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: 50, characterY: 999, characterScale: 1 }),
    { x: 50, y: TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent, scale: 1, dialogueX: 60, dialogueY: 90 },
  );
});

test("invalid placement values fall back without propagating NaN", () => {
  assert.deepEqual(
    normalizeTeachingVirtualCharacterPlacement({ characterX: "bad", characterY: null, characterScale: undefined }, "right"),
    { x: 75, y: 0, scale: 1, dialogueX: 85, dialogueY: 30 },
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

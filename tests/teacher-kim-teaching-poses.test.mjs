import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  teacherKimPoseForTeachingMoment,
  teacherKimSentenceCaptionForCue,
  teacherKimSpeechRhythmForCue,
} from "../src/lib/teacher-kim-character.ts";

const root = new URL("../", import.meta.url);

test("金老师根据教学时刻自动切换动作并按语音词点调整表现节奏", () => {
  const base = {
    configuredPose: "explaining",
    teachingPhase: "explanation",
    classroomShot: "teacher_blackboard",
    teacherSpeaking: true,
    answerCorrect: null,
    sentence: "请看这里。",
  };
  assert.equal(teacherKimPoseForTeachingMoment({ ...base, teachingPhase: "task" }), "pointing-left");
  assert.equal(teacherKimPoseForTeachingMoment({ ...base, classroomShot: "interaction", teacherSpeaking: false }), "listening");
  assert.equal(teacherKimPoseForTeachingMoment({ ...base, classroomShot: "feedback", answerCorrect: true }), "encouraging");
  assert.equal(teacherKimPoseForTeachingMoment({ ...base, classroomShot: "feedback", answerCorrect: false }), "gentle-correction");
  assert.equal(teacherKimPoseForTeachingMoment({ ...base, sentence: "请跟我读一遍。" }), "repeat-after-me");

  const normalRhythm = teacherKimSpeechRhythmForCue("你好", 0);
  const strongRhythm = teacherKimSpeechRhythmForCue("很好！", 1);
  assert.ok(strongRhythm.mouthCycleMs < normalRhythm.mouthCycleMs);
  assert.equal(strongRhythm.emphasis, "strong");

  assert.deepEqual(
    teacherKimSentenceCaptionForCue("第一句。第二句！", { charStart: 4, charEnd: 6 }),
    { text: "第二句！", spokenText: "第二", remainingText: "句！" },
  );
});

test("金老师动作库覆盖真实教学事件并由统一白名单约束", async () => {
  const [character, actions, editor, runtime] = await Promise.all([
    readFile(new URL("src/lib/teacher-kim-character.ts", root), "utf8"),
    readFile(new URL("src/app/dashboard/admin/teaching-scripts/actions.ts", root), "utf8"),
    readFile(new URL("src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx", root), "utf8"),
    readFile(new URL("src/lib/learning-agent-script-runtime.ts", root), "utf8"),
  ]);

  for (const pose of ["pointing-left", "repeat-after-me", "listening", "gentle-correction"]) {
    assert.match(character, new RegExp(`"${pose}"`));
  }
  assert.match(character, /指向学习内容/);
  assert.match(character, /示范跟读/);
  assert.match(character, /倾听学生/);
  assert.match(character, /温和纠错/);
  assert.match(actions, /z\.enum\(TEACHER_KIM_POSES\)/);
  assert.match(editor, /TEACHER_KIM_POSE_LABELS\[pose\]/);
  assert.match(runtime, /isTeacherKimPose\(performance\.pose\)/);
});

test("金老师四个教学动作均提供透明三帧并从私有 R2 v4 加载", async () => {
  const [route, shell, builder] = await Promise.all([
    readFile(new URL("src/app/api/learning-agent/characters/[pose]/route.ts", root), "utf8"),
    readFile(new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root), "utf8"),
    readFile(new URL("scripts/build-teacher-kim-teaching-frames.mjs", root), "utf8"),
  ]);

  for (const pose of ["pointing-left", "repeat-after-me", "listening", "gentle-correction"]) {
    for (const frame of ["idle", "speaking", "blink"]) {
      assert.match(route, new RegExp(`uply-teacher/v4/${pose}-${frame}\\.png`));
      assert.match(shell, new RegExp(`/api/learning-agent/characters/${pose}-${frame}`));
    }
  }
  assert.match(builder, /resize\(512, 1024/);
  assert.match(builder, /greenDominance/);
  assert.match(builder, /identityOverlay/);
  assert.match(builder, /#26386f/);
  assert.match(builder, /#d9b45c/);
});

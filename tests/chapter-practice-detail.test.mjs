import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateChapterPracticeSelfCheck,
  isHangulPracticeChapter,
  orderPublishedChapterPracticeBlocks,
  selfCheckTopics,
} from "../src/features/chapter-practice/student/model.ts";
import {
  isTemporaryListeningAudio,
  parseListeningMaterial,
} from "../src/features/chapter-practice/student/listening.ts";
import {
  calculateStudentPracticeProgress,
  emptyStudentPracticeProgress,
  mergeProgressSnapshots,
  practiceAccuracyThreshold,
} from "../src/features/chapter-practice/student/progress-model.ts";

function block(overrides) {
  return {
    id: crypto.randomUUID(),
    practiceUnitId: crypto.randomUUID(),
    blockType: "overview",
    title: "本章回顾",
    instructions: "回顾本章重点。",
    contentPayload: {},
    sourceType: "course_chapter",
    sourceId: crypto.randomUUID(),
    sortOrder: 0,
    isRequired: true,
    ...overrides,
  };
}

test("详情块按产品顺序排列，同时保留同类块的管理端顺序", () => {
  const ordered = orderPublishedChapterPracticeBlocks([
    block({ blockType: "self_check", sortOrder: 10 }),
    block({ blockType: "writing", sortOrder: 80 }),
    block({ blockType: "overview", sortOrder: 90 }),
    block({ blockType: "listening", sortOrder: 50 }),
    block({ blockType: "grammar", sortOrder: 30 }),
    block({ blockType: "vocabulary", sortOrder: 20 }),
  ]);
  assert.deepEqual(
    ordered.map((item) => item.blockType),
    ["overview", "vocabulary", "grammar", "listening", "writing", "self_check"],
  );
});

test("只有课程键或 payload 明确标记时才启用字母互动", () => {
  const hangulBlock = block({
    blockType: "vocabulary",
    contentPayload: { exercise: { courseKey: "hangul-introduction" } },
  });
  const formalBlock = block({
    blockType: "vocabulary",
    contentPayload: {
      exercise: {
        courseKey: "korean-level-one",
        chapterTitle: "韩国语一级",
        koreanExample: "한 개에 천 원이에요.",
      },
    },
  });
  assert.equal(
    isHangulPracticeChapter({ courseKey: "korean-beginner", blocks: [hangulBlock] }),
    true,
  );
  assert.equal(
    isHangulPracticeChapter({ courseKey: "korean-beginner", blocks: [formalBlock] }),
    false,
  );
});

test("自我检测使用本章真实主题并返回明确的通过与待加强结果", () => {
  const selfCheck = block({
    blockType: "self_check",
    contentPayload: {
      skills: {
        greeting: "日常问候",
        particle: "主题助词 은/는",
        ending: "礼貌终结语尾",
      },
      passingScore: 80,
    },
  });
  const topics = selfCheckTopics(selfCheck, "第一课");
  assert.deepEqual(topics, ["日常问候", "主题助词 은/는", "礼貌终结语尾"]);

  const needsReview = evaluateChapterPracticeSelfCheck({
    topics,
    passingScore: 80,
    answers: { "0": "mastered", "1": "review", "2": "review" },
  });
  assert.deepEqual(needsReview, {
    score: 33,
    passingScore: 80,
    passed: false,
    masteredCount: 1,
    topicCount: 3,
  });

  const passed = evaluateChapterPracticeSelfCheck({
    topics,
    passingScore: 80,
    answers: { "0": "mastered", "1": "mastered", "2": "mastered" },
  });
  assert.equal(passed.passed, true);
  assert.equal(passed.score, 100);

  assert.deepEqual(
    selfCheckTopics(
      block({
        blockType: "self_check",
        contentPayload: { skills: ["发音目标", null, "简单音节"] },
      }),
      "第一课",
    ),
    ["发音目标", "简单音节"],
  );
});

test("听力块解析真实目标、材料、题目和正式音频地址", () => {
  const listening = block({
    blockType: "listening",
    contentPayload: {
      audioStatus: "ready",
      description: "听出人物和地点。",
      exercise: {
        focus: ["听出人物", "听出地点"],
        audioUrl: "/audio/chapter-1.mp3",
      },
      questions: [
        {
          id: "69133442-e409-4158-b23c-9693dccaea7b",
          type: "single_choice",
          prompt: "在哪里见面？",
          content: {
            stimulus: "학교에서 만나요.",
            hint: "注意地点助词。",
            options: [
              { value: "a", label: "学校" },
              { value: "b", label: "车站" },
            ],
          },
        },
      ],
    },
  });
  const material = parseListeningMaterial(listening);
  assert.equal(material.audioUrl, "/audio/chapter-1.mp3");
  assert.deepEqual(material.objectives, ["听出人物", "听出地点", "听出人物和地点。"]);
  assert.equal(material.transcript, "학교에서 만나요.");
  assert.equal(material.questions[0].options.length, 2);
  assert.equal(isTemporaryListeningAudio(material), false);
});

test("听力块没有音频地址时使用临时语音，缺少题目时保持空列表", () => {
  const material = parseListeningMaterial(
    block({
      blockType: "listening",
      contentPayload: {
        audioStatus: "pending",
        exercise: { listeningText: "안녕하세요." },
      },
    }),
  );
  assert.equal(isTemporaryListeningAudio(material), true);
  assert.equal(material.transcript, "안녕하세요.");
  assert.deepEqual(material.questions, []);
});

test("巩固进度按完成规则、练习正确率和现有章节测试通过口径计算", () => {
  const unitId = crypto.randomUUID();
  const overview = block({ practiceUnitId: unitId, blockType: "overview" });
  const selfCheck = block({ practiceUnitId: unitId, blockType: "self_check" });
  const facts = {
    ...emptyStudentPracticeProgress(unitId),
    completedBlockIds: [overview.id, selfCheck.id],
    correctCount: 8,
    attemptCount: 10,
    startedAt: "2026-08-19T01:00:00.000Z",
    lastPracticedAt: "2026-08-19T02:00:00.000Z",
    completedAt: "2026-08-19T02:00:00.000Z",
  };
  const completionRule = {
    minimumRequiredBlocks: 2,
    requireSelfCheck: true,
    minimumAccuracyPercent: 80,
  };
  assert.equal(practiceAccuracyThreshold(completionRule), 80);
  const waitingForTest = calculateStudentPracticeProgress({
    facts,
    blocks: [overview, selfCheck],
    completionRule,
    chapterTestAvailable: true,
    chapterTestPassed: false,
  });
  assert.equal(waitingForTest.progressPercent, 100);
  assert.equal(waitingForTest.masteryPercent, 66.67);
  assert.equal(waitingForTest.status, "needs_reinforcement");

  const mastered = calculateStudentPracticeProgress({
    facts,
    blocks: [overview, selfCheck],
    completionRule,
    chapterTestAvailable: true,
    chapterTestPassed: true,
  });
  assert.equal(mastered.masteryPercent, 100);
  assert.equal(mastered.status, "mastered");
});

test("较旧本地缓存不能覆盖服务器，较新缓存只做单调合并", () => {
  const unitId = crypto.randomUUID();
  const blockA = crypto.randomUUID();
  const blockB = crypto.randomUUID();
  const server = {
    ...emptyStudentPracticeProgress(unitId),
    status: "in_progress",
    completedBlockIds: [blockA],
    correctCount: 8,
    attemptCount: 10,
    lastPracticedAt: "2026-08-19T10:00:00.000Z",
  };
  const olderLocal = {
    ...server,
    completedBlockIds: [],
    correctCount: 1,
    attemptCount: 2,
    lastPracticedAt: "2026-08-19T09:00:00.000Z",
  };
  assert.deepEqual(
    mergeProgressSnapshots({ server, local: olderLocal }),
    server,
  );

  const newerLocal = {
    ...olderLocal,
    completedBlockIds: [blockB],
    correctCount: 3,
    attemptCount: 4,
    lastPracticedAt: "2026-08-19T11:00:00.000Z",
  };
  const merged = mergeProgressSnapshots({ server, local: newerLocal });
  assert.deepEqual(new Set(merged.completedBlockIds), new Set([blockA, blockB]));
  assert.equal(merged.correctCount, 8);
  assert.equal(merged.attemptCount, 10);
});

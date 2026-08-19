import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requirePlatformOwner } from "@/lib/admin";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHAPTER_PRACTICE_BLOCK_LABELS,
  DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS,
  REQUIRED_CHAPTER_PRACTICE_BLOCKS,
  defaultCompletionRule,
  inspectChapterPracticePublication,
  parseCompletionRule,
} from "./model";
import {
  createChapterPracticeSourceDigest,
  didChapterPracticeSourcesChange,
} from "./source-change";
import type {
  ChapterPracticeBlock,
  ChapterPracticeBlockType,
  ChapterPracticeCompletionRule,
  ChapterPracticePublishInspection,
  ChapterPracticeUnitDetail,
  ChapterPracticeUnitStatus,
} from "./types";

type JsonObject = Record<string, unknown>;
type AuthorityContext = Awaited<ReturnType<typeof loadAuthorityContext>>;

type GeneratedBlock = {
  block_type: ChapterPracticeBlockType;
  title: string;
  instructions: string;
  content_payload: JsonObject;
  source_type: string;
  source_id: string;
  sort_order: number;
  is_required: boolean;
  status: "draft";
};

export class ChapterPracticeOperationError extends Error {
  reasons: string[];

  constructor(message: string, reasons: string[] = []) {
    super(message);
    this.name = "ChapterPracticeOperationError";
    this.reasons = reasons;
  }
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function localizedText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = objectValue(value);
  return textValue(record["zh-CN"]) || textValue(record.zh) || textValue(record["ko-KR"]);
}

function assertQuery<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) {
    throw new ChapterPracticeOperationError(`${label}失败`, [result.error.message]);
  }
  return result.data as T;
}

async function loadAuthorityContext(
  supabase: SupabaseClient,
  courseChapterId: string,
) {
  const chapter = assertQuery(
    "读取课程章节",
    await supabase
      .from("course_chapters")
      .select(
        "id,lesson_id,chapter_test_id,slug,title,description,is_published,content_scope,updated_at",
      )
      .eq("id", courseChapterId)
      .maybeSingle(),
  ) as {
    id: string;
    lesson_id: string;
    chapter_test_id: string | null;
    slug: string;
    title: string;
    description: string | null;
    is_published: boolean;
    content_scope: string;
    updated_at: string;
  } | null;
  if (!chapter) {
    throw new ChapterPracticeOperationError("课程章节不存在");
  }

  const lesson = assertQuery(
    "读取所属课时",
    await supabase
      .from("lessons")
      .select(
        "id,course_id,title,is_published,content_scope,learning_objectives,lesson_tasks,key_points,common_mistakes,summary_text,reflection_questions,updated_at",
      )
      .eq("id", chapter.lesson_id)
      .maybeSingle(),
  ) as {
    id: string;
    course_id: string;
    title: string;
    is_published: boolean;
    content_scope: string;
    learning_objectives: string | null;
    lesson_tasks: string | null;
    key_points: string | null;
    common_mistakes: string | null;
    summary_text: string | null;
    reflection_questions: string | null;
    updated_at: string;
  } | null;
  if (!lesson) throw new ChapterPracticeOperationError("所属课时不存在");

  const course = assertQuery(
    "读取所属课程",
    await supabase
      .from("courses")
      .select("id,slug,title,is_published,content_scope,student_app_id,updated_at")
      .eq("id", lesson.course_id)
      .maybeSingle(),
  ) as {
    id: string;
    slug: string;
    title: string;
    is_published: boolean;
    content_scope: string;
    student_app_id: string;
    updated_at: string;
  } | null;
  if (
    !course ||
    course.student_app_id !== STUDENT_APP_IDS.korean ||
    course.content_scope !== "platform" ||
    lesson.content_scope !== "platform" ||
    chapter.content_scope !== "platform"
  ) {
    throw new ChapterPracticeOperationError("该章节不属于韩国语平台课程");
  }

  const textbook = assertQuery(
    "读取互动教材",
    await supabase
      .from("digital_textbooks")
      .select("id,status,updated_at")
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("lesson_id", lesson.id)
      .eq("status", "published")
      .maybeSingle(),
  ) as { id: string; status: string; updated_at: string } | null;

  const version = textbook
    ? (assertQuery(
        "读取教材版本",
        await supabase
          .from("digital_textbook_versions")
          .select("id,version_number,status,updated_at")
          .eq("textbook_id", textbook.id)
          .eq("status", "published")
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as {
        id: string;
        version_number: number;
        status: string;
        updated_at: string;
      } | null)
    : null;

  let textbookChapterQuery = version
    ? supabase
        .from("digital_textbook_chapters")
        .select("id,title,scenario,goal,status,audio_status,updated_at")
        .eq("version_id", version.id)
        .eq("status", "published")
    : null;
  if (textbookChapterQuery) {
    textbookChapterQuery = chapter.chapter_test_id
      ? textbookChapterQuery.eq("chapter_test_id", chapter.chapter_test_id)
      : textbookChapterQuery.eq("slug", chapter.slug);
  }
  const textbookChapter = textbookChapterQuery
    ? (assertQuery(
        "读取教材章节",
        await textbookChapterQuery.maybeSingle(),
      ) as {
        id: string;
        title: JsonObject;
        scenario: JsonObject;
        goal: JsonObject;
        status: string;
        audio_status: string | null;
        updated_at: string;
      } | null)
    : null;

  const modules = textbookChapter
    ? ((assertQuery(
        "读取教材模块",
        await supabase
          .from("digital_textbook_modules")
          .select("id,module_code,title,description,sort_order,updated_at")
          .eq("chapter_id", textbookChapter.id)
          .order("sort_order"),
      ) ?? []) as Array<{
        id: string;
        module_code: string;
        title: JsonObject;
        description: JsonObject;
        sort_order: number;
        updated_at: string;
      }>)
    : [];
  const moduleIds = modules.map((item) => item.id);
  const nodes = moduleIds.length
    ? ((assertQuery(
        "读取教材内容",
        await supabase
          .from("digital_textbook_nodes")
          .select("id,module_id,node_code,title,content,sort_order,updated_at")
          .in("module_id", moduleIds)
          .order("sort_order"),
      ) ?? []) as Array<{
        id: string;
        module_id: string;
        node_code: string;
        title: JsonObject;
        content: JsonObject;
        sort_order: number;
        updated_at: string;
      }>)
    : [];
  const nodeIds = nodes.map((item) => item.id);
  const activities = nodeIds.length
    ? ((assertQuery(
        "读取教材活动",
        await supabase
          .from("digital_textbook_activities")
          .select(
            "id,node_id,activity_type,prompt,instruction,options,public_config,sort_order,updated_at",
          )
          .in("node_id", nodeIds)
          .order("sort_order"),
      ) ?? []) as Array<{
        id: string;
        node_id: string;
        activity_type: string;
        prompt: JsonObject;
        instruction: JsonObject;
        options: unknown[];
        public_config: JsonObject;
        sort_order: number;
        updated_at: string;
      }>)
    : [];
  const activityIds = activities.map((item) => item.id);
  const activitySecrets = activityIds.length
    ? ((assertQuery(
        "读取教材活动判定配置",
        await supabase
          .from("digital_textbook_activity_secrets")
          .select("activity_id,answer_key,audio_status,audio_object_key")
          .in("activity_id", activityIds),
      ) ?? []) as Array<{
        activity_id: string;
        answer_key: JsonObject;
        audio_status: string | null;
        audio_object_key: string | null;
      }>)
    : [];

  const exercises = ((assertQuery(
    "读取专项练习",
    await supabase
      .from("growth_toolbox_exercises")
      .select(
        "id,skill,title,description,instructions,content_payload,status,updated_at",
      )
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("course_chapter_id", chapter.id)
      .eq("status", "published")
      .order("sort_order"),
  ) ?? []) as Array<{
    id: string;
    skill: string;
    title: string;
    description: string;
    instructions: string;
    content_payload: JsonObject;
    status: string;
    updated_at: string;
  }>);
  const exerciseIds = exercises.map((item) => item.id);
  const questions = exerciseIds.length
    ? ((assertQuery(
        "读取专项练习题",
        await supabase
          .from("growth_toolbox_questions")
          .select(
            "id,exercise_id,question_type,prompt,content_payload,max_score,sort_order,updated_at",
          )
          .in("exercise_id", exerciseIds)
          .order("sort_order"),
      ) ?? []) as Array<{
        id: string;
        exercise_id: string;
        question_type: string;
        prompt: string;
        content_payload: JsonObject;
        max_score: number;
        sort_order: number;
        updated_at: string;
      }>)
    : [];
  const questionIds = questions.map((item) => item.id);
  const questionKeys = questionIds.length
    ? ((assertQuery(
        "读取专项练习判定配置",
        await supabase
          .from("growth_toolbox_question_keys")
          .select("question_id,accepted_answers,rubric,updated_at")
          .in("question_id", questionIds),
      ) ?? []) as Array<{
        question_id: string;
        accepted_answers: unknown[];
        rubric: JsonObject;
        updated_at: string;
      }>)
    : [];

  const chapterTest = chapter.chapter_test_id
    ? (assertQuery(
        "读取章节测试",
        await supabase
          .from("chapter_tests")
          .select("id,slug,title,status,passing_score,skills,updated_at")
          .eq("id", chapter.chapter_test_id)
          .maybeSingle(),
      ) as {
        id: string;
        slug: string;
        title: string;
        status: string;
        passing_score: number;
        skills: JsonObject;
        updated_at: string;
      } | null)
    : null;
  const chapterTestQuestions = chapterTest
    ? ((assertQuery(
        "读取章节测试题",
        await supabase
          .from("chapter_test_questions")
          .select("id,status,correct_option,updated_at")
          .eq("test_id", chapterTest.id),
      ) ?? []) as Array<{
        id: string;
        status: string;
        correct_option: number | null;
        updated_at: string;
      }>)
    : [];
  const homework = chapter.chapter_test_id
    ? (assertQuery(
        "读取章节作业",
        await supabase
          .from("chapter_homework_plans")
          .select("id,title,status,duration_minutes,passing_score,updated_at")
          .eq("test_id", chapter.chapter_test_id)
          .maybeSingle(),
      ) as {
        id: string;
        title: string;
        status: string;
        duration_minutes: number;
        passing_score: number;
        updated_at: string;
      } | null)
    : null;

  return {
    chapter,
    lesson,
    course,
    textbook,
    version,
    textbookChapter,
    modules,
    nodes,
    activities,
    activitySecrets,
    exercises,
    questions,
    questionKeys,
    chapterTest,
    chapterTestQuestions,
    homework,
  };
}

function publicQuestions(context: AuthorityContext, exerciseId: string) {
  return context.questions
    .filter((question) => question.exercise_id === exerciseId)
    .map((question) => ({
      id: question.id,
      type: question.question_type,
      prompt: question.prompt,
      content: question.content_payload,
      maxScore: Number(question.max_score),
      sortOrder: question.sort_order,
    }));
}

function objectiveConfigurationSummary(
  context: AuthorityContext,
  exerciseId: string,
) {
  const objectiveTypes = new Set(["single_choice", "true_false", "short_text"]);
  const objectiveQuestions = context.questions.filter(
    (question) =>
      question.exercise_id === exerciseId &&
      objectiveTypes.has(question.question_type),
  );
  const keyByQuestion = new Map(
    context.questionKeys.map((key) => [key.question_id, key]),
  );
  const configured = objectiveQuestions.filter((question) => {
    const key = keyByQuestion.get(question.id);
    return Boolean(
      key &&
        (arrayValue(key.accepted_answers).length > 0 ||
          Object.keys(objectValue(key.rubric)).length > 0),
    );
  });
  return {
    objectiveQuestionCount: objectiveQuestions.length,
    configuredObjectiveQuestionCount: configured.length,
  };
}

function detectExerciseAudioStatus(
  context: AuthorityContext,
  exerciseId: string,
) {
  const source = JSON.stringify({
    exercise: context.exercises.find((item) => item.id === exerciseId)
      ?.content_payload,
    questions: context.questions
      .filter((item) => item.exercise_id === exerciseId)
      .map((item) => item.content_payload),
  }).toLowerCase();
  if (/"audiostatus"\s*:\s*"ready"/.test(source) || /"audiourl"\s*:/.test(source)) {
    return "ready";
  }
  if (/"audiostatus"\s*:\s*"pending"/.test(source)) return "pending";
  return "missing";
}

function exerciseBlock(
  context: AuthorityContext,
  blockType: Extract<
    ChapterPracticeBlockType,
    "vocabulary" | "grammar" | "listening" | "speaking" | "reading" | "writing"
  >,
  sortOrder: number,
): GeneratedBlock | null {
  const exercise = context.exercises.find((item) => item.skill === blockType);
  if (!exercise) return null;
  const judgement = objectiveConfigurationSummary(context, exercise.id);
  return {
    block_type: blockType,
    title: CHAPTER_PRACTICE_BLOCK_LABELS[blockType],
    instructions:
      textValue(exercise.instructions) ||
      DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS[blockType],
    content_payload: {
      description: exercise.description,
      exercise: exercise.content_payload,
      questions: publicQuestions(context, exercise.id),
      judgement,
      ...(blockType === "listening"
        ? { audioStatus: detectExerciseAudioStatus(context, exercise.id) }
        : {}),
    },
    source_type: "growth_toolbox_exercise",
    source_id: exercise.id,
    sort_order: sortOrder,
    is_required: REQUIRED_CHAPTER_PRACTICE_BLOCKS.includes(
      blockType as (typeof REQUIRED_CHAPTER_PRACTICE_BLOCKS)[number],
    ),
    status: "draft",
  };
}

function textbookModuleBlock(
  context: AuthorityContext,
  blockType: "vocabulary" | "grammar" | "comparison",
  moduleCode: string,
  sortOrder: number,
): GeneratedBlock | null {
  const textbookModule = context.modules.find(
    (item) => item.module_code === moduleCode,
  );
  if (!textbookModule) return null;
  const nodes = context.nodes
    .filter((node) => node.module_id === textbookModule.id)
    .map((node) => ({
      id: node.id,
      title: localizedText(node.title),
      content: node.content,
      sortOrder: node.sort_order,
    }));
  if (nodes.length === 0) return null;
  return {
    block_type: blockType,
    title: CHAPTER_PRACTICE_BLOCK_LABELS[blockType],
    instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS[blockType],
    content_payload: { nodes },
    source_type: "digital_textbook_module",
    source_id: textbookModule.id,
    sort_order: sortOrder,
    is_required: blockType !== "comparison",
    status: "draft",
  };
}

function buildGeneratedBlocks(context: AuthorityContext): GeneratedBlock[] {
  const blocks: Array<GeneratedBlock | null> = [];
  blocks.push({
    block_type: "overview",
    title: CHAPTER_PRACTICE_BLOCK_LABELS.overview,
    instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.overview,
    content_payload: {
      chapterDescription: context.chapter.description,
      learningObjectives: context.lesson.learning_objectives,
      lessonTasks: context.lesson.lesson_tasks,
      keyPoints: context.lesson.key_points,
      textbookGoal: context.textbookChapter?.goal ?? null,
      textbookScenario: context.textbookChapter?.scenario ?? null,
    },
    source_type: "course_chapter",
    source_id: context.chapter.id,
    sort_order: 10,
    is_required: true,
    status: "draft",
  });
  blocks.push(
    textbookModuleBlock(context, "vocabulary", "vocabulary", 20) ??
      exerciseBlock(context, "vocabulary", 20),
  );
  blocks.push(
    textbookModuleBlock(context, "grammar", "grammar", 30) ??
      exerciseBlock(context, "grammar", 30),
  );
  const comparison = textbookModuleBlock(context, "comparison", "patterns", 40);
  blocks.push(
    comparison ??
      (textValue(context.lesson.common_mistakes)
        ? {
            block_type: "comparison",
            title: CHAPTER_PRACTICE_BLOCK_LABELS.comparison,
            instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.comparison,
            content_payload: {
              commonMistakes: context.lesson.common_mistakes,
              keyPoints: context.lesson.key_points,
            },
            source_type: "lesson",
            source_id: context.lesson.id,
            sort_order: 40,
            is_required: false,
            status: "draft",
          }
        : null),
  );
  if (
    context.course.slug === "hangul-introduction" ||
    /(?:hangul|jamo|alphabet)/i.test(context.chapter.slug) ||
    /韩文|字母/.test(context.chapter.title)
  ) {
    blocks.push({
      block_type: "interaction",
      title: CHAPTER_PRACTICE_BLOCK_LABELS.interaction,
      instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.interaction,
      content_payload: {
        contentKind: "hangul",
        practiceKind: "syllable-structure",
      },
      source_type: "course_chapter",
      source_id: context.chapter.id,
      sort_order: 45,
      is_required: true,
      status: "draft",
    });
  }
  blocks.push(exerciseBlock(context, "listening", 50));
  blocks.push(exerciseBlock(context, "speaking", 60));
  blocks.push(exerciseBlock(context, "reading", 70));
  blocks.push(exerciseBlock(context, "writing", 80));

  if (context.homework?.status === "published") {
    blocks.push({
      block_type: "review",
      title: CHAPTER_PRACTICE_BLOCK_LABELS.review,
      instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.review,
      content_payload: {
        title: context.homework.title,
        durationMinutes: context.homework.duration_minutes,
        passingScore: Number(context.homework.passing_score),
        summary: context.lesson.summary_text,
      },
      source_type: "chapter_homework_plan",
      source_id: context.homework.id,
      sort_order: 90,
      is_required: true,
      status: "draft",
    });
  } else if (context.chapterTest?.status === "published") {
    blocks.push({
      block_type: "review",
      title: CHAPTER_PRACTICE_BLOCK_LABELS.review,
      instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.review,
      content_payload: {
        summary: context.lesson.summary_text,
        reflectionQuestions: context.lesson.reflection_questions,
        testQuestionCount: context.chapterTestQuestions.length,
      },
      source_type: "chapter_test",
      source_id: context.chapterTest.id,
      sort_order: 90,
      is_required: true,
      status: "draft",
    });
  }

  if (context.chapterTest?.status === "published") {
    blocks.push({
      block_type: "self_check",
      title: CHAPTER_PRACTICE_BLOCK_LABELS.self_check,
      instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.self_check,
      content_payload: {
        testSlug: context.chapterTest.slug,
        passingScore: Number(context.chapterTest.passing_score),
        skills: context.chapterTest.skills,
        questionCount: context.chapterTestQuestions.length,
      },
      source_type: "chapter_test",
      source_id: context.chapterTest.id,
      sort_order: 100,
      is_required: true,
      status: "draft",
    });
  } else {
    const selfCheckActivity = context.activities.find(
      (item) => item.activity_type === "self_check",
    );
    if (selfCheckActivity) {
      blocks.push({
        block_type: "self_check",
        title: CHAPTER_PRACTICE_BLOCK_LABELS.self_check,
        instructions: DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS.self_check,
        content_payload: {
          prompt: selfCheckActivity.prompt,
          instruction: selfCheckActivity.instruction,
          config: selfCheckActivity.public_config,
        },
        source_type: "digital_textbook_activity",
        source_id: selfCheckActivity.id,
        sort_order: 100,
        is_required: true,
        status: "draft",
      });
    }
  }

  return blocks.filter((block): block is GeneratedBlock => Boolean(block));
}

function sourceSnapshot(context: AuthorityContext): JsonObject {
  return {
    generatedAt: new Date().toISOString(),
    contentDigest: sourceContentDigest(context),
    course: { id: context.course.id, updatedAt: context.course.updated_at },
    lesson: { id: context.lesson.id, updatedAt: context.lesson.updated_at },
    chapter: { id: context.chapter.id, updatedAt: context.chapter.updated_at },
    textbookChapter: context.textbookChapter
      ? { id: context.textbookChapter.id, updatedAt: context.textbookChapter.updated_at }
      : null,
    exercises: context.exercises.map((item) => ({
      id: item.id,
      skill: item.skill,
      updatedAt: item.updated_at,
    })),
    chapterTest: context.chapterTest
      ? {
          id: context.chapterTest.id,
          status: context.chapterTest.status,
          updatedAt: context.chapterTest.updated_at,
        }
      : null,
    homework: context.homework
      ? {
          id: context.homework.id,
          status: context.homework.status,
          updatedAt: context.homework.updated_at,
        }
      : null,
  };
}

function sourceContentFields(value: object, omitStatus = false): JsonObject {
  const result = { ...(value as JsonObject) };
  delete result.updated_at;
  if (omitStatus) delete result.status;
  return result;
}

function sourceContentDigest(context: AuthorityContext) {
  return createChapterPracticeSourceDigest({
    course: { id: context.course.id, title: context.course.title },
    lesson: {
      id: context.lesson.id,
      title: context.lesson.title,
      learningObjectives: context.lesson.learning_objectives,
      lessonTasks: context.lesson.lesson_tasks,
      keyPoints: context.lesson.key_points,
      commonMistakes: context.lesson.common_mistakes,
      summaryText: context.lesson.summary_text,
      reflectionQuestions: context.lesson.reflection_questions,
    },
    chapter: {
      id: context.chapter.id,
      title: context.chapter.title,
      description: context.chapter.description,
    },
    textbookChapter: context.textbookChapter
      ? {
          id: context.textbookChapter.id,
          title: context.textbookChapter.title,
          scenario: context.textbookChapter.scenario,
          goal: context.textbookChapter.goal,
          audioStatus: context.textbookChapter.audio_status,
        }
      : null,
    modules: context.modules.map((module) => sourceContentFields(module)),
    nodes: context.nodes.map((node) => sourceContentFields(node)),
    activities: context.activities.map((activity) =>
      sourceContentFields(activity),
    ),
    activitySecrets: context.activitySecrets.map((secret) =>
      sourceContentFields(secret),
    ),
    exercises: context.exercises.map((exercise) =>
      sourceContentFields(exercise, true),
    ),
    questions: context.questions.map((question) => sourceContentFields(question)),
    questionKeys: context.questionKeys.map((key) => sourceContentFields(key)),
    chapterTest: context.chapterTest
      ? {
          id: context.chapterTest.id,
          slug: context.chapterTest.slug,
          title: context.chapterTest.title,
          passingScore: context.chapterTest.passing_score,
          skills: context.chapterTest.skills,
        }
      : null,
    chapterTestQuestions: context.chapterTestQuestions.map((question) =>
      sourceContentFields(question, true),
    ),
    homework: context.homework
      ? {
          id: context.homework.id,
          title: context.homework.title,
          durationMinutes: context.homework.duration_minutes,
          passingScore: context.homework.passing_score,
        }
      : null,
  });
}

function legacySourceUpdatedAts(context: AuthorityContext) {
  return [
    context.lesson.updated_at,
    ...context.modules.map((item) => item.updated_at),
    ...context.nodes.map((item) => item.updated_at),
    ...context.activities.map((item) => item.updated_at),
    ...context.exercises.map((item) => item.updated_at),
    ...context.questions.map((item) => item.updated_at),
    ...context.questionKeys.map((item) => item.updated_at),
    context.homework?.updated_at,
  ].filter((value): value is string => Boolean(value));
}

async function requireEditableUnit(
  supabase: SupabaseClient,
  unitId: string,
) {
  const unit = assertQuery(
    "读取巩固包",
    await supabase
      .from("chapter_practice_units")
      .select("id,course_chapter_id,status,published_at,completion_rule")
      .eq("id", unitId)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
  ) as {
    id: string;
    course_chapter_id: string;
    status: ChapterPracticeUnitStatus;
    published_at: string | null;
    completion_rule: JsonObject;
  } | null;
  if (!unit) throw new ChapterPracticeOperationError("巩固包不存在");
  if (unit.published_at || unit.status !== "draft") {
    throw new ChapterPracticeOperationError(
      "当前版本不可编辑",
      ["只有草稿可以编辑；已发布内容必须创建新版本。"],
    );
  }
  return unit;
}

async function createDraftVersion(
  supabase: SupabaseClient,
  courseChapterId: string,
  allowAfterPublished: boolean,
  loadedContext?: AuthorityContext,
) {
  const context = loadedContext ?? await loadAuthorityContext(supabase, courseChapterId);
  if (!context.chapter.is_published) {
    throw new ChapterPracticeOperationError("无法生成巩固包", ["课程章节尚未发布。"]);
  }
  const latest = assertQuery(
    "读取现有版本",
    await supabase
      .from("chapter_practice_units")
      .select("id,version,status,published_at")
      .eq("course_chapter_id", courseChapterId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as {
    id: string;
    version: number;
    status: ChapterPracticeUnitStatus;
    published_at: string | null;
  } | null;
  if (latest && (latest.status === "draft" || latest.status === "pending_review")) {
    return latest.id;
  }
  if (latest && !allowAfterPublished) {
    throw new ChapterPracticeOperationError("该章节已经生成巩固包");
  }
  if (
    latest &&
    !["published", "needs_update", "disabled"].includes(latest.status)
  ) {
    throw new ChapterPracticeOperationError("当前版本状态不允许创建新版本");
  }

  const blocks = buildGeneratedBlocks(context);
  if (blocks.length === 0) {
    throw new ChapterPracticeOperationError("没有可用于生成巩固包的权威内容");
  }
  const requiredCount = blocks.filter((block) => block.is_required).length;
  const unit = assertQuery(
    "创建巩固包草稿",
    await supabase
      .from("chapter_practice_units")
      .insert({
        student_app_id: STUDENT_APP_IDS.korean,
        course_chapter_id: courseChapterId,
        source_textbook_chapter_id: context.textbookChapter?.id ?? null,
        version: (latest?.version ?? 0) + 1,
        status: "draft",
        title: `${context.chapter.title}巩固`,
        completion_rule: defaultCompletionRule(requiredCount),
        source_snapshot: sourceSnapshot(context),
      })
      .select("id")
      .single(),
  ) as { id: string };

  const blockResult = await supabase.from("chapter_practice_blocks").insert(
    blocks.map((block) => ({ ...block, practice_unit_id: unit.id })),
  );
  if (blockResult.error) {
    await supabase.from("chapter_practice_units").delete().eq("id", unit.id);
    throw new ChapterPracticeOperationError("创建巩固包内容块失败", [
      blockResult.error.message,
    ]);
  }
  return unit.id;
}

export async function generateChapterPracticeDraft(courseChapterId: string) {
  await requirePlatformOwner();
  return createDraftVersion(createAdminClient(), courseChapterId, false);
}

export async function createNextChapterPracticeVersion(
  courseChapterId: string,
) {
  await requirePlatformOwner();
  return createDraftVersion(createAdminClient(), courseChapterId, true);
}

async function markPublishedUnitNeedsUpdate(
  supabase: SupabaseClient,
  courseChapterId: string,
  context: AuthorityContext,
) {
  const publishedUnit = assertQuery(
    "读取已发布巩固包",
    await supabase
      .from("chapter_practice_units")
      .select("id,source_snapshot")
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("course_chapter_id", courseChapterId)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { id: string; source_snapshot: JsonObject } | null;
  if (!publishedUnit) return "not_published" as const;

  const changed = didChapterPracticeSourcesChange({
    previousSnapshot: objectValue(publishedUnit.source_snapshot),
    currentContentDigest: sourceContentDigest(context),
    currentSourceUpdatedAts: legacySourceUpdatedAts(context),
  });
  if (!changed) return "unchanged" as const;

  assertQuery(
    "标记巩固包需更新",
    await supabase
      .from("chapter_practice_units")
      .update({ status: "needs_update" })
      .eq("id", publishedUnit.id)
      .eq("status", "published")
      .select("id")
      .single(),
  );
  return "marked" as const;
}

export async function markPublishedChapterPracticeNeedsUpdate(
  courseChapterId: string,
) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  const context = await loadAuthorityContext(supabase, courseChapterId);
  return markPublishedUnitNeedsUpdate(supabase, courseChapterId, context);
}

async function resolvePublishedTextbookCourseChapter(
  supabase: SupabaseClient,
  textbookChapterId: string,
) {
  const textbookChapter = assertQuery(
    "读取已发布教材章节",
    await supabase
      .from("digital_textbook_chapters")
      .select("id,version_id,chapter_test_id,slug")
      .eq("id", textbookChapterId)
      .eq("status", "published")
      .maybeSingle(),
  ) as {
    id: string;
    version_id: string;
    chapter_test_id: string | null;
    slug: string;
  } | null;
  if (!textbookChapter) {
    throw new ChapterPracticeOperationError("已发布教材章节不存在");
  }

  const version = assertQuery(
    "读取教材版本",
    await supabase
      .from("digital_textbook_versions")
      .select("textbook_id")
      .eq("id", textbookChapter.version_id)
      .maybeSingle(),
  ) as { textbook_id: string } | null;
  if (!version) throw new ChapterPracticeOperationError("教材版本不存在");

  const textbook = assertQuery(
    "读取互动教材",
    await supabase
      .from("digital_textbooks")
      .select("lesson_id,student_app_id")
      .eq("id", version.textbook_id)
      .maybeSingle(),
  ) as { lesson_id: string; student_app_id: string } | null;
  if (!textbook || textbook.student_app_id !== STUDENT_APP_IDS.korean) {
    throw new ChapterPracticeOperationError("该教材不属于韩国语应用");
  }

  let chapterQuery = supabase
    .from("course_chapters")
    .select("id")
    .eq("lesson_id", textbook.lesson_id);
  chapterQuery = textbookChapter.chapter_test_id
    ? chapterQuery.eq("chapter_test_id", textbookChapter.chapter_test_id)
    : chapterQuery.eq("slug", textbookChapter.slug);
  const courseChapter = assertQuery(
    "读取关联课程章节",
    await chapterQuery.maybeSingle(),
  ) as { id: string } | null;
  if (!courseChapter) {
    throw new ChapterPracticeOperationError("教材章节尚未关联课程章节");
  }
  return courseChapter.id;
}

export async function synchronizeChapterPracticeAfterTextbookPublish(
  textbookChapterId: string,
) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  const courseChapterId = await resolvePublishedTextbookCourseChapter(
    supabase,
    textbookChapterId,
  );
  // Loading the authority context also verifies the linked chapter test and
  // published specialist-practice sources before either transition.
  const context = await loadAuthorityContext(supabase, courseChapterId);
  const units = (assertQuery(
    "读取章节巩固包",
    await supabase
      .from("chapter_practice_units")
      .select("id")
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("course_chapter_id", courseChapterId)
      .limit(1),
  ) ?? []) as Array<{ id: string }>;

  if (units.length === 0) {
    const unitId = await createDraftVersion(
      supabase,
      courseChapterId,
      false,
      context,
    );
    return { courseChapterId, outcome: "draft_created" as const, unitId };
  }

  const outcome = await markPublishedUnitNeedsUpdate(
    supabase,
    courseChapterId,
    context,
  );
  return { courseChapterId, outcome };
}

export async function getChapterPracticeUnitDetail(
  courseChapterId: string,
): Promise<ChapterPracticeUnitDetail | null> {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  const context = await loadAuthorityContext(supabase, courseChapterId);
  const unit = assertQuery(
    "读取巩固包版本",
    await supabase
      .from("chapter_practice_units")
      .select(
        "id,student_app_id,course_chapter_id,source_textbook_chapter_id,version,status,title,completion_rule,source_snapshot,published_at,updated_at",
      )
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("course_chapter_id", courseChapterId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as {
    id: string;
    student_app_id: string;
    course_chapter_id: string;
    source_textbook_chapter_id: string | null;
    version: number;
    status: ChapterPracticeUnitStatus;
    title: string;
    completion_rule: JsonObject;
    source_snapshot: JsonObject;
    published_at: string | null;
    updated_at: string;
  } | null;
  if (!unit) return null;
  const rows = ((assertQuery(
    "读取巩固包内容块",
    await supabase
      .from("chapter_practice_blocks")
      .select(
        "id,practice_unit_id,block_type,title,instructions,content_payload,source_type,source_id,sort_order,is_required,status",
      )
      .eq("practice_unit_id", unit.id)
      .order("sort_order"),
  ) ?? []) as Array<{
    id: string;
    practice_unit_id: string;
    block_type: ChapterPracticeBlockType;
    title: string;
    instructions: string;
    content_payload: JsonObject;
    source_type: string | null;
    source_id: string | null;
    sort_order: number;
    is_required: boolean;
    status: ChapterPracticeUnitStatus;
  }>);

  const blocks: ChapterPracticeBlock[] = rows.map((block) => ({
    id: block.id,
    practiceUnitId: block.practice_unit_id,
    blockType: block.block_type,
    title: block.title,
    instructions: block.instructions,
    contentPayload: objectValue(block.content_payload),
    sourceType: block.source_type,
    sourceId: block.source_id,
    sortOrder: block.sort_order,
    isRequired: block.is_required,
    status: block.status,
    missingReasons:
      block.block_type === "listening" &&
      textValue(objectValue(block.content_payload).audioStatus) === "missing"
        ? ["当前听力来源没有可用音频，请补齐来源或停用该内容块。"]
        : [],
  }));
  return {
    id: unit.id,
    studentAppId: unit.student_app_id,
    courseChapterId: unit.course_chapter_id,
    sourceTextbookChapterId: unit.source_textbook_chapter_id,
    version: unit.version,
    status: unit.status,
    title: unit.title,
    completionRule: parseCompletionRule(unit.completion_rule),
    sourceSnapshot: objectValue(unit.source_snapshot),
    publishedAt: unit.published_at,
    updatedAt: unit.updated_at,
    courseTitle: context.course.title,
    lessonTitle: context.lesson.title,
    chapterTitle: context.chapter.title,
    blocks,
  };
}

export async function updateChapterPracticeUnit(input: {
  unitId: string;
  title: string;
  completionRule: ChapterPracticeCompletionRule;
}) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  await requireEditableUnit(supabase, input.unitId);
  const title = input.title.trim();
  if (!title) throw new ChapterPracticeOperationError("巩固包标题不能为空");
  assertQuery(
    "保存巩固包设置",
    await supabase
      .from("chapter_practice_units")
      .update({ title, completion_rule: input.completionRule })
      .eq("id", input.unitId)
      .select("id")
      .single(),
  );
}

export async function updateChapterPracticeBlock(input: {
  unitId: string;
  blockId: string;
  title: string;
  instructions: string;
  enabled: boolean;
  isRequired: boolean;
}) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  await requireEditableUnit(supabase, input.unitId);
  const title = input.title.trim();
  const instructions = input.instructions.trim();
  if (!title) throw new ChapterPracticeOperationError("内容块标题不能为空");
  assertQuery(
    "保存内容块",
    await supabase
      .from("chapter_practice_blocks")
      .update({
        title,
        instructions,
        is_required: input.isRequired,
        status: input.enabled ? "draft" : "disabled",
      })
      .eq("id", input.blockId)
      .eq("practice_unit_id", input.unitId)
      .select("id")
      .single(),
  );
}

export async function moveChapterPracticeBlock(input: {
  unitId: string;
  blockId: string;
  direction: "up" | "down";
}) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  await requireEditableUnit(supabase, input.unitId);
  const blocks = ((assertQuery(
    "读取内容块顺序",
    await supabase
      .from("chapter_practice_blocks")
      .select("id,sort_order")
      .eq("practice_unit_id", input.unitId)
      .order("sort_order"),
  ) ?? []) as Array<{ id: string; sort_order: number }>);
  const index = blocks.findIndex((block) => block.id === input.blockId);
  const targetIndex = input.direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= blocks.length) return;
  const current = blocks[index];
  const target = blocks[targetIndex];
  const used = new Set(blocks.map((block) => block.sort_order));
  let temporaryOrder = 100000;
  while (used.has(temporaryOrder) && temporaryOrder > 0) temporaryOrder -= 1;
  const first = await supabase
    .from("chapter_practice_blocks")
    .update({ sort_order: temporaryOrder })
    .eq("id", current.id);
  if (first.error) throw new ChapterPracticeOperationError("调整内容块顺序失败", [first.error.message]);
  const second = await supabase
    .from("chapter_practice_blocks")
    .update({ sort_order: current.sort_order })
    .eq("id", target.id);
  if (second.error) {
    await supabase
      .from("chapter_practice_blocks")
      .update({ sort_order: current.sort_order })
      .eq("id", current.id);
    throw new ChapterPracticeOperationError("调整内容块顺序失败", [second.error.message]);
  }
  const third = await supabase
    .from("chapter_practice_blocks")
    .update({ sort_order: target.sort_order })
    .eq("id", current.id);
  if (third.error) {
    await supabase
      .from("chapter_practice_blocks")
      .update({ sort_order: temporaryOrder })
      .eq("id", target.id);
    await supabase
      .from("chapter_practice_blocks")
      .update({ sort_order: current.sort_order })
      .eq("id", current.id);
    await supabase
      .from("chapter_practice_blocks")
      .update({ sort_order: target.sort_order })
      .eq("id", target.id);
    throw new ChapterPracticeOperationError("调整内容块顺序失败", [third.error.message]);
  }
}

function exerciseJudgementValid(
  context: AuthorityContext,
  exerciseId: string,
) {
  const summary = objectiveConfigurationSummary(context, exerciseId);
  return summary.objectiveQuestionCount === summary.configuredObjectiveQuestionCount;
}

function textbookJudgementValid(context: AuthorityContext, sourceId: string) {
  const moduleNodeIds = new Set(
    context.nodes
      .filter((node) => node.module_id === sourceId)
      .map((node) => node.id),
  );
  const objectiveTypes = new Set([
    "single_choice",
    "multiple_choice",
    "fill_blank",
    "ordering",
    "listening",
  ]);
  const objectiveActivities = context.activities.filter(
    (activity) =>
      moduleNodeIds.has(activity.node_id) &&
      objectiveTypes.has(activity.activity_type),
  );
  const secretByActivity = new Map(
    context.activitySecrets.map((secret) => [secret.activity_id, secret]),
  );
  return objectiveActivities.every(
    (activity) =>
      Object.keys(objectValue(secretByActivity.get(activity.id)?.answer_key)).length > 0,
  );
}

async function inspectUnit(
  supabase: SupabaseClient,
  unitId: string,
): Promise<ChapterPracticePublishInspection> {
  const unit = assertQuery(
    "读取待发布巩固包",
    await supabase
      .from("chapter_practice_units")
      .select("id,course_chapter_id,title,completion_rule,status,published_at")
      .eq("id", unitId)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
  ) as {
    id: string;
    course_chapter_id: string;
    title: string;
    completion_rule: JsonObject;
    status: ChapterPracticeUnitStatus;
    published_at: string | null;
  } | null;
  if (!unit) throw new ChapterPracticeOperationError("巩固包不存在");
  const context = await loadAuthorityContext(supabase, unit.course_chapter_id);
  const blocks = ((assertQuery(
    "读取待发布内容块",
    await supabase
      .from("chapter_practice_blocks")
      .select(
        "id,block_type,title,instructions,content_payload,source_type,source_id,sort_order,is_required,status",
      )
      .eq("practice_unit_id", unit.id),
  ) ?? []) as Array<{
    id: string;
    block_type: ChapterPracticeBlockType;
    title: string;
    instructions: string;
    content_payload: JsonObject;
    source_type: string | null;
    source_id: string | null;
    sort_order: number;
    is_required: boolean;
    status: ChapterPracticeUnitStatus;
  }>);

  const validSources = new Map<string, Set<string>>([
    ["course_chapter", new Set([context.chapter.id])],
    ["lesson", new Set([context.lesson.id])],
    ["digital_textbook_module", new Set(context.modules.map((item) => item.id))],
    ["digital_textbook_activity", new Set(context.activities.map((item) => item.id))],
    [
      "growth_toolbox_exercise",
      new Set(context.exercises.map((item) => item.id)),
    ],
    [
      "chapter_test",
      new Set(
        context.chapterTest?.status === "published"
          ? [context.chapterTest.id]
          : [],
      ),
    ],
    [
      "chapter_homework_plan",
      new Set(
        context.homework?.status === "published" ? [context.homework.id] : [],
      ),
    ],
  ]);

  return inspectChapterPracticePublication({
    hierarchyPublished:
      context.course.is_published &&
      context.lesson.is_published &&
      context.chapter.is_published,
    unitTitle: unit.title,
    completionRule: parseCompletionRule(unit.completion_rule),
    blocks: blocks.map((block) => {
      const sourceValid = Boolean(
        block.source_type &&
          block.source_id &&
          validSources.get(block.source_type)?.has(block.source_id),
      );
      let objectiveJudgementValid = true;
      if (block.source_type === "growth_toolbox_exercise" && block.source_id) {
        objectiveJudgementValid = exerciseJudgementValid(context, block.source_id);
      } else if (
        block.source_type === "digital_textbook_module" &&
        block.source_id
      ) {
        objectiveJudgementValid = textbookJudgementValid(context, block.source_id);
      } else if (block.source_type === "chapter_test") {
        objectiveJudgementValid =
          context.chapterTestQuestions.length > 0 &&
          context.chapterTestQuestions.every(
            (question) =>
              question.status === "published" && question.correct_option !== null,
          );
      }
      return {
        id: block.id,
        blockType: block.block_type,
        title: block.title,
        instructions: block.instructions,
        sortOrder: block.sort_order,
        isRequired: block.is_required,
        enabled: block.status !== "disabled",
        sourceValid,
        objectiveJudgementValid,
        referenceValid: sourceValid,
        audioStatus:
          block.block_type === "listening"
            ? textValue(objectValue(block.content_payload).audioStatus) || null
            : null,
      };
    }),
  });
}

export async function inspectChapterPracticeUnit(
  unitId: string,
): Promise<ChapterPracticePublishInspection> {
  await requirePlatformOwner();
  return inspectUnit(createAdminClient(), unitId);
}

export async function submitChapterPracticeForReview(unitId: string) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  await requireEditableUnit(supabase, unitId);
  const inspection = await inspectUnit(supabase, unitId);
  if (!inspection.passed) {
    throw new ChapterPracticeOperationError(
      "发布前检查未通过",
      inspection.checks.flatMap((item) => item.reasons),
    );
  }
  const blocks = await supabase
    .from("chapter_practice_blocks")
    .update({ status: "pending_review" })
    .eq("practice_unit_id", unitId)
    .neq("status", "disabled");
  if (blocks.error) throw new ChapterPracticeOperationError("提交检查失败", [blocks.error.message]);
  const unit = await supabase
    .from("chapter_practice_units")
    .update({ status: "pending_review" })
    .eq("id", unitId);
  if (unit.error) {
    await supabase
      .from("chapter_practice_blocks")
      .update({ status: "draft" })
      .eq("practice_unit_id", unitId)
      .eq("status", "pending_review");
    throw new ChapterPracticeOperationError("提交检查失败", [unit.error.message]);
  }
}

export async function returnChapterPracticeToDraft(unitId: string) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  const unit = assertQuery(
    "读取巩固包",
    await supabase
      .from("chapter_practice_units")
      .select("id,status,published_at")
      .eq("id", unitId)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
  ) as { id: string; status: string; published_at: string | null } | null;
  if (!unit || unit.published_at || unit.status !== "pending_review") {
    throw new ChapterPracticeOperationError("只有待检查版本可以退回草稿");
  }
  const blockResult = await supabase
    .from("chapter_practice_blocks")
    .update({ status: "draft" })
    .eq("practice_unit_id", unitId)
    .eq("status", "pending_review");
  if (blockResult.error) {
    throw new ChapterPracticeOperationError("退回内容块失败", [blockResult.error.message]);
  }
  const unitResult = await supabase
    .from("chapter_practice_units")
    .update({ status: "draft" })
    .eq("id", unitId)
    .select("id")
    .single();
  if (unitResult.error) {
    await supabase
      .from("chapter_practice_blocks")
      .update({ status: "pending_review" })
      .eq("practice_unit_id", unitId)
      .eq("status", "draft");
    throw new ChapterPracticeOperationError("退回草稿失败", [unitResult.error.message]);
  }
}

export async function publishChapterPracticeUnit(unitId: string) {
  await requirePlatformOwner();
  const supabase = createAdminClient();
  const unitBefore = assertQuery(
    "读取待发布巩固包",
    await supabase
      .from("chapter_practice_units")
      .select("id,status,published_at")
      .eq("id", unitId)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
  ) as { id: string; status: string; published_at: string | null } | null;
  if (!unitBefore || unitBefore.published_at || unitBefore.status !== "pending_review") {
    throw new ChapterPracticeOperationError("只有待检查版本可以发布");
  }
  const inspection = await inspectUnit(supabase, unitId);
  if (!inspection.passed) {
    throw new ChapterPracticeOperationError(
      "发布前检查未通过",
      inspection.checks.flatMap((item) => item.reasons),
    );
  }
  const blockResult = await supabase
    .from("chapter_practice_blocks")
    .update({ status: "published" })
    .eq("practice_unit_id", unitId)
    .eq("status", "pending_review");
  if (blockResult.error) {
    throw new ChapterPracticeOperationError("发布内容块失败", [blockResult.error.message]);
  }
  const publishedAt = new Date().toISOString();
  const unitResult = await supabase
    .from("chapter_practice_units")
    .update({ status: "published", published_at: publishedAt })
    .eq("id", unitId)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();
  if (unitResult.error || !unitResult.data) {
    await supabase
      .from("chapter_practice_blocks")
      .update({ status: "pending_review" })
      .eq("practice_unit_id", unitId)
      .eq("status", "published");
    throw new ChapterPracticeOperationError("发布巩固包失败", [
      unitResult.error?.message ?? "版本状态已经变化，请刷新后重试。",
    ]);
  }
  return publishedAt;
}

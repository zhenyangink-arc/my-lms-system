import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STUDENT_APP_IDS } from "@/lib/student-apps";
import {
  calculateStudentPracticeProgress,
  emptyStudentPracticeProgress,
  mergeProgressSnapshots,
} from "./progress-model";
import type {
  PublishedChapterPracticeBlock,
  StudentChapterPracticeProgress,
} from "./types";

type ProgressRow = {
  practice_unit_id: string;
  status: string;
  progress_percent: number | string;
  mastery_percent: number | string;
  completed_block_ids: string[] | null;
  last_block_id: string | null;
  correct_count: number;
  attempt_count: number;
  started_at: string | null;
  last_practiced_at: string | null;
  completed_at: string | null;
};

export type StudentPracticeProgressMutation = {
  kind:
    | "complete_block"
    | "self_check"
    | "listening_attempt"
    | "listening_play"
    | "interaction_complete"
    | "cache_merge"
    | "legacy_import"
    | "recalculate";
  blockId?: string;
  correctCount?: number;
  attemptCount?: number;
  reviewTopics?: string[];
  snapshot?: StudentChapterPracticeProgress;
};

function progressDto(row: ProgressRow): StudentChapterPracticeProgress {
  const status = [
    "not_started",
    "in_progress",
    "needs_reinforcement",
    "mastered",
  ].includes(row.status)
    ? (row.status as StudentChapterPracticeProgress["status"])
    : "not_started";
  return {
    practiceUnitId: row.practice_unit_id,
    status,
    progressPercent: Number(row.progress_percent) || 0,
    masteryPercent: Number(row.mastery_percent) || 0,
    completedBlockIds: Array.isArray(row.completed_block_ids)
      ? row.completed_block_ids.map(String)
      : [],
    lastBlockId: row.last_block_id,
    correctCount: Math.max(0, Number(row.correct_count) || 0),
    attemptCount: Math.max(0, Number(row.attempt_count) || 0),
    startedAt: row.started_at,
    lastPracticedAt: row.last_practiced_at,
    completedAt: row.completed_at,
  };
}

async function loadChapterTestEvidence({
  supabase,
  courseChapterId,
  studentId,
}: {
  supabase: SupabaseClient;
  courseChapterId: string;
  studentId: string;
}) {
  const { data: chapter, error: chapterError } = await supabase
    .from("course_chapters")
    .select("chapter_test_id,slug")
    .eq("id", courseChapterId)
    .single();
  if (chapterError || !chapter) {
    throw new Error("章节测试关联读取失败", { cause: chapterError });
  }
  const chapterTestAvailable = Boolean(chapter.chapter_test_id);
  if (!chapterTestAvailable) {
    return { chapterTestAvailable: false, chapterTestPassed: false };
  }
  const { data: attempts, error: attemptError } = await supabase
    .from("chapter_test_attempts")
    .select("test_id,test_slug,passed")
    .eq("student_id", studentId);
  if (attemptError) {
    throw new Error("章节测试结果读取失败", { cause: attemptError });
  }
  return {
    chapterTestAvailable,
    chapterTestPassed: (attempts ?? []).some(
      (attempt) =>
        Boolean(attempt.passed) &&
        (attempt.test_id === chapter.chapter_test_id ||
          attempt.test_slug === chapter.slug),
    ),
  };
}

export async function loadStudentChapterPracticeProgress({
  supabase,
  studentId,
  practiceUnitId,
}: {
  supabase: SupabaseClient;
  studentId: string;
  practiceUnitId: string;
}) {
  const { data, error } = await supabase
    .from("student_chapter_practice_progress")
    .select(
      "practice_unit_id,status,progress_percent,mastery_percent,completed_block_ids,last_block_id,correct_count,attempt_count,started_at,last_practiced_at,completed_at",
    )
    .eq("student_id", studentId)
    .eq("practice_unit_id", practiceUnitId)
    .maybeSingle();
  if (error) throw new Error("章节巩固进度读取失败", { cause: error });
  return data ? progressDto(data as ProgressRow) : null;
}

export async function recordStudentChapterPracticeProgress({
  supabase,
  tenantId,
  studentId,
  practiceUnitId,
  mutation,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  practiceUnitId: string;
  mutation: StudentPracticeProgressMutation;
}): Promise<StudentChapterPracticeProgress> {
  const [{ data: unit, error: unitError }, current] = await Promise.all([
    supabase
      .from("chapter_practice_units")
      .select("id,course_chapter_id,completion_rule")
      .eq("id", practiceUnitId)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("status", "published")
      .maybeSingle(),
    loadStudentChapterPracticeProgress({
      supabase,
      studentId,
      practiceUnitId,
    }),
  ]);
  if (unitError || !unit) {
    throw new Error("当前章节巩固版本未发布或已更新", { cause: unitError });
  }
  if (mutation.kind === "legacy_import" && current) return current;

  const { data: blockRows, error: blockError } = await supabase
    .from("chapter_practice_blocks")
    .select(
      "id,practice_unit_id,block_type,title,instructions,content_payload,source_type,source_id,sort_order,is_required",
    )
    .eq("practice_unit_id", practiceUnitId)
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (blockError) throw new Error("章节巩固内容读取失败", { cause: blockError });
  const blocks = (blockRows ?? []).map(
    (block) =>
      ({
        id: String(block.id),
        practiceUnitId: String(block.practice_unit_id),
        blockType: String(block.block_type),
        title: String(block.title),
        instructions: String(block.instructions),
        contentPayload:
          block.content_payload && typeof block.content_payload === "object"
            ? (block.content_payload as Record<string, unknown>)
            : {},
        sourceType: block.source_type ? String(block.source_type) : null,
        sourceId: block.source_id ? String(block.source_id) : null,
        sortOrder: Number(block.sort_order) || 0,
        isRequired: Boolean(block.is_required),
      }) satisfies PublishedChapterPracticeBlock,
  );
  const block = mutation.blockId
    ? blocks.find((item) => item.id === mutation.blockId)
    : null;
  if (mutation.blockId && !block) {
    throw new Error("学习内容已更新，请刷新后重试");
  }
  if (
    mutation.kind === "self_check" &&
    block?.blockType !== "self_check"
  ) {
    throw new Error("自我检测内容无效");
  }
  if (
    (mutation.kind === "listening_attempt" ||
      mutation.kind === "listening_play") &&
    block?.blockType !== "listening"
  ) {
    throw new Error("听力内容无效");
  }
  if (
    mutation.kind === "interaction_complete" &&
    block?.blockType !== "interaction"
  ) {
    throw new Error("字母互动内容无效");
  }

  const now = new Date().toISOString();
  let facts = current ?? emptyStudentPracticeProgress(practiceUnitId);
  if (mutation.kind === "cache_merge" || mutation.kind === "legacy_import") {
    if (!mutation.snapshot || mutation.snapshot.practiceUnitId !== practiceUnitId) {
      throw new Error("本地进度缓存无效");
    }
    facts = mergeProgressSnapshots({ server: current, local: mutation.snapshot });
    if (facts === current) return current;
  } else if (mutation.kind !== "recalculate") {
    const completedBlockIds = new Set(facts.completedBlockIds);
    if (
      block &&
      [
        "complete_block",
        "self_check",
        "interaction_complete",
      ].includes(mutation.kind)
    ) {
      completedBlockIds.add(block.id);
    }
    const attemptDelta = Math.max(0, Math.trunc(mutation.attemptCount ?? 0));
    const correctDelta = Math.max(0, Math.trunc(mutation.correctCount ?? 0));
    if (correctDelta > attemptDelta || attemptDelta > 100) {
      throw new Error("练习结果无效");
    }
    facts = {
      ...facts,
      completedBlockIds: [...completedBlockIds],
      lastBlockId: block?.id ?? facts.lastBlockId,
      correctCount: facts.correctCount + correctDelta,
      attemptCount: facts.attemptCount + attemptDelta,
      startedAt: facts.startedAt ?? now,
      lastPracticedAt: now,
    };
  }

  const evidence = await loadChapterTestEvidence({
    supabase,
    courseChapterId: String(unit.course_chapter_id),
    studentId,
  });
  let calculated = calculateStudentPracticeProgress({
    facts,
    blocks,
    completionRule:
      unit.completion_rule && typeof unit.completion_rule === "object"
        ? (unit.completion_rule as Record<string, unknown>)
        : {},
    ...evidence,
  });
  if (calculated.progressPercent >= 100 && !calculated.completedAt) {
    calculated = { ...calculated, completedAt: now };
  }
  const { data: saved, error: saveError } = await supabase
    .from("student_chapter_practice_progress")
    .upsert(
      {
        tenant_id: tenantId,
        student_id: studentId,
        practice_unit_id: practiceUnitId,
        status: calculated.status,
        progress_percent: calculated.progressPercent,
        mastery_percent: calculated.masteryPercent,
        completed_block_ids: calculated.completedBlockIds,
        last_block_id: calculated.lastBlockId,
        correct_count: calculated.correctCount,
        attempt_count: calculated.attemptCount,
        started_at: calculated.startedAt ?? now,
        last_practiced_at: calculated.lastPracticedAt ?? now,
        completed_at: calculated.completedAt,
      },
      { onConflict: "tenant_id,student_id,practice_unit_id" },
    )
    .select(
      "practice_unit_id,status,progress_percent,mastery_percent,completed_block_ids,last_block_id,correct_count,attempt_count,started_at,last_practiced_at,completed_at",
    )
    .single();
  if (saveError || !saved) {
    throw new Error("章节巩固进度保存失败", { cause: saveError });
  }
  if (
    mutation.kind === "self_check" &&
    block &&
    mutation.reviewTopics?.length
  ) {
    try {
      const { error: reviewError } = await supabase.rpc(
        "record_student_practice_self_check_review",
        {
          p_practice_unit_id: practiceUnitId,
          p_block_id: block.id,
          p_review_topics: mutation.reviewTopics,
        },
      );
      if (reviewError) {
        console.warn("巩固自测已保存，但错题归集失败", reviewError.message);
      }
    } catch (reviewError) {
      console.warn("巩固自测已保存，但错题归集失败", reviewError);
    }
  }
  return progressDto(saved as ProgressRow);
}

export async function refreshStudentPracticeProgressForChapterTest({
  supabase,
  tenantId,
  studentId,
  testSlug,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  testSlug: string;
}) {
  const { data: test, error: testError } = await supabase
    .from("chapter_tests")
    .select("id")
    .eq("slug", testSlug)
    .maybeSingle();
  if (testError || !test) return;
  const { data: chapters, error: chapterError } = await supabase
    .from("course_chapters")
    .select("id")
    .eq("chapter_test_id", test.id);
  if (chapterError || !chapters?.length) return;
  const { data: units, error: unitError } = await supabase
    .from("chapter_practice_units")
    .select("id")
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("status", "published")
    .in(
      "course_chapter_id",
      chapters.map((chapter) => chapter.id),
    );
  if (unitError || !units?.length) return;
  for (const unit of units) {
    const current = await loadStudentChapterPracticeProgress({
      supabase,
      studentId,
      practiceUnitId: unit.id,
    });
    if (!current) continue;
    await recordStudentChapterPracticeProgress({
      supabase,
      tenantId,
      studentId,
      practiceUnitId: unit.id,
      mutation: { kind: "recalculate" },
    });
  }
}

"use server";

import { z } from "zod";

import { requireActiveUser } from "@/lib/auth";
import { recordStudentChapterPracticeProgress } from "./student/progress-service";
import type { StudentChapterPracticeProgress } from "./student/types";

const progressSnapshotSchema = z.object({
  practiceUnitId: z.uuid(),
  status: z.enum([
    "not_started",
    "in_progress",
    "needs_reinforcement",
    "mastered",
  ]),
  progressPercent: z.number().min(0).max(100),
  masteryPercent: z.number().min(0).max(100),
  completedBlockIds: z.array(z.uuid()).max(100),
  lastBlockId: z.uuid().nullable(),
  correctCount: z.number().int().min(0).max(1_000_000),
  attemptCount: z.number().int().min(0).max(1_000_000),
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  lastPracticedAt: z.iso.datetime({ offset: true }).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
});

const mutationSchema = z.object({
  practiceUnitId: z.uuid(),
  kind: z.enum([
    "complete_block",
    "self_check",
    "listening_attempt",
    "listening_play",
    "interaction_complete",
    "cache_merge",
    "legacy_import",
  ]),
  blockId: z.uuid().optional(),
  correctCount: z.number().int().min(0).max(100).optional(),
  attemptCount: z.number().int().min(0).max(100).optional(),
  reviewTopics: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  snapshot: progressSnapshotSchema.optional(),
});

export type StudentPracticeProgressActionResult =
  | { ok: true; progress: StudentChapterPracticeProgress }
  | { ok: false; message: string };

export async function updateStudentChapterPracticeProgressAction(
  input: unknown,
): Promise<StudentPracticeProgressActionResult> {
  const parsed = mutationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "学习进度内容无效，请刷新后重试。" };
  }
  const { supabase, tenant, profile, user } = await requireActiveUser();
  if (!tenant?.id || profile?.role !== "student") {
    return { ok: false, message: "只有当前机构的学生账号可以保存学习进度。" };
  }
  try {
    const progress = await recordStudentChapterPracticeProgress({
      supabase,
      tenantId: tenant.id,
      studentId: user.id,
      practiceUnitId: parsed.data.practiceUnitId,
      mutation: parsed.data,
    });
    return { ok: true, progress };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "学习进度保存失败，已保留在本机等待重试。",
    };
  }
}

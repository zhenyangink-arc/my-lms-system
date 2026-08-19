"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ChapterPracticeOperationError,
  createNextChapterPracticeVersion,
  generateChapterPracticeDraft,
  moveChapterPracticeBlock,
  publishChapterPracticeUnit,
  returnChapterPracticeToDraft,
  submitChapterPracticeForReview,
  updateChapterPracticeBlock,
  updateChapterPracticeUnit,
} from "./api/management-service";

export type ChapterPracticeActionState = {
  ok: boolean;
  message: string;
  reasons: string[];
  unitId?: string;
  completedAt?: number;
};

export const INITIAL_CHAPTER_PRACTICE_ACTION_STATE: ChapterPracticeActionState = {
  ok: false,
  message: "",
  reasons: [],
};

const contextSchema = z.object({
  space: z.string().regex(/^[a-z0-9-]{1,80}$/),
  appSlug: z.literal("korean"),
});
const chapterSchema = contextSchema.extend({
  courseChapterId: z.uuid(),
});
const unitSchema = contextSchema.extend({ unitId: z.uuid() });

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function refreshPaths(space: string, courseChapterId?: string) {
  const base = `/${space}/dashboard/admin/apps/korean/practice-center`;
  revalidatePath(base);
  if (courseChapterId) revalidatePath(`${base}/${courseChapterId}`);
}

function failure(error: unknown): ChapterPracticeActionState {
  if (error instanceof ChapterPracticeOperationError) {
    return {
      ok: false,
      message: error.message,
      reasons: error.reasons,
      completedAt: Date.now(),
    };
  }
  return {
    ok: false,
    message: "操作失败，请刷新后重试。",
    reasons: [error instanceof Error ? error.message : String(error)],
    completedAt: Date.now(),
  };
}

export async function generateChapterPracticeAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
): Promise<ChapterPracticeActionState> {
  const parsed = chapterSchema.safeParse(values(formData));
  if (!parsed.success) return { ...failure(new Error("请求参数无效")), reasons: [] };
  try {
    const unitId = await generateChapterPracticeDraft(parsed.data.courseChapterId);
    refreshPaths(parsed.data.space, parsed.data.courseChapterId);
    return {
      ok: true,
      message: "巩固包草稿已生成。",
      reasons: [],
      unitId,
      completedAt: Date.now(),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function createNextChapterPracticeVersionAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
): Promise<ChapterPracticeActionState> {
  const parsed = chapterSchema.safeParse(values(formData));
  if (!parsed.success) return { ...failure(new Error("请求参数无效")), reasons: [] };
  try {
    const unitId = await createNextChapterPracticeVersion(
      parsed.data.courseChapterId,
    );
    refreshPaths(parsed.data.space, parsed.data.courseChapterId);
    return {
      ok: true,
      message: "新版本草稿已创建。",
      reasons: [],
      unitId,
      completedAt: Date.now(),
    };
  } catch (error) {
    return failure(error);
  }
}

const unitSettingsSchema = unitSchema.extend({
  courseChapterId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  minimumRequiredBlocks: z.coerce.number().int().min(1).max(100),
  requireSelfCheck: z.enum(["true", "false"]),
  minimumAccuracyPercent: z.coerce.number().min(0).max(100),
});

export async function saveChapterPracticeUnitAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
): Promise<ChapterPracticeActionState> {
  const parsed = unitSettingsSchema.safeParse(values(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "巩固包设置不完整。",
      reasons: parsed.error.issues.map((issue) => issue.message),
      completedAt: Date.now(),
    };
  }
  try {
    await updateChapterPracticeUnit({
      unitId: parsed.data.unitId,
      title: parsed.data.title,
      completionRule: {
        mode: "required_blocks",
        minimumRequiredBlocks: parsed.data.minimumRequiredBlocks,
        requireSelfCheck: parsed.data.requireSelfCheck === "true",
        minimumAccuracyPercent: parsed.data.minimumAccuracyPercent,
      },
    });
    refreshPaths(parsed.data.space, parsed.data.courseChapterId);
    return {
      ok: true,
      message: "巩固包设置已保存。",
      reasons: [],
      completedAt: Date.now(),
    };
  } catch (error) {
    return failure(error);
  }
}

const blockSchema = unitSchema.extend({
  courseChapterId: z.uuid(),
  blockId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(4000),
  enabled: z.enum(["true", "false"]),
  isRequired: z.enum(["true", "false"]),
});

export async function saveChapterPracticeBlockAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
): Promise<ChapterPracticeActionState> {
  const parsed = blockSchema.safeParse(values(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "内容块设置不完整。",
      reasons: parsed.error.issues.map((issue) => issue.message),
      completedAt: Date.now(),
    };
  }
  try {
    await updateChapterPracticeBlock({
      unitId: parsed.data.unitId,
      blockId: parsed.data.blockId,
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      enabled: parsed.data.enabled === "true",
      isRequired: parsed.data.isRequired === "true",
    });
    refreshPaths(parsed.data.space, parsed.data.courseChapterId);
    return {
      ok: true,
      message: "内容块已保存。",
      reasons: [],
      completedAt: Date.now(),
    };
  } catch (error) {
    return failure(error);
  }
}

const moveSchema = unitSchema.extend({
  courseChapterId: z.uuid(),
  blockId: z.uuid(),
  direction: z.enum(["up", "down"]),
});

export async function moveChapterPracticeBlockAction(formData: FormData) {
  const parsed = moveSchema.safeParse(values(formData));
  if (!parsed.success) throw new ChapterPracticeOperationError("排序请求无效");
  await moveChapterPracticeBlock({
    unitId: parsed.data.unitId,
    blockId: parsed.data.blockId,
    direction: parsed.data.direction,
  });
  refreshPaths(parsed.data.space, parsed.data.courseChapterId);
}

async function runUnitTransition(
  formData: FormData,
  operation: (unitId: string) => Promise<unknown>,
  successMessage: string,
): Promise<ChapterPracticeActionState> {
  const parsed = unitSchema
    .extend({ courseChapterId: z.uuid() })
    .safeParse(values(formData));
  if (!parsed.success) return { ...failure(new Error("请求参数无效")), reasons: [] };
  try {
    await operation(parsed.data.unitId);
    refreshPaths(parsed.data.space, parsed.data.courseChapterId);
    return {
      ok: true,
      message: successMessage,
      reasons: [],
      completedAt: Date.now(),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function submitChapterPracticeForReviewAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
) {
  return runUnitTransition(
    formData,
    submitChapterPracticeForReview,
    "发布前检查已通过，版本已进入待检查状态。",
  );
}

export async function returnChapterPracticeToDraftAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
) {
  return runUnitTransition(
    formData,
    returnChapterPracticeToDraft,
    "版本已退回草稿，可以继续编辑。",
  );
}

export async function publishChapterPracticeAction(
  _state: ChapterPracticeActionState,
  formData: FormData,
) {
  return runUnitTransition(
    formData,
    publishChapterPracticeUnit,
    "新版本已发布，已发布内容将保持不可变。",
  );
}

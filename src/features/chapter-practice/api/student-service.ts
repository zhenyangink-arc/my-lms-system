import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STUDENT_APP_IDS } from "@/lib/student-apps";
import type {
  PublishedChapterPracticeBlock,
  PublishedChapterPracticeUnit,
} from "../student/types";

type QueryError = { message: string } | null;

function throwIfError(label: string, error: QueryError) {
  if (error) {
    throw new Error(`章节巩固详情的${label}读取失败`, { cause: error });
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 学生端只消费最新的已发布版本。草稿、待检查、已停用和需更新版本都不会
 * 进入详情页；内容块也必须随所属版本一起处于 published 状态。
 */
export async function loadPublishedChapterPracticeUnit({
  supabase,
  courseChapterId,
}: {
  supabase: SupabaseClient;
  courseChapterId: string;
}): Promise<PublishedChapterPracticeUnit | null> {
  const unitResult = await supabase
    .from("chapter_practice_units")
    .select(
      "id,course_chapter_id,version,title,completion_rule,published_at",
    )
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("course_chapter_id", courseChapterId)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError("已发布版本", unitResult.error);

  if (!unitResult.data) return null;
  const unit = unitResult.data as {
    id: string;
    course_chapter_id: string;
    version: number;
    title: string;
    completion_rule: unknown;
    published_at: string;
  };

  const blockResult = await supabase
    .from("chapter_practice_blocks")
    .select(
      "id,practice_unit_id,block_type,title,instructions,content_payload,source_type,source_id,sort_order,is_required",
    )
    .eq("practice_unit_id", unit.id)
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  throwIfError("已发布内容块", blockResult.error);

  const blocks = (blockResult.data ?? []).map((row) => {
    const block = row as {
      id: string;
      practice_unit_id: string;
      block_type: string;
      title: string;
      instructions: string;
      content_payload: unknown;
      source_type: string | null;
      source_id: string | null;
      sort_order: number;
      is_required: boolean;
    };
    return {
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
    } satisfies PublishedChapterPracticeBlock;
  });

  return {
    id: unit.id,
    courseChapterId: unit.course_chapter_id,
    version: unit.version,
    title: unit.title,
    completionRule: objectValue(unit.completion_rule),
    publishedAt: unit.published_at,
    blocks,
  };
}

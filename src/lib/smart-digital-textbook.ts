import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SmartLocale = "zh-CN" | "ko-KR";
export type SmartSupportMode = "chinese" | "bilingual" | "immersion";
export type SmartAccent = "jade" | "iris" | "coral" | "sky";
export type SmartActivityType =
  | "single_choice"
  | "multiple_choice"
  | "fill_blank"
  | "ordering"
  | "listening"
  | "speaking"
  | "writing"
  | "self_check";

export type LocalizedText = Record<SmartLocale, string>;

export type SmartTextbookActivity = {
  id: string;
  key: string;
  type: SmartActivityType;
  completed: boolean;
  prompt: LocalizedText;
  instruction: LocalizedText;
  options: string[];
  config: Record<string, unknown>;
};

export type SmartTextbookMediaAsset = {
  id: string;
  key: string;
  type: "image" | "audio";
  purpose: string;
  status: "pending" | "ready" | "rejected";
  altText: LocalizedText;
  metadata: Record<string, unknown>;
};

export type SmartTextbookNode = {
  id: string;
  code: string;
  type: "learn" | "practice" | "mission" | "review";
  minutes: number;
  title: LocalizedText;
  content: Record<string, unknown>;
  media: SmartTextbookMediaAsset[];
  activities: SmartTextbookActivity[];
};

export type SmartTextbookModule = {
  id: string;
  code: string;
  order: number;
  accent: SmartAccent;
  title: LocalizedText;
  description: LocalizedText;
  nodes: SmartTextbookNode[];
};

export type SmartTextbookProgress = {
  nodeId: string;
  status: "not_started" | "in_progress" | "completed";
  completionPercent: number;
  masteryScore: number;
  attemptCount: number;
};

export type SmartTextbookData = {
  id: string;
  versionId: string;
  levelCode: string;
  title: LocalizedText;
  chapter: {
    id: string;
    slug: string;
    number: number;
    title: LocalizedText;
    scenario: LocalizedText;
    goal: LocalizedText;
    chapterTestId: string | null;
    chapterTestSlug: string | null;
  };
  modules: SmartTextbookModule[];
  preference: {
    locale: SmartLocale;
    supportMode: SmartSupportMode;
  };
  progress: SmartTextbookProgress[];
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function localized(value: unknown): LocalizedText {
  const record = asObject(value);
  return {
    "zh-CN": String(record["zh-CN"] ?? ""),
    "ko-KR": String(record["ko-KR"] ?? record["zh-CN"] ?? ""),
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export type LoadSmartDigitalTextbookOptions = {
  textbookSlug: string;
  chapterNumber?: number;
  chapterSlug?: string;
  userId: string;
  tenantId: string | null;
  trackingDisabled: boolean;
};

type LoadSmartDigitalChapterProgressOptions = Pick<
  LoadSmartDigitalTextbookOptions,
  "textbookSlug" | "chapterNumber" | "userId" | "tenantId" | "trackingDisabled"
>;

/**
 * 返回某个智能教材章节的持久化完成度。课程目录用它判断无章节测试的
 * `content_viewed` 章节是否已经完成，避免把“看完教材”误当成“通过测试”。
 */
export async function loadSmartDigitalTextbookChapterProgress(
  options: LoadSmartDigitalChapterProgressOptions,
) {
  if (options.trackingDisabled || !options.tenantId) return 0;

  const admin = createAdminClient();
  const { data: textbook } = await admin
    .from("digital_textbooks")
    .select("id")
    .eq("slug", options.textbookSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!textbook) return 0;

  const { data: version } = await admin
    .from("digital_textbook_versions")
    .select("id")
    .eq("textbook_id", textbook.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) return 0;

  const { data: chapter } = await admin
    .from("digital_textbook_chapters")
    .select("id")
    .eq("version_id", version.id)
    .eq("chapter_number", options.chapterNumber ?? 1)
    .eq("status", "published")
    .maybeSingle();
  if (!chapter) return 0;

  const { data: modules } = await admin
    .from("digital_textbook_modules")
    .select("id")
    .eq("chapter_id", chapter.id);
  const moduleIds = (modules ?? []).map((module) => String(module.id));
  if (moduleIds.length === 0) return 0;

  const { data: nodes } = await admin
    .from("digital_textbook_nodes")
    .select("id")
    .in("module_id", moduleIds);
  const nodeIds = (nodes ?? []).map((node) => String(node.id));
  if (nodeIds.length === 0) return 0;

  const { data: progressRows } = await admin
    .from("digital_textbook_node_progress")
    .select("node_id,completion_percent,status")
    .eq("tenant_id", options.tenantId)
    .eq("student_id", options.userId)
    .eq("version_id", version.id)
    .in("node_id", nodeIds);
  const progressByNodeId = new Map(
    (progressRows ?? []).map((row) => [
      String(row.node_id),
      row.status === "completed" ? 100 : Math.max(0, Math.min(100, Number(row.completion_percent) || 0)),
    ]),
  );

  return Math.round(
    nodeIds.reduce((total, nodeId) => total + (progressByNodeId.get(nodeId) ?? 0), 0) /
      nodeIds.length,
  );
}

/**
 * 通用智能教材加载器。新增章节只需发布同一本教材下的章节、模块、节点与活动，
 * 页面层按 chapterNumber 或 chapterSlug 调用，无需复制教材界面。
 */
export async function loadSmartDigitalTextbook(
  options: LoadSmartDigitalTextbookOptions,
): Promise<SmartTextbookData | null> {
  const admin = createAdminClient();

  const { data: textbook, error: textbookError } = await admin
    .from("digital_textbooks")
    .select("id,level_code,title")
    .eq("slug", options.textbookSlug)
    .eq("status", "published")
    .maybeSingle();

  if (textbookError) {
    if (textbookError.code === "42P01" || textbookError.code === "PGRST205") {
      return null;
    }
    throw new Error(`无法读取智能教材：${textbookError.message}`);
  }
  if (!textbook) return null;

  let versionQuery = admin
    .from("digital_textbook_versions")
    .select("id")
    .eq("textbook_id", textbook.id)
    .order("version_number", { ascending: false })
    .limit(1);
  versionQuery = options.trackingDisabled
    ? versionQuery.in("status", ["draft", "published"])
    : versionQuery.eq("status", "published");
  const { data: version, error: versionError } = await versionQuery.maybeSingle();
  if (versionError) throw new Error(`无法读取教材版本：${versionError.message}`);
  if (!version) return null;

  let chapterQuery = admin
    .from("digital_textbook_chapters")
    .select("id,slug,chapter_number,title,scenario,goal,chapter_test_id,chapter_tests(slug)")
    .eq("version_id", version.id);
  chapterQuery = options.trackingDisabled
    ? chapterQuery.in("status", ["draft", "published"])
    : chapterQuery.eq("status", "published");
  chapterQuery = options.chapterSlug
    ? chapterQuery.eq("slug", options.chapterSlug)
    : chapterQuery.eq("chapter_number", options.chapterNumber ?? 1);
  const { data: chapter, error: chapterError } = await chapterQuery.maybeSingle();
  if (chapterError) throw new Error(`无法读取教材章节：${chapterError.message}`);
  if (!chapter) return null;
  const chapterTest = asObject(chapter.chapter_tests);

  const { data: modules, error: moduleError } = await admin
    .from("digital_textbook_modules")
    .select("id,module_code,sort_order,accent_role,title,description")
    .eq("chapter_id", chapter.id)
    .order("sort_order");
  if (moduleError) throw new Error(`无法读取教材模块：${moduleError.message}`);

  const moduleIds = (modules ?? []).map((item) => String(item.id));
  const { data: nodes, error: nodeError } = moduleIds.length
    ? await admin
        .from("digital_textbook_nodes")
        .select("id,module_id,node_code,node_type,sort_order,estimated_minutes,title,content")
        .in("module_id", moduleIds)
        .order("sort_order")
    : { data: [], error: null };
  if (nodeError) throw new Error(`无法读取学习节点：${nodeError.message}`);

  const nodeIds = (nodes ?? []).map((item) => String(item.id));
  const { data: mediaAssets, error: mediaError } = nodeIds.length
    ? await admin
        .from("digital_textbook_media_assets")
        .select("id,node_id,asset_key,media_type,purpose,production_status,alt_text,metadata")
        .in("node_id", nodeIds)
        .order("asset_key")
    : { data: [], error: null };
  if (mediaError && mediaError.code !== "42P01" && mediaError.code !== "PGRST205") {
    throw new Error(`无法读取教材媒体资源：${mediaError.message}`);
  }
  const { data: activities, error: activityError } = nodeIds.length
    ? await admin
        .from("digital_textbook_activities")
        .select("id,node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config")
        .in("node_id", nodeIds)
        .order("sort_order")
    : { data: [], error: null };
  if (activityError) throw new Error(`无法读取互动活动：${activityError.message}`);

  // 听力活动是否"就绪"改查真实是否已经上传音频，不再相信 public_config 里
  // 人工维护的 audioStatus 字段——内容编辑忘记把它改成 ready，音频就会
  // 一直显示成不可用，即使音频文件早就传好了。
  const listeningActivityIds = (activities ?? [])
    .filter((activity) => activity.activity_type === "listening")
    .map((activity) => String(activity.id));
  const { data: audioSecrets } = listeningActivityIds.length
    ? await admin
        .from("digital_textbook_activity_secrets")
        .select("activity_id,audio_object_key,audio_status")
        .in("activity_id", listeningActivityIds)
    : { data: [] as { activity_id: string; audio_object_key: string | null; audio_status: string | null }[] };
  const activityIdsWithAudio = new Set(
    (audioSecrets ?? [])
      .filter((row) => row.audio_object_key && row.audio_status === "ready")
      .map((row) => String(row.activity_id))
  );

  let preference: SmartTextbookData["preference"] = {
    locale: "zh-CN",
    supportMode: "bilingual",
  };
  let progress: SmartTextbookProgress[] = [];
  const completedActivityIds = new Set<string>();

  if (!options.trackingDisabled && options.tenantId) {
    const activityIds = (activities ?? []).map((activity) => String(activity.id));
    const [
      { data: savedPreference },
      { data: savedProgress },
      { data: completedAttempts },
    ] = await Promise.all([
      admin
        .from("digital_textbook_preferences")
        .select("interface_locale,support_mode")
        .eq("tenant_id", options.tenantId)
        .eq("student_id", options.userId)
        .eq("textbook_id", textbook.id)
        .maybeSingle(),
      nodeIds.length
        ? admin
            .from("digital_textbook_node_progress")
            .select("node_id,status,completion_percent,mastery_score,attempt_count")
            .eq("tenant_id", options.tenantId)
            .eq("student_id", options.userId)
            .eq("version_id", version.id)
            .in("node_id", nodeIds)
        : Promise.resolve({ data: [] }),
      activityIds.length
        ? admin
            .from("digital_textbook_attempts")
            .select("activity_id")
            .eq("tenant_id", options.tenantId)
            .eq("student_id", options.userId)
            .eq("version_id", version.id)
            .eq("is_correct", true)
            .in("activity_id", activityIds)
        : Promise.resolve({ data: [] }),
    ]);

    for (const attempt of completedAttempts ?? []) {
      completedActivityIds.add(String(attempt.activity_id));
    }

    if (savedPreference) {
      preference = {
        locale:
          savedPreference.interface_locale === "ko-KR" ? "ko-KR" : "zh-CN",
        supportMode:
          savedPreference.support_mode === "chinese" ||
          savedPreference.support_mode === "immersion"
            ? savedPreference.support_mode
            : "bilingual",
      };
    }

    progress = (savedProgress ?? []).map((item) => ({
      nodeId: String(item.node_id),
      status:
        item.status === "completed" || item.status === "in_progress"
          ? item.status
          : "not_started",
      completionPercent: Number(item.completion_percent ?? 0),
      masteryScore: Number(item.mastery_score ?? 0),
      attemptCount: Number(item.attempt_count ?? 0),
    }));
  }

  const mappedModules: SmartTextbookModule[] = (modules ?? []).map((module) => ({
    id: String(module.id),
    code: String(module.module_code),
    order: Number(module.sort_order),
    accent: module.accent_role as SmartAccent,
    title: localized(module.title),
    description: localized(module.description),
    nodes: (nodes ?? [])
      .filter((node) => node.module_id === module.id)
      .map((node) => ({
        id: String(node.id),
        code: String(node.node_code),
        type: node.node_type as SmartTextbookNode["type"],
        minutes: Number(node.estimated_minutes),
        title: localized(node.title),
        content: asObject(node.content),
        media: (mediaAssets ?? [])
          .filter((asset) => asset.node_id === node.id)
          .map((asset) => ({
            id: String(asset.id),
            key: String(asset.asset_key),
            type: asset.media_type === "audio" ? "audio" : "image",
            purpose: String(asset.purpose),
            status:
              asset.production_status === "ready" || asset.production_status === "rejected"
                ? asset.production_status
                : "pending",
            altText: localized(asset.alt_text),
            metadata: asObject(asset.metadata),
          })),
        activities: (activities ?? [])
          .filter((activity) => activity.node_id === node.id)
          .map((activity) => ({
            id: String(activity.id),
            key: String(activity.activity_key),
            type: activity.activity_type as SmartActivityType,
            completed: completedActivityIds.has(String(activity.id)),
            prompt: localized(activity.prompt),
            instruction: localized(activity.instruction),
            options: asStringArray(activity.options),
            config:
              activity.activity_type === "listening"
                ? {
                    ...asObject(activity.public_config),
                    audioStatus: activityIdsWithAudio.has(String(activity.id))
                      ? "ready"
                      : "pending",
                  }
                : asObject(activity.public_config),
          })),
      })),
  }));

  return {
    id: String(textbook.id),
    versionId: String(version.id),
    levelCode: String(textbook.level_code),
    title: localized(textbook.title),
    chapter: {
      id: String(chapter.id),
      slug: String(chapter.slug),
      number: Number(chapter.chapter_number),
      title: localized(chapter.title),
      scenario: localized(chapter.scenario),
      goal: localized(chapter.goal),
      chapterTestId: chapter.chapter_test_id ? String(chapter.chapter_test_id) : null,
      chapterTestSlug: chapterTest.slug ? String(chapterTest.slug) : null,
    },
    modules: mappedModules,
    preference,
    progress,
  };
}

/** @deprecated 新章节请直接使用 loadSmartDigitalTextbook。 */
export function loadKoreanLevelOneChapterOne(
  options: Omit<LoadSmartDigitalTextbookOptions, "textbookSlug" | "chapterNumber" | "chapterSlug">,
) {
  return loadSmartDigitalTextbook({
    ...options,
    textbookSlug: "korean-level-one-smart",
    chapterNumber: 1,
  });
}

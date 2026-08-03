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
  prompt: LocalizedText;
  instruction: LocalizedText;
  options: string[];
  config: Record<string, unknown>;
};

export type SmartTextbookNode = {
  id: string;
  code: string;
  type: "learn" | "practice" | "mission" | "review";
  minutes: number;
  title: LocalizedText;
  content: Record<string, unknown>;
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

export async function loadKoreanLevelOneChapterOne(options: {
  userId: string;
  tenantId: string | null;
  trackingDisabled: boolean;
}): Promise<SmartTextbookData | null> {
  const admin = createAdminClient();

  const { data: textbook, error: textbookError } = await admin
    .from("digital_textbooks")
    .select("id,level_code,title")
    .eq("slug", "korean-level-one-smart")
    .eq("status", "published")
    .maybeSingle();

  if (textbookError) {
    if (textbookError.code === "42P01" || textbookError.code === "PGRST205") {
      return null;
    }
    throw new Error(`无法读取智能教材：${textbookError.message}`);
  }
  if (!textbook) return null;

  const { data: version, error: versionError } = await admin
    .from("digital_textbook_versions")
    .select("id")
    .eq("textbook_id", textbook.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new Error(`无法读取教材版本：${versionError.message}`);
  if (!version) return null;

  const { data: chapter, error: chapterError } = await admin
    .from("digital_textbook_chapters")
    .select("id,slug,chapter_number,title,scenario,goal,chapter_test_id")
    .eq("version_id", version.id)
    .eq("chapter_number", 1)
    .eq("status", "published")
    .maybeSingle();
  if (chapterError) throw new Error(`无法读取教材章节：${chapterError.message}`);
  if (!chapter) return null;

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
  const { data: activities, error: activityError } = nodeIds.length
    ? await admin
        .from("digital_textbook_activities")
        .select("id,node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config")
        .in("node_id", nodeIds)
        .order("sort_order")
    : { data: [], error: null };
  if (activityError) throw new Error(`无法读取互动活动：${activityError.message}`);

  let preference: SmartTextbookData["preference"] = {
    locale: "zh-CN",
    supportMode: "bilingual",
  };
  let progress: SmartTextbookProgress[] = [];

  if (!options.trackingDisabled && options.tenantId) {
    const [{ data: savedPreference }, { data: savedProgress }] = await Promise.all([
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
    ]);

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
        activities: (activities ?? [])
          .filter((activity) => activity.node_id === node.id)
          .map((activity) => ({
            id: String(activity.id),
            key: String(activity.activity_key),
            type: activity.activity_type as SmartActivityType,
            prompt: localized(activity.prompt),
            instruction: localized(activity.instruction),
            options: asStringArray(activity.options),
            config: asObject(activity.public_config),
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
    },
    modules: mappedModules,
    preference,
    progress,
  };
}

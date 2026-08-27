import "server-only";

import { redirect } from "next/navigation";

import { requirePlatformOwner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  LocalizedText,
  TeachingScriptActivity,
  TeachingScriptModule,
  TeachingScriptNode,
  TeachingScriptStudioData,
  TeachingScriptVersion,
} from "./types";

type Row = Record<string, unknown>;

function localized(value: unknown): LocalizedText {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const text = String(value ?? "");
    return { "zh-CN": text, "ko-KR": text };
  }
  const record = value as Record<string, unknown>;
  return {
    "zh-CN": String(record["zh-CN"] ?? record["ko-KR"] ?? ""),
    "ko-KR": String(record["ko-KR"] ?? record["zh-CN"] ?? ""),
  };
}

function ids(rows: Row[]) {
  return rows.map((row) => String(row.id)).filter(Boolean);
}

export async function getTeachingScriptStudioData(
  studentAppId: string,
): Promise<TeachingScriptStudioData> {
  await requirePlatformOwner();
  if (!studentAppId) redirect("/dashboard/admin/apps");

  const admin = createAdminClient();
  const { data: textbooks, error: textbookError } = await admin
    .from("digital_textbooks")
    .select("id,title")
    .eq("student_app_id", studentAppId)
    .order("created_at");
  if (textbookError) throw new Error("无法读取教学脚本对应的教材。");

  const textbookRows = (textbooks ?? []) as Row[];
  const textbookIds = ids(textbookRows);
  if (!textbookIds.length) return { appId: studentAppId, modules: [] };

  const { data: versions, error: versionError } = await admin
    .from("digital_textbook_versions")
    .select("id,textbook_id,version_number,status")
    .in("textbook_id", textbookIds)
    .order("version_number", { ascending: false });
  if (versionError) throw new Error("无法读取教材版本。");
  const textbookVersionRows = (versions ?? []) as Row[];
  const activeTextbookVersionByTextbook = new Map<string, Row>();
  for (const row of textbookVersionRows) {
    const textbookId = String(row.textbook_id);
    const current = activeTextbookVersionByTextbook.get(textbookId);
    if (!current || (row.status === "published" && current.status !== "published")) {
      activeTextbookVersionByTextbook.set(textbookId, row);
    }
  }
  const activeTextbookVersionIds = [...activeTextbookVersionByTextbook.values()].map((row) => String(row.id));

  const { data: chapters, error: chapterError } = await admin
    .from("digital_textbook_chapters")
    .select("id,version_id,chapter_number,title,status")
    .in("version_id", activeTextbookVersionIds)
    .order("chapter_number");
  if (chapterError) throw new Error("无法读取教材章节。");
  const chapterRows = (chapters ?? []) as Row[];
  const chapterIds = ids(chapterRows);
  if (!chapterIds.length) return { appId: studentAppId, modules: [] };

  const { data: modules, error: moduleError } = await admin
    .from("digital_textbook_modules")
    .select("id,chapter_id,module_code,title,description,sort_order")
    .in("chapter_id", chapterIds)
    .order("sort_order");
  if (moduleError) throw new Error("无法读取教材板块。");
  const moduleRows = (modules ?? []) as Row[];
  const moduleIds = ids(moduleRows);

  const [{ data: lessons }, { data: contentNodes }] = await Promise.all([
    admin
      .from("learning_agent_lessons")
      .select("id,module_id,status,revision")
      .in("module_id", moduleIds),
    admin
      .from("digital_textbook_nodes")
      .select("id,module_id")
      .in("module_id", moduleIds),
  ]);
  const lessonRows = (lessons ?? []) as Row[];
  const contentNodeRows = (contentNodes ?? []) as Row[];
  const lessonIds = ids(lessonRows);
  const contentNodeIds = ids(contentNodeRows);

  const [{ data: scriptVersions }, { data: activities }] = await Promise.all([
    lessonIds.length
      ? admin
          .from("learning_agent_script_versions")
          .select("id,lesson_id,version_number,status,title,change_note,published_at")
          .in("lesson_id", lessonIds)
          .order("version_number", { ascending: false })
      : Promise.resolve({ data: [] }),
    contentNodeIds.length
      ? admin
          .from("digital_textbook_activities")
          .select("id,node_id,activity_key,activity_type,prompt,sort_order")
          .in("node_id", contentNodeIds)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);
  const scriptVersionRows = (scriptVersions ?? []) as Row[];
  const scriptVersionIds = ids(scriptVersionRows);
  const { data: scriptNodes } = scriptVersionIds.length
    ? await admin
        .from("learning_agent_script_nodes")
        .select("id,script_version_id,node_key,node_type,sort_order,title,teacher_script,configuration,reference_activity_id,action_type,next_node_key,remediation_node_key,is_required")
        .in("script_version_id", scriptVersionIds)
        .order("sort_order")
    : { data: [] };
  const scriptNodeRows = (scriptNodes ?? []) as Row[];
  const scriptNodeIds = ids(scriptNodeRows);
  const { data: interactionSecrets } = scriptNodeIds.length
    ? await admin
        .from("learning_agent_node_interaction_secrets")
        .select("node_id,correct_option_index,correct_feedback,incorrect_feedback")
        .in("node_id", scriptNodeIds)
    : { data: [] };
  const interactionSecretByNode = new Map(
    ((interactionSecrets ?? []) as Row[]).map((row) => [String(row.node_id), row]),
  );

  const textbookByVersion = new Map(
    textbookVersionRows.map((row) => [String(row.id), String(row.textbook_id)]),
  );
  const textbookById = new Map(textbookRows.map((row) => [String(row.id), row]));
  const chapterById = new Map(chapterRows.map((row) => [String(row.id), row]));
  const lessonByModule = new Map(lessonRows.map((row) => [String(row.module_id), row]));
  const contentNodeModule = new Map(
    contentNodeRows.map((row) => [String(row.id), String(row.module_id)]),
  );

  const activitiesByModule = new Map<string, TeachingScriptActivity[]>();
  for (const row of (activities ?? []) as Row[]) {
    const moduleId = contentNodeModule.get(String(row.node_id));
    if (!moduleId) continue;
    const items = activitiesByModule.get(moduleId) ?? [];
    items.push({
      id: String(row.id),
      key: String(row.activity_key ?? ""),
      type: String(row.activity_type ?? ""),
      prompt: localized(row.prompt),
    });
    activitiesByModule.set(moduleId, items);
  }

  const nodesByVersion = new Map<string, TeachingScriptNode[]>();
  for (const row of scriptNodeRows) {
    const versionId = String(row.script_version_id);
    const items = nodesByVersion.get(versionId) ?? [];
    const interactionSecret = interactionSecretByNode.get(String(row.id));
    items.push({
      id: String(row.id),
      versionId,
      key: String(row.node_key),
      type: row.node_type as TeachingScriptNode["type"],
      order: Number(row.sort_order),
      title: localized(row.title),
      script: localized(row.teacher_script),
      configuration: row.configuration && typeof row.configuration === "object"
        ? row.configuration as Record<string, unknown>
        : {},
      referenceActivityId: row.reference_activity_id ? String(row.reference_activity_id) : null,
      actionType: row.action_type as TeachingScriptNode["actionType"],
      nextNodeKey: row.next_node_key ? String(row.next_node_key) : null,
      remediationNodeKey: row.remediation_node_key ? String(row.remediation_node_key) : null,
      required: row.is_required !== false,
      interactionSecret: interactionSecret ? {
        correctOptionIndex: Number(interactionSecret.correct_option_index),
        correctFeedback: localized(interactionSecret.correct_feedback),
        incorrectFeedback: localized(interactionSecret.incorrect_feedback),
      } : null,
    });
    nodesByVersion.set(versionId, items);
  }

  const versionsByLesson = new Map<string, TeachingScriptVersion[]>();
  for (const row of scriptVersionRows) {
    const lessonId = String(row.lesson_id);
    const items = versionsByLesson.get(lessonId) ?? [];
    items.push({
      id: String(row.id),
      lessonId,
      number: Number(row.version_number),
      status: row.status as TeachingScriptVersion["status"],
      title: localized(row.title),
      changeNote: String(row.change_note ?? ""),
      publishedAt: row.published_at ? String(row.published_at) : null,
      nodes: nodesByVersion.get(String(row.id)) ?? [],
    });
    versionsByLesson.set(lessonId, items);
  }

  const result: TeachingScriptModule[] = moduleRows.flatMap((module) => {
    const chapter = chapterById.get(String(module.chapter_id));
    if (!chapter) return [];
    const textbookId = textbookByVersion.get(String(chapter.version_id));
    const textbook = textbookId ? textbookById.get(textbookId) : null;
    if (!textbookId || !textbook) return [];
    const lesson = lessonByModule.get(String(module.id));
    const lessonId = lesson ? String(lesson.id) : null;
    return [{
      id: String(module.id),
      code: String(module.module_code),
      order: Number(module.sort_order),
      title: localized(module.title),
      chapterId: String(chapter.id),
      chapterNumber: Number(chapter.chapter_number),
      chapterTitle: localized(chapter.title),
      textbookId,
      textbookTitle: localized(textbook.title),
      lessonId,
      activities: activitiesByModule.get(String(module.id)) ?? [],
      versions: lessonId ? versionsByLesson.get(lessonId) ?? [] : [],
    }];
  });

  return {
    appId: studentAppId,
    modules: result.sort((left, right) =>
      left.chapterNumber - right.chapterNumber
        || left.order - right.order
        || left.code.localeCompare(right.code),
    ),
  };
}

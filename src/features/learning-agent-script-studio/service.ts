import "server-only";

import { redirect } from "next/navigation";

import { requirePlatformOwner } from "@/lib/admin";
import { buildGenericModuleLearningTargets, buildOrientationLearningTargets, type SmartTextbookLearningTarget } from "@/lib/smart-textbook-learning-targets";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BlackboardLayoutTemplate,
  BlackboardLayoutTemplateElement,
  CharacterStyleTemplate,
  LocalizedText,
  TeachingScriptActivity,
  TeachingScriptModule,
  TeachingScriptNode,
  TeachingScriptSpeechAsset,
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

async function loadCharacterStyleTemplates(admin: ReturnType<typeof createAdminClient>): Promise<CharacterStyleTemplate[]> {
  const { data, error } = await admin
    .from("learning_agent_character_style_templates")
    .select("id,name,virtual_character_position,character_x,character_y,character_scale,dialogue_x,dialogue_y,split_character_x,split_character_y,split_character_scale,split_dialogue_x,split_dialogue_y,narrow_character_x,narrow_character_y,narrow_character_scale,blackboard_x,blackboard_y,blackboard_scale")
    .order("created_at", { ascending: false });
  if (error) throw new Error("无法读取样式模板。");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    virtualCharacterPosition: row.virtual_character_position === "left" ? "left" : "right",
    characterX: Number(row.character_x),
    characterY: Number(row.character_y),
    characterScale: Number(row.character_scale),
    dialogueX: Number(row.dialogue_x),
    dialogueY: Number(row.dialogue_y),
    splitCharacterX: Number(row.split_character_x),
    splitCharacterY: Number(row.split_character_y),
    splitCharacterScale: Number(row.split_character_scale),
    splitDialogueX: Number(row.split_dialogue_x),
    splitDialogueY: Number(row.split_dialogue_y),
    narrowCharacterX: Number(row.narrow_character_x),
    narrowCharacterY: Number(row.narrow_character_y),
    narrowCharacterScale: Number(row.narrow_character_scale),
    blackboardX: Number(row.blackboard_x),
    blackboardY: Number(row.blackboard_y),
    blackboardScale: Number(row.blackboard_scale),
  }));
}

function normalizeBlackboardLayoutTemplateElement(value: unknown): BlackboardLayoutTemplateElement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const type = record.type === "bullets" || record.type === "expression" ? record.type : "text";
  const align = record.align === "center" || record.align === "right" ? record.align : "left";
  const tone = record.tone === "primary" || record.tone === "highlight" || record.tone === "muted" ? record.tone : "default";
  const fontWeight = record.fontWeight === 400 || record.fontWeight === 700 ? record.fontWeight : 600;
  return {
    type,
    x: Number(record.x) || 0,
    y: Number(record.y) || 0,
    width: Number(record.width) || 8,
    height: Number(record.height) || 6,
    fontSize: Number(record.fontSize) || 20,
    fontWeight,
    align,
    tone,
  };
}

async function loadBlackboardLayoutTemplates(admin: ReturnType<typeof createAdminClient>): Promise<BlackboardLayoutTemplate[]> {
  const { data, error } = await admin
    .from("learning_agent_blackboard_layout_templates")
    .select("id,name,background,elements")
    .order("created_at", { ascending: false });
  if (error) throw new Error("无法读取黑板版式模板。");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    background: row.background === "warm" || row.background === "grid" ? row.background : "plain",
    elements: (Array.isArray(row.elements) ? row.elements : [])
      .map(normalizeBlackboardLayoutTemplateElement)
      .filter((element): element is BlackboardLayoutTemplateElement => element !== null),
  }));
}

async function loadSmartTextbookLearningTargetRegistry(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, SmartTextbookLearningTarget[]>> {
  const { data, error } = await admin
    .from("smart_textbook_learning_target_registry")
    .select("module_code,target_key,page_key,page_label,region_key,region_label,label,scope,kind,supports_student_action")
    .order("sort_order");
  if (error) throw new Error("无法读取智能教材目标注册表。");
  const byModuleCode = new Map<string, SmartTextbookLearningTarget[]>();
  for (const row of data ?? []) {
    const moduleCode = String(row.module_code);
    const items = byModuleCode.get(moduleCode) ?? [];
    items.push({
      key: String(row.target_key),
      pageKey: String(row.page_key),
      pageLabel: String(row.page_label),
      regionKey: String(row.region_key),
      regionLabel: String(row.region_label),
      label: String(row.label),
      scope: row.scope as SmartTextbookLearningTarget["scope"],
      kind: row.kind as SmartTextbookLearningTarget["kind"],
      supportsStudentAction: row.supports_student_action === true,
    });
    byModuleCode.set(moduleCode, items);
  }
  return byModuleCode;
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
  if (!textbookIds.length) return { appId: studentAppId, modules: [], characterStyleTemplates: await loadCharacterStyleTemplates(admin), blackboardLayoutTemplates: await loadBlackboardLayoutTemplates(admin) };

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
  if (!chapterIds.length) return { appId: studentAppId, modules: [], characterStyleTemplates: await loadCharacterStyleTemplates(admin), blackboardLayoutTemplates: await loadBlackboardLayoutTemplates(admin) };

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
      .select("id,module_id,node_code,sort_order,content")
      .in("module_id", moduleIds)
      .order("sort_order"),
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
        .select("id,script_version_id,node_key,node_type,sort_order,title,teacher_script,configuration,reference_activity_id,action_type,next_node_key,remediation_node_key,is_required,updated_at")
        .in("script_version_id", scriptVersionIds)
        .order("sort_order")
    : { data: [] };
  const scriptNodeRows = (scriptNodes ?? []) as Row[];
  const scriptNodeIds = ids(scriptNodeRows);
  const [{ data: interactionSecrets }, { data: speechAssets }] = scriptNodeIds.length
    ? await Promise.all([
        admin
          .from("learning_agent_node_interaction_secrets")
          .select("node_id,correct_option_index,correct_feedback,incorrect_feedback")
          .in("node_id", scriptNodeIds),
        admin
          .from("learning_agent_script_audio_assets")
          .select("id,script_node_id,locale,segment_index,content_hash,duration_ms,voice_manifest,production_status,updated_at")
          .in("script_node_id", scriptNodeIds),
      ])
    : [{ data: [] }, { data: [] }];
  const interactionSecretByNode = new Map(
    ((interactionSecrets ?? []) as Row[]).map((row) => [String(row.node_id), row]),
  );
  const speechAssetsByNode = new Map<string, TeachingScriptSpeechAsset[]>();
  for (const row of (speechAssets ?? []) as Row[]) {
    const nodeId = String(row.script_node_id);
    const items = speechAssetsByNode.get(nodeId) ?? [];
    items.push({
      id: String(row.id),
      locale: row.locale === "ko-KR" ? "ko-KR" : "zh-CN",
      segmentIndex: Number(row.segment_index),
      contentHash: String(row.content_hash),
      durationMs: Number(row.duration_ms),
      voiceManifest: row.voice_manifest && typeof row.voice_manifest === "object" && !Array.isArray(row.voice_manifest)
        ? row.voice_manifest as Record<string, unknown>
        : {},
      productionStatus: row.production_status === "failed" || row.production_status === "pending"
        ? row.production_status
        : "ready",
      updatedAt: String(row.updated_at ?? ""),
    });
    speechAssetsByNode.set(nodeId, items);
  }

  const scriptVersionById = new Map(scriptVersionRows.map((row) => [String(row.id), row]));
  const publishedSpeechAssetsByLessonAndKey = new Map<string, TeachingScriptSpeechAsset[]>();
  for (const row of scriptNodeRows) {
    const version = scriptVersionById.get(String(row.script_version_id));
    if (version?.status !== "published") continue;
    publishedSpeechAssetsByLessonAndKey.set(
      `${String(version.lesson_id)}:${String(row.node_key)}`,
      speechAssetsByNode.get(String(row.id)) ?? [],
    );
  }

  const textbookByVersion = new Map(
    textbookVersionRows.map((row) => [String(row.id), String(row.textbook_id)]),
  );
  const textbookById = new Map(textbookRows.map((row) => [String(row.id), row]));
  const chapterById = new Map(chapterRows.map((row) => [String(row.id), row]));
  const lessonByModule = new Map(lessonRows.map((row) => [String(row.module_id), row]));
  const contentNodeModule = new Map(
    contentNodeRows.map((row) => [String(row.id), String(row.module_id)]),
  );
  const contentNodesByModule = new Map<string, Row[]>();
  for (const row of contentNodeRows) {
    const moduleId = String(row.module_id);
    const items = contentNodesByModule.get(moduleId) ?? [];
    items.push(row);
    contentNodesByModule.set(moduleId, items);
  }

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
    const version = scriptVersionById.get(versionId);
    const directSpeechAssets = speechAssetsByNode.get(String(row.id)) ?? [];
    const publishedSpeechAssets = version
      ? publishedSpeechAssetsByLessonAndKey.get(`${String(version.lesson_id)}:${String(row.node_key)}`) ?? []
      : [];
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
      updatedAt: String(row.updated_at ?? ""),
      speechAssets: directSpeechAssets.length ? directSpeechAssets : publishedSpeechAssets,
      speechAssetsFromPublishedVersion: directSpeechAssets.length === 0 && publishedSpeechAssets.length > 0,
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

  const learningTargetRegistry = await loadSmartTextbookLearningTargetRegistry(admin);

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
      learningTargets: String(module.module_code) === "orientation"
        ? buildOrientationLearningTargets({
            content: (contentNodesByModule.get(String(module.id))?.[0]?.content ?? {}) as Record<string, unknown>,
            activities: activitiesByModule.get(String(module.id)) ?? [],
            staticTargets: learningTargetRegistry.get("orientation") ?? [],
          })
        : buildGenericModuleLearningTargets({
            moduleCode: String(module.module_code),
            activities: activitiesByModule.get(String(module.id)) ?? [],
            staticTargets: learningTargetRegistry.get(String(module.module_code)) ?? [],
          }),
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
    characterStyleTemplates: await loadCharacterStyleTemplates(admin),
    blackboardLayoutTemplates: await loadBlackboardLayoutTemplates(admin),
  };
}

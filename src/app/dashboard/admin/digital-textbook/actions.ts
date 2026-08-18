"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { requireActiveUser } from "@/lib/auth";
import { requirePlatformOwner } from "@/lib/admin";
import {
  assertR2ObjectUpload,
  createR2SignedObjectUrl,
  createR2SignedUploadUrl,
} from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message?: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VocabularyWord = {
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
};

export type GrammarExample = { ko: string; zh: string; audio: string };

/** 收音情况行：尾字收音 + 对应的情况说明 */
export type GrammarCaseRow = {
  batchim: string;
  conjugation: string;
};

/** 形态组合行：一个形态 + 它的组合结果 + 该行对应的音频(objectKey，可选) */
export type GrammarFormRow = {
  form: string;
  combination: string;
  audio: string;
};

export type GrammarItem = {
  title: string;
  meaning: string;
  cases: GrammarCaseRow[];
  rows: GrammarFormRow[];
  examples: GrammarExample[];
  caution: string;
};

function normalizeCases(raw: Partial<GrammarItem>): GrammarCaseRow[] {
  if (Array.isArray(raw.cases)) {
    return raw.cases
      .map((row) => ({
        batchim: String((row as GrammarCaseRow).batchim ?? "").trim(),
        conjugation: String((row as GrammarCaseRow).conjugation ?? "").trim(),
      }))
      .filter((row) => row.batchim || row.conjugation);
  }
  // 旧格式兑底：batchim 按“／”拆、conjugation 按“；”拆，按位置对齐成行
  const batchims = String((raw as Partial<GrammarItem> & { batchim?: string }).batchim ?? "").split("／").map((line) => line.trim()).filter(Boolean);
  const conjugations = String((raw as Partial<GrammarItem> & { conjugation?: string }).conjugation ?? "").split("；").map((line) => line.trim()).filter(Boolean);
  const count = Math.max(batchims.length, conjugations.length);
  return Array.from({ length: count }, (_, index) => ({
    batchim: batchims[index] ?? "",
    conjugation: conjugations[index] ?? "",
  }));
}

function normalizeRows(raw: Partial<GrammarItem>): GrammarFormRow[] {
  if (Array.isArray(raw.rows)) {
    return raw.rows
      .map((row) => ({
        form: String((row as GrammarFormRow).form ?? "").trim(),
        combination: String((row as GrammarFormRow).combination ?? "").trim(),
        audio: String((row as GrammarFormRow).audio ?? "").trim(),
      }))
      .filter((row) => row.form || row.combination);
  }
  // 旧格式兜底：form/combination/audio 各自用“；”分隔，按位置对齐成行
  const forms = String((raw as Partial<GrammarItem> & { form?: string }).form ?? "").split("；").map((line) => line.trim()).filter(Boolean);
  const combos = String((raw as Partial<GrammarItem> & { combination?: string }).combination ?? "").split("；").map((line) => line.trim()).filter(Boolean);
  const audios = String((raw as Partial<GrammarItem> & { audio?: string }).audio ?? "").split("；").map((line) => line.trim()).filter(Boolean);
  const count = Math.max(forms.length, combos.length);
  return Array.from({ length: count }, (_, index) => ({
    form: forms[index] ?? "",
    combination: combos[index] ?? "",
    audio: audios[index] ?? "",
  }));
}

function cleanGrammar(raw: Partial<GrammarItem>): GrammarItem {
  return {
    title: String(raw.title ?? "").trim(),
    meaning: String(raw.meaning ?? "").trim(),
    cases: normalizeCases(raw),
    rows: normalizeRows(raw),
    examples: Array.isArray(raw.examples)
      ? raw.examples
          .map((item) => ({
            ko: String((item as GrammarExample).ko ?? "").trim(),
            zh: String((item as GrammarExample).zh ?? "").trim(),
            audio: String((item as GrammarExample).audio ?? "").trim(),
          }))
          .filter((item) => item.ko || item.zh)
      : [],
    caution: String(raw.caution ?? "").trim(),
  };
}

function grammarOf(content: Record<string, unknown> | null | undefined): GrammarItem[] {
  if (!content) return [];
  const raw = Array.isArray(content.grammar) ? content.grammar : [];
  return raw.filter(
    (item): item is GrammarItem =>
      Boolean(item) && typeof item === "object" && Boolean((item as GrammarItem).title)
  );
}

const TEXTBOOK_STATUSES = new Set(["draft", "published", "archived"]);

/**
 * 应用层鉴权：与数据库 current_user_can_manage_standard_question_bank()
 * 保持一致——平台负责人永久拥有，或被授权的平台副负责人可管理。
 */
async function canManageTextbooks(): Promise<boolean> {
  const { supabase } = await requireActiveUser();
  const { data, error } = await supabase.rpc(
    "current_user_can_manage_standard_question_bank"
  );
  return !error && data === true;
}

function cleanWord(raw: Partial<VocabularyWord>): VocabularyWord {
  return {
    ko: String(raw.ko ?? "").trim(),
    zh: String(raw.zh ?? "").trim(),
    pos: String(raw.pos ?? "").trim(),
    collocation: String(raw.collocation ?? "").trim(),
    transcription: String(raw.transcription ?? "").trim(),
  };
}

function validateWord(word: VocabularyWord): string | null {
  if (!word.ko && !word.zh) return "韩语或中文释义至少填写一项";
  return null;
}

async function loadNodeContent(
  admin: ReturnType<typeof createAdminClient>,
  nodeId: string
) {
  const { data: node, error } = await admin
    .from("digital_textbook_nodes")
    .select("content")
    .eq("id", nodeId)
    .maybeSingle();
  if (error || !node) return { node: null as null, error: "找不到该词汇节点" };
  const content = (node.content ?? {}) as Record<string, unknown>;
  return { node: { content }, error: null };
}

function vocabularyOf(content: Record<string, unknown>): VocabularyWord[] {
  return Array.isArray(content.vocabulary) ? (content.vocabulary as VocabularyWord[]) : [];
}

/** 切换教材发布状态 */
export async function setTextbookStatusAction(
  textbookId: string,
  status: string
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  if (!TEXTBOOK_STATUSES.has(status)) {
    return { ok: false, message: "无效的教材状态" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("digital_textbooks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", textbookId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  revalidateDashboard("/[space]/apps/korean/practice/skills/vocabulary", "page");
  return { ok: true };
}

/**
 * 一次发布一个完整章节：教材章节、关联章节测试及其正式题目。
 * UI 可见性不是权限边界；Server Action 和数据库 RPC 都会重新校验平台负责人。
 */
export async function publishTextbookChapterAction(
  chapterId: string,
): Promise<ActionResult> {
  const normalizedChapterId = String(chapterId ?? "").trim();
  if (!UUID_PATTERN.test(normalizedChapterId)) {
    return { ok: false, message: "章节编号不正确。" };
  }

  const { supabase } = await requirePlatformOwner();
  const { data, error } = await supabase.rpc(
    "publish_digital_textbook_chapter",
    { p_chapter_id: normalizedChapterId },
  );

  if (error) {
    const safeMessage = [
      "只有平台负责人可以发布教材章节",
      "没有找到要发布的教材章节",
      "当前章节尚未关联章节测试",
      "当前章节测试还没有可发布题目",
      "章节测试存在未完成配置的题目",
    ].find((message) => error.message.includes(message));
    return {
      ok: false,
      message: safeMessage ?? "章节发布失败，请检查章节测试与题目配置后重试。",
    };
  }

  const result = data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : {};
  const questionCount = Number(result.publishedQuestions ?? 0);

  revalidateDashboard("/dashboard/admin/digital-textbook");
  revalidateDashboard("/dashboard/assignments/korean");
  revalidateDashboard("/dashboard/assignments/korean/[testSlug]", "page");
  revalidateDashboard(
    "/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]",
    "page",
  );
  revalidateDashboard("/[space]/apps/korean/assignments/korean", "page");
  revalidateDashboard(
    "/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]",
    "page",
  );

  return {
    ok: true,
    message: questionCount > 0
      ? `章节、章节测试和 ${questionCount} 道题已发布。`
      : "章节已发布。",
  };
}

/** 给指定词汇节点添加一个单词 */
export async function addVocabularyWordAction(
  nodeId: string,
  raw: Partial<VocabularyWord>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  const word = cleanWord(raw);
  const invalid = validateWord(word);
  if (invalid) return { ok: false, message: invalid };

  const admin = createAdminClient();
  const loaded = await loadNodeContent(admin, nodeId);
  if (!loaded.node) return { ok: false, message: loaded.error };
  const words = vocabularyOf(loaded.node.content);

  const { error } = await admin
    .from("digital_textbook_nodes")
    .update({
      content: { ...loaded.node.content, vocabulary: [...words, word] },
      updated_at: new Date().toISOString(),
    })
    .eq("id", nodeId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  revalidateDashboard("/[space]/apps/korean/practice/skills/vocabulary", "page");
  return { ok: true };
}

/** 编辑指定索引的单词 */
export async function updateVocabularyWordAction(
  nodeId: string,
  index: number,
  raw: Partial<VocabularyWord>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  const word = cleanWord(raw);
  const invalid = validateWord(word);
  if (invalid) return { ok: false, message: invalid };
  if (!Number.isInteger(index) || index < 0) {
    return { ok: false, message: "无效的单词索引" };
  }

  const admin = createAdminClient();
  const loaded = await loadNodeContent(admin, nodeId);
  if (!loaded.node) return { ok: false, message: loaded.error };
  const words = vocabularyOf(loaded.node.content);
  if (index >= words.length) return { ok: false, message: "单词索引越界" };

  const next = [...words];
  next[index] = word;

  const { error } = await admin
    .from("digital_textbook_nodes")
    .update({
      content: { ...loaded.node.content, vocabulary: next },
      updated_at: new Date().toISOString(),
    })
    .eq("id", nodeId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  revalidateDashboard("/[space]/apps/korean/practice/skills/vocabulary", "page");
  return { ok: true };
}

/** 删除指定索引的单词 */
export async function removeVocabularyWordAction(
  nodeId: string,
  index: number
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  if (!Number.isInteger(index) || index < 0) {
    return { ok: false, message: "无效的单词索引" };
  }

  const admin = createAdminClient();
  const loaded = await loadNodeContent(admin, nodeId);
  if (!loaded.node) return { ok: false, message: loaded.error };
  const words = vocabularyOf(loaded.node.content);
  if (index >= words.length) return { ok: false, message: "单词索引越界" };

  const next = [...words.slice(0, index), ...words.slice(index + 1)];

  const { error } = await admin
    .from("digital_textbook_nodes")
    .update({
      content: { ...loaded.node.content, vocabulary: next },
      updated_at: new Date().toISOString(),
    })
    .eq("id", nodeId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  revalidateDashboard("/[space]/apps/korean/practice/skills/vocabulary", "page");
  return { ok: true };
}

/**
 * 确保章节存在语法模块节点(module_code='grammar')，不存在则创建。
 * 返回该节点的 id，供后续读写 content.grammar。
 */
async function ensureGrammarNode(
  admin: ReturnType<typeof createAdminClient>,
  chapterId: string
): Promise<{ nodeId?: string; error?: string }> {
  const { data: module } = await admin
    .from("digital_textbook_modules")
    .select("id,sort_order")
    .eq("chapter_id", chapterId)
    .eq("module_code", "grammar")
    .maybeSingle();

  let moduleId = module?.id;
  if (!moduleId) {
    const { data: existing } = await admin
      .from("digital_textbook_modules")
      .select("sort_order")
      .eq("chapter_id", chapterId);
    const used = new Set((existing ?? []).map((row) => row.sort_order as number));
    let sortOrder = 1;
    while (used.has(sortOrder) && sortOrder <= 8) sortOrder += 1;
    if (sortOrder > 8) return { error: "该章节模块位已满（最多 8 个）" };

    const { data: created, error: moduleError } = await admin
      .from("digital_textbook_modules")
      .insert({
        chapter_id: chapterId,
        module_code: "grammar",
        sort_order: sortOrder,
        accent_role: "iris",
        title: { "zh-CN": "语法解说", "ko-KR": "문법" },
        description: {},
      })
      .select("id")
      .single();
    if (moduleError || !created) {
      return { error: moduleError?.message ?? "创建语法模块失败" };
    }
    moduleId = created.id;
  }

  const { data: node } = await admin
    .from("digital_textbook_nodes")
    .select("id")
    .eq("module_id", moduleId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (node) return { nodeId: node.id };

  const { data: createdNode, error: nodeError } = await admin
    .from("digital_textbook_nodes")
    .insert({
      module_id: moduleId,
      node_code: "grammar-1",
      node_type: "learn",
      sort_order: 1,
      estimated_minutes: 5,
      title: { "zh-CN": "语法点", "ko-KR": "문법" },
      content: { grammar: [] },
    })
    .select("id")
    .single();
  if (nodeError || !createdNode) {
    return { error: nodeError?.message ?? "创建语法节点失败" };
  }
  return { nodeId: createdNode.id };
}

async function loadGrammarNode(
  admin: ReturnType<typeof createAdminClient>,
  chapterId: string
): Promise<{ nodeId?: string; content?: Record<string, unknown>; error?: string }> {
  const { nodeId, error } = await ensureGrammarNode(admin, chapterId);
  if (error || !nodeId) return { error: error ?? "无法准备语法节点" };
  const { data: node, error: nodeError } = await admin
    .from("digital_textbook_nodes")
    .select("content")
    .eq("id", nodeId)
    .maybeSingle();
  if (nodeError || !node) return { error: "找不到语法节点" };
  return { nodeId, content: (node.content ?? {}) as Record<string, unknown> };
}

/** 添加一条语法 */
export async function addGrammarItemAction(
  chapterId: string,
  raw: Partial<GrammarItem>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  const item = cleanGrammar(raw);
  if (!item.title) return { ok: false, message: "语法标题不能为空" };

  const admin = createAdminClient();
  const loaded = await loadGrammarNode(admin, chapterId);
  if (!loaded.nodeId) return { ok: false, message: loaded.error };
  const items = grammarOf(loaded.content);

  const { error } = await admin
    .from("digital_textbook_nodes")
    .update({
      content: { ...loaded.content, grammar: [...items, item] },
      updated_at: new Date().toISOString(),
    })
    .eq("id", loaded.nodeId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  return { ok: true };
}

/** 编辑指定索引的语法 */
export async function updateGrammarItemAction(
  chapterId: string,
  index: number,
  raw: Partial<GrammarItem>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  const item = cleanGrammar(raw);
  if (!item.title) return { ok: false, message: "语法标题不能为空" };
  if (!Number.isInteger(index) || index < 0) {
    return { ok: false, message: "无效的语法索引" };
  }

  const admin = createAdminClient();
  const loaded = await loadGrammarNode(admin, chapterId);
  if (!loaded.nodeId) return { ok: false, message: loaded.error };
  const items = grammarOf(loaded.content);
  if (index >= items.length) return { ok: false, message: "语法索引越界" };

  const next = [...items];
  next[index] = item;

  const { error } = await admin
    .from("digital_textbook_nodes")
    .update({
      content: { ...loaded.content, grammar: next },
      updated_at: new Date().toISOString(),
    })
    .eq("id", loaded.nodeId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  return { ok: true };
}

/** 删除指定索引的语法 */
export async function removeGrammarItemAction(
  chapterId: string,
  index: number
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改互动教材" };
  }
  if (!Number.isInteger(index) || index < 0) {
    return { ok: false, message: "无效的语法索引" };
  }

  const admin = createAdminClient();
  const loaded = await loadGrammarNode(admin, chapterId);
  if (!loaded.nodeId) return { ok: false, message: loaded.error };
  const items = grammarOf(loaded.content);
  if (index >= items.length) return { ok: false, message: "语法索引越界" };

  const next = [...items.slice(0, index), ...items.slice(index + 1)];

  const { error } = await admin
    .from("digital_textbook_nodes")
    .update({
      content: { ...loaded.content, grammar: next },
      updated_at: new Date().toISOString(),
    })
    .eq("id", loaded.nodeId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/digital-textbook");
  return { ok: true };
}

const MAX_GRAMMAR_AUDIO_BYTES = 20 * 1024 * 1024;

function sanitizeAudioFileName(fileName: string) {
  const base = fileName.replace(/[^\w.\-가-힣]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return base.slice(0, 80) || "grammar-audio.mp3";
}

/**
 * 生成语法音频的 R2 上传签名 URL。
 * 音频文件存放在 Cloudflare R2（前缀 audio/grammar/），不写入 Supabase。
 * objectKey 约定：audio/grammar/{textbookSlug}/ch{章节号}/{时间戳}-{文件名}
 */
export async function createGrammarAudioUploadUrlAction(input: {
  textbookSlug: string;
  chapterNumber: number;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限上传音频" };
  }
  const slug = String(input.textbookSlug ?? "").trim();
  if (!slug) return { ok: false, message: "缺少教材标识" };
  if (!Number.isInteger(input.chapterNumber) || input.chapterNumber < 1) {
    return { ok: false, message: "无效的章节号" };
  }
  const contentType = String(input.contentType ?? "").trim();
  if (!contentType.startsWith("audio/")) {
    return { ok: false, message: "仅支持音频文件（mp3 / m4a / wav 等）" };
  }
  const fileSize = Number(input.fileSize);
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_GRAMMAR_AUDIO_BYTES) {
    return { ok: false, message: "音频大小需在 20MB 以内" };
  }

  const fileName = sanitizeAudioFileName(String(input.fileName ?? "grammar-audio.mp3"));
  const objectKey = `audio/grammar/${slug}/ch${input.chapterNumber}/${Date.now()}-${fileName}`;

  try {
    const uploadUrl = await createR2SignedUploadUrl(objectKey, contentType, fileSize);
    const signedUrl = await createR2SignedObjectUrl(objectKey);
    return { ok: true, objectKey, uploadUrl, signedUrl };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "生成上传地址失败",
    };
  }
}

/** 上传完成后校验 R2 对象是否真实存在且大小一致 */
export async function confirmGrammarAudioUploadAction(input: {
  objectKey: string;
  fileSize: number;
}) {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限上传音频" };
  }
  const objectKey = String(input.objectKey ?? "");
  if (!objectKey.startsWith("audio/grammar/")) {
    return { ok: false, message: "无效的音频地址" };
  }
  const fileSize = Number(input.fileSize);
  try {
    await assertR2ObjectUpload(objectKey, fileSize);
    const signedUrl = await createR2SignedObjectUrl(objectKey);
    return { ok: true, signedUrl };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "音频校验失败",
    };
  }
}

/** 取语法音频的临时播放地址（R2 签名 URL，默认 1 小时有效） */
export async function getGrammarAudioSignedUrlAction(objectKey: string) {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限访问音频" };
  }
  const key = String(objectKey ?? "");
  if (!key.startsWith("audio/grammar/")) {
    return { ok: false, message: "无效的音频地址" };
  }
  try {
    const signedUrl = await createR2SignedObjectUrl(key);
    return { ok: true, signedUrl };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "生成播放地址失败",
    };
  }
}

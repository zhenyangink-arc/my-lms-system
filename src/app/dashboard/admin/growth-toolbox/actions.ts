"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message?: string };

export type ToolboxItemInput = {
  title: string;
  description: string;
  href: string;
  iconName: string;
  accent: string;
  soft: string;
  sortOrder: number;
  isEnabled: boolean;
  relatedCourseId: string | null;
};

const ICON_NAMES = new Set([
  "notebook-pen",
  "mic",
  "book-open",
  "ear",
  "wrench",
  "sparkles",
  "headphones",
  "message-square",
  "pen-tool",
]);

const COLOR_KEYS = new Set([
  "var(--app-accent)",
  "var(--app-warm)",
  "var(--app-secondary)",
  "var(--app-success)",
]);

async function canManageTextbooks(): Promise<boolean> {
  const { supabase } = await requireActiveUser();
  const { data, error } = await supabase.rpc(
    "current_user_can_manage_standard_question_bank"
  );
  return !error && data === true;
}

function cleanInput(raw: Partial<ToolboxItemInput>): ToolboxItemInput {
  const href = String(raw.href ?? "").trim();
  const relatedCourseId = raw.relatedCourseId ? String(raw.relatedCourseId).trim() : null;
  return {
    title: String(raw.title ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    href,
    iconName: String(raw.iconName ?? "wrench").trim(),
    accent: String(raw.accent ?? "var(--app-accent)").trim(),
    soft: String(raw.soft ?? "var(--app-accent-soft)").trim(),
    sortOrder: Number(raw.sortOrder ?? 0),
    isEnabled: Boolean(raw.isEnabled),
    relatedCourseId: relatedCourseId || null,
  };
}

function validateInput(input: ToolboxItemInput): string | null {
  if (!input.title) return "名称不能为空";
  if (!input.href || !input.href.startsWith("/dashboard/")) {
    return "链接必须是 /dashboard/ 开头的站内路径";
  }
  if (!ICON_NAMES.has(input.iconName)) return "请选择有效的图标";
  if (!COLOR_KEYS.has(input.accent)) return "请选择有效的强调色";
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 99) {
    return "排序必须是 0-99 的整数";
  }
  return null;
}

/** 更新一个成长工具箱入口的配置 */
export async function updateToolboxItemAction(
  itemId: string,
  raw: Partial<ToolboxItemInput>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改成长工具箱" };
  }
  const input = cleanInput(raw);
  const invalid = validateInput(input);
  if (invalid) return { ok: false, message: invalid };

  const admin = createAdminClient();
  const { error } = await admin
    .from("growth_toolbox_items")
    .update({
      title: input.title,
      description: input.description,
      href: input.href,
      icon_name: input.iconName,
      accent: input.accent,
      soft: input.soft,
      sort_order: input.sortOrder,
      is_enabled: input.isEnabled,
      related_course_id: input.relatedCourseId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  revalidateDashboard("/dashboard/toolbox");
  return { ok: true };
}

export type VocabularyWordInput = {
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
};

function cleanWord(raw: Partial<VocabularyWordInput>): VocabularyWordInput {
  return {
    ko: String(raw.ko ?? "").trim(),
    zh: String(raw.zh ?? "").trim(),
    pos: String(raw.pos ?? "").trim(),
    collocation: String(raw.collocation ?? "").trim(),
    transcription: String(raw.transcription ?? "").trim(),
  };
}

/** 向练习词库添加单词（仅写 growth_toolbox_vocabulary，绝不触碰互动教材数据） */
export async function addToolboxVocabularyAction(
  raw: Partial<VocabularyWordInput>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改练习词库" };
  }
  const word = cleanWord(raw);
  if (!word.ko && !word.zh) return { ok: false, message: "韩语或中文释义至少填写一项" };

  const admin = createAdminClient();
  // 新词追加到词库末尾：取当前最大 sort_order + 1
  const { data: maxRow } = await admin
    .from("growth_toolbox_vocabulary")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await admin.from("growth_toolbox_vocabulary").insert({
    ko: word.ko,
    zh: word.zh,
    pos: word.pos,
    collocation: word.collocation,
    transcription: word.transcription,
    source: "custom",
    sort_order: nextSortOrder,
  });
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  return { ok: true };
}

/** 编辑词库中指定单词 */
export async function updateToolboxVocabularyAction(
  itemId: string,
  raw: Partial<VocabularyWordInput>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改练习词库" };
  }
  const word = cleanWord(raw);
  if (!word.ko && !word.zh) return { ok: false, message: "韩语或中文释义至少填写一项" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("growth_toolbox_vocabulary")
    .update({
      ko: word.ko,
      zh: word.zh,
      pos: word.pos,
      collocation: word.collocation,
      transcription: word.transcription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  return { ok: true };
}

/** 从词库删除单词 */
export async function removeToolboxVocabularyAction(
  itemId: string
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改练习词库" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("growth_toolbox_vocabulary")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  return { ok: true };
}

export type GrammarCaseRow = { batchim: string; conjugation: string };
export type GrammarFormRow = { form: string; combination: string; audio: string };
export type GrammarExampleRow = { ko: string; zh: string; audio: string };

export type GrammarLibraryItemInput = {
  title: string;
  meaning: string;
  cases: GrammarCaseRow[];
  rows: GrammarFormRow[];
  examples: GrammarExampleRow[];
  caution: string;
};

function normalizeCases(raw: Partial<GrammarLibraryItemInput>): GrammarCaseRow[] {
  if (Array.isArray(raw.cases)) {
    return raw.cases
      .map((row) => ({
        batchim: String((row as GrammarCaseRow).batchim ?? "").trim(),
        conjugation: String((row as GrammarCaseRow).conjugation ?? "").trim(),
      }))
      .filter((row) => row.batchim || row.conjugation);
  }
  return [];
}

function normalizeRows(raw: Partial<GrammarLibraryItemInput>): GrammarFormRow[] {
  if (Array.isArray(raw.rows)) {
    return raw.rows
      .map((row) => ({
        form: String((row as GrammarFormRow).form ?? "").trim(),
        combination: String((row as GrammarFormRow).combination ?? "").trim(),
        audio: String((row as GrammarFormRow).audio ?? "").trim(),
      }))
      .filter((row) => row.form || row.combination);
  }
  return [];
}

function cleanGrammar(raw: Partial<GrammarLibraryItemInput>): GrammarLibraryItemInput {
  return {
    title: String(raw.title ?? "").trim(),
    meaning: String(raw.meaning ?? "").trim(),
    cases: normalizeCases(raw),
    rows: normalizeRows(raw),
    examples: Array.isArray(raw.examples)
      ? raw.examples
          .map((item) => ({
            ko: String(item.ko ?? "").trim(),
            zh: String(item.zh ?? "").trim(),
            audio: String(item.audio ?? "").trim(),
          }))
          .filter((item) => item.ko || item.zh)
      : [],
    caution: String(raw.caution ?? "").trim(),
  };
}

/** 向语法库添加条目（仅写 growth_toolbox_grammar，绝不触碰互动教材） */
export async function addGrammarLibraryAction(
  raw: Partial<GrammarLibraryItemInput>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改语法库" };
  }
  const item = cleanGrammar(raw);
  if (!item.title) return { ok: false, message: "语法标题不能为空" };

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("growth_toolbox_grammar")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await admin.from("growth_toolbox_grammar").insert({
    title: item.title,
    meaning: item.meaning,
    cases: item.cases,
    rows: item.rows,
    examples: item.examples,
    caution: item.caution,
    source: "custom",
    sort_order: nextSortOrder,
  });
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  return { ok: true };
}

/** 编辑语法库中指定条目 */
export async function updateGrammarLibraryAction(
  itemId: string,
  raw: Partial<GrammarLibraryItemInput>
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改语法库" };
  }
  const item = cleanGrammar(raw);
  if (!item.title) return { ok: false, message: "语法标题不能为空" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("growth_toolbox_grammar")
    .update({
      title: item.title,
      meaning: item.meaning,
      cases: item.cases,
      rows: item.rows,
      examples: item.examples,
      caution: item.caution,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  return { ok: true };
}

/** 从语法库删除条目 */
export async function removeGrammarLibraryAction(
  itemId: string
): Promise<ActionResult> {
  if (!(await canManageTextbooks())) {
    return { ok: false, message: "没有权限修改语法库" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("growth_toolbox_grammar")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidateDashboard("/dashboard/admin/growth-toolbox");
  return { ok: true };
}

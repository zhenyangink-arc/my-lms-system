"use server";

import { revalidatePath } from "next/cache";

import {
  getConversationPracticeAccess,
  requireConversationPracticeManager,
} from "@/lib/conversation-practice";
import type { ConversationPracticeActionState } from "./action-state";
import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_DIFFICULTIES,
  CONVERSATION_STATUSES,
  type ConversationCategory,
  type ConversationDifficulty,
  type ConversationStatus,
  type DialogueLine,
  type KeyExpression,
} from "./config";

function result(status: "success" | "error", message: string): ConversationPracticeActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readDialogue(value: FormDataEntryValue | null) {
  const source = lines(value);
  if (source.length > 50) return { error: "示范对话最多填写 50 句。" } as const;

  const dialogue: DialogueLine[] = [];
  for (const [index, line] of source.entries()) {
    const [speaker = "", korean = "", ...chineseParts] = line.split("|").map((part) => part.trim());
    const chinese = chineseParts.join("|").trim();
    if (!speaker || !korean || !chinese) {
      return { error: `示范对话第 ${index + 1} 行格式不正确，请使用“角色｜韩语｜中文”。` } as const;
    }
    if (speaker.length > 30 || korean.length > 300 || chinese.length > 300) {
      return { error: `示范对话第 ${index + 1} 行内容过长。` } as const;
    }
    dialogue.push({ speaker, korean, chinese });
  }
  return { data: dialogue } as const;
}

function readExpressions(value: FormDataEntryValue | null) {
  const source = lines(value);
  if (source.length > 30) return { error: "重点表达最多填写 30 条。" } as const;

  const expressions: KeyExpression[] = [];
  for (const [index, line] of source.entries()) {
    const [korean = "", ...chineseParts] = line.split("|").map((part) => part.trim());
    const chinese = chineseParts.join("|").trim();
    if (!korean || !chinese) {
      return { error: `重点表达第 ${index + 1} 行格式不正确，请使用“韩语｜中文”。` } as const;
    }
    if (korean.length > 300 || chinese.length > 300) {
      return { error: `重点表达第 ${index + 1} 行内容过长。` } as const;
    }
    expressions.push({ korean, chinese });
  }
  return { data: expressions } as const;
}

function readScenarioInput(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "daily").trim();
  const difficulty = String(formData.get("difficulty") ?? "beginner").trim();
  const situation = String(formData.get("situation") ?? "").trim();
  const starterPrompt = String(formData.get("starter_prompt") ?? "").trim();
  const practiceTips = String(formData.get("practice_tips") ?? "").trim();
  const durationMinutes = Number.parseInt(String(formData.get("duration_minutes") ?? "10"), 10);
  const sortOrder = Number.parseInt(String(formData.get("sort_order") ?? "0"), 10);
  const isFeatured = formData.get("is_featured") === "on";
  const objectives = lines(formData.get("learning_objectives"));
  const dialogue = readDialogue(formData.get("sample_dialogue"));
  const expressions = readExpressions(formData.get("key_expressions"));

  if (title.length < 2 || title.length > 100) return { error: "场景标题需要填写 2 至 100 个字。" } as const;
  if (description.length > 500) return { error: "场景简介不能超过 500 个字。" } as const;
  if (situation.length > 1500) return { error: "情景说明不能超过 1500 个字。" } as const;
  if (starterPrompt.length > 1000) return { error: "开场任务不能超过 1000 个字。" } as const;
  if (practiceTips.length > 1500) return { error: "练习提示不能超过 1500 个字。" } as const;
  if (objectives.length > 20 || objectives.some((item) => item.length > 200)) return { error: "学习目标最多 20 条，每条不超过 200 个字。" } as const;
  if (!(CONVERSATION_CATEGORIES as readonly string[]).includes(category)) return { error: "请选择有效的会话分类。" } as const;
  if (!(CONVERSATION_DIFFICULTIES as readonly string[]).includes(difficulty)) return { error: "请选择有效的练习难度。" } as const;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) return { error: "练习时长需要填写 1 至 120 分钟。" } as const;
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return { error: "排序值需要填写 0 至 100000。" } as const;
  if ("error" in dialogue) return dialogue;
  if ("error" in expressions) return expressions;

  return {
    data: {
      p_title: title,
      p_description: description,
      p_category: category as ConversationCategory,
      p_difficulty: difficulty as ConversationDifficulty,
      p_situation: situation,
      p_learning_objectives: objectives,
      p_sample_dialogue: dialogue.data,
      p_key_expressions: expressions.data,
      p_starter_prompt: starterPrompt,
      p_practice_tips: practiceTips,
      p_duration_minutes: durationMinutes,
      p_is_featured: isFeatured,
      p_sort_order: sortOrder,
    },
  } as const;
}

function refreshConversationPractice(scenarioId?: string) {
  revalidatePath("/dashboard/conversation-practice");
  revalidatePath("/dashboard/admin/conversation-practice");
  revalidatePath("/dashboard/admin");
  if (scenarioId) {
    revalidatePath(`/dashboard/conversation-practice/${scenarioId}`);
    revalidatePath(`/dashboard/admin/conversation-practice/${scenarioId}`);
  }
}

export async function createConversationScenarioAction(
  _previousState: ConversationPracticeActionState,
  formData: FormData
): Promise<ConversationPracticeActionState> {
  void _previousState;
  const { supabase } = await requireConversationPracticeManager();
  const input = readScenarioInput(formData);
  if ("error" in input && input.error) return result("error", input.error);
  const intent = String(formData.get("intent") ?? "draft");
  const status: ConversationStatus = intent === "publish" ? "published" : "draft";

  const { data, error } = await supabase.rpc("save_conversation_practice_scenario", {
    p_id: null,
    ...input.data,
    p_status: status,
  });
  if (error || !data) return result("error", "会话场景保存失败，请稍后重试。 ");
  refreshConversationPractice(String(data));
  return result("success", status === "published" ? "会话场景已经发布。" : "会话场景草稿已经保存。");
}

export async function updateConversationScenarioAction(
  scenarioId: string,
  _previousState: ConversationPracticeActionState,
  formData: FormData
): Promise<ConversationPracticeActionState> {
  void _previousState;
  if (!isUuid(scenarioId)) return result("error", "场景编号不正确，请刷新页面重试。");
  const { supabase } = await requireConversationPracticeManager();
  const input = readScenarioInput(formData);
  if ("error" in input && input.error) return result("error", input.error);
  const status = String(formData.get("status") ?? "draft");
  if (!(CONVERSATION_STATUSES as readonly string[]).includes(status)) return result("error", "场景状态不正确。");

  const { data, error } = await supabase.rpc("save_conversation_practice_scenario", {
    p_id: scenarioId,
    ...input.data,
    p_status: status,
  });
  if (error || !data) return result("error", "会话场景修改失败，请确认记录仍然存在。");
  refreshConversationPractice(scenarioId);
  return result("success", "会话场景内容已经更新。");
}

export async function changeConversationScenarioStatusAction(
  scenarioId: string,
  nextStatus: ConversationStatus,
  _previousState: ConversationPracticeActionState,
  _formData: FormData
): Promise<ConversationPracticeActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(scenarioId)) return result("error", "场景编号不正确，请刷新页面重试。");
  if (!(CONVERSATION_STATUSES as readonly string[]).includes(nextStatus)) return result("error", "场景状态不正确。");
  const { supabase } = await requireConversationPracticeManager();
  const { error } = await supabase.rpc("change_conversation_practice_scenario_status", {
    p_scenario_id: scenarioId,
    p_status: nextStatus,
  });
  if (error) return result("error", "场景状态更新失败，请稍后重试。");
  refreshConversationPractice(scenarioId);
  return result("success", nextStatus === "published" ? "场景已经发布。" : nextStatus === "archived" ? "场景已经归档。" : "场景已经转为草稿。");
}

export async function saveConversationPracticeProgressAction(
  scenarioId: string,
  _previousState: ConversationPracticeActionState,
  formData: FormData
): Promise<ConversationPracticeActionState> {
  void _previousState;
  if (!isUuid(scenarioId)) return result("error", "场景编号不正确，请刷新页面重试。");
  const access = await getConversationPracticeAccess();
  if (access.role !== "student") return result("error", "管理账号当前处于学生端预览状态，不能保存练习记录。");
  const confidence = Number.parseInt(String(formData.get("confidence") ?? "0"), 10);
  const reflection = String(formData.get("reflection") ?? "").trim();
  const completed = formData.get("completed") === "on";
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) return result("error", "请选择 1 至 5 级的自信程度。");
  if (reflection.length > 1200) return result("error", "练习复盘不能超过 1200 个字。");

  const { error } = await access.supabase.rpc("record_conversation_practice", {
    p_scenario_id: scenarioId,
    p_confidence: confidence,
    p_reflection: reflection,
    p_completed: completed,
  });
  if (error) return result("error", "练习记录保存失败，请确认场景仍然开放。");
  refreshConversationPractice(scenarioId);
  return result("success", completed ? "本次练习和完成状态已经保存。" : "本次练习记录已经保存。");
}

export async function grantConversationPracticeAdminAction(
  _previousState: ConversationPracticeActionState,
  formData: FormData
): Promise<ConversationPracticeActionState> {
  void _previousState;
  const access = await getConversationPracticeAccess();
  if (!access.canAssignAdmins) return result("error", "只有负责人可以指定会话练习管理员。");
  const adminId = String(formData.get("admin_id") ?? "").trim();
  if (!isUuid(adminId)) return result("error", "请选择需要授权的管理员。");

  const { data: target, error: targetError } = await access.supabase
    .from("profiles")
    .select("id,role,status")
    .eq("id", adminId)
    .maybeSingle();
  if (targetError || !target || target.role !== "admin" || (target.status && target.status !== "active")) {
    return result("error", "只能授权状态正常的管理员账号。");
  }

  const { error } = await access.supabase.from("conversation_practice_admin_assignments").upsert(
    {
      admin_id: adminId,
      granted_by: access.user.id,
      granted_at: new Date().toISOString(),
      revoked_by: null,
      revoked_at: null,
    },
    { onConflict: "admin_id" }
  );
  if (error) return result("error", "管理员授权失败，请稍后重试。");
  refreshConversationPractice();
  return result("success", "该管理员已经获得会话练习后台编辑权限。");
}

export async function revokeConversationPracticeAdminAction(
  adminId: string,
  _previousState: ConversationPracticeActionState,
  _formData: FormData
): Promise<ConversationPracticeActionState> {
  void _previousState;
  void _formData;
  const access = await getConversationPracticeAccess();
  if (!access.canAssignAdmins) return result("error", "只有负责人可以撤销会话练习管理员权限。");
  if (!isUuid(adminId)) return result("error", "管理员编号不正确，请刷新页面重试。");

  const { data, error } = await access.supabase
    .from("conversation_practice_admin_assignments")
    .update({ revoked_by: access.user.id, revoked_at: new Date().toISOString() })
    .eq("admin_id", adminId)
    .is("revoked_at", null)
    .select("admin_id")
    .maybeSingle();
  if (error || !data) return result("error", "管理员权限撤销失败，请刷新页面重试。");
  refreshConversationPractice();
  return result("success", "该管理员的会话练习后台权限已经撤销。");
}

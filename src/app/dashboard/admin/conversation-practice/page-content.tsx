import { MessageCircleMore } from "lucide-react";

import {
  CONVERSATION_CATEGORY_LABELS,
  CONVERSATION_DATE_TIME_OPTIONS,
  CONVERSATION_DIFFICULTY_LABELS,
  CONVERSATION_STATUS_LABELS,
  type ConversationCategory,
  type ConversationDifficulty,
  type ConversationStatus,
  type DialogueLine,
  type KeyExpression,
} from "@/app/dashboard/conversation-practice/config";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireConversationPracticeManager } from "@/lib/conversation-practice";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { ConversationScenarioForm, type ConversationScenarioFormValue } from "./ConversationScenarioForm";
import { ConversationScenarioStatusActions } from "./ConversationScenarioStatusActions";
import { ConversationScenarioTable, type ConversationScenarioTableRow } from "./ConversationScenarioTable";

type ScenarioRow = {
  id: string;
  title: string;
  description: string;
  category: ConversationCategory;
  difficulty: ConversationDifficulty;
  situation: string;
  learning_objectives: unknown;
  sample_dialogue: unknown;
  key_expressions: unknown;
  starter_prompt: string;
  practice_tips: string;
  duration_minutes: number;
  status: ConversationStatus;
  is_featured: boolean;
  sort_order: number;
  updated_at: string;
};

type ProgressRow = {
  scenario_id: string;
  user_id: string;
  status: "practicing" | "completed";
  practice_count: number;
  confidence: number | null;
  reflection: string;
  last_practiced_at: string;
};

type ProfileRow = { id: string; full_name: string | null; email: string | null };

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dialogues(value: unknown): DialogueLine[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is DialogueLine =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as DialogueLine).speaker === "string" &&
          typeof (item as DialogueLine).korean === "string" &&
          typeof (item as DialogueLine).chinese === "string"
      )
    : [];
}

function expressions(value: unknown): KeyExpression[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is KeyExpression =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as KeyExpression).korean === "string" &&
          typeof (item as KeyExpression).chinese === "string"
      )
    : [];
}

function toFormValue(row: ScenarioRow): ConversationScenarioFormValue {
  return {
    ...row,
    learning_objectives: strings(row.learning_objectives),
    sample_dialogue: dialogues(row.sample_dialogue),
    key_expressions: expressions(row.key_expressions),
  };
}

function getCompleteness(row: ScenarioRow) {
  const checks = [
    ["场景简介", Boolean(row.description.trim())],
    ["情景说明", Boolean(row.situation.trim())],
    ["学习目标", strings(row.learning_objectives).length > 0],
    ["示范对话", dialogues(row.sample_dialogue).length > 0],
    ["重点表达", expressions(row.key_expressions).length > 0],
    ["开场任务", Boolean(row.starter_prompt.trim())],
    ["练习提示", Boolean(row.practice_tips.trim())],
  ] as const;
  const missingItems = checks.filter(([, ready]) => !ready).map(([label]) => label);
  return { completeness: Math.round(((checks.length - missingItems.length) / checks.length) * 100), missingItems };
}

function PracticeDataTable({ progress, studentNames }: { progress: ProgressRow[]; studentNames: Map<string, string> }) {
  return (
    <section className="mt-8 border-t pt-6" style={{ borderColor: "var(--app-border)" }}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold">学生练习记录</h3>
          <p className="app-muted-text mt-1 text-[10px]">当前场景共有 {progress.length} 名学生留下练习记录</p>
        </div>
        <span className="app-muted-text font-mono text-[10px]">{progress.length} RESULTS</span>
      </div>
      <div className="overflow-x-auto border-y" style={{ borderColor: "var(--app-border)" }}>
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead>
            <tr className="app-muted-text border-b text-[10px]" style={{ borderColor: "var(--app-border)" }}>
              <th className="px-3 py-2.5 font-medium">学生</th>
              <th className="px-3 py-2.5 font-medium">状态</th>
              <th className="px-3 py-2.5 font-medium">练习次数</th>
              <th className="px-3 py-2.5 font-medium">自信等级</th>
              <th className="px-3 py-2.5 font-medium">最近练习</th>
              <th className="w-[36%] px-3 py-2.5 font-medium">练习复盘</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((item) => (
              <tr key={item.user_id} className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border-soft)" }}>
                <td className="px-3 py-3 font-medium">{studentNames.get(item.user_id) || "学生"}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex rounded-full px-2 py-1 text-[9px] font-medium" style={{ color: item.status === "completed" ? "var(--app-success)" : "var(--app-accent)", backgroundColor: item.status === "completed" ? "var(--app-success-soft)" : "var(--app-accent-soft)" }}>
                    {item.status === "completed" ? "已掌握" : "练习中"}
                  </span>
                </td>
                <td className="app-muted-text px-3 py-3">{item.practice_count} 次</td>
                <td className="app-muted-text px-3 py-3">{item.confidence ? `${item.confidence} / 5` : "未评价"}</td>
                <td className="app-muted-text whitespace-nowrap px-3 py-3 text-[10px]"><LocalDateTime value={item.last_practiced_at} options={CONVERSATION_DATE_TIME_OPTIONS} /></td>
                <td className="app-muted-text px-3 py-3 leading-5">{item.reflection || "—"}</td>
              </tr>
            ))}
            {progress.length === 0 && (
              <tr><td colSpan={6} className="app-muted-text px-4 py-10 text-center text-[11px]">还没有学生练习记录，场景发布后会在这里汇总。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export async function ConversationPracticeManagementContent({
  searchParams,
  studentAppId,
  routeBasePath = "/dashboard/admin/conversation-practice",
}: {
  searchParams: Promise<{ scenario?: string; mode?: string }>;
  studentAppId?: string;
  routeBasePath?: string;
}) {
  const [{ supabase, canManageContent, role, tenantId, user }, params] = await Promise.all([
    requireConversationPracticeManager(),
    searchParams,
  ]);

  // 老师只能看到自己负责学生的练习进度（场景目录仍全部可见）。
  const myStudentIds =
    role === "teacher" && tenantId
      ? new Set(
          await getTeacherAssignedStudentIds(
            supabase,
            tenantId,
            user.id,
            studentAppId,
          ),
        )
      : null;
  let scenariosQuery = supabase
    .from("conversation_practice_scenarios")
    .select("id,title,description,category,difficulty,situation,learning_objectives,sample_dialogue,key_expressions,starter_prompt,practice_tips,duration_minutes,status,is_featured,sort_order,updated_at")
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });
  if (studentAppId) {
    scenariosQuery = scenariosQuery.eq("student_app_id", studentAppId);
  }
  const scenariosResult = await scenariosQuery;

  const scenarios = (scenariosResult.data ?? []) as ScenarioRow[];
  const scenarioIds = scenarios.map((scenario) => scenario.id);
  let progressQuery = supabase
    .from("conversation_practice_progress")
    .select("scenario_id,user_id,status,practice_count,confidence,reflection,last_practiced_at");
  if (tenantId) progressQuery = progressQuery.eq("tenant_id", tenantId);
  if (scenarioIds.length) {
    progressQuery = progressQuery.in("scenario_id", scenarioIds);
  }
  if (myStudentIds) progressQuery = progressQuery.in("user_id", [...myStudentIds]);
  const progressResult = scenarioIds.length
    ? await progressQuery
    : { data: [] as ProgressRow[], error: null };
  const progress = (progressResult.data ?? []) as ProgressRow[];
  const progressByScenario = new Map<string, ProgressRow[]>();
  progress.forEach((item) => {
    const current = progressByScenario.get(item.scenario_id) ?? [];
    current.push(item);
    progressByScenario.set(item.scenario_id, current);
  });

  const selectedRaw = canManageContent ? scenarios.find((item) => item.id === params.scenario) ?? null : null;
  const selectedScenario = selectedRaw ? toFormValue(selectedRaw) : null;
  const selectedProgress = selectedRaw ? progressByScenario.get(selectedRaw.id) ?? [] : [];
  const selectedStudentIds = [...new Set(selectedProgress.map((item) => item.user_id))];
  const { data: selectedProfiles } = selectedStudentIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", selectedStudentIds)
    : { data: [] as ProfileRow[] };
  const studentNames = new Map(
    ((selectedProfiles ?? []) as ProfileRow[]).map((student) => [student.id, student.full_name?.trim() || student.email || "学生"])
  );

  const rows: ConversationScenarioTableRow[] = scenarios.map((scenario) => {
    const scenarioProgress = progressByScenario.get(scenario.id) ?? [];
    const quality = getCompleteness(scenario);
    return {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      category: scenario.category,
      categoryLabel: CONVERSATION_CATEGORY_LABELS[scenario.category],
      difficultyLabel: CONVERSATION_DIFFICULTY_LABELS[scenario.difficulty],
      durationMinutes: scenario.duration_minutes,
      status: scenario.status,
      statusLabel: CONVERSATION_STATUS_LABELS[scenario.status],
      isFeatured: scenario.is_featured,
      studentCount: scenarioProgress.length,
      completedCount: scenarioProgress.filter((item) => item.status === "completed").length,
      practiceCount: scenarioProgress.reduce((sum, item) => sum + item.practice_count, 0),
      completeness: quality.completeness,
      missingItems: quality.missingItems,
      editHref: `${routeBasePath}?scenario=${scenario.id}`,
      active: scenario.id === selectedRaw?.id,
    };
  });

  const createOpen = canManageContent && params.mode === "create";

  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]"><MessageCircleMore size={18} />会话练习管理</h2>
          </div>
        </header>

        {(scenariosResult.error || progressResult.error) && (
          <section className="border-y px-4 py-3 text-[11px] font-medium" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>
            会话练习后台数据暂时无法完整读取，请确认最新数据库迁移已经执行。
          </section>
        )}

        <ConversationScenarioTable
          rows={rows}
          canManage={canManageContent}
          createOpen={createOpen}
          createHref={`${routeBasePath}?mode=create`}
          closeHref={routeBasePath}
        >
          {createOpen ? (
            <ConversationScenarioForm workspace />
          ) : selectedScenario ? (
            <>
              <div className="mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--app-border)" }}>
                <div>
                  <p className="app-muted-text text-[10px]">当前状态</p>
                  <p className="mt-1 text-[12px] font-semibold">{CONVERSATION_STATUS_LABELS[selectedScenario.status]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ConversationScenarioStatusActions id={selectedScenario.id} status={selectedScenario.status} />
                </div>
              </div>
              <ConversationScenarioForm scenario={selectedScenario} workspace />
              <PracticeDataTable progress={selectedProgress} studentNames={studentNames} />
            </>
          ) : null}
        </ConversationScenarioTable>
      </div>
    </div>
  );
}

export default function ConversationPracticeManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; mode?: string }>;
}) {
  return (
    <ConversationPracticeManagementContent searchParams={searchParams} />
  );
}

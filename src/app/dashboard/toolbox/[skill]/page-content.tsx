import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Ear,
  Mic,
  PenTool,
  Shapes,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { ToolboxStudyTimer } from "@/app/dashboard/toolbox/StudyTimer";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import {
  getStudentAppBasePath,
  STUDENT_APP_IDS,
} from "@/lib/student-apps";
import {
  ToolboxPracticeRunner,
  type ToolboxExercise,
  type ToolboxQuestion,
} from "./ToolboxPracticeRunner";

const skillMap: Record<
  string,
  {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    accent: string;
    soft: string;
  }
> = {
  speaking: {
    title: "口语练习",
    subtitle: "情境表达与发音训练",
    icon: Mic,
    accent: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
  },
  grammar: {
    title: "语法练习",
    subtitle: "句式、助词与语言运用",
    icon: Shapes,
    accent: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  listening: {
    title: "听力练习",
    subtitle: "听音辨义与信息理解",
    icon: Ear,
    accent: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
  reading: {
    title: "阅读练习",
    subtitle: "短文理解与信息定位",
    icon: BookOpen,
    accent: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  writing: {
    title: "写作练习",
    subtitle: "从基础句型开始准确表达",
    icon: PenTool,
    accent: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
  },
};

type ExerciseRow = {
  id: string;
  skill: "reading" | "writing";
  title: string;
  description: string;
  instructions: string;
  content_payload: unknown;
};

type QuestionRow = {
  id: string;
  question_type: string;
  prompt: string;
  content_payload: unknown;
  max_score: number | string;
};

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseOptions(value: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const option = objectPayload(item);
    const value = stringValue(option.value);
    const label = stringValue(option.label);
    return value && label ? [{ value, label }] : [];
  });
}

export default async function ToolboxSkillPage({
  params,
}: {
  params: Promise<{ skill: string }>;
}) {
  const { supabase, tenant } = await requireActiveUser();
  const dashboardBasePath = tenant?.slug
    ? getStudentAppBasePath(tenant.slug, "korean")
    : getDashboardBasePath(null);
  const toolboxHref = scopeDashboardPath("/dashboard/toolbox", dashboardBasePath);
  const { skill } = await params;
  const entry = skillMap[skill];
  if (!entry) notFound();

  const Icon = entry.icon;
  const isScoredPractice = skill === "reading" || skill === "writing";

  if (!isScoredPractice) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link
          href={toolboxHref}
          className="app-muted-text inline-flex min-h-11 items-center gap-2 text-xs font-black"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回成长工具箱
        </Link>

        <section
          className="app-card rounded-3xl border p-8 text-center sm:p-10"
          style={{
            background:
              "linear-gradient(145deg, var(--app-card-bg), var(--app-hero-end))",
          }}
        >
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ color: entry.accent, backgroundColor: entry.soft }}
          >
            <Icon size={26} aria-hidden="true" />
          </span>
          <DashboardTitleWithHint
            className="mt-4"
            headingLevel={1}
            title={`${entry.title} · 即将上线`}
            description="练习数据框架已经统一，题库与专项交互正在准备中。上线后的结果会独立进入成长工具箱能力画像。"
          />
        </section>
      </div>
    );
  }

  const { data: exerciseData } = await withStudentAppSchemaFallback(
    supabase
      .from("growth_toolbox_exercises")
      .select("id,skill,title,description,instructions,content_payload")
      .eq("skill", skill)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    () =>
      supabase
        .from("growth_toolbox_exercises")
        .select("id,skill,title,description,instructions,content_payload")
        .eq("skill", skill)
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
  );
  const exerciseRow = exerciseData as ExerciseRow | null;

  const { data: questionData } = exerciseRow
    ? await supabase
        .from("growth_toolbox_questions")
        .select("id,question_type,prompt,content_payload,max_score")
        .eq("exercise_id", exerciseRow.id)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const exercisePayload = objectPayload(exerciseRow?.content_payload);
  const exercise: ToolboxExercise | null = exerciseRow
    ? {
        id: exerciseRow.id,
        skill: exerciseRow.skill,
        title: exerciseRow.title,
        description: exerciseRow.description,
        instructions: exerciseRow.instructions,
        passageTitle: stringValue(exercisePayload.passageTitle),
        passage: stringValue(exercisePayload.passage),
        helper: stringValue(exercisePayload.helper),
      }
    : null;
  const questions: ToolboxQuestion[] = ((questionData ?? []) as QuestionRow[])
    .filter(
      (question) =>
        question.question_type === "single_choice" ||
        question.question_type === "true_false" ||
        question.question_type === "short_text",
    )
    .map((question) => {
      const payload = objectPayload(question.content_payload);
      return {
        id: question.id,
        questionType: question.question_type as ToolboxQuestion["questionType"],
        prompt: question.prompt,
        options: parseOptions(payload.options),
        hint: stringValue(payload.hint),
        maxScore: Number(question.max_score) || 0,
      };
    });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {exercise && questions.length > 0 && <ToolboxStudyTimer skill={skill} />}
      <Link
        href={toolboxHref}
        className="app-muted-text inline-flex min-h-11 items-center gap-2 text-xs font-black"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        返回成长工具箱
      </Link>

      <section
        className="relative overflow-hidden rounded-[2rem] border p-6 sm:p-8"
        style={{
          borderColor: "var(--app-border)",
          background:
            "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg) 52%, var(--app-accent-soft))",
        }}
      >
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ color: entry.accent, backgroundColor: entry.soft }}
            >
              <Icon size={26} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-black tracking-[0.14em]" style={{ color: entry.accent }}>
                {entry.subtitle}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                {exercise?.title ?? entry.title}
              </h1>
              <p className="app-muted-text mt-1 max-w-2xl text-xs font-bold leading-5">
                {exercise?.description ?? "练习内容正在准备中。"}
              </p>
            </div>
          </div>
          {exercise && (
            <span className="rounded-full px-3 py-2 text-[10px] font-black" style={{ color: entry.accent, backgroundColor: entry.soft }}>
              {questions.length} 题 · 服务端评分
            </span>
          )}
        </div>
        {exercise?.instructions && (
          <p className="relative mt-5 rounded-2xl px-4 py-3 text-xs font-bold leading-5" style={{ backgroundColor: entry.soft }}>
            {exercise.instructions}
          </p>
        )}
      </section>

      {!exercise || questions.length === 0 ? (
        <section className="app-soft-card flex min-h-56 flex-col items-center justify-center rounded-[2rem] border p-8 text-center">
          <Icon size={28} className="opacity-40" aria-hidden="true" />
          <h2 className="mt-3 text-base font-black">练习题库尚未部署</h2>
          <p className="app-muted-text mt-2 max-w-md text-xs font-bold leading-5">
            数据库迁移部署完成后，这里会自动显示第一组正式练习。
          </p>
        </section>
      ) : (
        <ToolboxPracticeRunner
          exercise={exercise}
          questions={questions}
          backHref={toolboxHref}
          accent={entry.accent}
          soft={entry.soft}
        />
      )}
    </div>
  );
}

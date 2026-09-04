import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  languageSkillOrder,
  languageSkillPresentation,
  type LanguageSkill,
} from "@/components/analytics/SixDimensionRadar";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

const TREND_MONTH_COUNT = 6;
const DAY_MS = 86_400_000;

export type AbilitySkillTier = "优势项" | "良好" | "中等" | "待提升";

export type AbilityPortraitSkill = {
  skill: LanguageSkill;
  value: number | null;
  evidenceCount: number;
  activityCount: number;
  tier: AbilitySkillTier | null;
  description: string;
};

export type AbilityPortraitTrendSeries = {
  skill: LanguageSkill;
  values: Array<number | null>;
};

export type AbilityPortraitConfidence = {
  homeworkCount: number;
  examCount: number;
  aiSpeakingCount: number;
  practiceSessionCount: number;
  totalEvidence: number;
  levelLabel: "高可信度" | "中等可信度" | "积累中";
  stars: number;
};

export type AbilityPortraitInsightItem = {
  skill: LanguageSkill;
  label: string;
  description: string;
};

export type AbilityPortraitInsight = {
  overallScore: number | null;
  grade: string;
  levelLabel: string;
  strongestLabel: string | null;
  weakestLabel: string | null;
  directionLabel: string;
  suggestion: string;
  updatedAtLabel: string;
  strengths: AbilityPortraitInsightItem[];
  improvements: AbilityPortraitInsightItem[];
  growthSuggestions: string[];
};

export type AbilityPortraitUniversityTarget = {
  universityName: string;
  programName: string | null;
  statusLabel: string;
  daysRemaining: number | null;
};

export type AbilityPortraitData = {
  skills: AbilityPortraitSkill[];
  insight: AbilityPortraitInsight;
  trend: { months: string[]; series: AbilityPortraitTrendSeries[] };
  confidence: AbilityPortraitConfidence;
  universityTarget: AbilityPortraitUniversityTarget | null;
};

type ToolboxProfileRow = {
  skill: LanguageSkill;
  ability_score: number | string | null;
  valid_sessions: number | string;
  valid_attempts: number | string;
};

type GradeSkillProfileRow = {
  grade_category: "homework" | "exam";
  skill: LanguageSkill;
  percentage: number | string | null;
  earned_points: number | string;
  total_points: number | string;
  question_count: number | string;
  assessment_count: number | string;
};

type PracticeSessionRow = {
  skill: LanguageSkill;
  completed_at: string;
  earned_score: number | string;
  max_score: number | string;
};

type UniversityTargetRow = {
  university_name: string;
  program_name: string | null;
  status: string;
  priority: number;
  application_deadline: string | null;
};

const universityTargetStatusLabels: Record<string, string> = {
  researching: "了解中",
  preparing: "准备材料",
  applied: "已申请",
  interview: "面试中",
  offer: "已录取",
  rejected: "未通过",
  paused: "已暂停",
};

const overallLevelBuckets: Array<[number, string]> = [
  [90, "优秀"],
  [75, "中上"],
  [60, "中等"],
  [40, "基础"],
];

const gradeBuckets: Array<[number, string]> = [
  [93, "A"],
  [90, "A-"],
  [87, "B+"],
  [83, "B"],
  [80, "B-"],
  [77, "C+"],
  [70, "C"],
  [60, "D"],
];

const skillTierBands: Array<[number, AbilitySkillTier]> = [
  [80, "优势项"],
  [65, "良好"],
  [50, "中等"],
];

const skillTierDescriptions: Record<LanguageSkill, Record<AbilitySkillTier, string>> = {
  listening: {
    优势项: "能够流畅理解各类对话与讲座内容",
    良好: "可以听懂大部分日常对话，长难句稍弱",
    中等: "基础听力尚可，语速较快时理解下降",
    待提升: "听力理解偏弱，建议从精听训练入手",
  },
  speaking: {
    优势项: "表达流畅自然，发音清晰准确",
    良好: "能进行日常对话，发音基本准确",
    中等: "能完成简单表达，流利度有待加强",
    待提升: "口语输出较少，建议增加开口练习",
  },
  reading: {
    优势项: "能理解主旨与细节，阅读速度稳定",
    良好: "能读懂大部分文本，速度中等",
    中等: "基础阅读没问题，长文本理解偏慢",
    待提升: "阅读理解薄弱，建议从短文精读开始",
  },
  writing: {
    优势项: "表达逻辑清晰，句式运用灵活",
    良好: "能完整表达意思，逻辑仍可优化",
    中等: "表达逻辑与结构有待加强",
    待提升: "写作输出较少，建议从造句练习开始",
  },
  grammar: {
    优势项: "语法运用准确，复杂结构掌握扎实",
    良好: "语法基础扎实，复杂句式偶有失误",
    中等: "基础语法尚可，复杂结构仍需巩固",
    待提升: "语法薄弱，建议从基础句型开始梳理",
  },
  vocabulary: {
    优势项: "词汇量充足，语境搭配运用自如",
    良好: "词汇量良好，基础扎实",
    中等: "词汇量中等，需提升运用广度",
    待提升: "词汇积累不足，建议加强高频词记忆",
  },
};

const skillActionSuggestions: Record<LanguageSkill, string> = {
  listening: "多接触真实语速的听力材料，逐步适应更高难度",
  speaking: "增加口语开口频率，多做情境对话练习",
  reading: "扩大阅读量，从短文精读过渡到长文泛读",
  writing: "加强写作结构训练，提升逻辑表达能力",
  grammar: "针对语法薄弱点，进行专项练习",
  vocabulary: "扩大词汇量，加强语境搭配的运用",
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function overallLevelLabel(score: number | null): string {
  if (score == null) return "积累中";
  for (const [threshold, label] of overallLevelBuckets) {
    if (score >= threshold) return label;
  }
  return "入门";
}

function scoreToGrade(score: number | null): string {
  if (score == null) return "—";
  for (const [threshold, grade] of gradeBuckets) {
    if (score >= threshold) return grade;
  }
  return "F";
}

function tierForScore(score: number): AbilitySkillTier {
  for (const [threshold, tier] of skillTierBands) {
    if (score >= threshold) return tier;
  }
  return "待提升";
}

function monthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return `${month}月`;
}

function formatUpdatedAt(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\//g, "-");
}

export async function loadAbilityPortrait({
  supabase,
  tenantId,
  studentId,
  now,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  now: Date;
}): Promise<AbilityPortraitData> {
  const trendSince = new Date(now.getTime() - 183 * DAY_MS).toISOString();

  const [
    toolboxResult,
    gradeResult,
    sessionsResult,
    aiSpeakingCountResult,
    universityTargetResult,
  ] = await Promise.all([
    withStudentAppSchemaFallback(
      supabase
        .from("student_toolbox_skill_profiles")
        .select("skill,ability_score,valid_sessions,valid_attempts")
        .eq("student_id", studentId)
        .eq("student_app_id", STUDENT_APP_IDS.korean),
      () =>
        supabase
          .from("student_toolbox_skill_profiles")
          .select("skill,ability_score,valid_sessions,valid_attempts")
          .eq("student_id", studentId),
    ),
    withStudentAppSchemaFallback(
      supabase
        .from("student_grade_skill_profiles")
        .select(
          "grade_category,skill,percentage,earned_points,total_points,question_count,assessment_count",
        )
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .eq("student_app_id", STUDENT_APP_IDS.korean),
      () =>
        supabase
          .from("student_grade_skill_profiles")
          .select(
            "grade_category,skill,percentage,earned_points,total_points,question_count,assessment_count",
          )
          .eq("tenant_id", tenantId)
          .eq("student_id", studentId),
    ),
    supabase
      .from("toolbox_practice_sessions")
      .select("skill,completed_at,earned_score,max_score")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .gte("completed_at", trendSince)
      .order("completed_at", { ascending: true }),
    supabase
      .from("toolbox_practice_attempts")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("skill", "speaking")
      .eq("evaluated_by", "ai"),
    supabase
      .from("student_university_targets")
      .select("university_name,program_name,status,priority,application_deadline")
      .eq("user_id", studentId)
      .order("priority", { ascending: false })
      .order("application_deadline", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const toolboxBySkill = new Map(
    ((toolboxResult.data ?? []) as ToolboxProfileRow[]).map((row) => [
      row.skill,
      row,
    ]),
  );
  const gradeRows = (gradeResult.data ?? []) as GradeSkillProfileRow[];
  const homeworkBySkill = new Map(
    gradeRows
      .filter((row) => row.grade_category === "homework")
      .map((row) => [row.skill, row]),
  );
  const examBySkill = new Map(
    gradeRows
      .filter((row) => row.grade_category === "exam")
      .map((row) => [row.skill, row]),
  );

  const skills: AbilityPortraitSkill[] = languageSkillOrder.map((skill) => {
    const toolbox = toolboxBySkill.get(skill);
    const homework = homeworkBySkill.get(skill);
    const exam = examBySkill.get(skill);
    const values = [
      toolbox?.ability_score,
      homework?.percentage,
      exam?.percentage,
    ]
      .map((value) => (value == null ? null : Number(value)))
      .filter((value): value is number => value != null);
    const evidenceCount =
      (Number(toolbox?.valid_attempts) || 0) +
      (Number(homework?.question_count) || 0) +
      (Number(exam?.question_count) || 0);
    const activityCount =
      (Number(toolbox?.valid_sessions) || 0) +
      (Number(homework?.assessment_count) || 0) +
      (Number(exam?.assessment_count) || 0);
    const value = average(values);
    const tier = value == null ? null : tierForScore(value);

    return {
      skill,
      value,
      evidenceCount,
      activityCount,
      tier,
      description: tier ? skillTierDescriptions[skill][tier] : "暂无有效数据",
    };
  });

  const availableSkills = skills.filter((item) => item.value != null);
  const overallScore = average(
    availableSkills.map((item) => item.value as number),
  );
  const sortedByValue = [...availableSkills].sort(
    (a, b) => (b.value as number) - (a.value as number),
  );
  const strongest = sortedByValue[0] ?? null;
  const weakest = sortedByValue.at(-1) ?? null;
  const strengths = sortedByValue.slice(0, 2).map((item) => ({
    skill: item.skill,
    label: languageSkillPresentation[item.skill].fullLabel,
    description: item.description,
  }));
  const strengthSkillSet = new Set(strengths.map((item) => item.skill));
  const improvements = [...sortedByValue]
    .reverse()
    .filter((item) => !strengthSkillSet.has(item.skill))
    .slice(0, 2)
    .map((item) => ({
      skill: item.skill,
      label: languageSkillPresentation[item.skill].fullLabel,
      description: item.description,
    }));
  const growthSuggestions: string[] = [];
  const weakestTwo = [...sortedByValue].reverse().slice(0, 2);
  for (const item of weakestTwo) {
    growthSuggestions.push(
      `${languageSkillPresentation[item.skill].fullLabel}：${skillActionSuggestions[item.skill]}`,
    );
  }
  if (strongest && !weakestTwo.some((item) => item.skill === strongest.skill)) {
    growthSuggestions.push(
      `保持${languageSkillPresentation[strongest.skill].fullLabel}优势，尝试更高难度内容`,
    );
  }

  const insight: AbilityPortraitInsight = {
    overallScore: overallScore == null ? null : Math.round(overallScore),
    grade: scoreToGrade(overallScore),
    levelLabel: overallLevelLabel(overallScore),
    strongestLabel: strongest
      ? languageSkillPresentation[strongest.skill].fullLabel
      : null,
    weakestLabel: weakest
      ? languageSkillPresentation[weakest.skill].fullLabel
      : null,
    directionLabel:
      strongest && weakest && strongest.skill !== weakest.skill
        ? `优先提升${languageSkillPresentation[weakest.skill].fullLabel}`
        : availableSkills.length > 0
          ? "保持均衡练习"
          : "先积累学习数据",
    suggestion:
      strongest && weakest && strongest.skill !== weakest.skill
        ? `${languageSkillPresentation[strongest.skill].fullLabel}是目前的强项，建议优先加强${languageSkillPresentation[weakest.skill].fullLabel}的针对性训练，逐步缩小六维差距。`
        : availableSkills.length > 0
          ? "各维度数据还比较接近，继续保持均衡练习即可看到更清晰的强弱项对比。"
          : "还没有足够的作业、测试或专项练习数据，完成学习后这里会自动生成能力解读。",
    updatedAtLabel: formatUpdatedAt(now),
    strengths,
    improvements,
    growthSuggestions,
  };

  const practiceSessions = (sessionsResult.data ?? []) as PracticeSessionRow[];
  const months: string[] = [];
  for (let offset = TREND_MONTH_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime());
    date.setMonth(date.getMonth() - offset);
    const key = monthKey(date);
    if (!months.includes(key)) months.push(key);
  }
  const monthSet = new Set(months);
  const bucket = new Map<string, Map<LanguageSkill, { earned: number; max: number }>>();
  for (const session of practiceSessions) {
    const key = monthKey(new Date(session.completed_at));
    if (!monthSet.has(key)) continue;
    const monthBucket = bucket.get(key) ?? new Map<LanguageSkill, { earned: number; max: number }>();
    const current = monthBucket.get(session.skill) ?? { earned: 0, max: 0 };
    current.earned += Number(session.earned_score) || 0;
    current.max += Number(session.max_score) || 0;
    monthBucket.set(session.skill, current);
    bucket.set(key, monthBucket);
  }
  const trend = {
    months: months.map(monthLabel),
    series: languageSkillOrder.map((skill) => ({
      skill,
      values: months.map((month) => {
        const totals = bucket.get(month)?.get(skill);
        if (!totals || totals.max <= 0) return null;
        return Math.round((totals.earned / totals.max) * 1000) / 10;
      }),
    })),
  };

  const homeworkCount = gradeRows
    .filter((row) => row.grade_category === "homework")
    .reduce((sum, row) => sum + (Number(row.assessment_count) || 0), 0);
  const examCount = gradeRows
    .filter((row) => row.grade_category === "exam")
    .reduce((sum, row) => sum + (Number(row.assessment_count) || 0), 0);
  const aiSpeakingCount = aiSpeakingCountResult.count ?? 0;
  const practiceSessionCount = practiceSessions.length;
  const totalEvidence =
    homeworkCount + examCount + aiSpeakingCount + practiceSessionCount;
  const confidence: AbilityPortraitConfidence = {
    homeworkCount,
    examCount,
    aiSpeakingCount,
    practiceSessionCount,
    totalEvidence,
    levelLabel:
      totalEvidence >= 15 ? "高可信度" : totalEvidence >= 6 ? "中等可信度" : "积累中",
    stars: Math.max(1, Math.min(5, Math.round(totalEvidence / 4) || 1)),
  };

  const targetRow = universityTargetResult.data as UniversityTargetRow | null;
  const universityTarget: AbilityPortraitUniversityTarget | null = targetRow
    ? {
        universityName: targetRow.university_name,
        programName: targetRow.program_name,
        statusLabel:
          universityTargetStatusLabels[targetRow.status] ?? targetRow.status,
        daysRemaining: (() => {
          if (!targetRow.application_deadline) return null;
          const remaining = Math.ceil(
            (new Date(targetRow.application_deadline).getTime() -
              now.getTime()) /
              DAY_MS,
          );
          return remaining >= 0 ? remaining : null;
        })(),
      }
    : null;

  return { skills, insight, trend, confidence, universityTarget };
}

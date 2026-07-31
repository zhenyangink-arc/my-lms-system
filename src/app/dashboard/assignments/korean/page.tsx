import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Languages,
  Lock,
  XCircle,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { isPlatformTenantManagerRole } from "@/lib/admin";
import { requireAssignmentViewer } from "@/lib/learning-assignments";
import { getUnlockedKoreanTestSlugs } from "@/lib/korean-learning-unlocks";
import type { CourseTestRow } from "@/lib/korean-chapter-tests";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChapterTestSectionCard } from "./ChapterTestSectionCard";

type TestAttemptRow = {
  test_slug: string;
  score: number;
  passed: boolean;
};

const levelOneUnits = [
  ["01", "안녕하세요?", "你好？"],
  ["02", "이거는 뭐예요?", "这是什么？"],
  ["03", "한국어를 공부해요.", "我学习韩语。"],
  ["04", "어디에 있어요?", "在哪里？"],
  ["05", "주말에 친구를 만났어요.", "周末见了朋友。"],
  ["06", "얼마예요?", "多少钱？"],
  ["07", "날씨가 어때요?", "天气怎么样？"],
  ["08", "영화 볼까요?", "去看电影好吗？"],
  ["09", "이분은 누구세요?", "这位是谁？"],
  ["10", "지금 몇 시예요?", "现在几点？"],
  ["11", "감기에 걸렸어요.", "感冒了。"],
  ["12", "여보세요.", "喂。"],
  ["13", "서울역으로 가 주세요.", "请带我去首尔站。"],
  ["14", "이 옷을 입어 보세요.", "请试穿这件衣服。"],
  ["15", "여행을 가고 싶어요.", "我想去旅行。"],
  ["16", "우리 집에 올 수 있어요?", "你能来我家吗？"],
] as const;

export default async function KoreanAssignmentTestsPage() {
  const { supabase, user, role, isManager } = await requireAssignmentViewer();
  const admin = createAdminClient();
  const [{ data: testData }, { data: testQuestionData }] = await Promise.all([
    admin
      .from("course_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
      )
      .in("course_key", ["hangul-introduction", "korean-level-one"])
      .eq("status", "published")
      .order("chapter_number", { ascending: true }),
    admin
      .from("course_test_questions")
      .select("test_id")
      .eq("status", "published")
      .eq("question_type", "single_choice")
      .eq("is_chapter_test_item", true),
  ]);
  const questionCountByTestId = new Map<string, number>();
  for (const question of testQuestionData ?? []) {
    const testId = String(question.test_id);
    questionCountByTestId.set(
      testId,
      (questionCountByTestId.get(testId) ?? 0) + 1
    );
  }
  const allChapterTests = ((testData ?? []) as CourseTestRow[]).map((test) => ({
    ...test,
    questionCount: questionCountByTestId.get(test.id) ?? 0,
  }));
  const hangulTests = allChapterTests.filter(
    (test) => test.course_key === "hangul-introduction"
  );
  const levelOneTests = allChapterTests.filter(
    (test) => test.course_key === "korean-level-one"
  );
  const levelOneTestByChapter = new Map(
    levelOneTests.map((test) => [test.chapter_number, test])
  );
  const { data: testAttemptData } =
    allChapterTests.length
      ? await supabase
          .from("course_test_attempts")
          .select("test_slug,score,passed")
          .eq("student_id", user.id)
          .in(
            "test_slug",
            allChapterTests.map((test) => test.slug)
          )
      : { data: [] as TestAttemptRow[] };
  const attemptByTestSlug = new Map(
    ((testAttemptData ?? []) as TestAttemptRow[]).map((attempt) => [
      attempt.test_slug,
      attempt,
    ])
  );
  const unlockedTestSlugs = getUnlockedKoreanTestSlugs(
    attemptByTestSlug.keys()
  );
  if (isPlatformTenantManagerRole(role)) {
    for (const test of allChapterTests) unlockedTestSlugs.add(test.slug);
  }
  const openedLevelOneCount = levelOneTests.filter((test) =>
    unlockedTestSlugs.has(test.slug)
  ).length;
  const availableTestCount = allChapterTests.filter((test) =>
    unlockedTestSlugs.has(test.slug)
  ).length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/assignments#chapter-tests"
          className="app-muted-text inline-flex items-center gap-2 text-xs font-black"
        >
          <ArrowLeft size={14} />
          返回学习任务
        </Link>

        <section
          className="app-card overflow-hidden rounded-3xl border p-5 sm:p-7"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-accent-soft), var(--app-secondary-soft))",
          }}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <Languages size={15} />
                课程章节测试
              </span>
              <DashboardTitleWithHint
                className="mt-4"
                titleClassName="text-3xl font-black tracking-tight"
                title="学完一章，马上检验自己是否真正掌握"
                description="章节测试跟随“我的课程”的学习进度自动开放，不需要老师单独布置，也没有作业截止时间。完成测试后可以复习薄弱知识点，再继续下一章。"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["学习线路", "3"],
                ["1级章节", "16"],
                ["可测试", String(availableTestCount)],
              ].map(([label, value]) => (
                <div key={label} className="app-card rounded-2xl border p-4 text-center">
                  <p className="text-2xl font-black">{value}</p>
                  <p className="app-muted-text mt-1 text-[11px] font-black">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ChapterTestSectionCard
          eyebrow="路线 01 · 字母启蒙"
          title="韩语字母入门"
          description="四章测试已经独立设计，建议学完对应章节后进入；可以反复练习，系统保留最近一次成绩。"
          meta={`${hangulTests.length} 章`}
          accentColor="var(--app-warm)"
        >
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {hangulTests.map((test) => {
              const isUnlocked = unlockedTestSlugs.has(test.slug);
              const attempt = isUnlocked
                ? attemptByTestSlug.get(test.slug)
                : undefined;
              const cardContent = (
                <>
                  <div className="min-w-0 p-2.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[8px] font-black"
                      style={{
                        color: "var(--app-accent)",
                        backgroundColor: "var(--app-accent-soft)",
                      }}
                    >
                      CHAPTER {String(test.chapter_number).padStart(2, "0")}
                    </span>
                    <h3 className="mt-1.5 text-[10px] font-black leading-[14px]">
                      {test.title}
                    </h3>
                    <p className="app-muted-text mt-0.5 text-[9px] leading-3">
                      {test.korean_title}
                    </p>
                    <p className="app-muted-text mt-1.5 text-[8px] font-bold leading-3">
                      {!isUnlocked
                        ? "完成上一章测试后开放"
                        : attempt
                        ? `${attempt.passed ? "已通过" : "未达掌握线"} · 掌握线 ${test.passing_score} 分`
                        : `${test.questionCount} 题 · 掌握线 ${test.passing_score} 分`}
                    </p>
                    {isUnlocked && (
                      <span
                        className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-black leading-3"
                        style={{ color: "var(--app-secondary)" }}
                      >
                        {attempt ? "重新测试" : "开始测试"}
                        <ArrowRight size={11} />
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center justify-center border-l p-2 text-center"
                    style={{
                      borderColor: attempt
                        ? attempt.passed
                          ? "var(--app-success)"
                          : "var(--app-warm)"
                        : "var(--app-border-soft)",
                      backgroundColor: attempt
                        ? attempt.passed
                          ? "var(--app-success-soft)"
                          : "var(--app-warm-soft)"
                        : "var(--app-card-bg)",
                    }}
                  >
                    {!isUnlocked ? (
                      <span className="app-muted-text inline-flex flex-col items-center gap-1 text-[8px] font-black">
                        <Lock size={14} />
                        未开放
                      </span>
                    ) : attempt ? (
                      <span
                        className="inline-flex flex-col items-center gap-1 text-[9px] font-black"
                        style={{
                          color: attempt.passed
                            ? "var(--app-success)"
                            : "var(--app-warm)",
                        }}
                      >
                        {attempt.passed ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <XCircle size={14} />
                        )}
                        {attempt.score} 分
                      </span>
                    ) : (
                      <span
                        className="app-muted-text inline-flex flex-col items-center gap-1 text-[8px] font-black"
                      >
                        <CircleDashed size={14} />
                        未测试
                      </span>
                    )}
                  </div>
                </>
              );
              const cardStyle = {
                background: attempt
                  ? attempt.passed
                    ? "linear-gradient(135deg, var(--app-card-bg), var(--app-success-soft))"
                    : "linear-gradient(135deg, var(--app-card-bg), var(--app-warm-soft))"
                  : "linear-gradient(135deg, var(--app-card-bg), var(--app-secondary-soft))",
                borderColor: attempt
                  ? attempt.passed
                    ? "var(--app-success)"
                    : "var(--app-warm)"
                  : "var(--app-border-soft)",
              };
              return isUnlocked ? (
                <Link
                  key={test.slug}
                  href={`/dashboard/assignments/korean/${test.slug}`}
                  className="app-soft-card group grid grid-cols-[minmax(0,1fr)_68px] overflow-hidden rounded-xl border transition hover:-translate-y-0.5 hover:shadow-md"
                  style={cardStyle}
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={test.slug}
                  className="app-soft-card grid grid-cols-[minmax(0,1fr)_68px] overflow-hidden rounded-xl border opacity-75"
                  style={cardStyle}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </ChapterTestSectionCard>

        <ChapterTestSectionCard
          eyebrow="路线 02 · 基础表达"
          title="韩国语1级"
          description="依照1A＋1B的16课进度，逐课开放配套测试。"
          meta={`已开放 ${openedLevelOneCount}／16`}
          accentColor="var(--app-accent)"
        >
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {levelOneUnits.map(([number, korean, chinese]) => {
              const test = levelOneTestByChapter.get(Number(number));
              const isUnlocked = Boolean(
                test && unlockedTestSlugs.has(test.slug)
              );
              const attempt = test && isUnlocked
                ? attemptByTestSlug.get(test.slug)
                : undefined;
              const passed = attempt?.passed === true;
              const failed = Boolean(attempt) && !passed;
              const statusColor = passed
                ? "var(--app-success)"
                : failed
                  ? "var(--app-warm)"
                  : "var(--app-muted)";
              const statusSoft = passed
                ? "var(--app-success-soft)"
                : failed
                  ? "var(--app-warm-soft)"
                  : "var(--app-card-bg)";
              const cardContent = (
                <>
                  <div className="min-w-0 p-2.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[8px] font-black"
                      style={{
                        color: "var(--app-accent)",
                        backgroundColor: "var(--app-accent-soft)",
                      }}
                    >
                      第{number}课
                    </span>
                    <h3 className="mt-1.5 text-[10px] font-black leading-[14px]">
                      {korean}
                    </h3>
                    <p className="app-muted-text mt-0.5 text-[9px] leading-3">
                      {chinese}
                    </p>
                    <p className="app-muted-text mt-1.5 text-[8px] font-bold leading-3">
                      {!isUnlocked
                        ? "完成上一章测试后开放"
                        : test
                          ? attempt
                            ? `${passed ? "已通过" : "未通过"} · 掌握线 ${test.passing_score} 分`
                            : `${test.questionCount} 题 · 掌握线 ${test.passing_score} 分`
                          : "课程题库准备中"}
                    </p>
                    {test && isUnlocked && (
                      <span
                        className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-black leading-3"
                        style={{ color: "var(--app-secondary)" }}
                      >
                        {attempt ? "重新测试" : "开始测试"}
                        <ArrowRight size={11} />
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center justify-center border-l p-2 text-center"
                    style={{
                      color: statusColor,
                      borderColor: passed
                        ? "var(--app-success)"
                        : failed
                          ? "var(--app-warm)"
                          : "var(--app-border-soft)",
                      backgroundColor: statusSoft,
                    }}
                  >
                    <span className="inline-flex flex-col items-center gap-1 text-[8px] font-black">
                      {!isUnlocked ? (
                        <Lock size={14} />
                      ) : passed ? (
                        <CheckCircle2 size={14} />
                      ) : failed ? (
                        <XCircle size={14} />
                      ) : (
                        <CircleDashed size={14} />
                      )}
                      {!isUnlocked
                        ? "未开放"
                        : !test
                          ? "准备中"
                          : attempt
                            ? `${attempt.score} 分`
                            : "未测试"}
                    </span>
                  </div>
                </>
              );
              const cardStyle = {
                background: passed
                  ? "linear-gradient(135deg, var(--app-card-bg), var(--app-success-soft))"
                  : failed
                    ? "linear-gradient(135deg, var(--app-card-bg), var(--app-warm-soft))"
                    : "linear-gradient(135deg, var(--app-card-bg), var(--app-secondary-soft))",
                borderColor: passed
                  ? "var(--app-success)"
                  : failed
                    ? "var(--app-warm)"
                    : "var(--app-border-soft)",
              };
              return test && isUnlocked ? (
                <Link
                  key={number}
                  href={`/dashboard/assignments/korean/${test.slug}`}
                  className="app-soft-card group grid grid-cols-[minmax(0,1fr)_68px] overflow-hidden rounded-xl border transition hover:-translate-y-0.5 hover:shadow-md"
                  style={cardStyle}
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={number}
                  className="app-soft-card grid grid-cols-[minmax(0,1fr)_68px] overflow-hidden rounded-xl border opacity-75"
                  style={cardStyle}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </ChapterTestSectionCard>

        <section
          className="rounded-3xl border border-dashed p-5 sm:p-6"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-soft-bg)",
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-success)",
                backgroundColor: "var(--app-success-soft)",
              }}
            >
              <BookOpenCheck size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black" style={{ color: "var(--app-success)" }}>
                路线 03 · 能力进阶
              </p>
              <DashboardTitleWithHint
                className="mt-1"
                headingLevel={2}
                titleClassName="font-black"
                title="韩国语2级测试线路"
                description="待韩国语2级课程章节完成后，再按相同结构逐章开放。"
              />
            </div>
            {isManager && (
              <Link
                href="/dashboard/admin/courses"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white"
                style={{ backgroundColor: "var(--app-secondary)" }}
              >
                进入课程内容管理
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
